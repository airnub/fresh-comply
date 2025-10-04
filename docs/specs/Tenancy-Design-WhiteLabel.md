---
title: "Tenancy Design – White-Label Platform"
version: 1.0.0
status: Draft
owners:
  - Platform Team (@airnub)
review_cycle: Quarterly
---

# Tenancy Design – White-Label Platform

> Governs how FreshComply exposes a white-label, multi-tenant environment where the platform operator (Airlab/Airnub), provider organizations, and their client organizations share infrastructure without violating isolation or governance requirements.

---

## 1. Scope & Principles

- **Audience:** Product, platform, and security engineers standing up the white-label experience, along with governance reviewers.
- **In Scope:** Supabase tenancy model, realm resolution, role checks, data distribution between `platform.*` and tenant schemas, white-label configuration, and tenancy-aware observability.
- **Out of Scope:** Billing orchestration (covered in [ADR-0002](../architecture/0002-billing-stripe.v1.0.0.md)) and detailed workflow overlay authoring (see [Tenant Overlay Spec](./extensions-tenant-overlays.v1.0.0.md)).
- **Principles:**
  - **Isolation first.** Tenants never rely on `NULL` scoping. Every row ties to a tenant context identifier.
  - **Provider delegated control.** Providers can manage their clients and branding without gaining access to platform-wide controls.
  - **Governance locks.** Platform catalogs and policies are writable only by platform admins via controlled surfaces.
  - **Least privilege.** Role helpers must allow the minimal permissions necessary for a given experience.

---

## 2. Tenancy Layers & Identity Model

| Layer | Description | Primary Identifier | Example Actors |
| --- | --- | --- | --- |
| **Platform** | Airlab/Airnub operations environment for moderation, registries, observability, and incident response. | `platform_admin` service claims | Platform SRE, Compliance Officer |
| **Provider (Partner Org)** | Accounting firm or reseller offering FreshComply under its brand. Hosts multiple client organizations. | `org_id` (provider) | Partner admin, Partner staff |
| **Client Organisation** | End-customer using workflows, document generation, and filings. | `subject_org_id` | Client owner, client collaborator |
| **End-user Actor** | Individual user authenticated via Supabase Auth or external SSO. | `app_user_id` | Staff, auditors, platform reviewers |

### Identity Resolution Flow

1. **Auth** issues JWT claims with `org_memberships` for tenant and client orgs, plus optional `platform_admin = true`.
2. **Realm resolution** middleware examines request context:
   - **Host-based** (`*.freshcomply.app` or custom domain) resolves to `org_id` using `platform.resolve_tenant_by_domain(host)` RPC.
   - **Path-based** fallback for internal tooling: `/platform/*` enforces `platform_admin` and bypasses tenant theming.
3. **Session context** stores `{ org_id, parent_org_id?, subject_org_id?, acting_org_id }`. Client-level resources (workflows, records) always include `subject_org_id` and the resolved `org_id`.
4. **Acting on behalf** captured via `engagements(actor_org_id, on_behalf_of_org_id, org_id, ...)` and per-request header `X-FC-On-Behalf-Of` so audit trails show delegation.

### Role Helpers

- `app.is_platform_admin()` → `jwt()->>"role" = 'platform_admin'` or equivalent service signing.
- `app.has_org_access(target_org uuid)` → returns `true` when user belongs to the tenant org **or** the specific client org.
- `app.is_provider_admin()` → tenant-level role enabling management of branding, domains, and client provisioning but not platform catalog changes.

---

## 3. Data Domains & Schema Boundaries

### Platform Schema (`platform.*`)

- **Purpose:** Global catalogs, moderated data, and governance tables.
- **Tables:**
  - `platform.rule_sources`, `platform.rule_packs`, `platform.rule_pack_versions`
  - `platform.step_types`, `platform.workflow_packs`
  - `platform.tenants` (registration metadata, legal terms, support contact)
  - `platform.tenant_limits` (seat/run limits, feature flags)
  - `platform.realm_domains` (primary domain map, verification metadata)
- **Policies:**
  - `SELECT` allowed for platform admins and server RPCs.
  - `INSERT/UPDATE/DELETE` limited to platform admins. Provider portals interact through RPCs returning read-only views.

### Shared Public Schema (`public.*`)

