create schema if not exists platform;

create table if not exists platform.step_types (
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

create table if not exists platform.step_type_versions (
  id uuid primary key default gen_random_uuid(),
  step_type_id uuid not null references platform.step_types(id) on delete cascade,
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

-- Ensure any existing timestamps are populated prior to tightening constraints
update public.step_types
set created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());

update public.step_type_versions
set created_at = coalesce(created_at, now());

-- Copy existing registry data into the platform schema
insert into platform.step_types (id, slug, title, category, summary, latest_version, created_by, created_at, updated_at)
select id, slug, title, category, summary, latest_version, created_by, created_at, updated_at
from public.step_types
on conflict (id) do update
  set slug = excluded.slug,
      title = excluded.title,
      category = excluded.category,
      summary = excluded.summary,
      latest_version = excluded.latest_version,
      created_by = excluded.created_by,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;

insert into platform.step_type_versions (id, step_type_id, version, definition, input_schema_id, output_schema_id, status, created_by, created_at, published_at)
select id, step_type_id, version, definition, input_schema_id, output_schema_id, status, created_by, created_at, published_at
from public.step_type_versions
on conflict (id) do update
  set step_type_id = excluded.step_type_id,
      version = excluded.version,
      definition = excluded.definition,
      input_schema_id = excluded.input_schema_id,
      output_schema_id = excluded.output_schema_id,
      status = excluded.status,
      created_by = excluded.created_by,
      created_at = excluded.created_at,
      published_at = excluded.published_at;

-- Update references to point at the platform tables
alter table if exists steps
  drop constraint if exists steps_step_type_version_id_fkey;

alter table if exists tenant_step_type_installs
  drop constraint if exists tenant_step_type_installs_step_type_version_id_fkey;

alter table steps
  add constraint steps_step_type_version_id_fkey
    foreign key (step_type_version_id)
    references platform.step_type_versions(id);

alter table tenant_step_type_installs
  add constraint tenant_step_type_installs_step_type_version_id_fkey
    foreign key (step_type_version_id)
    references platform.step_type_versions(id) on delete cascade;

-- Lock down the platform registry tables with service/admin only access
alter table platform.step_types enable row level security;
alter table platform.step_type_versions enable row level security;

create policy if not exists "Platform services manage step types" on platform.step_types
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

create policy if not exists "Platform services manage step type versions" on platform.step_type_versions
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

-- Expose read-only views for tenant consumption
create or replace view public.v_step_types as
select
  st.id,
  st.slug,
  st.title,
  st.category,
  st.summary,
  st.latest_version,
  st.created_by,
  st.created_at,
  st.updated_at
from platform.step_types st;

create or replace view public.v_step_type_versions as
select
  stv.id,
  stv.step_type_id,
  st.slug as step_type_slug,
  stv.version,
  stv.definition,
  stv.input_schema_id,
  stv.output_schema_id,
  stv.status,
  stv.created_by,
  stv.created_at,
  stv.published_at
from platform.step_type_versions stv
join platform.step_types st on st.id = stv.step_type_id;

grant select on public.v_step_types to authenticated, service_role;
grant select on public.v_step_type_versions to authenticated, service_role;

drop view if exists public.step_type_versions cascade;
drop view if exists public.step_types cascade;

drop table if exists public.step_type_versions cascade;
drop table if exists public.step_types cascade;
