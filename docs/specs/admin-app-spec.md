# FreshComply — Admin App Spec (v2025-10-03)

**Version:** 2025-10-03  \
**Owner:** Platform Admin Team  \
**Scope:** Secure administrative interface for operations, support, compliance, and DPO teams.

## 1. Purpose & Guardrails
- Provide internal-only tooling for investigating workflow issues, moderating freshness, managing organisations/users, and coordinating Temporal orchestration without exposing raw Temporal UI.
- Enforce least-privilege RBAC (`platform_admin`, `support_agent`, `compliance_moderator`, `dpo`). UI only surfaces actions the current role can perform.
- All state changes require reason codes and log to `admin_actions` and the unified audit log. Destructive actions require two-person approval.
- Admin clients never bypass RLS; all writes go through server functions or RPC signed with the service role.

## 2. Architecture
- **Framework:** Next.js 15 (App Router) with TypeScript, Tailwind CSS, Radix primitives, and shadcn/ui components.
- **i18n:** `next-intl` with locales `en-IE` and `ga-IE`.
- **Auth:** Supabase Auth via `@supabase/ssr`. Middleware negotiates locale, enforces authentication, and redirects non-admins to login.
- **RBAC Utilities:** `src/lib/rbac.ts` exposes helpers for step editing and second-approval checks.
- **Audit Layer:** Every API mutation records `admin_action_id`, reason codes, diff snapshots, and actor metadata.
- **Security:** CSRF protection, per-admin rate limits on high-risk routes, redaction of PII in logs; adheres to [Product Spec §11.1 SOC 2 controls](./fresh-comply-spec.md#soc-2-compliance-requirements).

## 3. App Structure
```
apps/admin
 ├── src/app
 │   ├── [locale]/(auth)/login
 │   ├── [locale]/(dashboard)
 │   ├── [locale]/runs/[runId]
 │   ├── [locale]/runs/[runId]/temporal
 │   ├── [locale]/freshness
 │   ├── [locale]/orgs
 │   ├── [locale]/dsr
 │   ├── [locale]/cases
 │   └── api/admin/*
 ├── src/components
 └── src/lib
```
Each route focuses on a key operational workflow:
- **Dashboard:** Aggregate metrics, queue health, accessibility smoke checks.
- **Global Search:** Query runs, steps, orgs, users, and cases with keyboard shortcuts.
- **Run Inspector:** Read-only overview plus guarded actions (reassign, due-date shift, status update, document regeneration, digest resend, workflow cancellation).
- **Temporal Panel:** Proxies `@airnub/orchestrator-temporal` to inspect workflow executions, send signals, retry activities, and request cancellations.
- **Freshness Moderation:** Review watcher diffs, approve/reject updates, publish new workflow definitions with changelog.
- **Orgs & Users:** Create organisations, manage memberships, invite users, and manage engagements.
- **DSR Console:** Track acknowledgment/resolve SLAs, export bundles, toggle legal holds, and drive erase pipelines.
- **Support Cases:** Manage case lifecycle, notes, attachments (Supabase Storage), and tagging.

## 4. API Surface
- All handlers live under `/api/admin/*` and are server-only.
- Mutations call stored procedures that validate RBAC, append audit entries, and enforce two-person approval where required.
- Endpoints emit structured logs with `admin_action_id` for correlation.
- Temporal actions (signals, retries, cancellations) are proxied through backend helpers; Temporal address is never exposed to the browser.

## 5. Data Model Additions
- Tables: `support_cases`, `support_notes`, `admin_actions`, `feature_flags`, `legal_holds`.
- Step Type Registry: `step_types` (slug + latest version), `step_type_versions` (semver + definition JSON), `tenant_step_type_installs` (per-tenant enable/pin), `tenant_secret_bindings` (alias → provider/path), `json_schemas` (shared request/response schemas).
- Workflow extensions: `workflow_runs.orchestration_workflow_id`, `workflow_runs.execution_mode`, step-level auditing for reassignment/redo, `steps.step_type_id`, `steps.step_type_version`.
- Stored procedures for: step reassignment, due date shift, status marking, document regeneration queue, digest resend, watcher publish/reject, org/user CRUD, engagement linking, DSR actions, support case lifecycle, step type publish/retire, tenant enable/disable, secret alias binding.

## 6. Step Type Registry & Secret Alias Management
- **Access Control:** Only `platform_admin` may create or edit step types. Tenants see a read-only catalog and can enable allowed types + map secret aliases. Every mutation records `admin_action_id`, reason, diff snapshot, and enforces two-person approval if flagged.
- **Step Types List:** Paginated table showing slug, latest version, execution mode, created/updated metadata, enabled tenants count, and status (active/retired). Filters by mode and version.
- **Create / Edit Step Type:**
  - Form captures name, description, locales (`i18n` bundle), execution mode selector (`manual`, `temporal`, `external:webhook`, `external:websocket`).
  - Mode-specific fields: Temporal workflow + optional default task queue; Webhook method, URL alias, token alias, header templates, optional signing secret alias; WebSocket URL/token aliases, message schema ref, temporal workflow + task queue recommendation.
  - Attach input schema (required) and optional output schema from `json_schemas`; defaults for permissions/policy (retention, lawful basis, required flag).
  - Version picker enforces semver and surfaces diff from prior version. Publishing writes to `step_type_versions`, updates `step_types.latest_version`, and emits audit record.
- **Version History Drawer:** Inspect JSON definition, changelog, impacted tenants, and download schema bundle for CLI tooling.
- **Tenant Enablement:** Toggle to install step type for a tenant (optionally pin to version or follow latest). Creates/updates `tenant_step_type_installs` via RPC with RBAC + audit. Bulk enable includes confirmation modal with policy warnings.
- **Secret Alias Bindings:**
  - Table of aliases installed by tenant (`secrets.crm.apiToken`). Columns: alias, provider (`hashicorp`, `aws-sm`, `env`, `supabase-kv`), provider ref/path, last verified timestamp.
  - Add/Edit modal requires alias pattern validation, provider selection, path/ARN/key input. Admin never sees secret value. "Test connection" triggers backend HEAD/echo using stored credential and surfaces success/error state.
  - Deleting alias requires reason + double-confirm, checks for active step type usage before removal.
- **Safety:** UI never shows resolved secret values; copy actions share alias only. Inline lint prevents saving step types that contain literal secrets or missing schema references. All actions log to audit trail.

## 7. Testing & Accessibility
- Unit tests: RBAC helpers, admin RPCs, audit logging hooks.
- Playwright flows: step reassignment, freshness approval, Temporal signal replay, DSR export download, step type publish/install, secret alias binding lifecycle.
- Accessibility: Axe and Pa11y checks covering Dashboard, Run Inspector, Temporal panel.

## 8. Runbook
```
pnpm run dev:stack   # Temporal + Postgres (local)
pnpm run dev:worker  # Temporal worker bundle
pnpm run dev:admin   # Admin app on http://localhost:3100
```
Keep admin tooling isolated from customer portal; do not link to Temporal Web UI from customer surfaces.

## 9. SOC 2 Control Coverage

The admin app is a primary surface for SOC 2 evidence collection. It must:

- **Enforce Controlled Changes:** All privileged actions require authenticated admins, role checks, reason codes, and (where specified) two-person approval to satisfy change-management controls.
- **Guarantee Audit Integrity:** Persist `admin_actions` and related log entries in append-only stores with hashes/diffs so auditors can trace sample selections back to immutable evidence.
- **Surface Access Reviews:** Provide exports/reporting for quarterly access reviews (users, roles, step type editors, Temporal operators) aligned with the joiner/mover/leaver workflow defined in [Product Spec §11.1](./fresh-comply-spec.md#soc-2-compliance-requirements).
- **Track Monitoring Events:** Bubble queue health, watcher drift, and incident annotations into admin dashboards so monitoring/incident-response evidence is reviewable.
- **Link Vendor Decisions:** Store subprocessor approvals/attestations and make them discoverable for SOC 2 vendor-management samples.
- **Support Evidence Packaging:** Offer filtered exports (CSV/JSON) tagged with control IDs to streamline quarterly readiness packets.