- Houses tenant-scoped operational data.
- **Required Columns:** `org_id UUID NOT NULL`, `created_by`, `created_at`, `updated_at`.
- **Example Tables:** `organisations`, `workflow_runs`, `run_steps`, `documents`, `audit_log`, `tenant_branding`, `tenant_domains`, `tenant_secret_bindings`.
- **Policy Template:**
  ```sql
  create policy tenant_rw on public.<table>
    using (app.has_org_access(org_id))
    with check (app.has_org_access(org_id));

  create policy platform_ro on public.<table>
    using (app.is_platform_admin());
  ```
- **Client-specific views** expose filtered subsets (e.g., `public.v_client_documents`) with additional `subject_org_id` predicates to avoid cross-client leakage inside a provider realm.

### Derived Data & Analytics

- Long-term analytics exported into `analytics.*` schema with anonymized tenant IDs and hashed subject IDs.
- Exports triggered by platform admins only and require audit logging of request, dataset, and export destination.

---

## 4. Realm Resolution & White-Label Configuration

### Domain Routing

1. Incoming request host matched against `platform.realm_domains`.
2. Verified domains populate `tenant_domains(tenant_id, domain, verified_at, cert_status)`.
3. Middleware attaches `org_id` to request, sets `x-tenant-org-id` header for internal API calls, and caches branding tokens.
4. Unknown domains return `HTTP 404` (no fallback to default tenant) to prevent host header abuse.

### Branding Tokens

- `tenant_branding` table stores a JSON document:
  ```json
  {
    "primaryColor": "#0F172A",
    "secondaryColor": "#36A3FF",
    "surface": "light",
    "logoUrl": "https://cdn.freshcomply.app/provider-x/logo.svg",
    "faviconUrl": "https://.../favicon.ico",
    "typography": {
      "heading": "Inter",
      "body": "Inter"
    },
    "pdfFooter": "© Provider X — Registered in Ireland"
  }
  ```
- Server-rendered pages wrap `<html data-tenant="{tenant_id}">` and inject CSS variables at build time to avoid flash of unstyled content.
- Document rendering pipelines resolve branding tokens and embed them in generated PDFs, including watermark or legal footer.

### Notification Templates

- Email/SMS templates accept `tenant_branding` tokens and per-tenant sender identities stored in `tenant_notification_profiles`.
- DKIM/SPF records tracked per domain. Platform never stores provider SMTP secrets; only alias references to the vault.

---

## 5. Access Control Scenarios

| Scenario | Required Role Helper | Notes |
| --- | --- | --- |
| Provider admin managing branding | `app.is_provider_admin()` | Allows CRUD on `tenant_branding`, `tenant_domains`, `tenant_notification_profiles`.
| Provider staff managing a client workflow | `app.has_org_access(target_client_org)` | Must also belong to provider tenant; actions recorded with `on_behalf_of_org_id`.
| Client owner editing their own workflow | `app.has_org_access(client_org_id)` | Limited to resources where `subject_org_id = client_org_id`.
| Platform moderator publishing rule packs | `app.is_platform_admin()` | Executes RPC on `platform.rule_pack_versions` and logs to `admin_actions` ledger.
| Platform support impersonating provider admin | Service role issues short-lived token via audited support tool; requires approval workflow and automatic email to provider owner.

**Two-person control:** Any operation crossing tenant boundaries (e.g., merging client records, transferring tenants) triggers Temporal workflow requiring dual approval logged in `admin_actions`.

---

## 6. Data Lifecycle & Governance

- **Tenant Registration:**
  1. Provider signs MSA → platform admin inserts record in `platform.tenants`.
  2. Automated workflow provisions `tenant_branding` defaults, invites provider admins, and creates DNS onboarding tasks.
  3. Provider accepts invitation → `org_id` created in `public.organisations` with `type = 'provider'`.

- **Client Provisioning:**
  1. Provider admin calls `/api/provider/clients` with metadata.
  2. API creates `public.organisations` row (`type = 'client'`, `parent_org_id = provider_org_id`).
  3. Temporal workflow seeds baseline overlays and documents to `org_id` context.

- **Offboarding:**
  - Soft-delete flag `deactivated_at` on tenant/client records; RLS denies new writes, but data retained for 7 years unless legal hold requires longer.
  - Export requests go through DSR workflow, collecting zipped audit logs and documents with brand tokens stripped.

- **Catalog Distribution:**
  - Platform publishes rule pack and step type versions into `platform.*` tables.
  - Provider tenants subscribe via `tenant_rule_pack_installs` referencing the latest `platform.rule_pack_versions` but storing adoption metadata in `public.workflow_lock_adoptions`.

