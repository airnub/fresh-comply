-- Auto-consolidated baseline (2025-10-04T14:42:43.521Z)
-- Constraints (FKs) & Indexes

ALTER TABLE public.orgs ADD CONSTRAINT "orgs_parent_org_id_fkey" foreign key (parent_org_id)
  references public.orgs(id)
  on delete restrict;
ALTER TABLE public.steps ADD CONSTRAINT "steps_step_type_version_id_fkey" foreign key (step_type_version_id)
  references platform.step_type_versions(id);
ALTER TABLE public.tenant_step_type_installs ADD CONSTRAINT "tenant_step_type_installs_step_type_version_id_fkey" foreign key (step_type_version_id)
  references platform.step_type_versions(id) on delete cascade;
ALTER TABLE public.tenant_workflow_overlays ADD CONSTRAINT "tenant_workflow_overlays_workflow_def_fk" constraint tenant_workflow_overlays_workflow_def_fk
    foreign key (org_id, workflow_def_id) references workflow_defs(org_id, id) on delete cascade;
ALTER TABLE public.workflow_def_versions ADD CONSTRAINT "workflow_def_versions_workflow_def_fk" constraint workflow_def_versions_workflow_def_fk
    foreign key (org_id, workflow_def_id) references workflow_defs(org_id, id) on delete cascade;
ALTER TABLE public.workflow_runs ADD CONSTRAINT "workflow_runs_workflow_def_fk" constraint workflow_runs_workflow_def_fk
    foreign key (org_id, workflow_def_id) references workflow_defs(org_id, id);

create index dsr_requests_tenant_status_idx on dsr_requests(org_id, status, due_at);
create index dsr_request_jobs_schedule_idx on dsr_request_jobs(job_type, run_after) where processed_at is null;
create unique index tenant_domains_tenant_domain_unique on tenant_domains(org_id, domain);
create unique index tenant_domains_primary_unique on tenant_domains(org_id) where is_primary;
create index tenant_domains_lookup_idx on tenant_domains(domain, verified_at);
create index tenant_domains_tenant_idx on tenant_domains(org_id, verified_at);
create index tenant_branding_updated_idx on tenant_branding(updated_at desc);
create index tenant_branding_tokens_idx on tenant_branding using gin (tokens jsonb_path_ops);
create index billing_tenants_tenant_idx on billing_tenants(org_id);
create index billing_subscriptions_tenant_idx on billing_subscriptions(org_id);
create index billing_subscriptions_status_idx on billing_subscriptions(status);
create index billing_prices_active_idx on billing_prices(is_active);
create unique index if not exists audit_log_row_hash_key on audit_log(row_hash);
create unique index admin_actions_row_hash_key on admin_actions(row_hash);
create index if not exists source_registry_tenant_idx on source_registry(org_id);
create index source_snapshot_source_idx on source_snapshot(source_id, fetched_at desc);
create index if not exists source_snapshot_tenant_idx on source_snapshot(org_id);
create index change_event_source_idx on change_event(source_id, detected_at desc);
create index if not exists change_event_tenant_idx on change_event(org_id, detected_at desc);
create index rule_versions_rule_idx on rule_versions(rule_id);
create index if not exists rule_versions_tenant_idx on rule_versions(org_id);
create index template_versions_template_idx on template_versions(template_id);
create index if not exists template_versions_tenant_idx on template_versions(org_id);
create index if not exists workflow_def_versions_tenant_idx on workflow_def_versions(org_id);
create index workflow_pack_versions_pack_idx on workflow_pack_versions(pack_id);
create index if not exists workflow_pack_versions_tenant_idx on workflow_pack_versions(org_id);
create index if not exists moderation_queue_tenant_status_idx on moderation_queue(org_id, status, created_at desc);
create index moderation_queue_change_event_idx on moderation_queue(change_event_id);
create index release_notes_scope_idx on release_notes(org_id, scope, ref_id);
create index adoption_records_scope_idx on adoption_records(org_id, scope, ref_id);
create index adoption_records_run_idx on adoption_records(run_id);
create unique index audit_log_tenant_chain_position_key on audit_log(tenant_id, chain_position);
create unique index audit_log_tenant_row_hash_key on audit_log(tenant_id, row_hash);
create index platform_rule_sources_jurisdiction_category_idx
  on platform.rule_sources(jurisdiction, category);
create index platform_rule_source_snapshots_source_idx
  on platform.rule_source_snapshots(rule_source_id, fetched_at desc);
create index platform_rule_packs_key_idx on platform.rule_packs(pack_key);
create index platform_rule_pack_detections_pack_idx
  on platform.rule_pack_detections(rule_pack_key, detected_at desc);
create index platform_rule_pack_detections_status_idx
  on platform.rule_pack_detections(status);
create index platform_rule_pack_detection_sources_source_idx
  on platform.rule_pack_detection_sources(rule_source_id);
create index source_registry_org_idx on source_registry(org_id);
create index source_snapshot_org_idx on source_snapshot(org_id);
create index change_event_org_idx on change_event(org_id, detected_at desc);
create index rule_versions_org_idx on rule_versions(org_id);
create index template_versions_org_idx on template_versions(org_id);
create index workflow_def_versions_org_idx on workflow_def_versions(org_id);
create index workflow_pack_versions_org_idx on workflow_pack_versions(org_id);
create index moderation_queue_org_status_idx on moderation_queue(org_id, status, created_at desc);
create index platform_rule_pack_proposals_status_idx
  on platform.rule_pack_proposals(status);
create index platform_rule_pack_proposals_pack_idx
  on platform.rule_pack_proposals(rule_pack_key, proposed_version);
create unique index if not exists workflow_defs_org_id_id_key on workflow_defs(org_id, id);
create index workflow_defs_org_key_idx on workflow_defs(org_id, key);
create index tenant_secret_bindings_org_alias_idx on tenant_secret_bindings(org_id, alias);
create index tenant_workflow_overlays_org_workflow_idx on tenant_workflow_overlays(org_id, workflow_def_id);
create index tenant_step_type_installs_org_idx on tenant_step_type_installs(org_id);
create index tenant_workflow_overlays_org_idx on tenant_workflow_overlays(org_id);
create index if not exists orgs_parent_idx on public.orgs (parent_org_id);
create index if not exists org_memberships_user_role_idx
  on public.org_memberships (user_id, role);
create index if not exists org_memberships_org_status_idx
  on public.org_memberships (org_id, status);
create index if not exists realms_provider_idx on public.realms (provider_org_id);
do $$
declare
  rec record;
  has_null boolean;
  idx_name text;
  qualified text;
begin
  for rec in
    select table_schema, table_name
    from information_schema.columns
    where column_name = 'org_id'
      and table_schema = 'public'
  loop
    qualified := format('%I.%I', rec.table_schema, rec.table_name);

    execute format('select exists (select 1 from %s where org_id is null)', qualified)
      into has_null;

    if has_null then
      raise exception 'Table % has NULL org_id rows; global rows must be migrated before enforcing tenancy.', qualified;
    end if;

    execute format('alter table %s alter column org_id type uuid using org_id::uuid', qualified);
    execute format('alter table %s alter column org_id set not null', qualified);

    idx_name := format('%s_org_id_idx', rec.table_name);
    execute format('create index if not exists %I on %s (org_id)', idx_name, qualified);
  end loop;
end$$;
create index if not exists orgs_type_idx on public.orgs (type);
