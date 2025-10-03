begin;

create table if not exists source_registry (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  name text not null,
  url text not null,
  parser text not null,
  jurisdiction text,
  category text,
  created_at timestamptz not null default now(),
  unique (tenant_org_id, url)
);

create index if not exists source_registry_tenant_idx on source_registry(tenant_org_id);

create table if not exists source_snapshot (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  source_id uuid not null references source_registry(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  content_hash text not null,
  parsed_facts jsonb not null,
  storage_ref text,
  created_at timestamptz not null default now(),
  unique (source_id, content_hash)
);

create index if not exists source_snapshot_source_idx on source_snapshot(source_id, fetched_at desc);
create index if not exists source_snapshot_tenant_idx on source_snapshot(tenant_org_id);

create table if not exists change_event (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  source_id uuid not null references source_registry(id) on delete cascade,
  from_hash text,
  to_hash text not null,
  detected_at timestamptz not null default now(),
  severity text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists change_event_source_idx on change_event(source_id, detected_at desc);
create index if not exists change_event_tenant_idx on change_event(tenant_org_id, detected_at desc);

create table if not exists rule_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  rule_id text not null,
  version text not null,
  logic_jsonb jsonb not null,
  sources jsonb not null,
  checksum text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (tenant_org_id, rule_id, version)
);

create index if not exists rule_versions_rule_idx on rule_versions(rule_id);
create index if not exists rule_versions_tenant_idx on rule_versions(tenant_org_id);

create table if not exists template_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  template_id text not null,
  version text not null,
  storage_ref text not null,
  checksum text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (tenant_org_id, template_id, version)
);

create index if not exists template_versions_template_idx on template_versions(template_id);
create index if not exists template_versions_tenant_idx on template_versions(tenant_org_id);

create table if not exists workflow_def_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  workflow_def_id uuid not null references workflow_defs(id) on delete cascade,
  version text not null,
  graph_jsonb jsonb not null,
  rule_ranges jsonb not null default '{}'::jsonb,
  template_ranges jsonb not null default '{}'::jsonb,
  checksum text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (workflow_def_id, version)
);

create index if not exists workflow_def_versions_tenant_idx on workflow_def_versions(tenant_org_id);

create table if not exists workflow_pack_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  pack_id text not null,
  version text not null,
  overlay_jsonb jsonb not null,
  checksum text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (tenant_org_id, pack_id, version)
);

create index if not exists workflow_pack_versions_pack_idx on workflow_pack_versions(pack_id);
create index if not exists workflow_pack_versions_tenant_idx on workflow_pack_versions(tenant_org_id);

create table if not exists moderation_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  change_event_id uuid references change_event(id) on delete set null,
  proposal jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'amended')),
  classification text,
  reviewer_id uuid references users(id),
  decided_at timestamptz,
  created_by uuid references users(id),
  notes_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moderation_queue_tenant_status_idx on moderation_queue(tenant_org_id, status, created_at desc);
create index if not exists moderation_queue_change_event_idx on moderation_queue(change_event_id);

create table if not exists release_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  scope text not null,
  ref_id text not null,
  from_version text,
  to_version text not null,
  classification text not null,
  effective_date date,
  notes_md text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index if not exists release_notes_scope_idx on release_notes(tenant_org_id, scope, ref_id);

create table if not exists adoption_records (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  run_id uuid references workflow_runs(id) on delete set null,
  scope text not null,
  ref_id text not null,
  from_version text,
  to_version text not null,
  mode text not null,
  actor_id uuid references users(id),
  decided_at timestamptz not null default now(),
  notes jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists adoption_records_scope_idx on adoption_records(tenant_org_id, scope, ref_id);
create index if not exists adoption_records_run_idx on adoption_records(run_id);

alter table workflow_runs
  add column if not exists merged_workflow_snapshot jsonb;

alter table source_registry enable row level security;
alter table source_snapshot enable row level security;
alter table change_event enable row level security;
alter table rule_versions enable row level security;
alter table template_versions enable row level security;
alter table workflow_def_versions enable row level security;
alter table workflow_pack_versions enable row level security;
alter table moderation_queue enable row level security;
alter table release_notes enable row level security;
alter table adoption_records enable row level security;

create policy "Service role manages source registry" on source_registry
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read source registry" on source_registry
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Service role manages source snapshots" on source_snapshot
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read source snapshots" on source_snapshot
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Service role manages change events" on change_event
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read change events" on change_event
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Service role manages rule versions" on rule_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read rule versions" on rule_versions
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Service role manages template versions" on template_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read template versions" on template_versions
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Service role manages workflow def versions" on workflow_def_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read workflow def versions" on workflow_def_versions
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Service role manages workflow pack versions" on workflow_pack_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read workflow pack versions" on workflow_pack_versions
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Service role manages moderation queue" on moderation_queue
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members view moderation queue" on moderation_queue
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Service role manages release notes" on release_notes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read release notes" on release_notes
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Service role manages adoption records" on adoption_records
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read adoption records" on adoption_records
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Tenant members insert adoption records" on adoption_records
  for insert
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create or replace function log_freshness_moderation_audit()
returns trigger
language plpgsql
as $$
begin
  insert into audit_log(
    tenant_org_id,
    actor_user_id,
    actor_org_id,
    subject_org_id,
    entity,
    target_kind,
    target_id,
    action,
    meta_json
  )
  values (
    new.tenant_org_id,
    coalesce(new.reviewer_id, new.created_by),
    new.tenant_org_id,
    new.tenant_org_id,
    'moderation_queue',
    'freshness_moderation',
    new.id,
    'enqueue',
    jsonb_build_object(
      'change_event_id', new.change_event_id,
      'status', new.status,
      'classification', new.classification,
      'proposal', new.proposal
    )
  );

  return new;
end;
$$;

create or replace function log_freshness_adoption_audit()
returns trigger
language plpgsql
as $$
begin
  insert into audit_log(
    tenant_org_id,
    actor_user_id,
    actor_org_id,
    subject_org_id,
    run_id,
    entity,
    target_kind,
    target_id,
    action,
    meta_json
  )
  values (
    new.tenant_org_id,
    new.actor_id,
    new.tenant_org_id,
    new.tenant_org_id,
    new.run_id,
    'adoption_records',
    'freshness_adoption',
    new.id,
    'adopt',
    jsonb_build_object(
      'scope', new.scope,
      'ref_id', new.ref_id,
      'from_version', new.from_version,
      'to_version', new.to_version,
      'mode', new.mode
    )
  );

  return new;
end;
$$;

create trigger moderation_queue_audit_after_insert
  after insert on moderation_queue
  for each row execute function log_freshness_moderation_audit();

create trigger adoption_records_audit_after_insert
  after insert on adoption_records
  for each row execute function log_freshness_adoption_audit();

commit;
