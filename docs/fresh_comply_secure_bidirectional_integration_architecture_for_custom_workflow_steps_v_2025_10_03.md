# FreshComply — Secure Bidirectional Integration Architecture for Custom Workflow Steps

**Repo:** `@airnub/fresh-comply`  
**Version:** 2025‑10‑03  
**Owner:** @airnub  
**Status:** Source of truth for integrating external systems with custom steps (manual/automated) via Webhooks, Polling, WebSockets, and Temporal

> Purpose: Define an architecture that lets tenants add/edit **custom workflow steps** that exchange data securely with external systems in a **bidirectional** manner, while keeping our **custom UI**, **tenant overlays**, and **compliance** guarantees.

---

## 1) High‑Level Overview

- **Step Types** (admin‑defined, versioned) describe *how* a step executes: `manual`, `temporal`, `external:webhook`, `external:websocket`.
- **Tenant Overlays** compose/insert these step types into base workflows without forking (overlay patch model).
- **Temporal Workflows** orchestrate send→wait→receive (durable retries, timers, signals), keeping UI custom.
- **Integration Egress** makes outbound, signed, idempotent HTTP calls (secrets resolved via **aliases → vault**).
- **Integration Ingress** receives third‑party callbacks (webhooks), verifies signature, and **Signals** waiting workflows.

```
[Portal UI] → [Portal API] → (Temporal Workflow)
                               ↙           ↘
                    [Integration Egress]   [Integration Ingress (Webhook)]
                           ↔   External System   ↔

Secrets: overlays reference aliases (e.g., secrets.crm.apiToken) → resolved in server/vault only.
```

---

## 2) Step Lifecycle (Bidirectional)

State machine per custom step:

```
PENDING → OUTBOUND_SENT → AWAITING_CALLBACK (or POLLING) → PROCESSING_RESULT → DONE / FAILED / TIMED_OUT
```

- **OUTBOUND_SENT:** activity posts to external (with idempotency key & correlation).
- **AWAITING_CALLBACK:** workflow waits for webhook **Signal** or **polls** on an interval.
- **PROCESSING_RESULT:** validate/normalize to canonical schema; attach artifacts/evidence.

---

## 3) Integration Patterns (choose per step)

1) **Request/Callback** (preferred): Send job → wait for webhook → Signal → proceed.  
2) **Polling** (fallback): Send job → timer loop → poll status until terminal state/timeout.  
3) **Streaming/WebSocket** (advanced): Short‑lived workflow; WS client runs in an **activity**; workflow ends on matching event or timeout.

> Temporal Web UI remains ops‑only; end users interact with **our portal**.

---

## 4) Security & Compliance

### Ingress (Webhook Receiver)
- Path: `/hooks/{tenantId}/{channel}` (+ opaque token if desired).
- Auth: **HMAC‑SHA256** signature header; timestamp + nonce to prevent replay; strict clock skew window.
- Validation: map payload → canonical event (CloudEvents‑like), validate JSON Schema; **Signal** workflow with `{runId, stepId, externalRef, payload}`.
- Audit: store header hashes (no secrets), payload hash, verification result, actor context.

### Egress (Outbound Calls)
- Resolve **secret aliases** from vault (never inline in overlays or client).  
- Headers: `Authorization: Bearer <token>`, `X‑FC‑Idempotency‑Key: {runId}:{stepId}`, optional `X‑FC‑Signature` (HMAC of body).  
- Reliability: exponential backoff; circuit breaker; 4xx vs 5xx classification; correlation IDs.

### Data Protection
- Step **policy** declares lawful basis, retention duration, and PII fields → included in RoPA & DSR exports.

---

## 5) Step Type & Overlay Config (authoritative)

### Step Type (admin‑defined)
```json
{
  "name": "external-job-with-callback",
  "execution": {
    "mode": "temporal",
    "workflow": "externalJobWorkflow",
    "defaultTaskQueue": "tenant-generic"
  },
  "inputSchema": "external.job.request@1.0.0",
  "outputSchema": "external.job.result@1.0.0",
  "policy": { "lawful_basis": "contract", "retention": "P3Y" }
}
```

