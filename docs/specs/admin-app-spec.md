# FreshComply Admin App — Back Office Spec

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
- **Security:** CSRF protection, per-admin rate limits on high-risk routes, redaction of PII in logs.

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
- Workflow extensions: `workflow_runs.orchestration_workflow_id`, `workflow_runs.execution_mode`, step-level auditing for reassignment/redo.
- Stored procedures for: step reassignment, due date shift, status marking, document regeneration queue, digest resend, watcher publish/reject, org/user CRUD, engagement linking, DSR actions, support case lifecycle.

## 6. Testing & Accessibility
- Unit tests: RBAC helpers, admin RPCs, audit logging hooks.
- Playwright flows: step reassignment, freshness approval, Temporal signal replay, DSR export download.
- Accessibility: Axe and Pa11y checks covering Dashboard, Run Inspector, Temporal panel.

## 7. Runbook
```
pnpm run dev:stack   # Temporal + Postgres (local)
pnpm run dev:worker  # Temporal worker bundle
pnpm run dev:admin   # Admin app on http://localhost:3100
```
Keep admin tooling isolated from customer portal; do not link to Temporal Web UI from customer surfaces.
