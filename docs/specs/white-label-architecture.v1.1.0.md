---
title: "FreshComply — White‐Label Multi‐Tenant Architecture"
version: 1.1.0
status: Stable
---








# FreshComply — White‑Label Multi‑Tenant Architecture

## Schema roles: public, app, platform

- public → tenant-owned data (org_id NOT NULL, RLS tenant/provider/platform patterns).
- app → helper functions/RPCs/claims; no tables with tenant/global data.
- platform → global catalogs; admin-only writes; tenants read via views/RPCs.

## Practical recommendation & scaffolding

Practical recommendation
Keep app for functions; add platform for global tables.
Your earlier design used app.is_platform_admin() and other helpers—those should stay in app. Create platform.* for global state.

Minimal SQL scaffolding (safe defaults):

-- helpers stay here
create schema if not exists app;

-- global data lives here
create schema if not exists platform;

-- example global catalog
create table if not exists platform.rule_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  spec jsonb not null,
  published_at timestamptz not null default now(),
  unique(name, version)
);

-- RLS: admin-only writes; tenants read via a view
alter table platform.rule_packs enable row level security;

create policy admin_read_rule_packs on platform.rule_packs
  for select using (app.is_platform_admin());

create policy admin_write_rule_packs on platform.rule_packs
  for all using (app.is_platform_admin())
  with check (app.is_platform_admin());

-- tenant-facing read-only view (optional)
create or replace view public.v_rule_packs as
  select id, name, version, spec, published_at
  from platform.rule_packs;

Client/server rule of thumb

Browser/client: never write to platform.*; read via public.v_* or server RPCs.

Admin app/server: can write platform.* using service role or a server-minted JWT with role=platform_admin.



**Repo:** `@airnub/fresh-comply`  
**Version:** 2025‑10‑03  
**Owner:** Platform Team (@airnub)  
**Status:** Source of truth for white‑label delivery (partners/Accountants) with secure multi‑tenant isolation

> Goal: Offer FreshComply as a **white‑label company formation & compliance service** that partners (e.g., accounting firms) can brand and operate for their clients, while platform admins keep a separate, hardened back‑office. This design fits the existing stack (Next.js + Supabase + Temporal + Tenant Overlays + Step Types).

---

## 1) Tenancy Model & Ownership

**Hierarchy**
- **Platform (Airlab/Airnub)** → Can see/manage all tenants from a **separate Admin app**; operates Freshness/Moderation and marketplace of step types/packs.
- **Partner/Reseller Org (e.g., Accountant “Company A”)** → Runs a branded portal for its **clients** (Companies X, Y…), manages their subscriptions, overlays, and integrations.
- **Client Organisation (Company X)** → Operates its workflows, users, artefacts, and filings; full visibility on steps and deadlines.

**Isolation (Supabase RLS)**
- Every row stores `org_id` and (when relevant) `subject_org_id`.
- Policies only allow:
  - Tenant users to read/write their tenant data and the client runs they **engage** (`engager_org_id = org_id`).
  - Client users to read/write their own `subject_org_id` data.
  - Platform admins via server-minted `{ role: 'platform_admin' }` (or boolean override) tokens; service-role keys stay server-only via `public.is_platform_service()` and are audited.

**Acting‑on‑behalf**
- Engagement records capture `{ actor_org_id, on_behalf_of_org_id }` for each action; audit trails include both.

---

## 2) White‑Label Delivery (Domains, Theme, Email, PDFs)

**Custom Domains**
- Table: `tenant_domains(tenant_id, domain, verified_at, cert_status)`.
- Next.js **Middleware** resolves `Host` → `org_id`, loads branding, and injects it server‑side. All tenants share the same app binary.
- Automated certificate issuance (ACME) with DNS validation; status visible in Partner Admin.

**Brand Theming**
- Table: `tenant_branding(tenant_id, tokens, logo_url, favicon_url, typography, pdf_footer)`.
- CSS variables derived from design tokens; SSR sets `<html data-theme=tenant-xyz>` to avoid FOUC.
- Tokens applied across portal UI and **Document Factory** (PDF/HTML outputs).

**White‑Label Email**
- Per‑tenant sender domains (DKIM/SPF). Wizard shows DNS records, verifies, and stores only **secret aliases** to provider creds.
- Email templates (digests, escalations, DSR acks) render with tenant branding.

