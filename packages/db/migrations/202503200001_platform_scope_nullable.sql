begin;

alter table source_registry
  alter column tenant_org_id drop not null;

alter table source_snapshot
  alter column tenant_org_id drop not null;

alter table change_event
  alter column tenant_org_id drop not null;

alter table rule_versions
  alter column tenant_org_id drop not null;

alter table template_versions
  alter column tenant_org_id drop not null;

alter table workflow_def_versions
  alter column tenant_org_id drop not null;

alter table workflow_pack_versions
  alter column tenant_org_id drop not null;

alter table moderation_queue
  alter column tenant_org_id drop not null;

alter table release_notes
  alter column tenant_org_id drop not null;

alter policy "Tenant members read source registry" on source_registry
  using (
    auth.role() = 'service_role'
    or tenant_org_id is null
    or public.is_member_of_org(tenant_org_id)
  );

alter policy "Tenant members read source snapshots" on source_snapshot
  using (
    auth.role() = 'service_role'
    or tenant_org_id is null
    or public.is_member_of_org(tenant_org_id)
  );

alter policy "Tenant members read change events" on change_event
  using (
    auth.role() = 'service_role'
    or tenant_org_id is null
    or public.is_member_of_org(tenant_org_id)
  );

alter policy "Tenant members read rule versions" on rule_versions
  using (
    auth.role() = 'service_role'
    or tenant_org_id is null
    or public.is_member_of_org(tenant_org_id)
  );

alter policy "Tenant members read template versions" on template_versions
  using (
    auth.role() = 'service_role'
    or tenant_org_id is null
    or public.is_member_of_org(tenant_org_id)
  );

alter policy "Tenant members read workflow def versions" on workflow_def_versions
  using (
    auth.role() = 'service_role'
    or tenant_org_id is null
    or public.is_member_of_org(tenant_org_id)
  );

alter policy "Tenant members read workflow pack versions" on workflow_pack_versions
  using (
    auth.role() = 'service_role'
    or tenant_org_id is null
    or public.is_member_of_org(tenant_org_id)
  );

alter policy "Tenant members view moderation queue" on moderation_queue
  using (
    auth.role() = 'service_role'
    or tenant_org_id is null
    or public.is_member_of_org(tenant_org_id)
  );

alter policy "Tenant members read release notes" on release_notes
  using (
    auth.role() = 'service_role'
    or tenant_org_id is null
    or public.is_member_of_org(tenant_org_id)
  );

commit;
