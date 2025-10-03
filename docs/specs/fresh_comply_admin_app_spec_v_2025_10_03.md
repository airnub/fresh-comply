# FreshComply — Admin App Spec

**Repo:** `@airnub/fresh-comply`  
**Version:** 2025‑10‑03  
**Owner:** @airnub  
**Status:** Source of truth for the **admin-only** back office app

> This document defines the product, security, and engineering requirements for a **backend admin app** used by platform admins and support agents to investigate issues, assist customers, and safely progress workflow states. It complements the main Portal spec (end-user app) and the Temporal orchestration ADR.

---

## 1) Purpose & Principles

- **Purpose:** Provide a **secure, auditable** console to support customers, moderate workflow freshness changes, manage organisations/users/engagements, and interface with orchestration (Temporal) **without exposing internal tools** to end users.
- **Principles:**
  - **Least privilege** RBAC; explicit elevation for destructive actions.
  - **Everything audited** (who, what, when, why) with reason codes.
  - **No direct DB writes** from browser; server-only operations via vetted APIs/stored procedures.
  - **Temporal headless**: use our own admin UI; Temporal Web UI is ops-only.
  - **GDPR-first**: DSR console, redaction tools, legal hold, and data retention actions.

---

## 2) Roles & Access Model

- **platform_admin** (Airlab/Airnub staff): full access to all tenants for support; can approve risky actions (2-person rule).
- **support_agent**: read-most; can create support cases, add internal notes, re-send notifications, re-run safe tasks; no destructive edits.
- **compliance_moderator**: approves rule/version changes from Freshness Engine; manages `rules`, `sources`, `workflow_defs` publishing.
- **dpo** (data protection officer role): manages DSR queue, exports, deletions, legal holds.

> **Guardrails:** Admin actions require **justification**; certain actions require **secondary approval** (platform_admin). All actions stamped with `{ actor_user_id, actor_org_id, on_behalf_of_org_id }` where applicable.

---

## 3) Scope (MVP)

1. **Global search** over Organisations, WorkflowRuns, Steps, Users, SupportCases.  
2. **Run Inspector**: see full run state, history, evidence, Temporal linkage; edit **Step** state (with guardrails), reassign, shift due date, re-send notifications, regenerate docs.  
3. **Temporal Console (custom)**: list workflows by `runId/stepKey`, view recent runs, **send signals**, **retry/cancel** (where safe), view activity error traces.  
4. **Freshness Moderation**: review watcher diffs → approve/reject → publish new `workflow_def.version` with changelog.  
5. **Users & Orgs**: create/edit **Organisation**, invite users, manage memberships/roles, set/reset **Engagements** (Org A ↔ Org X).  
6. **DSR Console**: intake queue, SLA timers (72h ack/30d resolve), generate exports, trigger deletions with legal hold checks, communication templates.  
7. **Notifications & Calendar**: re-send digests, force escalation, regenerate ICS tokens.  
8. **Support Cases**: create/link a case to runs/steps/users; internal notes; status; tags; attachments.

**Non-goals (MVP):**
- General end-user configuration UI (lives in Portal).
- Arbitrary SQL execution.

---

## 4) Architecture

- **apps/admin** (Next.js 15, App Router) — separate app from `apps/portal` for clear boundaries.
- **Auth:** Supabase Auth via `@supabase/ssr`; only users with admin roles can enter. Optional SSO (SAML/OIDC) later.
- **RBAC:** Server-side checks on every route/action; UI hides what’s not permitted.
- **APIs:** Server routes call **service-layer** functions which hit Supabase/Postgres stored procedures with **role checks** (never raw client-side writes).
- **Temporal:** Use **@airnub/orchestrator-temporal** client. All workflow actions go through our API (no direct Temporal UI links).
- **Observability:** Admin shows traces/logs from our observability backend (OpenTelemetry spans).

---

## 5) UI — Primary Screens

