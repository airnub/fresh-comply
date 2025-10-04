---
title: "FreshComply — Workflow‐Agnostic Extension Model (Tenant Overlays)"
version: 1.0.0
status: Stable
---








# FreshComply — Workflow‑Agnostic Extension Model (Tenant Overlays)

**Repo:** `@airnub/fresh-comply`  
**Version:** 2025‑10‑03  
**Owner:** @airnub  
**Status:** Source of truth for extending core workflows without forking

> Goal: Allow any company (tenant) to **add, replace, or remove** steps (manual or automated) on top of the **canonical workflows** while preserving compliance guarantees, i18n/a11y/UX consistency, and auditability. This spec is workflow‑agnostic and jurisdiction‑agnostic.

---

## 1) Design Principles
- **Layered, not forked:** Extensions are **overlays** applied at runtime (and at publish time), not edits of core files.
- **Contract‑driven:** Steps declare inputs/outputs via JSON Schema; verification rules and deadlines are explicit.
- **Safe by default:** Policy lints block removal of **legally required** steps; data handling declares basis/retention.
- **UI‑consistent:** All tenant steps render through our **Radix + shadcn** components with next‑intl/i18n.
- **Engine‑agnostic automation:** Steps can be manual, **Temporal‑backed**, or **external webhook** automations.
- **Auditable:** Every merge, enable/disable, and runtime transition is recorded with diffs and reason codes.

---

## 2) Layered Overlay Model

```
Core (Airlab canonical)
  → Jurisdiction pack (e.g., Ireland)
    → Industry pack (e.g., Charity)
      → Tenant overlay (Company X)
        → Answers (runtime branching)
```

- Each layer can **add/replace/remove** steps, edges, labels, deadlines, docs, and messages.  
- Conflicts are resolved via **three‑way merge** with an **Impact Map** (see Freshness Engine) before publish.

---

## 3) DSL Additions (authoritative)

### 3.1 Execution Modes
```yaml
steps:
  - id: cro-name-check
    kind: action
    title_i18n: { en-IE: "Check CRO name", ga-IE: "Seiceáil ainm CRO" }
    execution:
      mode: temporal            # "manual" | "temporal" | "external"
      workflow: croNameCheckWorkflow  # when temporal
      taskQueue: tenantX-main        # optional; defaults per tenant
      input_schema: schemas/cro-name-check.json
      secrets: [ "secrets.croApiKey" ]
      externalWebhook: null          # when mode=external (signed URL)
    permissions: [ "org:member" ]
    required: false                  # base can mark legally required steps true
    verify:
      - rule: cro_name_checked_recently
    sources: [ cro_open_services ]
```

**New fields:**
- `execution.mode`: `manual` (UI task), `temporal` (Temporal workflow/activity), `external` (signed webhook).
- `execution.workflow`, `execution.taskQueue`, `execution.input_schema`, `execution.secrets`, `execution.externalWebhook`.
- `permissions`: simple strings used by RBAC (portal & admin).
- `required`: when **true** in base, overlays **cannot** remove the step (policy lint blocks publish).

### 3.2 Inputs/Outputs Contracts
- **Inputs**: JSON Schema (Zod‑compatible) referenced by `input_schema`.
- **Outputs**: attach artifacts to step (files, JSON) with `content_type` and retention tags.

### 3.3 Policy Metadata (optional)
```yaml
policy:
  lawful_basis: contract | legal_obligation | legitimate_interest | consent
  retention: { entity: "evidence", duration: "P6Y" }
  pii: ["name", "email"]
```

---

## 4) Overlay Format & Merge

**Patch format:** **JSON Patch (RFC 6902)** applied to the base workflow JSON representation.  
Supported ops: `add`, `remove`, `replace`, `move`, `copy`, `test`.

**Example overlay (Tenant X inserts a screening step):**
```json
[
  { "op": "add", "path": "/steps/-", "value": {
      "id": "tenantX-ml-screening",
      "kind": "action",
      "title_i18n": { "en-IE": "ML Screening (Tenant X)" },
      "execution": { "mode": "temporal", "workflow": "tenantX.mlScreening", "taskQueue": "tenantX-main" },
      "requires": ["revenue-chy-exemption"],
      "verify": [{ "rule": "ml_screening_passed" }]
  }},
  { "op": "add", "path": "/edges/-", "value": { "from": "revenue-chy-exemption", "to": "tenantX-ml-screening" } }
]
```

**Merge order:** core → jurisdiction → industry → tenant overlays. Conflicts prompt admin resolution in the **Packs UI** (apps/admin).

---

## 5) Workflow Packs (distributable bundles)

**Structure:**
```
pack.yaml                  # manifest
overlay.patch.json         # JSON Patch for one or more flows
schemas/*.json             # JSON Schemas for forms
messages/<locale>.json     # i18n strings
docs-templates/*.md.hbs    # optional document templates
temporal/*.ts              # optional workflows/activities (marketplace‑only)
```

**Manifest (`pack.yaml`):**
```yaml
name: tenantx-compliance
version: 1.2.0
compatibleWith: [ "setup-nonprofit-ie@^2025.10" ]
scope: ["tenant"]
signing: sha256
features: ["temporal", "docs"]
```

**Signing & trust:**
- Checksums required; optional ed25519 signature for marketplace packs.  
- Untrusted packs are rejected or sandboxed (no code execution).  
- Only marketplace‑approved packs may ship `temporal/*.ts` code; tenant private packs are **overlay/schema/messages/templates only**.

---

## 6) Runtime Algorithm (merge → validate → run)

