---
title: "FreshComply — Consolidated Architecture & Tenancy Spec (2025-10-04)"
version: 1.0.0
status: Stable
---








# FreshComply — Consolidated Architecture & Tenancy Spec (2025-10-04)

> This document is the canonical reference for FreshComply's multi-tenant data architecture, platform registries, and RLS enforcement. It supersedes earlier product/architecture specs. Always update this spec first when adjusting tenancy logic.

## 1. Tenancy Model (public schema)

- Every tenant-scoped table stores a hard, non-null `org_id` or `tenant_org_id` column that points at `public.organisations(id)`.
- Supabase Row Level Security (RLS) is enabled on all tenant tables. Policies rely on membership helpers instead of nullable org columns.
- `app.is_org_member(target_org uuid)` gatekeeps tenant operations. It returns `true` when:
  - the request comes from the Supabase service role,
  - the JWT contains `{ role: 'platform_admin' }` or `is_platform_admin: true`, or
  - the authenticated user has an active membership in the target org.
- Admin override is universal: RLS policies include `app.is_platform_admin()` so operators can read/write across tenants for support and moderation.
- Hash chains (`audit_log`, `admin_actions`) stamp the acting tenant to guarantee tamper evidence per tenant.

### Tenancy guarantees

- Inserts/updates must provide a tenant id; migrations enforce `NOT NULL` on `org_id`/`tenant_org_id` and add covering indexes for lookup performance.
- RPCs that accept `tenant_org_id` call `public.assert_tenant_membership` to reject null context and unauthorized access.
- Temporal workflows, document generation, and DSR processing all reference the tenant id so that downstream audit entries and webhooks carry the correct scope.

## 2. Platform Schema (global assets)

- Shared registries live under the `platform` schema: `rule_sources`, `rule_source_snapshots`, `rule_packs`, `rule_pack_detections`, `rule_pack_detection_sources`, `rule_pack_proposals`, `step_types`, and `step_type_versions`.
- Platform tables enable RLS with **admin/service only** policies:
  - `using/with check (public.is_platform_service() or app.is_platform_admin())`
  - Tenants consume read-only views (`public.v_step_types`, `public.v_step_type_versions`) or server-exposed RPCs.
- Watchers and admin tooling authenticate with service-role Supabase clients or server-minted platform admin JWTs. Browser clients never receive credentials that can mutate `platform.*`.
- Backfills move legacy global rows (where org id used to be NULL) into the platform schema. Follow-up migrations drop nullable tenancy logic.

## 3. Admin Override & JWT Helpers (`app` schema)

```sql
create or replace function app.jwt() returns jsonb;
create or replace function app.is_platform_admin() returns boolean;
create or replace function app.is_org_member(target_org uuid) returns boolean;
```

- `app.jwt()` unwraps `request.jwt.claims` (defaults to `{}`) to avoid null lookups in policies.
- `app.is_platform_admin()` accepts either a role claim (`role = 'platform_admin'`) or explicit `is_platform_admin` boolean flag (minted by the admin API).
- `app.is_org_member()` wraps membership lookups and cascades platform admin/service allowances.
- Use `public.is_member_of_org()` in policies to keep SQL migrations concise.

## 4. Migration & Backfill Guidelines

1. Create helper functions first (`app` schema) so subsequent migrations can rely on them idempotently.
2. Introduce new `platform.*` tables, copy shared rows from public tables, and delete legacy NULL-tenant rows.
3. Rename `tenant_org_id` to `org_id` when scoping to the owning tenant for clarity; immediately enforce `NOT NULL` + indexes.
4. Rebuild RLS policies to use `app.is_org_member()` and `app.is_platform_admin()`—never fall back to `... IS NULL` guards.
5. Add read-only views/RPCs when tenants need catalog access (e.g., `public.v_step_types`).
6. Write regression migrations that assert no NULL tenant keys remain before tightening constraints (see 202510040001_tenant_overlay_install_scope.sql).

## 5. CI Guardrails

- `.github/workflows/policy-rls.yml` fails if any SQL file reintroduces `org_id IS NULL` / `tenant_org_id IS NULL` checks in policies.
- The same workflow blocks client bundles from calling `supabase.from('platform.*').insert/update/upsert/delete`.
- `packages/db/check-rls.mjs` validates `schema.sql` includes RLS enablement and lacks forbidden NULL tenancy gates.

## 6. Test Matrix

| Persona | Expected Access |
|---------|-----------------|
| Tenant member | CRUD only within their `org_id` via `app.is_org_member`; platform tables are read-only via views, writes rejected. |
| Platform admin | Full cross-tenant read/write plus platform registries via admin app or service routes. |
| Service role | Same as platform admin, intended for workers/watchers only. |
| Anonymous/browser | Restricted to public views; no write surface to tenant or platform tables. |

Regression tests live under `packages/db/tests/*` and cover:
- Tenant vs admin RLS (`workflow_defs_rls.test.sql`, `tenant_extension_scope.test.sql`).
- Platform registry isolation (`freshness_tables_rls.test.sql`).
- Platform admin claim handling (`platform_admin_claim.test.sql`).

## 7. Operational Notes

- Admin API endpoints mint JWTs with `{ role: 'platform_admin' }` on the server before proxying to Supabase.
- Freshness watchers (`packages/freshness/src/watcher.ts`) require service-role keys; they fail fast if the platform schema is unavailable.
- When adding new platform registries, mirror the pattern: create under `platform`, enforce admin/service-only RLS, expose tenant-safe views.
- Archive superseded specs in `docs/_archive/<date>/` with a banner that points back to this file.

## 8. Change Control Checklist

- [ ] Update this spec for any tenancy, RLS, or platform schema change.
- [ ] Provide SQL migrations that are idempotent and re-runnable in dev.
- [ ] Extend regression tests covering tenant vs admin access.
- [ ] Wire new guardrails into CI when introducing additional constraints.
- [ ] Archive outdated docs immediately to avoid conflicting guidance.
