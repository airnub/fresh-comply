import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabaseClient, calculateAckDeadline, calculateResolutionDeadline, isDsrRequestType } from "@airnub/utils";
import type { TablesInsert } from "@airnub/types";
import { sendDsrAcknowledgement } from "@airnub/notifications";
import { annotateSpan, extractRunMetadataFromHeaders, setHttpAttributes, withTelemetrySpan } from "@airnub/utils/telemetry";

const ROUTE = "/api/dsr/[type]";

type IncomingDsrPayload = {
  tenantOrgId: string;
  subjectOrgId?: string;
  requesterEmail: string;
  requesterName?: string;
  assigneeUserId?: string;
  assigneeEmail?: string;
  metadata?: Record<string, unknown>;
};

type ErrorBody = { error: string };

function normalizePayload(raw: unknown): IncomingDsrPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const tenantOrgId = typeof value.tenantOrgId === "string" ? value.tenantOrgId : null;
  const subjectOrgId = typeof value.subjectOrgId === "string" ? value.subjectOrgId : undefined;
  const requesterEmail = typeof value.requesterEmail === "string" ? value.requesterEmail : null;
  const requesterName = typeof value.requesterName === "string" ? value.requesterName : undefined;
  const assigneeUserId = typeof value.assigneeUserId === "string" ? value.assigneeUserId : undefined;
  const assigneeEmail = typeof value.assigneeEmail === "string" ? value.assigneeEmail : undefined;
  const metadata = typeof value.metadata === "object" && value.metadata !== null ? (value.metadata as Record<string, unknown>) : undefined;

  if (!tenantOrgId || !requesterEmail) {
    return null;
  }

  return {
    tenantOrgId,
    subjectOrgId,
    requesterEmail,
    requesterName,
    assigneeUserId,
    assigneeEmail,
    metadata
  };
}

export async function POST(request: NextRequest, { params }: { params: { type: string } }) {
  const headerMetadata = extractRunMetadataFromHeaders(request.headers);

  return withTelemetrySpan(`POST ${ROUTE}`, {
    runId: headerMetadata.runId,
    stepId: headerMetadata.stepId,
    attributes: {
      "http.request.method": "POST",
      "http.route": ROUTE
    }
  }, async (span) => {
    const type = params.type?.toLowerCase() ?? "";
    if (!isDsrRequestType(type)) {
      const response = NextResponse.json({ error: "Unsupported request type" } satisfies ErrorBody, { status: 404 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    const parsedBody = await request.json().catch(() => null);
    const input = normalizePayload(parsedBody);

    if (!input) {
      const response = NextResponse.json({ error: "Invalid request payload" } satisfies ErrorBody, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    annotateSpan(span, {
      orgId: input.tenantOrgId,
      attributes: {
        "freshcomply.dsr.type": type,
        "freshcomply.dsr.subject_org": input.subjectOrgId ?? "unknown"
      }
    });

    try {
      const supabase = getServiceSupabaseClient();
      const receivedAt = new Date();
      const dueAt = calculateResolutionDeadline(receivedAt).toISOString();
      const ackDeadline = calculateAckDeadline(receivedAt).toISOString();

      const insertPayload: TablesInsert<"dsr_requests"> = {
        tenant_org_id: input.tenantOrgId,
        subject_org_id: input.subjectOrgId ?? null,
        assignee_user_id: input.assigneeUserId ?? null,
        assignee_email: input.assigneeEmail ?? null,
        requester_email: input.requesterEmail,
        requester_name: input.requesterName ?? null,
        request_payload: parsedBody as Record<string, unknown>,
        type,
        status: "received",
        received_at: receivedAt.toISOString(),
        due_at: dueAt
      };

      const { data: requestRow, error: insertError } = await supabase
        .from("dsr_requests")
        .insert(insertPayload)
        .select("id, tenant_org_id, subject_org_id, requester_email, requester_name, received_at")
        .maybeSingle();

      if (insertError || !requestRow) {
        console.error("Failed to persist DSR request", insertError);
        const response = NextResponse.json({ error: "Unable to record request" } satisfies ErrorBody, { status: 503 });
        setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
        return response;
      }

      await supabase
        .from("audit_log")
        .insert({
          tenant_org_id: requestRow.tenant_org_id,
          actor_org_id: requestRow.tenant_org_id,
          on_behalf_of_org_id: requestRow.subject_org_id ?? null,
          subject_org_id: requestRow.subject_org_id ?? null,
          entity: "dsr_request",
          action: "dsr.request.received",
          meta_json: {
            request_id: requestRow.id,
            type,
            status: "received",
            received_at: requestRow.received_at
          }
        });

      await supabase.from("dsr_request_jobs").insert([
        {
          request_id: requestRow.id,
          job_type: "ack_deadline",
          run_after: ackDeadline,
          payload: { type }
        },
        {
          request_id: requestRow.id,
          job_type: "resolution_deadline",
          run_after: dueAt,
          payload: { type }
        }
      ] satisfies TablesInsert<"dsr_request_jobs">[]);

      let ackSentAt: string | null = null;
      try {
        if (requestRow.requester_email) {
          await sendDsrAcknowledgement({
            recipientEmail: requestRow.requester_email,
            recipientName: requestRow.requester_name,
            requestType: type,
            receivedDate: new Date(requestRow.received_at ?? receivedAt.toISOString()).toISOString(),
            requestId: requestRow.id
          });
          ackSentAt = new Date().toISOString();
          await supabase
            .from("dsr_requests")
            .update({ status: "acknowledged", ack_sent_at: ackSentAt, updated_at: ackSentAt })
            .eq("id", requestRow.id);

          await supabase
            .from("audit_log")
            .insert({
              tenant_org_id: requestRow.tenant_org_id,
              actor_org_id: requestRow.tenant_org_id,
              on_behalf_of_org_id: requestRow.subject_org_id ?? null,
              subject_org_id: requestRow.subject_org_id ?? null,
              entity: "dsr_request",
              action: "dsr.request.acknowledged",
              meta_json: {
                request_id: requestRow.id,
                type,
                ack_sent_at: ackSentAt
              }
            });
          span.addEvent("dsr.acknowledged", {
            requestId: requestRow.id,
            ackSentAt
          });
        }
      } catch (ackError) {
        console.error("Failed to deliver DSR acknowledgement", ackError);
        span.recordException(ackError as Error);
      }

      console.info("DSR request received", {
        requestId: requestRow.id,
        type,
        tenantOrgId: requestRow.tenant_org_id,
        receivedAt: requestRow.received_at,
        ackSentAt
      });

      const response = NextResponse.json(
        {
          status: "accepted",
          requestId: requestRow.id,
          type,
          receivedAt: requestRow.received_at,
          ackSentAt,
          dueAt
        },
        { status: 202 }
      );
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    } catch (error) {
      console.error("Unexpected DSR intake error", error);
      const response = NextResponse.json({ error: "Unexpected error" } satisfies ErrorBody, { status: 500 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }
  });
}
