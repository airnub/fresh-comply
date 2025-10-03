create table organisations(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

create table users(
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  created_at timestamptz default now()
);

create table memberships(
  user_id uuid references users(id),
  org_id uuid references organisations(id),
  role text check (role in ('owner','admin','member','viewer')) not null,
  primary key(user_id, org_id)
);

create table engagements(
  id uuid primary key default gen_random_uuid(),
  engager_org_id uuid references organisations(id),
  client_org_id uuid references organisations(id),
  status text check (status in ('active','ended')) default 'active',
  scope text,
  created_at timestamptz default now()
);

create table workflow_defs(
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version text not null,
  title text not null,
  dsl_json jsonb not null,
  created_at timestamptz default now()
);

create table workflow_runs(
  id uuid primary key default gen_random_uuid(),
  workflow_def_id uuid references workflow_defs(id),
  subject_org_id uuid references organisations(id),
  engager_org_id uuid references organisations(id),
  status text check (status in ('draft','active','done','archived')) default 'active',
  created_by_user_id uuid references users(id),
  created_at timestamptz default now()
);

create table steps(
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id),
  key text not null,
  title text not null,
  status text check (status in ('todo','in_progress','waiting','blocked','done')) default 'todo',
  due_date date,
  assignee_user_id uuid references users(id)
);

create table documents(
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id),
  template_id text,
  path text,
  checksum text,
  created_at timestamptz default now()
);

create table audit_log(
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  actor_org_id uuid references organisations(id),
  on_behalf_of_org_id uuid references organisations(id),
  run_id uuid references workflow_runs(id),
  step_id uuid references steps(id),
  action text,
  meta_json jsonb,
  created_at timestamptz default now()
);

create or replace function public.is_member_of_org(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from memberships m
    where m.org_id = target_org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_run(target_run_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from workflow_runs wr
    join memberships m
      on m.user_id = auth.uid()
     and (m.org_id = wr.subject_org_id or m.org_id = wr.engager_org_id)
    where wr.id = target_run_id
  );
$$;

alter table organisations enable row level security;
alter table users enable row level security;
alter table memberships enable row level security;
alter table engagements enable row level security;
alter table workflow_defs enable row level security;
alter table workflow_runs enable row level security;
alter table steps enable row level security;
alter table documents enable row level security;
alter table audit_log enable row level security;

create policy "Members read organisations" on organisations
  for select
  using (auth.role() = 'service_role' or public.is_member_of_org(id));

create policy "Service role manages organisations" on organisations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Users can view their profile" on users
  for select
  using (auth.role() = 'service_role' or id = auth.uid());

create policy "Users can update their profile" on users
  for update
  using (auth.role() = 'service_role' or id = auth.uid())
  with check (auth.role() = 'service_role' or id = auth.uid());

create policy "Service role manages users" on users
  for insert
  with check (auth.role() = 'service_role');

create policy "Service role removes users" on users
  for delete
  using (auth.role() = 'service_role');

create policy "Users can read their memberships" on memberships
  for select
  using (auth.role() = 'service_role' or user_id = auth.uid());

create policy "Service role manages memberships" on memberships
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members view engagements" on engagements
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(engager_org_id)
    or public.is_member_of_org(client_org_id)
  );

create policy "Service role manages engagements" on engagements
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Authenticated can view workflow definitions" on workflow_defs
  for select
  using (auth.role() in ('authenticated', 'service_role'));

create policy "Service role manages workflow definitions" on workflow_defs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members access workflow runs" on workflow_runs
  for select
  using (auth.role() = 'service_role' or public.can_access_run(id));

create policy "Service role manages workflow runs" on workflow_runs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members read steps" on steps
  for select
  using (
    auth.role() = 'service_role'
    or public.can_access_run(run_id)
  );

create policy "Service role manages steps" on steps
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members read documents" on documents
  for select
  using (
    auth.role() = 'service_role'
    or public.can_access_run(run_id)
  );

create policy "Service role manages documents" on documents
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members read audit log" on audit_log
  for select
  using (
    auth.role() = 'service_role'
    or (run_id is not null and public.can_access_run(run_id))
    or (run_id is null and (
      (actor_org_id is not null and public.is_member_of_org(actor_org_id))
      or (on_behalf_of_org_id is not null and public.is_member_of_org(on_behalf_of_org_id))
    ))
  );

create policy "Service role manages audit log" on audit_log
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
