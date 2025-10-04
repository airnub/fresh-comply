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
  - **Isolation first.** Tenants never rely on `NULL` scoping. Every row ties to an owning `org_id`.
  - **Provider delegated control.** Providers can manage their clients and branding without gaining access to platform-wide controls.
  - **Governance locks.** Platform catalogs and policies are writable only by platform admins via controlled surfaces.
  - **Least privilege.** Role helpers must allow the minimal permissions necessary for a given experience.

---

## 2. Tenancy Layers & Identity Model

| Layer | Description | Identifier | Hierarchy Context | Example Actors |
| --- | --- | --- | --- | --- |
| **Platform** | Airlab/Airnub operations environment for moderation, registries, observability, and incident response. | `org_id` (platform root) | `parent_org_id = NULL` | Platform SRE, Compliance Officer |
| **Provider (Partner Org)** | Accounting firm or reseller offering FreshComply under its brand. Hosts multiple customer organizations. | `org_id` (provider) | `parent_org_id = <platform org_id>` | Partner admin, Partner staff |
| **Customer Organisation** | End-customer using workflows, document generation, and filings. | `org_id` (customer) | `parent_org_id = <provider org_id>` | Customer owner, customer collaborator |
| **End-user Actor** | Individual user authenticated via Supabase Auth or external SSO. | `app_user_id` | Linked to one or more `org_id` memberships | Staff, auditors, platform reviewers |

### Identity Resolution Flow

1. **Auth** issues JWT claims with `org_memberships` (array of `org_id` values) and the optional `platform_admin = true` flag. Membership entries are always tied back to the `public.organisations` tree via `parent_org_id`.
2. **Realm resolution** middleware examines request context:
   - **Host-based** (`*.freshcomply.app` or custom domain) resolves to a provider `org_id` using `platform.resolve_org_by_domain(host)` RPC and caches the resulting lineage `{ org_id, parent_org_id, platform_root_org_id }`.
   - **Path-based** fallback for internal tooling: `/platform/*` enforces `platform_admin` and bypasses provider/customer branding realms.
3. **Session context** stores `{ active_org_id, provider_org_id, platform_org_id, acting_org_id }`. Customer-scoped resources persist their owning `org_id` (the customer) with `parent_org_id` pointing at the provider. Provider-level assets use the provider `org_id` directly.
4. **Acting on behalf** captured via `engagements(actor_org_id, on_behalf_of_org_id, parent_org_id, ...)` and per-request header `X-FC-On-Behalf-Of` so audit trails show delegation without duplicating provider/customer identifiers.

### Role Helpers

- `app.is_platform_admin()` → `jwt()->>"role" = 'platform_admin'` or equivalent service signing.
- `app.has_org_access(target_org uuid)` → returns `true` when the user belongs to the target `org_id` **or** any ancestor in its lineage. Provider admins therefore reach customer orgs via recursive parent checks.
- `app.is_provider_admin()` → provider-level role enabling management of branding, domains, and customer provisioning but not platform catalog changes.

Helper implementations reference the canonical tenancy spec helpers (`app.get_org_lineage`, `app.list_member_orgs`) to ensure RLS checks and application middleware share the same recursive membership logic.

---

## 3. Data Domains & Schema Boundaries

### Platform Schema (`platform.*`)

- **Purpose:** Global catalogs, moderated data, and governance tables.
- **Tables:**
  - `platform.rule_sources`, `platform.rule_packs`, `platform.rule_pack_versions`
  - `platform.step_types`, `platform.workflow_packs`
  - `platform.tenants` (registration metadata, legal terms, support contact)
  - `platform.org_limits` (seat/run limits, feature flags)
  - `platform.realm_domains` (primary domain map, verification metadata)
- **Policies:**
  - `SELECT` allowed for platform admins and server RPCs.
  - `INSERT/UPDATE/DELETE` limited to platform admins. Provider portals interact through RPCs returning read-only views.

### Shared Public Schema (`public.*`)

- Houses org-scoped operational data.
- **Required Columns:** `org_id UUID NOT NULL`, `parent_org_id UUID REFERENCES public.organisations(org_id)`, `created_by`, `created_at`, `updated_at`.
- **Example Tables:** `organisations`, `workflow_runs`, `run_steps`, `documents`, `audit_log`, `org_branding_realms`, `org_domains`, `org_secret_bindings`.
- **Policy Template:**
  ```sql
  create policy org_rw on public.<table>
    using (app.has_org_access(org_id))
    with check (app.has_org_access(org_id));

  create policy platform_ro on public.<table>
    using (app.is_platform_admin());
  ```
