---
title: "Coding Agent Prompt — Link `AGENTS.md` + Implement White‐Label Multi‐Tenant Plan"
version: 1.0.0
status: Stable
---








# Coding Agent Prompt — Link `AGENTS.md` + Implement White‑Label Multi‑Tenant Plan

**Repo:** `airnub/fresh-comply`  
**Branch:** `main`  
**Source Spec:** `docs/specs/white-label-architecture.v1.0.0.md`  
**Objectives:**
1) **Link** `AGENTS.md` to the new white‑label spec and the other canonical docs.
2) **Break down** the white‑label architecture into **incremental issues/PR tasks**:
   - (A) Domains + Branding **MVP**
   - (B) **Partner Admin** surfaces
   - (C) **Per‑tenant Temporal queues**
   - (D) **Billing scaffold** (Stripe decision locked; use Supabase × Stripe database wrapper if viable)
   - (E) **Observability & Guardrails**
3) **Document decisions**: Stripe is the billing partner (ADR‑0002) and use a Supabase‑first Stripe database wrapper/pattern if possible.
4) **Enforce RLS** isolation between tenants while allowing **platform admin** cross‑tenant operations.
5) **Design & implement a full audit trail** suitable for Ireland/EU data laws.

> Guardrails: **No breaking changes** to existing runtime; additive migrations; all new env keys into `.env.example`; secrets only as **aliases** resolved server‑side.

---

## 0) Prep — Doc Links & ADRs

**Tasks**
- [ ] Update `AGENTS.md` → add a “White‑Label Architecture” link to:
  - `docs/specs/white-label-architecture.v1.0.0.md` (current)
  - keep links to: consolidated spec, admin spec, overlays spec, integration architecture, ADR‑0001 (Temporal)
- [ ] Create ADR‑0002: `docs/architecture/0002-billing-stripe.v1.0.0.md` recording:
  - **Decision:** Stripe is the billing partner; prefer Supabase‑aligned “Stripe database wrapper” pattern (Postgres tables + triggers + server functions + Stripe webhooks) where feasible.
  - **Context:** Multi‑tenant white‑label billing (partner‑billed vs client‑billed+rev‑share), EU VAT, involuntary churn handling.
  - **Consequences:** Introduce `billing_*` tables, webhook handler, and service layer; secrets via aliases; RLS‑safe views.
- [ ] Update `docs/INDEX.md` (docs index) to include the new white‑label spec & ADR‑0002.

**Acceptance**
- `AGENTS.md` and docs index show the new links; ADR‑0002 committed.

---

## 1) RLS Baseline — Tenancy & Roles (Cross‑cutting)

**Goal:** Enforce strict tenant isolation via **Supabase RLS**, while enabling **platform_admin** to operate across tenants; record acting‑on‑behalf context.

**Schema/Migrations**
- [ ] Ensure/extend **tenant context** on core tables: `organisations(tenant_org_id)`, `workflow_runs(tenant_org_id)`, `steps(tenant_org_id)`, `documents(tenant_org_id)`, `audit_log(tenant_org_id)`, `admin_actions(tenant_org_id)`, `engagements(tenant_org_id)`, etc.
- [ ] Create/ensure roles:
  - `platform_admin` (global), `tenant_admin`, `org_member`, `read_only`.
- [ ] RLS policies (examples):
  - Tenants: `using (tenant_org_id = auth.jwt()→tenant_org_id)` + membership checks.
  - Clients: `using (subject_org_id in auth.jwt()→org_ids)`.
  - Platform admin: via server‑side **service role** only; never in browser.
- [ ] All write ops go through **RPCs / stored procedures** that log `{ actor_user_id, actor_org_id, on_behalf_of_org_id }` to `audit_log`.

**Acceptance**
- Cross‑tenant access attempts fail under RLS; platform service ops succeed and are fully audited.

---

## 2) (A) Domains + Branding MVP

**Goal:** Multi‑tenant white‑label delivery by **domain** with SSR‑applied branding and PDF styling.

**Schema/Migrations**
- [ ] `tenant_domains(id, tenant_id, domain, verified_at, cert_status, created_at)`
- [ ] `tenant_branding(tenant_id pk, tokens jsonb, logo_url, favicon_url, pdf_footer, typography, updated_at)`

**Backend & UI**
- [ ] **Middleware** (portal): resolve `Host` → `tenant_id`; load branding; inject `<html data-theme=tenant‑{id}>` SSR.
- [ ] Shared **design tokens** → Tailwind CSS variables; persist per‑tenant in `tenant_branding.tokens`.
- [ ] Document Factory: accept tenant branding → render in **PDF & HTML**.
- [ ] Basic **Partner Admin** section (tenant‑scoped) to edit branding (logo, colors, typography, footer) with live preview.

