import { context as otelContext, trace, SpanStatusCode, type Context, type Span, type SpanAttributes, type SpanKind } from "@opentelemetry/api";

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "fresh-comply";

export const RUN_ID_ATTRIBUTE = "freshcomply.run_id";
export const STEP_ID_ATTRIBUTE = "freshcomply.step_id";
export const WORKFLOW_ATTRIBUTE = "freshcomply.workflow";
export const ORG_ID_ATTRIBUTE = "freshcomply.org_id";
export const TENANT_ID_ATTRIBUTE = "freshcomply.tenant_id";
export const PARTNER_ORG_ID_ATTRIBUTE = "freshcomply.partner_org_id";

export interface TelemetrySpanOptions {
  attributes?: SpanAttributes;
  runId?: string | null;
  stepId?: string | null;
  workflow?: string | null;
  orgId?: string | null;
  tenantId?: string | null;
  partnerOrgId?: string | null;
  context?: Context;
  kind?: SpanKind;
}

export interface SpanMetadata {
  runId?: string | null;
  stepId?: string | null;
  workflow?: string | null;
  orgId?: string | null;
  tenantId?: string | null;
  partnerOrgId?: string | null;
  attributes?: SpanAttributes;
}

function applyMetadata(span: Span, metadata?: SpanMetadata) {
  if (!metadata) return;
  if (metadata.runId) {
    span.setAttribute(RUN_ID_ATTRIBUTE, metadata.runId);
  }
  if (metadata.stepId) {
    span.setAttribute(STEP_ID_ATTRIBUTE, metadata.stepId);
  }
  if (metadata.workflow) {
    span.setAttribute(WORKFLOW_ATTRIBUTE, metadata.workflow);
  }
  if (metadata.orgId) {
    span.setAttribute(ORG_ID_ATTRIBUTE, metadata.orgId);
  }
  if (metadata.tenantId) {
    span.setAttribute(TENANT_ID_ATTRIBUTE, metadata.tenantId);
  }
  if (metadata.partnerOrgId) {
    span.setAttribute(PARTNER_ORG_ID_ATTRIBUTE, metadata.partnerOrgId);
  }
  if (metadata.attributes) {
    for (const [key, value] of Object.entries(metadata.attributes)) {
      if (value !== undefined && value !== null) {
        span.setAttribute(key, value as never);
      }
    }
  }
}

export async function withTelemetrySpan<T>(
  name: string,
  options: TelemetrySpanOptions,
  handler: (span: Span) => Promise<T> | T
): Promise<T> {
  const tracer = trace.getTracer(SERVICE_NAME);
  const attributes: SpanAttributes = { ...(options.attributes ?? {}) };

  if (options.runId) {
    attributes[RUN_ID_ATTRIBUTE] = options.runId;
  }
  if (options.stepId) {
    attributes[STEP_ID_ATTRIBUTE] = options.stepId;
  }
  if (options.workflow) {
    attributes[WORKFLOW_ATTRIBUTE] = options.workflow;
  }
  if (options.orgId) {
    attributes[ORG_ID_ATTRIBUTE] = options.orgId;
  }
  if (options.tenantId) {
    attributes[TENANT_ID_ATTRIBUTE] = options.tenantId;
  }
  if (options.partnerOrgId) {
    attributes[PARTNER_ORG_ID_ATTRIBUTE] = options.partnerOrgId;
  }

  const spanContext = options.context ?? otelContext.active();

  return tracer.startActiveSpan(
    name,
    { kind: options.kind, attributes },
    spanContext,
    async (span) => {
      try {
        const result = await handler(span);
        return result;
      } catch (error) {
        const exception =
          error instanceof Error ? error : new Error(String(error ?? "Unknown error"));
        span.recordException(exception);
        span.setStatus({ code: SpanStatusCode.ERROR, message: exception.message });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

export function annotateSpan(span: Span, metadata: SpanMetadata) {
  applyMetadata(span, metadata);
}

const RUN_HEADERS = ["x-fc-run-id", "x-run-id", "x-temporal-run-id"];
const STEP_HEADERS = ["x-fc-step-key", "x-step-id", "x-temporal-step-id"];
const TENANT_HEADERS = [
  "x-tenant-id",
  "x-fc-tenant-id",
  "x-temporal-tenant-id",
  "x-tenant-org-id"
];
const PARTNER_HEADERS = [
  "x-partner-org-id",
  "x-fc-partner-org-id",
  "x-temporal-partner-org-id"
];

export function extractRunMetadataFromHeaders(
  headers: Headers | Record<string, string> | undefined
): { runId?: string; stepId?: string; tenantId?: string; partnerOrgId?: string } {
  if (!headers) {
    return {};
  }

  const get = (name: string) => {
    if (headers instanceof Headers) {
      return headers.get(name) ?? undefined;
    }
    const value = (headers as Record<string, string>)[name];
    return value ?? undefined;
  };

  const runId = RUN_HEADERS.map((header) => get(header)).find((value) => value);
  const stepId = STEP_HEADERS.map((header) => get(header)).find((value) => value);
  const tenantId = TENANT_HEADERS.map((header) => get(header)).find((value) => value);
  const partnerOrgId = PARTNER_HEADERS.map((header) => get(header)).find((value) => value);

  return {
    runId: runId ?? undefined,
    stepId: stepId ?? undefined,
    tenantId: tenantId ?? undefined,
    partnerOrgId: partnerOrgId ?? undefined
  };
}

export function setHttpAttributes(span: Span, attributes: { method?: string; route?: string; status?: number }) {
  if (attributes.method) {
    span.setAttribute("http.request.method", attributes.method);
  }
  if (attributes.route) {
    span.setAttribute("http.route", attributes.route);
  }
  if (attributes.status !== undefined) {
    span.setAttribute("http.response.status_code", attributes.status);
  }
}