**Documents & PDFs**
- Constitution/policies/minutes render with tenant logo/colors and optional footer/legal lines per tenant.

---

## 3) Orchestration & Integrations (Per‑Tenant)

**Temporal Queues**
- One shared namespace (optionally per‑tenant namespaces later). Work routes to **`tenant-{id}-main`** task queues.
- Search Attributes on workflows: `tenantId`, `runId`, `stepKey`, `subjectOrg`.

**Secure Data In/Out**
- **Egress** activities: outbound HTTP with `X‑FC‑Idempotency‑Key`, optional HMAC signature; resolve secrets from **tenant_secret_bindings** (aliases only).
- **Ingress** webhooks: `/hooks/{tenantId}/{channel}` verify HMAC+timestamp+nonce and **Signal** waiting workflows.
- **Patterns** supported: Request/Callback, Polling with timers, and Streaming (WebSocket activity + short workflow).

---

## 4) Product Surfaces

**Partner Admin (inside FreshComply Portal; tenant scope)**
- **Branding**: colors, logo, typography, favicons; live preview.
- **Domains**: add/verify domain, auto‑issue cert, switch default.
- **Clients**: create client orgs, invite users, set roles, start runs on behalf.
- **Extensions**: install **Step Types**, map **secret aliases** to the vault, build **Tenant Overlays** with the visual builder.
- **Billing**: manage partner subscription and (optionally) client subscriptions.

**Platform Admin (separate app/deploy)**
- Global ops: Freshness Moderation, Source Registry, marketplace of packs/step types, DSR console, ops dashboards, Temporal ops (signals/retries/cancel with approvals).

---

## 5) Subscriptions & Billing Models

- **Partner‑billed**: Platform invoices partner per seat/org/usage; partner bills clients directly.
- **Client‑billed + Rev‑Share**: Platform bills client orgs, then shares revenue with partner. 

Stripe Connect + Billing recommended; invoices, tax/VAT handling, and payouts are handled centrally. (Abstracted in code behind a `billing` service.)

---

## 6) Security, Privacy, Observability

- **RLS** everywhere; server‑side guards on all admin operations (aligned with [SOC 2 controls](./fresh-comply-spec.md#soc-2-compliance-requirements)).
- **Secrets**: overlays may only reference **aliases**; real credentials stay in vault and are resolved server/worker side.
- **Webhook hardening**: HMAC, nonce replay protection, strict time windows.
- **OTel tracing**: every span/log has `{ tenant_id, partner_org_id, subject_org_id, run_id, step_id, ticket_id }`.
- **Rate limits** per tenant on webhook ingress and egress retries.
- **GDPR**: DSR queue is tenant‑scoped; RoPA records include tenant processors/subprocessors.

---

## 7) Audit Trail & DSR

- **Append-only ledgers**: `audit_log` (tenant event stream) and `admin_actions` (platform-admin mutations) capture `{ id, org_id, subject_org_id, actor_user_id, actor_org_id, on_behalf_of_org_id, action, payload jsonb, created_at, prev_hash, curr_hash }` with immutable retention windows that satisfy [SOC 2 audit evidence requirements](./fresh-comply-spec.md#soc-2-compliance-requirements).
- **Hash-chain enforcement**: Postgres `BEFORE INSERT` trigger sets `curr_hash = sha256(prev_hash || row_digest)` and verifies `prev_hash` equals the latest committed hash per `(org_id, stream_key)`; `UPDATE`/`DELETE` are blocked via RLS and constraint triggers so the chain cannot be rewritten.
- **RLS views**: expose tenant-safe `audit_log_view` / `admin_actions_view` filtering by `org_id` and enriching actor metadata; platform-only variants can traverse cross-tenant `subject_org_id` for DSR and incident response. The [Admin App Spec](./admin-app-spec.md) consumes the platform view for moderation tooling.
- **RPC write-through pattern**: all admin surfaces and automated workflows call `rpc_append_audit_entry(actor, action, payload)` which writes to `admin_actions`, returns the hash link, and emits NOTIFY for workers that append to `audit_log` so UI latency stays low.
- **DSR lifecycle coverage**: DSR intake, acknowledgement, hold, fulfillment, and closure events append to `audit_log` with legal basis, SLA timestamps, and export bundle references; exports include the latest hash signature to prove integrity during regulator handoffs.

---

## 8) Minimal Schema Additions

```
tenants(id, name, created_at, ...)
tenant_domains(id, tenant_id, domain, verified_at, cert_status)
tenant_branding(tenant_id, tokens jsonb, logo_url, favicon_url, pdf_footer, typography)
tenant_secret_bindings(id, tenant_id, alias, provider, provider_ref, created_at)

-- Existing tables extend with tenant context where not present
organisations(subject_org_id, parent_org_id, ...)
engagements(actor_org_id, on_behalf_of_org_id, org_id, ...)
steps(..., execution_mode, orchestration_workflow_id, external_ref, artifacts jsonb)
workflow_runs(..., org_id, merged_workflow_snapshot jsonb)

-- Step Type Registry (global) + tenant installs
a) step_types(id, slug, latest_version, ...)
b) step_type_versions(step_type_id, version, definition_json)
tenant_step_type_installs(tenant_id, step_type_id, version, enabled)

-- Overlays/Packs
a) workflow_packs, workflow_pack_versions, workflow_pack_installs
```

All tables enforce tenant scoping via RLS; migrations are additive and non‑destructive.

---

## 9) Deployment & Routing

- **Single portal app** serves all tenants; routing via domain. Middleware loads tenant config and sets branding tokens SSR.
- **Platform Admin app** deploys separately, on an internal domain; additional SSO/conditional access as needed.
- **Workers** read tenant queue names and secret aliases; never log secret values.

---

## 10) Implementation Roadmap (Increments)

1) **Brand & Domain MVP**
   - Tables: `tenant_domains`, `tenant_branding`.
   - Middleware host → tenant resolver; SSR token injection; PDF theming.
   - DKIM wizard for sender verification; store provider aliases.

2) **Partner Admin surfaces**
   - Branding tab; Domains tab; Clients tab; Extensions tab (install Step Types, secret alias mapping, Overlay Builder).

3) **Temporal multi‑tenant**
   - Route orchestration to `tenant-{id}-main` task queue; add Search Attributes.