- **Customer-specific views** expose filtered subsets (e.g., `public.v_customer_documents`) with lineage-aware predicates ensuring the caller's `active_org_id` matches the record `org_id` or a descendant in the provider hierarchy.

### Derived Data & Analytics

- Long-term analytics exported into `analytics.*` schema with anonymized org IDs and hashed subject IDs.
- Exports triggered by platform admins only and require audit logging of request, dataset, and export destination.

---

## 4. Realm Resolution & White-Label Configuration

### Domain Routing

1. Incoming request host matched against `platform.realm_domains`.
2. Verified domains populate `org_domains(org_id, domain, verified_at, cert_status)` so each row directly references the provider `org_id`.
3. Middleware attaches the resolved provider `org_id` (and derived customer `org_id` when applicable) to the request, sets `x-org-id` for internal API calls, and caches branding tokens keyed by a `branding_realm_id` mapped back to the owning `org_id`.
4. Unknown domains return `HTTP 404` (no fallback to default tenant) to prevent host header abuse.

### Branding Tokens

- `org_branding_realms` table stores a JSON document scoped by `branding_realm_id` with a foreign key to the owning `org_id`:
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
- Server-rendered pages wrap `<html data-org="{org_id}">` and inject CSS variables at build time to avoid flash of unstyled content. The separate `branding_realm_id` allows shared branding across sibling orgs when required for resellers.
- Document rendering pipelines resolve branding tokens and embed them in generated PDFs, including watermark or legal footer.

### Notification Templates

- Email/SMS templates accept `org_branding_realms` tokens and per-org sender identities stored in `org_notification_profiles`.
- DKIM/SPF records tracked per domain. Platform never stores provider SMTP secrets; only alias references to the vault.

---

## 5. Access Control Scenarios

| Scenario | Required Role Helper | Notes |
| --- | --- | --- |
| Provider admin managing branding | `app.is_provider_admin()` | Allows CRUD on `org_branding_realms`, `org_domains`, `org_notification_profiles` tied to their provider `org_id`.
| Provider staff managing a customer workflow | `app.has_org_access(target_org_id)` | Must also belong to provider org; actions recorded with `on_behalf_of_org_id` for audit.
| Customer owner editing their own workflow | `app.has_org_access(customer_org_id)` | Limited to resources where record `org_id = customer_org_id`.
| Platform moderator publishing rule packs | `app.is_platform_admin()` | Executes RPC on `platform.rule_pack_versions` and logs to `admin_actions` ledger.
| Platform support impersonating provider admin | Service role issues short-lived token via audited support tool; requires approval workflow and automatic email to provider owner.

**Two-person control:** Any operation crossing tenant boundaries (e.g., merging customer records, transferring org ownership) triggers Temporal workflow requiring dual approval logged in `admin_actions`.

---

## 6. Data Lifecycle & Governance

- **Tenant Registration:**
  1. Provider signs MSA → platform admin inserts record in `platform.tenants`.
  2. Automated workflow provisions default `org_branding_realms`, invites provider admins, and creates DNS onboarding tasks.
  3. Provider accepts invitation → new `org_id` created in `public.organisations` with `type = 'provider'` and `parent_org_id = <platform org_id>`.

- **Customer Provisioning:**
  1. Provider admin calls `/api/provider/customers` with metadata.
  2. API creates `public.organisations` row (`type = 'customer'`, `parent_org_id = provider_org_id`).
  3. Temporal workflow seeds baseline overlays and documents to the new customer `org_id` context.

- **Offboarding:**
  - Soft-delete flag `deactivated_at` on provider/customer org records; RLS denies new writes, but data retained for 7 years unless legal hold requires longer.
  - Export requests go through DSR workflow, collecting zipped audit logs and documents with brand tokens stripped.

- **Catalog Distribution:**
  - Platform publishes rule pack and step type versions into `platform.*` tables.
  - Provider orgs subscribe via `org_rule_pack_installs` referencing the latest `platform.rule_pack_versions` but storing adoption metadata in `public.workflow_lock_adoptions`.

---

## 7. Observability & Audit

