alter table workflow_runs
  add column if not exists merged_workflow_snapshot jsonb;

alter table steps
  add column if not exists step_type_version_id uuid,
  add column if not exists permissions text[] default '{}'::text[];

create table if not exists json_schemas(
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  version text not null,
  description text,
  schema jsonb not null,
  created_at timestamptz default now()
);

create table if not exists step_types(
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text,
  summary text,
  latest_version text,
  created_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists step_type_versions(
  id uuid primary key default gen_random_uuid(),
  step_type_id uuid references step_types(id) on delete cascade,
  version text not null,
  definition jsonb not null,
  input_schema_id uuid references json_schemas(id),
  output_schema_id uuid references json_schemas(id),
  status text check (status in ('draft','published','deprecated')) default 'draft',
  created_by uuid references users(id),
  created_at timestamptz default now(),
  published_at timestamptz,
  unique(step_type_id, version)
);

alter table steps
  add constraint if not exists steps_step_type_version_id_fkey
  foreign key (step_type_version_id)
  references step_type_versions(id);

create table if not exists tenant_step_type_installs(
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations(id) on delete cascade,
  step_type_version_id uuid references step_type_versions(id) on delete cascade,
  installed_at timestamptz default now(),
  status text check (status in ('enabled','disabled')) default 'enabled',
  unique(org_id, step_type_version_id)
);

create table if not exists tenant_secret_bindings(
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations(id) on delete cascade,
  alias text not null,
  description text,
  provider text,
  external_id text not null,
  created_at timestamptz default now(),
  unique(org_id, alias)
);

create table if not exists tenant_workflow_overlays(
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations(id) on delete cascade,
  workflow_def_id uuid references workflow_defs(id) on delete cascade,
  title text not null,
  patch jsonb not null,
  status text check (status in ('draft','published','archived')) default 'draft',
  created_by uuid references users(id),
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(org_id, workflow_def_id, title)
);

create table if not exists workflow_overlay_snapshots(
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id) on delete cascade,
  tenant_overlay_id uuid references tenant_workflow_overlays(id),
  applied_overlays jsonb not null default '[]'::jsonb,
  merged_workflow jsonb not null,
  created_at timestamptz default now()
);

create table if not exists workflow_overlay_layers(
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references workflow_overlay_snapshots(id) on delete cascade,
  source text not null,
  patch jsonb not null,
  created_at timestamptz default now()
);

alter table json_schemas enable row level security;
alter table step_types enable row level security;
alter table step_type_versions enable row level security;
alter table tenant_step_type_installs enable row level security;
alter table tenant_secret_bindings enable row level security;
alter table tenant_workflow_overlays enable row level security;
alter table workflow_overlay_snapshots enable row level security;
alter table workflow_overlay_layers enable row level security;

create policy if not exists "Service role manages json schemas" on json_schemas
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Admins read json schemas" on json_schemas
  for select using (auth.role() in ('service_role', 'authenticated'));

create policy if not exists "Service role manages step types" on step_types
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Admins read step types" on step_types
  for select using (auth.role() in ('service_role', 'authenticated'));

create policy if not exists "Service role manages step type versions" on step_type_versions
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Admins read step type versions" on step_type_versions
  for select using (auth.role() in ('service_role', 'authenticated'));

create policy if not exists "Service role manages tenant installs" on tenant_step_type_installs
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Tenant members read installs" on tenant_step_type_installs
  for select using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

create policy if not exists "Service role manages tenant secret bindings" on tenant_secret_bindings
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Tenant members manage secret bindings" on tenant_secret_bindings
  for select using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

create policy if not exists "Service role manages tenant overlays" on tenant_workflow_overlays
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Tenant members manage overlays" on tenant_workflow_overlays
  for select using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

create policy if not exists "Service role manages overlay snapshots" on workflow_overlay_snapshots
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Members read overlay snapshots" on workflow_overlay_snapshots
  for select using (
    auth.role() = 'service_role'
    or (run_id is not null and public.can_access_run(run_id))
  );

create policy if not exists "Service role manages overlay layers" on workflow_overlay_layers
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Members read overlay layers" on workflow_overlay_layers
  for select using (
    auth.role() = 'service_role'
    or exists (
      select 1 from workflow_overlay_snapshots s
      where s.id = snapshot_id and public.can_access_run(s.run_id)
    )
  );