1. **Select base**: get canonical `workflow_def` version for the run.
2. **Apply overlays** (jurisdiction→industry→tenant) to produce `merged_workflow`.
3. **Validate**:
   - JSON Schema refs exist & load.
   - Graph connectivity (no orphaned nodes); all `requires` resolvable.
   - **Policy lints** (see §7) pass (e.g., required steps present).
4. **Materialise** run: persist `merged_workflow_snapshot` on `workflow_runs` for immutability.
5. **Render** steps in portal:
   - `manual`: auto‑generated form from schema; server validates; audit.
   - `temporal`: start/query/signal via server APIs; store `orchestration_workflow_id`.
   - `external`: call signed webhook from server; handle retries/idempotency.

---

## 7) Safety & Policy Lints (blocking rules)

- **Required steps**: Base steps with `required: true` cannot be removed or bypassed.
- **Deadline preservation**: Overlays cannot extend statutory deadlines beyond base defaults.
- **Data policy**: Steps touching PII must declare `policy.lawful_basis` & `retention`.
- **Portal‑only sites**: If a third‑party portal has no write API, automation must be `manual + signal` (no headless scraping).
- **Secrets**: Steps may reference secret **aliases** only; real secrets are resolved server‑side from tenant vault.

---

## 8) Temporal & External Automation

- **Temporal**: per‑tenant **task queues** (e.g., `tenant-${tenantId}-main`). The step defines `workflow`/`taskQueue`. Our **orchestrator** package starts/queries/signals and writes status back to Postgres. Temporal UI is **ops‑only**.
- **External**: signed webhook (HMAC‑SHA256) with idempotency keys; retries with exponential backoff; response schema validated.

---

## 9) Admin UX (apps/admin)

- **Packs**: upload, validate, preview **Impact Map**, enable/disable per tenant.  
- **Conflicts**: three‑way diff resolver; store resolved overlay variant; changelog.  
- **Policy results**: lints must pass before enable.  
- **Audit**: every action stored in `admin_actions` + diff snapshot.

---

## 10) Data Model Additions

```
workflow_packs(id, name, publisher, marketplace boolean, created_at)
workflow_pack_versions(id, pack_id, version, manifest_json, overlay_json, checksum, created_at)
workflow_pack_installs(id, pack_version_id, org_id, enabled boolean, created_at, disabled_at)
workflow_overlays_resolved(id, run_id, pack_version_id, resolved_overlay_json, created_at)
```

- Extend `workflow_runs` with `merged_workflow_snapshot jsonb` for immutability.  
- Extend `steps` with `execution_mode text`, `orchestration_workflow_id text` (if temporal), `permissions text[]`.

**RLS:** Only tenant admins and platform admins can install/enable packs for that tenant.

---

## 11) Developer Tooling (CLI)

```
fc pack validate   # schema + policy lints + graph
fc pack build      # bundle + checksum
fc pack sign       # optional ed25519
fc pack install    # POST to admin API for a tenant
```

- Simulator: `fc pack dev` spins a local preview merging base + pack + sample answers.

---

## 12) Observability & Audit

- Correlate steps to overlays via `workflow_overlays_resolved`.  
- Structured logs include `pack_version_id`, `org_id`, `run_id`, `step_id`.
- Expose metrics: overlay validation failures, merge conflicts, policy lint failures.

---

## 13) Testing & CI

- **Unit:** overlay merge; required‑step lint; JSON Schema validation; secret alias resolution.  
- **Integration:** portal renders a tenant temporal step and a manual step from a sample pack.  
- **E2E:** install pack → new step appears → temporal step runs on tenant queue → verify block/unblock flow.  
- **A11y/i18n:** packs may ship messages; ensure missing keys fallback to `en‑IE` and log telemetry.

---

## 14) Security

- No arbitrary code execution from tenant packs (overlay/schema/messages/templates only).  
- Marketplace packs with code run **isolated workers**; code review & signing mandatory.  
- All webhooks are signed; Temporal activities fetch secrets from server‑side vault.

---

## 15) Roadmap & Enhancements

- **Upgrade Wizard**: assist tenants to rebase overlays after core updates.  
- **Pack Marketplace**: vetted third‑party packs with revenue share.  
- **Policy templates**: prebuilt lints per jurisdiction.  
- **Dry‑run impact**: simulate overlay on real run snapshot and show affected deadlines/docs.

---

## 16) Acceptance Criteria (DoD)

- Tenants can install a pack that adds: (a) a **manual** step with a JSON‑schema form; (b) a **temporal** step using a tenant task queue.  
- Base workflows marked `required: true` steps cannot be removed; lints block it.  
- Admin can view **Impact Map**, resolve conflicts, and enable the pack; all audited.  
- Portal renders merged workflow; transitions audited; i18n fallbacks work; a11y checks pass.  
- Docs updated: this spec + developer guide; example pack in `examples/packs/tenantX/`.

---

## 17) Example Files (starter)

**`pack.yaml`**
```yaml
name: tenantx-compliance
version: 1.2.0
compatibleWith: [ "setup-nonprofit-ie@^2025.10" ]
scope: ["tenant"]
signing: sha256
```

**`overlay.patch.json`**
```json
[
  { "op": "add", "path": "/steps/-", "value": {
    "id": "tenantX-ml-screening",
    "kind": "action",
    "title_i18n": { "en-IE": "ML Screening (Tenant X)" },
    "execution": { "mode": "temporal", "workflow": "tenantX.mlScreening", "taskQueue": "tenantX-main", "input_schema": "schemas/ml.json" },
    "verify": [{ "rule": "ml_screening_passed" }]
  }}
]
```

**`schemas/ml.json`** (abridged)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "referenceId": { "type": "string" },
    "notes": { "type": "string", "maxLength": 500 }
  },
  "required": ["referenceId"]
}
```

---

**End of Workflow‑Agnostic Extension Model Spec (v2025‑10‑03).**