**DNS/Cert (scaffold)**
- [ ] Domain add/verify flow: show DNS records, verify, mark `verified_at`.
- [ ] Cert issuance plumbing (abstracted; can be manual in MVP).

**Acceptance**
- Request on a mapped domain shows correct theme/logo **without FOUC**; generated PDFs include tenant branding.

---

## 3) (B) Partner Admin Surfaces

**Goal:** Tenant admins manage their **branding, domains, clients, extensions** inside the portal (not the platform Admin app).

**Features**
- [ ] **Branding tab** (from §2).
- [ ] **Domains tab**: add/verify domain; show cert status.
- [ ] **Clients tab**: create client organisations; invite users; set roles; start workflow runs **on behalf of** a client; all operations via RPCs that write to `audit_log`.
- [ ] **Extensions tab**: install **Step Types** (from registry), map **secret aliases** in `tenant_secret_bindings`, and build **Tenant Overlays** with the visual builder.

**Acceptance**
- Tenant admin can create a client, start a run on behalf, and insert a custom step through the overlay builder—**all audited** and RLS‑safe.

---

## 4) (C) Per‑Tenant Temporal Queues

**Goal:** Route orchestration to **per‑tenant Task Queues** while keeping our custom UI.

**Tasks**
- [ ] In `@airnub/orchestrator-temporal`, add queue resolver: `tenant-{id}-main`.
- [ ] Add Temporal **Search Attributes**: `tenantId`, `runId`, `stepKey`, `subjectOrg`.
- [ ] Update workflow starters to include tenant queue; workers subscribe to `tenant-*` with filtering or multiple workers.
- [ ] Admin ops (platform app): list workflows by tenant; send Signals; retry; cancel with two‑person approval.

**Acceptance**
- A demo run started by Tenant A executes on `tenant-A-main`; Tenant B’s runs do not intermix.

---

## 5) (D) Billing Scaffold — **Stripe** (Decision Locked)

**Decision (recorded in ADR‑0002)**
- **Billing partner:** Stripe.
- **Approach:** Prefer a **Supabase‑first, database‑backed wrapper** (tables+functions+webhooks) where possible (e.g., customer/subscription sync via triggers and a Stripe webhook receiver running server‑side).

**Schema/Migrations (MVP)**
- [ ] `billing_tenants(tenant_id, stripe_customer_id, billing_email, plan, status, created_at)`
- [ ] `billing_subscriptions(id, tenant_id, stripe_subscription_id, plan, status, current_period_end, created_at, updated_at)`
- [ ] `billing_prices(id, stripe_price_id, plan_code, interval, currency)`
- [ ] Views **RLS‑safe** per tenant for portal visibility.

**Backend**
- [ ] Webhook handler for Stripe events (customer.updated, subscription.updated, invoice.payment_*). Store minimal data, avoid PII where possible.
- [ ] Service layer to: create customer (tenant), attach default payment method, subscribe/cancel, upgrade/downgrade.
- [ ] **Rev‑share ready** (design): future tables for partner revenue mapping if you choose client‑billed + rev‑share.

**UI**
- [ ] Tenant Billing page: show plan & status; link to update payment method (Stripe‑hosted portal or embedded).

**Acceptance**
- A tenant can be subscribed/unsubscribed; status updates via webhook reflected in the portal; RLS prevents other tenants from seeing it; platform admin can view all.

---

## 6) (E) Observability & Guardrails

**Goal:** Robust visibility + safety for a white‑label, multi‑tenant system.

**Tasks**
- [ ] **OpenTelemetry**: propagate `{ tenant_id, partner_org_id, subject_org_id, run_id, step_id }` across UI → API → activities; add log correlation IDs.
- [ ] **Rate limits** per tenant for webhook ingress & egress; circuit breakers on flaky downstreams.
- [ ] **Overlay lints**: forbid inline secrets; require secret **aliases** only; block removal of `required: true` base steps; block illicit automation against no‑API portals.
- [ ] **Security headers/CSP**; dependency scanning; pre‑commit secret scanning.

**Acceptance**
- Tenant‑tagged traces visible; rate limit/circuit breakers observable; overlay lints trigger with good messages.

---

## 7) Full Audit Trail — Design & Implementation

**Goal:** An **append‑only, tamper‑evident** audit suitable for Irish/EU data laws (GDPR, accountability principle), with reason codes and actor contexts.