1. **Dashboard**: open tickets, overdue DSRs, failing workflows, watcher diffs awaiting moderation, recent admin actions.  
2. **Global Search**: typeahead over orgs/users/runs/steps/cases.  
3. **Run Inspector**:
   - Header: org, run, current phase %, version, acting context.
   - Tabs: **Timeline**, **Steps** (editable with guardrails), **Evidence**, **Docs**, **Notifications**, **Temporal**, **Audit**.
   - Actions: reassign step, set due date, re-send digest, regenerate doc, mark step **done**/**blocked** with reason.
4. **Temporal Panel** (custom): list child workflows & activities for this run/step; actions: **send signal**, **retry activity**, **cancel** (if safe), view last error.
5. **Freshness Moderation**: left diff (sources change), right impact map (rules/steps/templates), approve → new workflow_def.version with changelog.
6. **Users & Orgs**: CRUD orgs; invite users; set memberships; manage Engagements (Org A ↔ Org X) with scopes.
7. **DSR Console**: queue, timers, filters; action drawer for export/delete; canned email templates.
8. **Support Cases**: case list + detail; link to run/step/user; tags; attachments; internal-only notes.

> **UX Baseline:** Radix primitives, shadcn/ui components, next-intl, theme tokens, WCAG 2.2 AA.

---

## 6) Data Model Additions

```
support_cases(id, title, status, priority, org_id, run_id, step_id, opened_by_user_id, assignee_user_id, tags text[], created_at, updated_at)
support_notes(id, case_id, author_user_id, body, is_internal boolean, created_at)
admin_actions(id, actor_user_id, action, target_kind, target_id, reason_code, meta_json, created_at)
feature_flags(key primary key, enabled boolean, audience, description)
legal_holds(id, subject_kind, subject_id, reason, created_at, released_at)
```

> **RLS:** Admin tables protected so only admin roles can read/write; audit_log remains cross-tenant readable by admins but only **for context** involved in support work.

---

## 7) Guardrails & Approvals

- **Two-person rule** for risky ops (delete org, hard-delete user data, cancel Temporal workflow, edit step state backwards).  
- **Reason codes** and free-text justification mandatory.  
- **Safety checks**: changing a step to **done** verifies **requires**; downgrading a run version requires explicit migration path.

---

## 8) GDPR & Compliance Features (Admin)

- **DSR queue:** intake, timers, status; export ZIP/JSON/CSV; deletion jobs that respect `legal_holds`.  
- **RoPA viewer**: read-only.  
- **Subprocessors**: CRUD for registry; change-notice broadcasting.  
- **Consent**: view/override per user with reason; log to audit.

---

## 9) Temporal Ops (Admin)

- **List** workflows by `runId`, `stepKey` (Search Attributes).  
- **Signals**: send standard signals (e.g., `confirmManualFiling(receiptUrl)`).  
- **Retries**: trigger safe retry for last failed activity.  
- **Cancel**: allowed only with two-person approval; records action and justification.  
- **Health**: display worker heartbeats and queue lengths.

---

## 10) Notifications & Calendar Tools

- Re-send morning digest to a user/org.  
- Force **escalation** for overdue tasks.  
- Regenerate **ICS** tokens and invalidate old ones.

---

## 11) Security, Logging, and Audit

- **AuthN:** Supabase with `@supabase/ssr`; optional SSO later.  
- **AuthZ:** server-side guards; actions behind **POST** with CSRF protection; rate limiting.  
- **Audit:** all admin actions write to `admin_actions` and `audit_log` (actor, target, diff preview).  
- **PII Redaction:** logs use stable IDs; payload redaction in server logs.

---

## 12) Testing & Quality Gates

- Unit tests for admin APIs and guards.  
- e2e (Playwright) for Run Inspector edit with approval flow.  
- a11y checks (axe/Pa11y) for key pages.  
- Visual snapshots for admin theme variants.

---

## 13) Acceptance Criteria (MVP)

- Only admin roles can access `apps/admin`.  
- Global search returns entities across tenants.  
- Run Inspector can safely reassign a step, push a due date, regenerate a document, and re-send a digest — all audited.  
- Temporal Panel can send a signal and retry a failed activity; cancel requires second approval.  
- Freshness Moderation publishes a new workflow version with changelog.  
- DSR Console: intake → acknowledge → export ZIP; deletions honor legal holds.

---

## 14) Roadmap & Enhancements

- **Session shadowing** (read-only impersonation) with explicit banner and no write by default.  
- **Run snapshot & diff**: capture state before/after admin intervention; downloadable diff.  
- **Auto-fix suggestions**: propose safe corrections (e.g., missing `requires`) and simulate impact.  
- **Sandbox replay**: re-run a failing run with masked data in a sandbox to reproduce issues.  
- **Bulk tools**: batch re-verify rules, mass re-send digests, backfill ICS.  
- **Ops health**: dashboards for watcher failures, overdue DSR SLAs, Temporal queue depth.  
- **SSO** (SAML/OIDC) for admins, conditional access policies, hardware key requirement.  
- **Legal hold UI** for marking entities under investigation.  
- **Feature flag UI** for staged rollouts.

---

## 15) Deliverables Checklist

- `apps/admin` scaffold with pages: Dashboard, Search, Run Inspector, Freshness Moderation, Users & Orgs, DSR Console, Support Cases.  
- Admin APIs with server-only procedures and RLS-safe RPC.  
- New tables & migrations for support cases, notes, admin actions, legal holds.  
- Tests & CI gates; a11y and visual checks.  
- Docs updated: this spec linked from main spec; ADR references.

---

**End of Admin App Spec (v2025‑10‑03).**