---

## 7. Observability & Audit

- **Tracing:** All spans include `org_id`, `parent_org_id`, `subject_org_id`, `acting_org_id`, and `platform_request_id` attributes. Ingestion pipeline rejects spans missing tenant context.
- **Logging:** Structured JSON logs with `org_id` (and `parent_org_id` when applicable) appended server-side. Provider logs accessible only to provider admins via scoped search index.
- **Audit Trails:**
  - `public.audit_log` for tenant and client actions (append-only via trigger enforced hash chain).
  - `platform.admin_actions` for platform-level mutations. Write-only via RPC `platform.append_admin_action(actor, action, payload)`.
  - Cross-link entries via `correlation_id` so investigators can trace delegated actions end-to-end.
- **Alerting:** Multi-tenant anomaly detection monitors for cross-tenant access attempts; events forwarded to platform security channel with enriched metadata.

---

## 8. Security Controls

- **RLS Gate Reviews:** Automated CI script ensures new tables include `org_id` and policies referencing `app.has_org_access`. Failing to include both blocks merges.
- **Service Roles:**
  - `svc_portal` (provider/client portal) → `role = service`, limited to tenant queries via RPC.
  - `svc_platform_admin` → restricted to admin app; obtains SCIM-managed credentials rotated every 90 days.
- **Secret Management:** Providers map secret aliases to actual credentials in secure vault. Worker activities resolve alias at runtime; raw secrets never stored in database.
- **SSO:** Optional SAML/OIDC per provider. Metadata stored in `tenant_sso_connections` and activated by provider admins. Tokens always map to user rows with explicit tenant membership.
- **Data Residency:** Tenant record stores `region`. Provisioned services (Supabase project, storage buckets) deployed in the matching region or flagged if not available. Platform must document exceptions.

---

## 9. Implementation Roadmap

1. **Foundational Tenancy (Sprint 1–2)**
   - Implement `platform.tenants`, `platform.realm_domains`, `tenant_branding`, `tenant_domains` tables.
   - Add middleware for host resolution and tenancy context injection.
   - Migrate existing tenant data to ensure `org_id` is populated and `NOT NULL`.

2. **Provider Admin Surfaces (Sprint 3–4)**
   - Build `/provider/settings/branding`, `/provider/settings/domains`, `/provider/clients` pages.
   - Expose role management UI leveraging `app.has_org_access` and new provider admin role.
   - Integrate DNS verification workflow and automated certificate provisioning.

3. **Catalog Consumption (Sprint 5)**
   - Ship read-only views for rule packs and overlays.
   - Enable tenant adoption flows linking to `platform.rule_pack_versions`.
   - Add Temporal worker support for tenant-scoped queues and secret alias resolution.

4. **Governance Hardening (Sprint 6+)**
   - Enforce dual approval for cross-tenant actions.
   - Expand observability pipeline with tenant-enriched logs and alerts.
   - Run penetration test focused on provider-to-client breakout scenarios.

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Domain misconfiguration exposing wrong tenant | Leakage of branded experience or access to incorrect data | Require verified domains before routing, fallback to error, continuous monitoring of host headers |
| Provider staff lateral movement between clients | Unauthorised data access | Strict `app.has_org_access` checks combined with delegated audits and optional approval flows |
| Platform catalog corruption | All tenants inherit bad data | Append-only admin actions, moderation workflow, and release gating with canary tenants |
| Regional data residency breach | Regulatory non-compliance | Region metadata enforced in provisioning workflow and Data Residency policy audits |
| Tenant deprovisioning data loss | Legal exposure | Soft-delete with retention policy, export via DSR workflow, audit log immutability |

---

## 11. Open Questions

1. Do we allow provider admins to invite platform support into their tenant for time-boxed debugging?
2. Should platform-run analytics have per-provider opt-out toggles or contractual defaults?
3. How do we expose tenant health metrics (queue depth, webhook success) without leaking cross-tenant operations?
4. What automation migrates legacy single-tenant customers into the provider/client hierarchy?

---

## 12. References

- [FreshComply — White-Label Multi-Tenant Architecture Spec](./white-label-architecture.v1.0.0.md)
- [FreshComply — Consolidated Architecture & Tenancy Spec](./freshcomply-consolidated-spec.v1.0.0.md)
- [ADR-0003: White-Label Multi-Tenant Architecture](../architecture/0003-white-label-multi-tenant-architecture.v1.0.0.md)

