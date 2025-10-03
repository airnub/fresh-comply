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

### 3.1 Execution Modes

`execution.mode` now supports three values:

| Mode      | Description                                           | Required fields                  |
|-----------|-------------------------------------------------------|----------------------------------|
| `manual`  | Portal-only human task with optional form validation. | `input_schema?`, `permissions?`  |
| `temporal`| Temporal workflow/activity orchestration.            | `workflow`, `taskQueue`          |
| `external`| Signed webhook invocation for customer-hosted logic. | `webhook`                        |

Each execution block may also declare:

* `input_schema`: Relative path to a JSON Schema (served via admin or pack assets).
* `permissions`: Array of RBAC scopes required to view/complete the step.
* `secret_aliases`: Vault lookups resolved server-side before execution.

### 3.2 Required Steps

Base workflows mark steps that cannot be removed with `required: true`. Policy linting ensures overlays keep these steps present.

## 4. Workflow Core Library (`@airnub/workflow-core`)

* JSON Schema (`schemas/workflow-definition.schema.json`) defines the DSL additions.
* `validateWorkflow(workflow)` exposes Ajv-backed validation for authoring tools and runtime safety.
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
`temporal/*.ts`, `docs-templates/*.md.hbs`, and localised copy under `messages/<locale>.json` (future work).

### 5.3 Validation Pipeline

1. Load base workflow (YAML) and validate with `@airnub/workflow-core`.
2. Apply overlay patch via `fast-json-patch` with structural clone.
3. Assert required steps survive.
4. Validate graph integrity (edges reference known steps).
5. Ensure `input_schema` references resolve to pack assets.
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
```

The CLI uses `tsx` so it runs directly against TypeScript sources. Admin automation can integrate it into CI or upload pipelines.

## 7. Runtime Expectations

* Portal resolves overlays at run start via `mergeWorkflowWithPacks`.
* Temporal orchestrator reads `execution.taskQueue` to route jobs to tenant-specific workers.
* External executions call signed webhooks with retries and audit logging (implementation pending).

## 8. Next Steps

* Surface Impact Map + conflict resolution in Admin UI.
* Persist merged workflows per run with audit trail entries.
* Expand policy linting (GDPR data tags, step deadlines).
* Add pack signing with asymmetric keys and trust anchors.
