import { getServiceSupabaseClient, SupabaseServiceConfigurationError } from "@airnub/utils/supabase-service";
import type { Tables } from "@airnub/types";
import { sendDsrAcknowledgement, sendDsrSlaBreachNotice } from "@airnub/notifications";

async function main() {
  let supabase;
  try {
    supabase = getServiceSupabaseClient();
  } catch (error) {
    if (error instanceof SupabaseServiceConfigurationError) {
      console.error("DSR job runner missing Supabase environment", error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const { data: jobs, error: loadError } = await supabase
    .from("dsr_request_jobs")
    .select(
      `id, job_type, run_after, attempts, payload, request:dsr_requests!inner(
        id,
        tenant_org_id,
        subject_org_id,
        status,
        type,
        received_at,
        due_at,
        ack_sent_at,
        requester_email,
        requester_name,
        assignee_user_id,
        assignee_email,
        tenant:organisations!dsr_requests_tenant_org_id_fkey(name),
        assignee:users!dsr_requests_assignee_user_id_fkey(email)
      )`
    )
    .lte("run_after", nowIso)
    .is("processed_at", null)
    .order("run_after", { ascending: true })
    .limit(50);

  if (loadError) {
    console.error("Unable to load DSR jobs", loadError);
    process.exitCode = 1;
    return;
  }

  if (!jobs?.length) {
    console.info("No DSR jobs due at", nowIso);
    return;
  }

  for (const job of jobs) {
    const lockTimestamp = new Date().toISOString();
    const { data: lockedRow, error: lockError } = await supabase
      .from("dsr_request_jobs")
      .update({ locked_at: lockTimestamp, attempts: (job.attempts ?? 0) + 1, updated_at: lockTimestamp })
      .eq("id", job.id)
      .is("locked_at", null)
      .select("id")
      .maybeSingle();

    if (lockError) {
      console.error(`Unable to lock DSR job ${job.id}`, lockError);
      continue;
    }

    if (!lockedRow) {
      continue; // already locked by another worker
    }

    const request = job.request as unknown as (Tables<"dsr_requests"> & {
      tenant?: Pick<Tables<"organisations">, "name"> | null;
      assignee?: Pick<Tables<"users">, "email"> | null;
    });

    if (!request) {
      console.warn(`Job ${job.id} missing request context`);
      await markProcessed(job.id, lockTimestamp);
      continue;
    }

    try {
      switch (job.job_type) {
        case "ack_deadline":
          await handleAckDeadline(job.id, request, lockTimestamp, supabase);
          break;
        case "resolution_deadline":
          await handleResolutionDeadline(job.id, request, lockTimestamp, supabase);
          break;
        case "escalation_notice":
          await handleEscalationNotice(job.id, request, lockTimestamp, supabase);
          break;
        default:
          console.warn(`Unknown DSR job type ${job.job_type}`);
          await markProcessed(job.id, lockTimestamp);
          break;
      }
    } catch (error) {
      console.error(`DSR job ${job.id} failed`, error);
      await supabase
        .from("dsr_request_jobs")
        .update({ locked_at: null, updated_at: new Date().toISOString() })
        .eq("id", job.id);
    }
  }

  async function markProcessed(jobId: string, processedAt: string) {
    await supabase
      .from("dsr_request_jobs")
      .update({ processed_at: processedAt, updated_at: processedAt })
      .eq("id", jobId);
  }

  async function handleAckDeadline(
    jobId: string,
    request: Tables<"dsr_requests"> & {
      tenant?: Pick<Tables<"organisations">, "name"> | null;
    },
    lockedAt: string,
    client = supabase
  ) {
    if (request.ack_sent_at || !request.requester_email) {
      await markProcessed(jobId, lockedAt);
      return;
    }

    try {
      await sendDsrAcknowledgement({
        recipientEmail: request.requester_email,
        recipientName: request.requester_name,
        requestType: request.type,
        receivedDate: request.received_at,
        requestId: request.id
      });
      const ackSentAt = new Date().toISOString();
      await client
        .from("dsr_requests")
        .update({ status: "acknowledged", ack_sent_at: ackSentAt, updated_at: ackSentAt })
        .eq("id", request.id);
      await client.from("audit_log").insert({
        actor_org_id: request.tenant_org_id,
        action: "dsr.request.acknowledged",
        meta_json: { request_id: request.id, ack_sent_at: ackSentAt }
      });
      await markProcessed(jobId, ackSentAt);
    } catch (error) {
      console.error(`Failed to send delayed acknowledgement for ${request.id}`, error);
      await client
        .from("dsr_request_jobs")
        .update({ locked_at: null, updated_at: new Date().toISOString() })
        .eq("id", jobId);
    }
  }

  async function handleResolutionDeadline(
    jobId: string,
    request: Tables<"dsr_requests"> & {
      tenant?: Pick<Tables<"organisations">, "name"> | null;
        assignee?: Pick<Tables<"users">, "email"> | null;
    },
    lockedAt: string,
    client = supabase
  ) {
    if (request.status === "completed") {
      await markProcessed(jobId, lockedAt);
      return;
    }

    const nowIso = new Date().toISOString();
    if (request.status !== "escalated") {
      await client
        .from("dsr_requests")
        .update({ status: "escalated", updated_at: nowIso })
        .eq("id", request.id);
      await client.from("audit_log").insert({
        actor_org_id: request.tenant_org_id,
        action: "dsr.request.escalated",
        meta_json: { request_id: request.id, due_at: request.due_at }
      });
    }

    try {
      await sendDsrSlaBreachNotice({
        requestId: request.id,
        tenantOrgName: request.tenant?.name ?? "Unknown tenant",
        requestType: request.type,
        dueAt: request.due_at,
        assigneeEmail: request.assignee_email ?? request.assignee?.email ?? null
      });
    } catch (error) {
      console.error(`Failed to send DSR breach notice for ${request.id}`, error);
      await client
        .from("dsr_request_jobs")
        .update({ locked_at: null, updated_at: new Date().toISOString() })
        .eq("id", jobId);
      return;
    }

    await markProcessed(jobId, nowIso);
    await client.from("dsr_request_jobs").insert({
      request_id: request.id,
      job_type: "escalation_notice",
      run_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      payload: { stage: "daily_escalation" }
    });
  }

  async function handleEscalationNotice(
    jobId: string,
    request: Tables<"dsr_requests"> & {
      tenant?: Pick<Tables<"organisations">, "name"> | null;
      assignee?: Pick<Tables<"users">, "email"> | null;
    },
    lockedAt: string,
    client = supabase
  ) {
    if (request.status === "completed") {
      await markProcessed(jobId, lockedAt);
      return;
    }

    try {
      await sendDsrSlaBreachNotice({
        requestId: request.id,
        tenantOrgName: request.tenant?.name ?? "Unknown tenant",
        requestType: request.type,
        dueAt: request.due_at,
        assigneeEmail: request.assignee_email ?? request.assignee?.email ?? null
      });
    } catch (error) {
      console.error(`Failed to send recurring DSR escalation for ${request.id}`, error);
      await client
        .from("dsr_request_jobs")
        .update({ locked_at: null, updated_at: new Date().toISOString() })
        .eq("id", jobId);
      return;
    }

    await markProcessed(jobId, lockedAt);
    await client.from("dsr_request_jobs").insert({
      request_id: request.id,
      job_type: "escalation_notice",
      run_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      payload: { stage: "daily_escalation" }
    });
  }
}

main().catch((error) => {
  console.error("Unhandled DSR job runner error", error);
  process.exitCode = 1;
});