- **Tracing:** All spans include `active_org_id`, `acting_org_id`, `on_behalf_of_org_id`, and `platform_request_id` attributes. Ingestion pipeline rejects spans missing an owning `org_id`.
- **Logging:** Structured JSON logs append the owning `org_id` (customer or provider) server-side. Provider logs accessible only to provider admins via scoped search index that enforces `app.has_org_access(org_id)` checks.
- **Audit Trails:**
- `public.audit_log` for provider and customer org actions (append-only via trigger enforced hash chain).
  - `platform.admin_actions` for platform-level mutations. Write-only via RPC `platform.append_admin_action(actor, action, payload)`.
  - Cross-link entries via `correlation_id` so investigators can trace delegated actions end-to-end.
- **Alerting:** Multi-tenant anomaly detection monitors for cross-tenant access attempts; events forwarded to platform security channel with enriched metadata.

---

## 8. Security Controls

- **RLS Gate Reviews:** Automated CI script ensures new tables include `org_id` (and, where applicable, `parent_org_id`) plus policies referencing `app.has_org_access`. Failing to include both blocks merges.
- **Service Roles:**
- `svc_portal` (provider/customer portal) → `role = service`, limited to org-scoped queries via RPC.
  - `svc_platform_admin` → restricted to admin app; obtains SCIM-managed credentials rotated every 90 days.
- **Secret Management:** Providers map secret aliases to actual credentials in secure vault. Worker activities resolve alias at runtime; raw secrets never stored in database.
- **SSO:** Optional SAML/OIDC per provider. Metadata stored in `org_sso_connections` and activated by provider admins. Tokens always map to user rows with explicit org memberships.
- **Data Residency:** Provider org record stores `region`. Provisioned services (Supabase project, storage buckets) deployed in the matching region or flagged if not available. Platform must document exceptions.

---

## 9. Implementation Roadmap

1. **Foundational Tenancy (Sprint 1–2)**
   - Implement `platform.tenants`, `platform.realm_domains`, `org_branding_realms`, `org_domains` tables.
   - Add middleware for host resolution and tenancy context injection.
   - Migrate existing tenancy data to ensure every row has `org_id` populated, `parent_org_id` set correctly, and RLS policies aligned with `app.has_org_access(org_id)`.

2. **Provider Admin Surfaces (Sprint 3–4)**
  - Build `/provider/settings/branding`, `/provider/settings/domains`, `/provider/customers` pages.
   - Expose role management UI leveraging `app.has_org_access` and new provider admin role.
   - Integrate DNS verification workflow and automated certificate provisioning.

3. **Catalog Consumption (Sprint 5)**
   - Ship read-only views for rule packs and overlays.
   - Enable org adoption flows linking to `platform.rule_pack_versions`.
   - Add Temporal worker support for org-scoped queues and secret alias resolution.

4. **Governance Hardening (Sprint 6+)**
   - Enforce dual approval for cross-org actions.
   - Expand observability pipeline with org-enriched logs and alerts.
   - Run penetration test focused on provider-to-customer breakout scenarios.

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Domain misconfiguration exposing wrong org | Leakage of branded experience or access to incorrect data | Require verified domains before routing, fallback to error, continuous monitoring of host headers |
| Provider staff lateral movement between customers | Unauthorised data access | Strict `app.has_org_access` checks combined with delegated audits and optional approval flows |
| Platform catalog corruption | All tenants inherit bad data | Append-only admin actions, moderation workflow, and release gating with canary tenants |
| Regional data residency breach | Regulatory non-compliance | Region metadata enforced in provisioning workflow and Data Residency policy audits |
| Org deprovisioning data loss | Legal exposure | Soft-delete with retention policy, export via DSR workflow, audit log immutability |

---

## 11. Open Questions

1. Do we allow provider admins to invite platform support into their org (tenant) for time-boxed debugging?
2. Should platform-run analytics have per-provider opt-out toggles or contractual defaults?
3. How do we expose org health metrics (queue depth, webhook success) without leaking cross-tenant operations?
4. What automation migrates legacy single-tenant customers into the provider/customer hierarchy?

---

## 12. References

- [FreshComply — White-Label Multi-Tenant Architecture Spec](./white-label-architecture.v1.0.0.md)
- [FreshComply — Consolidated Architecture & Tenancy Spec](./freshcomply-consolidated-spec.v1.0.0.md)
- [ADR-0003: White-Label Multi-Tenant Architecture](../architecture/0003-white-label-multi-tenant-architecture.v1.0.0.md)