**Design Principles**
- **Append‑only & immutable**: no updates/deletes; corrections are new entries.
- **Tamper‑evident**: per‑row SHA‑256 and an optional **hash chain** (prev_hash) for high assurance.
- **Clock integrity**: server time with NTP; record `created_at` and `request_time` if provided; store timezone/offset.
- **Actor context**: `{ actor_user_id, actor_org_id, on_behalf_of_org_id, tenant_org_id, role }`.
- **Purpose & basis**: include `purpose_code` and `lawful_basis` when processing involves personal data.
- **PII minimisation**: store references/ids, not raw PII where possible; redact payloads in logs; store document checksums.
- **Data lineage**: link to `document_id`, `step_id`, `run_id`, `source_id` where relevant.

**Schema/Migrations**
- [ ] `audit_log(id uuid, tenant_org_id, actor_user_id, actor_org_id, on_behalf_of_org_id, target_kind, target_id, action, reason_code, meta_json, ip, user_agent, created_at, row_hash, prev_hash)`
- [ ] `admin_actions(id uuid, tenant_org_id, actor_user_id, action, target_kind, target_id, reason_code, meta_json, created_at, row_hash, prev_hash)`
- [ ] Database trigger to compute `row_hash` and link `prev_hash` (per‑tenant chain).
- [ ] Views for reporting with RLS (tenants see own; platform admin all).

**Write Path**
- [ ] All privileged mutations go through **RPCs** that: validate role, write to domain tables, write audit row, and return affected ids. Client cannot directly write audit.

**DSR Support**
- [ ] `dsr_requests(id, tenant_org_id, subject_org_id, type, status, ack_at, due_at, resolved_at)`
- [ ] Audit every DSR state transition; export job compiles all relevant data with document checksums.

**Acceptance**
- Any partner/client mutation yields an audit row with full actor context & reason code; hash chain verifies; reports scoped under RLS.

---

## 8) Issues & PR Workflow (suggested)

Create GitHub issues labeled by **phase** and **area**; open PRs per checklist below.

**Milestone 1 — Domains & Branding MVP**
- [ ] M1‑1: Migrations (`tenant_domains`, `tenant_branding`) + RLS
- [ ] M1‑2: Middleware host→tenant resolver + SSR theme
- [ ] M1‑3: Branding editor UI + PDF branding
- [ ] M1‑4: Domain verify flow (records only)

**Milestone 2 — Partner Admin Surfaces**
- [ ] M2‑1: Clients CRUD + invites (RPC + audit)
- [ ] M2‑2: Extensions tab (install step types, map secret aliases)
- [ ] M2‑3: Overlay Builder integration (tenant scope)

**Milestone 3 — Temporal Queues**
- [ ] M3‑1: Queue resolver + Search Attributes
- [ ] M3‑2: Worker subscription and filtering
- [ ] M3‑3: Admin ops for signals/retries (platform app)

**Milestone 4 — Billing (Stripe)**
- [ ] M4‑1: ADR‑0002 + migrations (`billing_*`)
- [ ] M4‑2: Stripe webhook + service layer
- [ ] M4‑3: Tenant billing UI (read‑only to start)

**Milestone 5 — Observability & Guardrails**
- [ ] M5‑1: OTel tenant tags; basic dashboards
- [ ] M5‑2: Rate limits & circuit breakers
- [ ] M5‑3: Overlay/policy lints

**Milestone 6 — Audit Trail**
- [ ] M6‑1: `audit_log` + triggers (hash chain)
- [ ] M6‑2: RPC write‑throughs + reports (RLS views)
- [ ] M6‑3: DSR queue auditability + export checksum

---

## 9) Environment & CI

- [ ] Update `.env.example`: `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`, `OTEL_EXPORTER_OTLP_ENDPOINT`, etc.
- [ ] Add CI checks for: lint/type/test, **markdown link check** (AGENTS.md + `/docs/**`), database migrations (dry run), and a basic RLS test.

---

## 10) Definition of Done (global)

- `AGENTS.md` links to the new white‑label spec & ADR‑0002; docs index updated.
- RLS enforced across all new tables; platform admin usable via service role.
- Domains + Branding work on real tenants; PDFs themed; no FOUC.
- Partner Admin can manage clients and extensions; overlay builder functions tenant‑scoped.
- Temporal routes work to per‑tenant queues; admin can operate workflows.
- Stripe billing scaffold in place; statuses reflect via webhook; RLS‑safe views.
- OTel + guardrails operational; overlay lints protect against unsafe configs.
- **Audit trail** is append‑only, hash‑chained, and populated by RPCs; DSR actions fully audited.