4) **Billing**
   - Stripe Connect + Billing scaffold (webhooks, subscription status on tenant/client); read‑only reporting to start.

5) **Observability & Guardrails**
   - OTel tenant tagging; rate limits; “no inline secrets” overlay lint; audit enrichments.

6) **Audit Trail & DSR**
   - Migrations for `audit_log`, `admin_actions`, hash-chain triggers, and per-scope RLS views.
   - RPC wrappers for write-through logging (`rpc_append_audit_entry`, `rpc_record_dsr_transition`) plus NOTIFY/LISTEN workers.
   - Reporting surfaces: Admin App audit feeds, tenant self-serve export, DSR lifecycle dashboards.

---

## 11) Acceptance Criteria

- Requests on a tenant’s custom domain render with that tenant’s theme, logo, and PDF branding; no FOUC.
- Partner Admin can: add a domain (verified), set branding, create client orgs, invite users, start a workflow on behalf, and install step types/overlays with secret aliases only.
- Temporal runs execute on per‑tenant task queues; Signals/Timers work; webhook ingress validates and routes to the correct run.
- RLS prevents cross‑tenant data access; audit trail append-only tables enforce hash-chain integrity per tenant and surface `{ actor_org_id, on_behalf_of_org_id }` for every mutation.
- DSR lifecycle events (intake → closure) are logged via the audit trail, and exports include integrity verification metadata from the hash chain.
- Billing records exist for partner/client subscriptions (even if read‑only initially).

---

## 12) Non‑Goals (MVP)

- Per‑tenant dedicated Temporal namespaces (supported later if required).
- Full billing flows (start with subscription scaffolding and upgrade later).
- Arbitrary code in tenant packs (marketplace review required for code).

---

## 13) References to Existing Components

- **Tenant Overlays & Step Types:** reuse for partner‑specific automations and integrations.
- **Bidirectional Integration Architecture:** secure ingress/egress, Signals/Timers, artifacts, and audits.
- **Freshness & Compliance Engine:** remains global; tenants receive updated workflow versions via moderation.

---

**End of White‑Label Multi‑Tenant Architecture (v2025‑10‑03).**
