# Observability and Dashboards

This runbook documents how to forward traces and logs from Fresh-Comply services to Grafana/Tempo/Loki and how to build dashboards that highlight workflow state using the new OpenTelemetry spans.

## Environment configuration

Set the OpenTelemetry exporter variables in each service (portal, admin, worker, orchestrator) using the new knobs in `.env`:

```bash
OTEL_SERVICE_NAME=fresh-comply-portal
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.5

# Security headers (can be tuned per deployment)
SECURITY_CSP_CONNECT_SRC='self' https://api.freshcomply.com https://tempo:4318
SECURITY_CSP_REPORT_URI=https://sentry.example.com/api/report
```

> **Tip:** set different `OTEL_SERVICE_NAME` values per app (`fresh-comply-admin`, `fresh-comply-worker`) to filter dashboards by surface.

The middleware now enforces a nonce-aware CSP and HSTS. If the Grafana or Loki endpoints require additional origins, append them to the `SECURITY_CSP_*` lists above.

## Export pipeline

1. **Traces:** configure Grafana Tempo as an OTLP HTTP/JSON receiver on port `4318`. The portal, admin app, and Temporal worker will emit spans with attributes:
   - `freshcomply.runId`, `freshcomply.stepKey`, `freshcomply.workflowId`
   - HTTP metadata (`http.method`, `http.route`, `http.status_code`)
   - Temporal specific dimensions (`freshcomply.signal`, `freshcomply.externalJob.status`)
2. **Logs:** Loki can ingest the existing `stdout` logs. Include the span context by enabling Grafana Agent’s `loki.process` stage with `parse_trace=true`.

## Grafana dashboards

### Workflow drilldown

Create a Tempo data source panel with the following query:

```
{service.name="fresh-comply-portal"} | traceql '{ span.http.route = "/api/orchestration/start" }'
```

Use span attributes to drive templated variables:

- `$runId` from `freshcomply.runId`
- `$stepKey` from `freshcomply.stepKey`
- `$workflowId` from `freshcomply.workflowId`

Add a table panel pointing at Loki with query:

```
{app="worker"} | json | freshcomply.runId = "$runId"
```

### Temporal worker health

Plot the number of `temporal.activity.*` spans grouped by `service.name` and `freshcomply.workflow` to visualise activity throughput. Add a bar gauge for `freshcomply.externalJob.status` to spot long-running polling loops.

### Security reporting

Because CSP violations can be reported via `SECURITY_CSP_REPORT_URI`, create an Explore view that checks for report traffic and correlate with the `x-csp-nonce` header exposed on responses. Include a panel showing the count of `freshcomply.csp` attributes (available on spans when security headers are generated).

## Alerting suggestions

- Alert when spans with `freshcomply.validation` attributes occur more than 5 times in 5 minutes (indicates repeated bad requests).
- Alert when `temporal.client.startStepWorkflow` spans fail with `SpanStatusCode.ERROR` for a specific workflow more than twice per hour.

## Run ID / Step ID propagation

Every API handler and server action now emits spans with the run metadata attributes above. Temporal client spans preserve the same keys so you can click from a frontend trace to the corresponding worker span in Tempo. Use Grafana’s “Trace to logs” feature with the `freshcomply.runId` label to jump to the worker logs.

