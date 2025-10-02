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
