import { context, SpanKind, SpanStatusCode, trace, type Span, type SpanAttributes, type SpanOptions } from "@opentelemetry/api";

const DEFAULT_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "fresh-comply";

export type RunMetadata = {
  orgId?: string;
  runId?: string;
  stepId?: string;
  stepKey?: string;
  workflowId?: string;
};

export type WithSpanOptions = {
  attributes?: SpanAttributes;
  run?: RunMetadata;
  spanOptions?: SpanOptions;
  kind?: SpanKind;
};

const RUN_ATTRIBUTE_PREFIX = "freshcomply";

export function getTracer(serviceName: string = DEFAULT_SERVICE_NAME) {
  return trace.getTracer(serviceName);
}

export function buildRunAttributes(metadata: RunMetadata = {}): SpanAttributes {
  const attributes: SpanAttributes = {};
  if (metadata.orgId) {
    attributes[`${RUN_ATTRIBUTE_PREFIX}.orgId`] = metadata.orgId;
  }
  if (metadata.runId) {
    attributes[`${RUN_ATTRIBUTE_PREFIX}.runId`] = metadata.runId;
  }
  if (metadata.stepId) {
    attributes[`${RUN_ATTRIBUTE_PREFIX}.stepId`] = metadata.stepId;
  }
  if (metadata.stepKey) {
    attributes[`${RUN_ATTRIBUTE_PREFIX}.stepKey`] = metadata.stepKey;
  }
  if (metadata.workflowId) {
    attributes[`${RUN_ATTRIBUTE_PREFIX}.workflowId`] = metadata.workflowId;
  }
  return attributes;
}

export function recordSpanError(span: Span, error: unknown) {
  if (!span) return;
  if (error instanceof Error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  } else {
    span.recordException({
      name: "Error",
      message: typeof error === "string" ? error : JSON.stringify(error)
    });
    span.setStatus({ code: SpanStatusCode.ERROR, message: "Unknown error" });
  }
}

export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T): Promise<T>;
export async function withSpan<T>(
  name: string,
  options: WithSpanOptions,
  fn: (span: Span) => Promise<T> | T
): Promise<T>;
export async function withSpan<T>(
  name: string,
  fnOrOptions: WithSpanOptions | ((span: Span) => Promise<T> | T),
  maybeFn?: (span: Span) => Promise<T> | T
): Promise<T> {
  const options: WithSpanOptions = typeof fnOrOptions === "function" ? {} : fnOrOptions ?? {};
  const fn = (typeof fnOrOptions === "function" ? fnOrOptions : maybeFn) as (span: Span) => Promise<T> | T;

  const tracer = getTracer();
  const span = tracer.startSpan(name, { ...options.spanOptions, kind: options.kind });
  const attributes: SpanAttributes = { ...options.attributes, ...buildRunAttributes(options.run) };
  if (Object.keys(attributes).length > 0) {
    span.setAttributes(attributes);
  }

  try {
    const activeSpan = trace.setSpan(context.active(), span);
    return await context.with(activeSpan, () => fn(span));
  } catch (error) {
    recordSpanError(span, error);
    throw error;
  } finally {
    span.end();
  }
}

export function annotateSuccess(span: Span, attributes: SpanAttributes = {}) {
  if (Object.keys(attributes).length > 0) {
    span.setAttributes(attributes);
  }
  span.setStatus({ code: SpanStatusCode.OK });
}
