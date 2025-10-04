begin;

create schema if not exists platform;

create table if not exists platform.rule_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  parser text not null,
  jurisdiction text,
  category text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_rule_sources_jurisdiction_category_idx
  on platform.rule_sources(jurisdiction, category);

create table if not exists platform.rule_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  rule_source_id uuid not null references platform.rule_sources(id) on delete cascade,
  content_hash text not null,
  parsed_facts jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists platform_rule_source_snapshots_source_idx
  on platform.rule_source_snapshots(rule_source_id, fetched_at desc);

create table if not exists platform.rule_packs (
  id uuid primary key default gen_random_uuid(),
  pack_key text not null,
  version text not null,
  title text not null,
  summary text,
  manifest jsonb not null default '{}'::jsonb,
  checksum text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  status text not null default 'draft' check (status in ('draft','proposed','published','deprecated')),
  unique (pack_key, version)
);

create index if not exists platform_rule_packs_key_idx
  on platform.rule_packs(pack_key);

create table if not exists platform.rule_pack_detections (
  id uuid primary key default gen_random_uuid(),
  rule_pack_id uuid references platform.rule_packs(id) on delete set null,
  rule_pack_key text not null,
  current_version text,
  proposed_version text not null,
  severity text not null check (severity in ('info','minor','major','critical')),
  status text not null default 'open' check (status in ('open','in_review','approved','rejected','superseded')),
  diff jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_by uuid references users(id),
  notes text,
  unique (rule_pack_key, proposed_version, detected_at)
);

create index if not exists platform_rule_pack_detections_pack_idx
  on platform.rule_pack_detections(rule_pack_key, detected_at desc);

create index if not exists platform_rule_pack_detections_status_idx
  on platform.rule_pack_detections(status);

create table if not exists platform.rule_pack_detection_sources (
  detection_id uuid references platform.rule_pack_detections(id) on delete cascade,
  rule_source_id uuid references platform.rule_sources(id) on delete cascade,
  change_summary jsonb not null default '{}'::jsonb,
  primary key (detection_id, rule_source_id)
);

create index if not exists platform_rule_pack_detection_sources_source_idx
  on platform.rule_pack_detection_sources(rule_source_id);

alter table platform.rule_sources enable row level security;
alter table platform.rule_source_snapshots enable row level security;
alter table platform.rule_packs enable row level security;
alter table platform.rule_pack_detections enable row level security;
alter table platform.rule_pack_detection_sources enable row level security;

create policy if not exists "Platform services manage rule sources" on platform.rule_sources
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

create policy if not exists "Platform services manage rule source snapshots" on platform.rule_source_snapshots
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

create policy if not exists "Platform services manage rule packs" on platform.rule_packs
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

create policy if not exists "Platform services manage rule pack detections" on platform.rule_pack_detections
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

create policy if not exists "Platform services manage rule pack detection sources" on platform.rule_pack_detection_sources
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

insert into platform.rule_sources (id, name, url, parser, jurisdiction, category, created_at)
select id, name, url, parser, jurisdiction, category, created_at
from source_registry
where org_id is null
on conflict (id) do update set
  name = excluded.name,
  url = excluded.url,
  parser = excluded.parser,
  jurisdiction = excluded.jurisdiction,
  category = excluded.category,
  updated_at = now();

delete from source_registry where org_id is null;

alter table source_registry rename column org_id to org_id;
alter table source_snapshot rename column org_id to org_id;
alter table change_event rename column org_id to org_id;
alter table rule_versions rename column org_id to org_id;
alter table template_versions rename column org_id to org_id;
alter table workflow_def_versions rename column org_id to org_id;
alter table workflow_pack_versions rename column org_id to org_id;
alter table moderation_queue rename column org_id to org_id;
alter table release_notes rename column org_id to org_id;
alter table adoption_records rename column org_id to org_id;

alter table source_registry alter column org_id set not null;
alter table source_snapshot alter column org_id set not null;
alter table change_event alter column org_id set not null;
alter table rule_versions alter column org_id set not null;
alter table template_versions alter column org_id set not null;
alter table workflow_def_versions alter column org_id set not null;
alter table workflow_pack_versions alter column org_id set not null;
alter table moderation_queue alter column org_id set not null;
alter table release_notes alter column org_id set not null;
alter table adoption_records alter column org_id set not null;

drop index if exists source_registry_tenant_idx;
create index source_registry_org_idx on source_registry(org_id);

drop index if exists source_snapshot_tenant_idx;
create index source_snapshot_org_idx on source_snapshot(org_id);

drop index if exists change_event_tenant_idx;
create index change_event_org_idx on change_event(org_id, detected_at desc);

drop index if exists rule_versions_tenant_idx;
create index rule_versions_org_idx on rule_versions(org_id);

drop index if exists template_versions_tenant_idx;
create index template_versions_org_idx on template_versions(org_id);

drop index if exists workflow_def_versions_tenant_idx;
create index workflow_def_versions_org_idx on workflow_def_versions(org_id);

drop index if exists workflow_pack_versions_tenant_idx;
create index workflow_pack_versions_org_idx on workflow_pack_versions(org_id);

drop index if exists moderation_queue_tenant_status_idx;
create index moderation_queue_org_status_idx on moderation_queue(org_id, status, created_at desc);

drop index if exists release_notes_scope_idx;
create index release_notes_scope_idx on release_notes(org_id, scope, ref_id);

drop index if exists adoption_records_scope_idx;
create index adoption_records_scope_idx on adoption_records(org_id, scope, ref_id);

alter policy "Tenant members read source registry" on source_registry
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read source snapshots" on source_snapshot
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read change events" on change_event
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read rule versions" on rule_versions
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read template versions" on template_versions
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read workflow def versions" on workflow_def_versions
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read workflow pack versions" on workflow_pack_versions
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members view moderation queue" on moderation_queue
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read release notes" on release_notes
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read adoption records" on adoption_records
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members insert adoption records" on adoption_records
  with check (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

commit;
