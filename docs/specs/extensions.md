# Workflow Extension Packs — Specification

**Version:** 2025-10-04  
**Owner:** Workflow Engineer @ FreshComply  
**Status:** Draft — Implements initial runtime + tooling requested in follow-on brief.

## 1. Purpose

Enable tenant-specific overlays that extend core jurisdictional workflows without forking base definitions. Provide a safe packaging
model for automated (Temporal) and manual steps, enforce legal guardrails, and surface impact to admins.

## 2. Layered Workflow Model

1. **Core:** Canonical Airlab definition shipped in `packages/workflows`.
2. **Jurisdiction:** Regional overlays maintained by FreshComply.
3. **Industry:** Optional overlays (e.g., Charity vs. Social Enterprise).
4. **Tenant Pack:** Signed package uploaded by an organisation admin.
5. **Run-time Answers:** Branching driven by form responses.

Each layer merges into the next via JSON Patch overlays at run start. Required steps marked in core definitions must survive every merge.

## 3. DSL Additions

### 3.1 Step Type References

* Steps may reference reusable registry entries via `stepType: "slug@version"`. Slug comes from `step_types.slug`; version is semver from `step_type_versions.version`.
* Step type definitions (authored in Admin app or CLI) are validated against `packages/workflow-core/src/step-type.schema.json` and encapsulate execution defaults, schema refs, permissions, and policy hints.
* Overlays may still inline execution metadata for bespoke steps, but registry-backed steps should prefer `execution.config` overrides to keep base definitions reusable.

### 3.2 Execution Modes

`execution.mode` now supports four values, each with a structured `execution.config` aligned to the registry definition:

| Mode                | Description                                                   | Required config fields                               |
|---------------------|---------------------------------------------------------------|-------------------------------------------------------|
| `manual`            | Portal-only human task with form auto-generated from schema. | none (inputs derived from `inputSchema`)              |
| `temporal`          | Temporal workflow/activity orchestration.                    | `workflow` (base or override), `taskQueue?`           |
| `external:webhook`  | Signed webhook invocation for tenant-hosted logic.           | `method`, `urlAlias`; optional `tokenAlias`, headers, signing |
| `external:websocket`| Temporal-managed websocket listener for tenant streams.      | `urlAlias`; optional `tokenAlias`, message schema ref, Temporal workflow/task queue |

Additional execution metadata:

* `inputSchema`: Reference to shared schema (`json_schemas.name@version`) used to render forms and validate payloads.
* `outputSchema` (optional): Validates responses from Temporal/webhook/websocket handlers.
* `permissions`: Array of RBAC scopes required to view/complete the step.
* `policy`: Required flag, lawful basis, and retention duration used by policy linting.
* Secrets must reference aliases (`secrets.*`) that resolve via `tenant_secret_bindings`; inline secrets are rejected.

### 3.3 Required Steps

Base workflows mark steps that cannot be removed with `required: true`. Policy linting ensures overlays keep these steps present.

## 4. Workflow Core Library (`@airnub/workflow-core`)

* JSON Schema (`schemas/workflow-definition.schema.json`) defines the DSL additions; `src/step-type.schema.json` is the authoritative contract for registry step types.
* `validateWorkflow(workflow)` exposes Ajv-backed validation for authoring tools and runtime safety; `validateStepType(stepType)` validates registry definitions before publish.
* Helper types exported for runtime/pack tooling.

## 5. Pack Model (`@airnub/workflow-packs`)

### 5.1 Manifest (`pack.yaml`)

```yaml
name: Tenant X Compliance Pack
version: 1.2.0
compatibleWithWorkflow:
  - setup-nonprofit-ie-charity@^2025.10
scopes:
  - tenant:tenant-x
overlays:
  - workflow: setup-nonprofit-ie-charity
    patch: overlay.patch.json
```

### 5.2 Overlay

`overlay.patch.json` contains RFC 6902 JSON Patch operations applied to the target workflow. Packs may also ship `schemas/*.json`,
`temporal/*.ts`, `docs-templates/*.md.hbs`, and localised copy under `messages/<locale>.json` (future work). When inserting registry-backed steps, patches set `stepType` and supply `execution.config` overrides plus tenant-specific metadata (titles, headers) without embedding secrets.

### 5.3 Validation Pipeline

1. Load base workflow (YAML) and validate with `@airnub/workflow-core`.
2. Apply overlay patch via `fast-json-patch` with structural clone.
3. Assert required steps survive.
4. Validate graph integrity (edges reference known steps).
5. Ensure `inputSchema` references resolve to pack assets or shared catalog entries.
6. Surface warnings (graph/schema issues) and fail on errors.

### 5.4 Impact Map

Packs report added, removed, and modified steps relative to the base workflow. Admin UI can reuse this to highlight merge effects.

### 5.5 Signature & Checksums

`signature.txt` may store the SHA-256 checksum of the pack directory. Validation compares this value against a computed checksum.

## 6. CLI (`fc-pack`)

```
Usage: fc-pack <command> [options]

Commands:
  validate <packDir> --workflow <path>   Validate pack against workflow
  impact <packDir> --workflow <path>     Show impact map after merge
  checksum <packDir>                     Print SHA-256 checksum for signing
  step-type validate <file>              Validate registry step type JSON
  step-type publish <file>               Publish/update registry entry via API
  overlay dev                            Launch local overlay builder preview
```

The CLI uses `tsx` so it runs directly against TypeScript sources. Admin automation can integrate it into CI or upload pipelines.

## 7. Runtime Expectations

* Portal resolves overlays at run start via `mergeWorkflowWithPacks` and persists merged snapshot + `stepType` references per step.
* Manual steps auto-generate forms from referenced JSON Schema; submissions validated server-side and stored as step outputs.
* Temporal orchestrator reads `execution.taskQueue` (or overrides under `execution.config`) to route jobs to tenant-specific workers; registry-backed Temporal steps log underlying workflow name for audit.
* `external:webhook` executions resolve `urlAlias` / `tokenAlias` / signing secret via `tenant_secret_bindings`, attach `X-FC-Idempotency-Key`, optionally `X-FC-Signature`, and apply exponential backoff with classification of 4xx/5xx responses.
* `external:websocket` executions launch a Temporal workflow that runs a websocket activity (headless), listens for events matching `messageSchema`, signals completion, and times out gracefully.

## 8. Tenant Overlay Builder (Portal)

- Workflow picker loads base definition + enabled step types for tenant.
- Graph editor allows insert-before/after, branching edges, and displays required step lock icons (cannot remove).
- Step configuration modal renders fields from `inputSchema`, shows read-only defaults from step type, and restricts secrets to alias dropdown sourced from `tenant_secret_bindings`.
- Policy lint banner surfaces violations (inline secrets, removal of required steps, retention conflicts) with quick fix links.
- Preview panel shows Impact Map + JSON Patch diff prior to publish; publish action persists overlay and records audit entry.
- Builder surfaces warnings when referencing step types newer than installed version; prompts admin to update install.

## 9. Next Steps

* Surface Impact Map + conflict resolution in Admin UI.
* Persist merged workflows per run with audit trail entries.
* Expand policy linting (GDPR data tags, step deadlines).
* Add pack signing with asymmetric keys and trust anchors.
