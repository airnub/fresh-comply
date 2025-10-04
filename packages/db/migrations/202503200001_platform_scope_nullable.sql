begin;

-- This migration previously attempted to introduce cross-tenant "platform" rows
-- by making org_id nullable and relaxing RLS policies. That approach was
-- reverted in favour of dedicated platform scoped tables. Reassert the original
-- tenant invariants and fail fast if any nullable rows slipped in while the
-- permissive version was deployed.

-- Guardrails: ensure no NULL org_id data exists. If it does, operators
-- must migrate those records to platform.* tables before rerunning.

create schema if not exists app;

create or replace function app.__ensure_not_null(_table regclass, _column text) returns void
language plpgsql
as $$
declare
  v_has_null boolean;
begin
  execute format('select exists (select 1 from %s where %I is null)', _table, _column)
    into v_has_null;
  if coalesce(v_has_null, false) then
    raise exception '% has NULL %. Manual backfill required before applying migration.', _table::text, _column;
  end if;
end;
$$;

select app.__ensure_not_null('source_registry', 'org_id');
select app.__ensure_not_null('source_snapshot', 'org_id');
select app.__ensure_not_null('change_event', 'org_id');
select app.__ensure_not_null('rule_versions', 'org_id');
select app.__ensure_not_null('template_versions', 'org_id');
select app.__ensure_not_null('workflow_def_versions', 'org_id');
select app.__ensure_not_null('workflow_pack_versions', 'org_id');
select app.__ensure_not_null('moderation_queue', 'org_id');
select app.__ensure_not_null('release_notes', 'org_id');
select app.__ensure_not_null('adoption_records', 'org_id');

drop function app.__ensure_not_null(regclass, text);

-- Restore strict tenant scoping policies without NULL bypasses. These match the
-- definitions introduced in 202503150001_freshness_tables.sql.

alter policy "Tenant members read source registry" on source_registry
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read source snapshots" on source_snapshot
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read change events" on change_event
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read rule versions" on rule_versions
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read template versions" on template_versions
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read workflow def versions" on workflow_def_versions
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read workflow pack versions" on workflow_pack_versions
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members view moderation queue" on moderation_queue
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read release notes" on release_notes
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read adoption records" on adoption_records
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members insert adoption records" on adoption_records
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

commit;
