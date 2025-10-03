# Observability & Dashboards

FreshComply emits OpenTelemetry spans from the Next.js portals, server actions, and Temporal activities/workflows. This document explains how to configure exports and wire up Grafana/Loki dashboards that take advantage of the embedded run/step metadata.

## 1. Environment Configuration

Set the following variables in `.env` (see `.env.example` for defaults):

| Variable | Purpose |
| --- | --- |
| `OTEL_SERVICE_NAME` | Service identity that appears in Grafana/Tempo/Loki. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP HTTP or gRPC endpoint for your collector (Tempo, Grafana Cloud, Honeycomb, etc.). |
| `OTEL_EXPORTER_OTLP_HEADERS` | Optional comma-separated `key=value` pairs for authentication headers. |
| `SECURITY_REFERRER_POLICY`, `SECURITY_X_FRAME_OPTIONS`, `SECURITY_ENABLE_HSTS`, `SECURITY_HSTS_*` | Hardened response headers for all Next.js apps. |
| `SECURITY_CSP_*` | Per-directive overrides appended to the default strict CSP. |
| `SECURITY_PERMISSIONS_POLICY`, `SECURITY_CROSS_ORIGIN_*` | Cross-origin isolation knobs if the downstream dashboards require special embedding policies. |

> **Nonce propagation:** Middleware injects an `x-csp-nonce` header into every request and exposes it as `data-csp-nonce` on the `<body>` tag. Use this attribute when adding inline scripts or `next/script` tags in the apps.

## 2. Collector & Tempo/Loki Wiring

1. Point your OTLP collector (Tempo, Grafana Agent, OpenTelemetry Collector) at the FreshComply runtime using the variables above.
2. Ensure the collector forwards traces and logs to Grafana/Tempo and (optionally) logs to Loki. FreshComply emits attributes on every span:
   - `freshcomply.run_id`
   - `freshcomply.step_id`
   - `freshcomply.workflow`
   - `freshcomply.org_id`
   - `freshcomply.temporal.activity`
   - `freshcomply.signal`
3. For HTTP entrypoints the spans also include `http.request.method`, `http.route`, and `http.response.status_code`.

## 3. Grafana Dashboards

Create two core dashboards:

### a. Workflow Run Explorer
- **Tempo Trace View** panel using a search query such as `freshcomply.run_id="$runId"`.
- Table panel fed from Loki (if configured) filtered by `{ freshcomply_run_id="$runId" }` to align logs with the same run.
- Stat panel summarising Temporal activity duration (`duration` span metric) grouped by `freshcomply.temporal.activity`.

### b. API Gateway Health
- Time-series panel showing P95 latency grouped by `http.route`.
- Pie or bar panel counting error responses where `http.response.status_code >= 400`.
- Table listing recent API calls enriched with `freshcomply.org_id`, `freshcomply.run_id`, and `freshcomply.step_id` for quick triage.

Parameterise both dashboards with variables:

| Variable | Query |
| --- | --- |
| `runId` | Tempo label values for `freshcomply.run_id`. |
| `workflow` | Tempo label values for `freshcomply.workflow`. |
| `stepKey` | Tempo label values for `freshcomply.step_id`. |

## 4. Alerting

Use Grafana Alerting or Loki alerts to watch for:

- Spikes in `http.response.status_code >= 500` grouped by route.
- Temporal activities exceeding SLA (`duration > 2m` for `performSignedHttpRequest`, `pollExternalJob`).
- Absence of spans for critical workflows (e.g. no `temporal.workflow.start` in the past N minutes).

## 5. Deployment Checklist

1. Populate `.env` with OTLP and security header variables.
2. Confirm middleware is running (check response headers for `Content-Security-Policy` and `x-csp-nonce`).
3. Run a manual workflow (`/api/orchestration/start`) and verify the spans appear in Grafana/Tempo with populated `freshcomply.*` attributes.
4. Snapshot the Grafana dashboards and store JSON in your infra repo for reproducible environments.