### Tenant Overlay (instance)
```yaml
- id: tenantx-data-enrichment
  kind: action
  title_i18n: { en-IE: "Enrich data in System Y" }
  stepType: "external-job-with-callback@1.0.0"
  execution:
    mode: temporal
    config:
      egress:
        method: POST
        urlAlias: secrets.sysY.baseUrl
        tokenAlias: secrets.sysY.apiToken
        path: "/v1/enrich"
      ingress:
        channel: "sysY-enrich"                # webhook route → Signal
        signatureSecretAlias: secrets.webhooks.sysY
      polling:
        enabled: true
        statusPath: "/v1/jobs/{{ticketId}}"
        intervalSec: 20
        maxAttempts: 60
  verify:
    - rule: enrichment_result_present
```

> Overlays may reference **secret aliases** only; values resolved server‑side from vault (tenant‑scoped bindings).

---

## 6) Temporal Orchestration (sketch)

- **Workflow**: `externalJobWorkflow` handles send→wait (Signal or poll)→persist.  
- **Activities**: `startExternalJob`, `pollExternalJob`, `persistResult`, `escalateTimeout`.  
- **Signals**: `receivedCallback(payload)` invoked by Ingress on verified webhook.

Key rules:
- Workflows remain **deterministic** (no network I/O inside them; use activities).
- Activities are **idempotent** (use `{runId, stepId}` business key).
- Timeouts escalate with notifications (and optional admin actions) instead of silent failure.

---

## 7) Integration Ingress & Egress (interfaces)

**Ingress (server)**
- Verify HMAC; reject on bad signature or stale timestamp.  
- Identify tenant via path; map `channel` → expected step(s) for that tenant.  
- Enqueue Signal call to Temporal with correlation IDs.  
- Idempotency: dedupe by `(tenantId, channel, nonce)`.

**Egress (server/activities)**
- `request(config, payload)` resolves `urlAlias`/`tokenAlias` → HTTP call with backoff.  
- Adds idempotency header + signature; logs request/response hashes.

---

## 8) Data Model Additions (optional for resilience)

```
webhook_inbox(id, tenant_id, channel, signature_ok boolean, payload_hash, processed_at, dedupe_key)
http_outbox(id, run_id, step_id, attempt, status, last_error, next_retry_at)
```

- Use **Inbox** to handle replay safely and re‑Signal if needed.  
- Use **Outbox** for reliable egress with retries and observability.

Extend `steps` with:
- `execution_mode text` (already present),
- `orchestration_workflow_id text` (Temporal run id),
- `external_ref text` (e.g., ticket id),
- `artifacts jsonb` (normalized outputs).

---

## 9) Observability & Audit

- **Tracing:** OpenTelemetry spans across UI → API → activities → external; include `runId`, `stepId`, `ticketId`.
- **Metrics:** success rate, latency, retries, webhook verification failures, timeouts.  
- **Audit:** Each state change & admin override logs actor, justification, before/after diff.

---

## 10) Admin & Portal UX

**Admin (apps/admin):**
- Step Type Registry (create/version); enable per tenant.  
- Secret Alias Bindings (map aliases → vault refs; test connectivity).  
- Webhook monitor (recent ingress events; verification result; linked runs).  
- Temporal panel: send Signals, retry last activity, cancel with two‑person approval.

**Portal (apps/portal):**
- Overlay Builder: insert step types, configure non‑secret inputs, select secret aliases.  
- Step UI shows status, allows **Start/Retry**, displays result artifacts and evidence.

---

## 11) Risks & Mitigations

- **Stuck waiting:** enforced timeouts + escalation notifications + admin actions.  
- **Webhook spoofing:** HMAC with rotating keys per tenant; strict timestamp/nonce windows.  
- **Secret leakage:** never store secrets in overlays/DB; aliases only; server resolves from vault.  
- **Breaking schema changes:** version step types & schemas; compatibility checks in overlay publish flow.  
- **Portal‑only targets:** policy lint blocks headless automation; require `manual + signal` steps.

---

## 12) Acceptance Criteria

- A tenant can add a **bidirectional** custom step (send→callback or polling) via Overlay Builder using secret aliases only.  
- Temporal workflow reliably orchestrates interactions; Signals and timers function; retries are visible.  
- Ingress verifies HMAC, dedupes events, Signals the correct workflow; egress adds idempotency & signatures.  
- Outputs are validated, stored as artifacts, and unlock subsequent steps.  
- All transitions are audited; observability dashboards show end‑to‑end traces.

---

**End of Secure Bidirectional Integration Architecture (v2025‑10‑03).**

