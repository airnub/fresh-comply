-- Platform catalog schema reserved for global data
set check_function_bodies = off;

create schema if not exists platform;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'platform'
      and table_name = 'rule_catalogs'
  ) then
    create table platform.rule_catalogs (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique,
      title text not null,
      description text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'platform'
      and table_name = 'rules'
  ) then
    create table platform.rules (
      id uuid primary key default gen_random_uuid(),
      catalog_id uuid not null references platform.rule_catalogs(id) on delete cascade,
      code text not null,
      summary text not null,
      body jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'platform'
      and table_name = 'global_records'
  ) then
    create table platform.global_records (
      id bigserial primary key,
      source_table text not null,
      payload jsonb not null,
      archived_at timestamptz not null default now()
    );
  end if;
end$$;

alter table platform.rule_catalogs enable row level security;
alter table platform.rules enable row level security;
alter table platform.global_records enable row level security;

-- Restrict catalog tables to platform administrators
drop policy if exists "platform_rule_catalogs_select" on platform.rule_catalogs;
drop policy if exists "platform_rule_catalogs_modify" on platform.rule_catalogs;
create policy "platform_rule_catalogs_select" on platform.rule_catalogs
  for select using (app.is_platform_admin());
create policy "platform_rule_catalogs_modify" on platform.rule_catalogs
  for all using (app.is_platform_admin()) with check (app.is_platform_admin());

drop policy if exists "platform_rules_select" on platform.rules;
drop policy if exists "platform_rules_modify" on platform.rules;
create policy "platform_rules_select" on platform.rules
  for select using (app.is_platform_admin());
create policy "platform_rules_modify" on platform.rules
  for all using (app.is_platform_admin()) with check (app.is_platform_admin());

drop policy if exists "platform_global_records_select" on platform.global_records;
drop policy if exists "platform_global_records_modify" on platform.global_records;
create policy "platform_global_records_select" on platform.global_records
  for select using (app.is_platform_admin());
create policy "platform_global_records_modify" on platform.global_records
  for all using (app.is_platform_admin()) with check (app.is_platform_admin());

-- Tenant facing view
create or replace view public.rule_catalogs_public as
  select c.slug,
         c.title,
         c.description,
         coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'code', r.code,
           'summary', r.summary,
           'body', r.body
         ) order by r.code) filter (where r.id is not null), '[]'::jsonb) as rules
  from platform.rule_catalogs c
  left join platform.rules r on r.catalog_id = c.id
  group by c.id;

-- Ensure tenants can read the view while platform admins retain write access
grant select on public.rule_catalogs_public to public;
