create table organisations(
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
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
  tenant_org_id uuid not null references organisations(id),
  engager_org_id uuid references organisations(id),
  client_org_id uuid references organisations(id),
  subject_org_id uuid references organisations(id),
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
  tenant_org_id uuid not null references organisations(id),
  status text check (status in ('draft','active','done','archived')) default 'active',
  orchestration_provider text not null default 'none',
  orchestration_workflow_id text,
  created_by_user_id uuid references users(id),
  merged_workflow_snapshot jsonb,
  created_at timestamptz default now()
);

create table steps(
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id),
  tenant_org_id uuid not null references organisations(id),
  subject_org_id uuid references organisations(id),
  key text not null,
  title text not null,
  status text check (status in ('todo','in_progress','waiting','blocked','done')) default 'todo',
  orchestration_run_id text,
  execution_mode text check (execution_mode in ('manual','temporal')) not null default 'manual',
  due_date date,
  assignee_user_id uuid references users(id),
  step_type_version_id uuid,
  permissions text[] default '{}'::text[]
);

create table json_schemas(
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  version text not null,
  description text,
  schema jsonb not null,
  created_at timestamptz default now()
);

create table step_types(
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

create table step_type_versions(
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
  add constraint steps_step_type_version_id_fkey
  foreign key (step_type_version_id)
  references step_type_versions(id);

create table tenant_step_type_installs(
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations(id) on delete cascade,
  step_type_version_id uuid references step_type_versions(id) on delete cascade,
  installed_at timestamptz default now(),
  status text check (status in ('enabled','disabled')) default 'enabled',
  unique(org_id, step_type_version_id)
);

create table tenant_secret_bindings(
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations(id) on delete cascade,
  alias text not null,
  description text,
  provider text,
  external_id text not null,
  created_at timestamptz default now(),
  unique(org_id, alias)
);

create table tenant_workflow_overlays(
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

create table workflow_overlay_snapshots(
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id) on delete cascade,
  tenant_overlay_id uuid references tenant_workflow_overlays(id),
  applied_overlays jsonb not null default '[]'::jsonb,
  merged_workflow jsonb not null,
  created_at timestamptz default now()
);

create table workflow_overlay_layers(
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references workflow_overlay_snapshots(id) on delete cascade,
  source text not null,
  patch jsonb not null,
  created_at timestamptz default now()
);

create table documents(
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id),
  tenant_org_id uuid not null references organisations(id),
  subject_org_id uuid references organisations(id),
  template_id text,
  path text,
  checksum text,
  created_at timestamptz default now()
);

create table audit_log(
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  actor_user_id uuid references users(id),
  actor_org_id uuid references organisations(id),
  on_behalf_of_org_id uuid references organisations(id),
  subject_org_id uuid references organisations(id),
  entity text,
  run_id uuid references workflow_runs(id),
  step_id uuid references steps(id),
  action text not null,
  meta_json jsonb,
  created_at timestamptz default now()
);

create table dsr_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  subject_org_id uuid references organisations(id),
  assignee_user_id uuid references users(id),
  assignee_email text,
  requester_email text,
  requester_name text,
  request_payload jsonb,
  type text not null check (type in (
    'access',
    'export',
    'rectification',
    'erasure',
    'restriction',
    'objection',
    'portability'
  )),
  status text not null check (status in (
    'received',
    'acknowledged',
    'in_progress',
    'paused',
    'completed',
    'escalated'
  )),
  received_at timestamptz not null default now(),
  ack_sent_at timestamptz,
  due_at timestamptz not null,
  resolved_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dsr_request_jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references dsr_requests(id) on delete cascade,
  job_type text not null check (job_type in ('ack_deadline', 'resolution_deadline', 'escalation_notice')),
  run_after timestamptz not null,
  payload jsonb,
  attempts integer not null default 0,
  locked_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dsr_requests_tenant_status_idx on dsr_requests(tenant_org_id, status, due_at);
create index dsr_request_jobs_schedule_idx on dsr_request_jobs(job_type, run_after) where processed_at is null;

create table cro_companies (
  company_number text primary key,
  name text not null,
  status text,
  company_type text,
  registered_on date,
  dissolved_on date,
  last_return_date date,
  address jsonb,
  eircode text,
  metadata jsonb,
  snapshot_fingerprint text,
  source_resource_id text,
  refreshed_at timestamptz default now(),
  created_at timestamptz default now()
);

create table charity_registration_metrics (
  metric_key text primary key,
  metric_label text not null,
  values_json jsonb not null,
  source_resource_id text,
  snapshot_fingerprint text,
  refreshed_at timestamptz default now(),
  created_at timestamptz default now()
);

create table revenue_charity_registry (
  id uuid primary key default gen_random_uuid(),
  charity_name text not null,
  charity_address text,
  source_resource_id text,
  snapshot_fingerprint text,
  refreshed_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(charity_name, source_resource_id)
);

create table funding_opportunities (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source_resource_id text not null,
  title text not null,
  summary text,
  call_year integer,
  call_type text,
  domain text,
  county text,
  lead_institution text,
  acronym text,
  amount_awarded numeric,
  currency text,
  metadata jsonb,
  snapshot_fingerprint text,
  refreshed_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(external_id, source_resource_id)
);

create table funding_opportunity_workflows (
  id uuid primary key default gen_random_uuid(),
  funding_opportunity_id uuid references funding_opportunities(id) on delete cascade,
  workflow_key text not null,
  created_at timestamptz default now(),
  unique(funding_opportunity_id, workflow_key)
);

create or replace function public.current_tenant_org_id()
returns uuid
language sql
stable
as $$
  select case
    when auth.jwt() ? 'tenant_org_id' then nullif(auth.jwt()->>'tenant_org_id', '')::uuid
    else null
  end;
$$;

create or replace function public.jwt_has_org(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from jsonb_array_elements_text(coalesce(auth.jwt()->'org_ids', '[]'::jsonb)) as org_id(value)
    where value = target_org_id::text
  );
$$;

create or replace function public.is_platform_service()
returns boolean
language sql
stable
as $$
  select auth.role() = 'service_role'
    or exists (
      select 1
      from jsonb_array_elements_text(coalesce(auth.jwt()->'role_paths', '[]'::jsonb)) as role_path(value)
      where value like 'platform:service%'
    );
$$;

create or replace function public.is_member_of_org(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_platform_service()
    or exists (
      select 1
      from memberships m
      join organisations o on o.id = m.org_id
      where m.org_id = target_org_id
        and m.user_id = auth.uid()
        and (
          public.current_tenant_org_id() is null
          or o.tenant_org_id = public.current_tenant_org_id()
        )
    );
$$;

create or replace function public.can_access_run(target_run_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_platform_service()
    or exists (
      select 1
      from workflow_runs wr
      where wr.id = target_run_id
        and (
          public.current_tenant_org_id() is null
          or wr.tenant_org_id = public.current_tenant_org_id()
        )
        and (
          (wr.engager_org_id is not null and public.is_member_of_org(wr.engager_org_id))
          or (wr.subject_org_id is not null and public.is_member_of_org(wr.subject_org_id))
          or (wr.subject_org_id is not null and public.jwt_has_org(wr.subject_org_id))
        )
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
alter table admin_actions enable row level security;
alter table json_schemas enable row level security;
alter table step_types enable row level security;
alter table step_type_versions enable row level security;
alter table tenant_step_type_installs enable row level security;
alter table tenant_secret_bindings enable row level security;
alter table tenant_workflow_overlays enable row level security;
alter table workflow_overlay_snapshots enable row level security;
alter table workflow_overlay_layers enable row level security;
alter table dsr_requests enable row level security;
alter table dsr_request_jobs enable row level security;

create policy "Members read organisations" on organisations
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and (
        public.is_member_of_org(id)
        or public.jwt_has_org(id)
        or id = public.current_tenant_org_id()
      )
    )
  );

create policy "Service role manages organisations" on organisations
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

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
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and (
        public.is_member_of_org(engager_org_id)
        or (client_org_id is not null and public.is_member_of_org(client_org_id))
        or (subject_org_id is not null and public.jwt_has_org(subject_org_id))
      )
    )
  );

create policy "Service role manages engagements" on engagements
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Authenticated can view workflow definitions" on workflow_defs
  for select
  using (auth.role() in ('authenticated', 'service_role'));

create policy "Service role manages workflow definitions" on workflow_defs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members access workflow runs" on workflow_runs
  for select
  using (public.is_platform_service() or public.can_access_run(id));

create policy "Service role manages workflow runs" on workflow_runs
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Members read steps" on steps
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and public.can_access_run(run_id)
    )
  );

create policy "Service role manages steps" on steps
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Members read documents" on documents
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and public.can_access_run(run_id)
    )
  );

create policy "Service role manages documents" on documents
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Members read audit log" on audit_log
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and (
        (run_id is not null and public.can_access_run(run_id))
        or (actor_org_id is not null and public.is_member_of_org(actor_org_id))
        or (on_behalf_of_org_id is not null and public.is_member_of_org(on_behalf_of_org_id))
        or (subject_org_id is not null and public.jwt_has_org(subject_org_id))
      )
    )
  );

create policy "Service role manages audit log" on audit_log
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Members read admin actions" on admin_actions
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and (
        public.is_member_of_org(tenant_org_id)
        or (actor_org_id is not null and public.is_member_of_org(actor_org_id))
        or (subject_org_id is not null and public.jwt_has_org(subject_org_id))
      )
    )
  );

create policy "Service role manages admin actions" on admin_actions
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Members view DSR requests" on dsr_requests
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and (
        public.is_member_of_org(tenant_org_id)
        or (
          subject_org_id is not null
          and (
            public.is_member_of_org(subject_org_id)
            or public.jwt_has_org(subject_org_id)
          )
        )
      )
    )
  );

create policy "Members manage DSR requests" on dsr_requests
  for all
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and public.is_member_of_org(tenant_org_id)
    )
  )
  with check (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and public.is_member_of_org(tenant_org_id)
    )
  );

create policy "Service role manages DSR jobs" on dsr_request_jobs
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Service role manages json schemas" on json_schemas
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Admins read json schemas" on json_schemas
  for select
  using (auth.role() in ('service_role', 'authenticated'));

create policy "Service role manages step types" on step_types
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Admins read step types" on step_types
  for select
  using (auth.role() in ('service_role', 'authenticated'));

create policy "Service role manages step type versions" on step_type_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Admins read step type versions" on step_type_versions
  for select
  using (auth.role() in ('service_role', 'authenticated'));

create policy "Service role manages tenant installs" on tenant_step_type_installs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read installs" on tenant_step_type_installs
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

create policy "Service role manages tenant secret bindings" on tenant_secret_bindings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members manage secret bindings" on tenant_secret_bindings
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

create policy "Service role manages tenant overlays" on tenant_workflow_overlays
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members manage overlays" on tenant_workflow_overlays
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

create policy "Service role manages overlay snapshots" on workflow_overlay_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members read overlay snapshots" on workflow_overlay_snapshots
  for select
  using (
    auth.role() = 'service_role'
    or (run_id is not null and public.can_access_run(run_id))
  );

create policy "Service role manages overlay layers" on workflow_overlay_layers
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members read overlay layers" on workflow_overlay_layers
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from workflow_overlay_snapshots s
      where s.id = snapshot_id
        and public.can_access_run(s.run_id)
    )
  );

create table if not exists admin_actions(
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  actor_id uuid references users(id) not null,
  actor_org_id uuid references organisations(id),
  on_behalf_of_org_id uuid references organisations(id),
  subject_org_id uuid references organisations(id),
  action text not null,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  requires_second_approval boolean not null default false,
  second_actor_id uuid references users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create or replace function admin_record_action(
  p_action text,
  p_actor_id uuid,
  p_reason text,
  p_payload jsonb,
  p_entity text default null,
  p_entity_id uuid default null,
  p_requires_second boolean default false,
  p_second_actor_id uuid default null,
  p_tenant_org_id uuid default null,
  p_actor_org_id uuid default null,
  p_on_behalf_of_org_id uuid default null,
  p_subject_org_id uuid default null,
  p_run_id uuid default null,
  p_step_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_id uuid;
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  if p_requires_second and (p_second_actor_id is null or p_second_actor_id = p_actor_id) then
    raise exception 'Second approver required';
  end if;

  v_tenant_org_id := coalesce(p_tenant_org_id, p_actor_org_id, p_on_behalf_of_org_id);
  if v_tenant_org_id is null then
    raise exception 'tenant_org_id is required';
  end if;

  v_subject_org_id := p_subject_org_id;

  insert into admin_actions(
    tenant_org_id,
    actor_id,
    actor_org_id,
    on_behalf_of_org_id,
    subject_org_id,
    action,
    reason,
    payload,
    requires_second_approval,
    second_actor_id,
    approved_at
  )
  values(
    v_tenant_org_id,
    p_actor_id,
    p_actor_org_id,
    p_on_behalf_of_org_id,
    v_subject_org_id,
    p_action,
    p_reason,
    coalesce(p_payload, '{}'::jsonb),
    p_requires_second,
    p_second_actor_id,
    case when p_requires_second then now() else null end
  )
  returning id into v_action_id;

  insert into audit_log(
    tenant_org_id,
    actor_user_id,
    actor_org_id,
    on_behalf_of_org_id,
    subject_org_id,
    entity,
    run_id,
    step_id,
    action,
    meta_json
  )
  values(
    v_tenant_org_id,
    p_actor_id,
    p_actor_org_id,
    p_on_behalf_of_org_id,
    v_subject_org_id,
    coalesce(p_entity, case when p_run_id is not null then 'workflow_run' when p_step_id is not null then 'step' else null end),
    coalesce(p_run_id, case when p_entity = 'workflow_run' then p_entity_id else null end),
    coalesce(p_step_id, case when p_entity = 'step' then p_entity_id else null end),
    p_action,
    coalesce(p_payload, '{}'::jsonb)
  );

  return jsonb_build_object('action_id', v_action_id, 'action', p_action);
end;
$$;

create or replace function admin_create_step_type(
  actor_id uuid,
  reason text,
  step_type jsonb,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return admin_record_action(
    'step_type_create',
    actor_id,
    reason,
    jsonb_build_object('step_type', step_type),
    p_tenant_org_id => tenant_org_id,
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id),
    p_on_behalf_of_org_id => on_behalf_of_org_id
  );
end;
$$;

create or replace function admin_update_step_type(
  actor_id uuid,
  reason text,
  step_type_id uuid,
  patch jsonb,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return admin_record_action(
    'step_type_update',
    actor_id,
    reason,
    jsonb_build_object('step_type_id', step_type_id, 'patch', patch),
    'step_type',
    step_type_id,
    p_tenant_org_id => tenant_org_id,
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id),
    p_on_behalf_of_org_id => on_behalf_of_org_id
  );
end;
$$;

create or replace function admin_reassign_step(
  actor_id uuid,
  reason text,
  run_id uuid,
  step_id uuid,
  assignee_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  update steps set assignee_user_id = assignee_id where id = step_id;
  return admin_record_action(
    'step_reassign',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'step_id', step_id, 'assignee_id', assignee_id),
    'step',
    step_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    p_on_behalf_of_org_id => on_behalf_of_org_id,
    p_subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    p_run_id => run_id,
    p_step_id => step_id
  );
end;
$$;

create or replace function admin_update_step_due_date(
  actor_id uuid,
  reason text,
  run_id uuid,
  step_id uuid,
  new_due_date text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  update steps set due_date = new_due_date::date where id = step_id;
  return admin_record_action(
    'step_due_date_update',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'step_id', step_id, 'due_date', new_due_date),
    'step',
    step_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    p_on_behalf_of_org_id => on_behalf_of_org_id,
    p_subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    p_run_id => run_id,
    p_step_id => step_id
  );
end;
$$;

create or replace function admin_update_step_status(
  actor_id uuid,
  reason text,
  run_id uuid,
  step_id uuid,
  new_status text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  update steps set status = new_status where id = step_id;
  return admin_record_action(
    'step_status_update',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'step_id', step_id, 'status', new_status),
    'step',
    step_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    p_on_behalf_of_org_id => on_behalf_of_org_id,
    p_subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    p_run_id => run_id,
    p_step_id => step_id
  );
end;
$$;

create or replace function admin_regenerate_document(
  actor_id uuid,
  reason text,
  run_id uuid,
  document_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return admin_record_action(
    'document_regenerate',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'document_id', document_id),
    'document',
    document_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    p_on_behalf_of_org_id => on_behalf_of_org_id,
    p_subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    p_run_id => run_id
  );
end;
$$;

create or replace function admin_resend_run_digest(
  actor_id uuid,
  reason text,
  run_id uuid,
  recipient_email text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return admin_record_action(
    'run_digest_resend',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'recipient_email', recipient_email),
    'workflow_run',
    run_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    p_on_behalf_of_org_id => on_behalf_of_org_id,
    p_subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    p_run_id => run_id
  );
end;
$$;

create or replace function admin_cancel_run(
  actor_id uuid,
  reason text,
  run_id uuid,
  second_actor_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return admin_record_action(
    'run_cancel',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id),
    'workflow_run',
    run_id,
    true,
    second_actor_id,
    coalesce(tenant_org_id, v_tenant_org_id),
    coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id,
    coalesce(subject_org_id, v_subject_org_id),
    run_id
  );
end;
$$;

create or replace function admin_approve_freshness_diff(
  actor_id uuid,
  reason text,
  diff_id uuid,
  notes text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return admin_record_action(
    'freshness_diff_approve',
    actor_id,
    reason,
    jsonb_build_object('diff_id', diff_id, 'notes', notes),
    p_tenant_org_id => tenant_org_id,
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id),
    p_on_behalf_of_org_id => on_behalf_of_org_id,
    p_subject_org_id => subject_org_id
  );
end;
$$;

create or replace function admin_reject_freshness_diff(
  actor_id uuid,
  reason text,
  diff_id uuid,
  notes text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return admin_record_action(
    'freshness_diff_reject',
    actor_id,
    reason,
    jsonb_build_object('diff_id', diff_id, 'notes', notes),
    p_tenant_org_id => tenant_org_id,
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id),
    p_on_behalf_of_org_id => on_behalf_of_org_id,
    p_subject_org_id => subject_org_id
  );
end;
$$;

create or replace function admin_acknowledge_dsr(
  actor_id uuid,
  reason text,
  request_id uuid,
  notes text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_tenant_org_id is null then
    raise exception 'DSR request % not found', request_id;
  end if;

  return admin_record_action(
    'dsr_acknowledge',
    actor_id,
    reason,
    jsonb_build_object('request_id', request_id, 'notes', notes),
    'dsr_request',
    request_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    p_on_behalf_of_org_id => coalesce(on_behalf_of_org_id, v_subject_org_id),
    p_subject_org_id => coalesce(subject_org_id, v_subject_org_id)
  );
end;
$$;

create or replace function admin_resolve_dsr(
  actor_id uuid,
  reason text,
  request_id uuid,
  resolution text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_tenant_org_id is null then
    raise exception 'DSR request % not found', request_id;
  end if;

  return admin_record_action(
    'dsr_resolve',
    actor_id,
    reason,
    jsonb_build_object('request_id', request_id, 'resolution', resolution),
    'dsr_request',
    request_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    p_on_behalf_of_org_id => coalesce(on_behalf_of_org_id, v_subject_org_id),
    p_subject_org_id => coalesce(subject_org_id, v_subject_org_id)
  );
end;
$$;

create or replace function admin_export_dsr_bundle(
  actor_id uuid,
  reason text,
  request_id uuid,
  destination text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_tenant_org_id is null then
    raise exception 'DSR request % not found', request_id;
  end if;

  return admin_record_action(
    'dsr_export',
    actor_id,
    reason,
    jsonb_build_object('request_id', request_id, 'destination', destination),
    'dsr_request',
    request_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    p_on_behalf_of_org_id => coalesce(on_behalf_of_org_id, v_subject_org_id),
    p_subject_org_id => coalesce(subject_org_id, v_subject_org_id)
  );
end;
$$;

create or replace function admin_toggle_legal_hold(
  actor_id uuid,
  reason text,
  request_id uuid,
  enabled boolean,
  second_actor_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_tenant_org_id is null then
    raise exception 'DSR request % not found', request_id;
  end if;

  return admin_record_action(
    case when enabled then 'legal_hold_enable' else 'legal_hold_disable' end,
    actor_id,
    reason,
    jsonb_build_object('request_id', request_id, 'enabled', enabled),
    'dsr_request',
    request_id,
    enabled,
    second_actor_id,
    coalesce(tenant_org_id, v_tenant_org_id),
    coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    coalesce(on_behalf_of_org_id, v_subject_org_id),
    coalesce(subject_org_id, v_subject_org_id)
  );
end;
$$;

create or replace function admin_bind_secret_alias(
  actor_id uuid,
  reason text,
  org_id uuid,
  alias text,
  provider text,
  external_id text,
  description text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_binding_id uuid;
begin
  insert into tenant_secret_bindings(org_id, alias, provider, external_id, description)
  values(org_id, alias, provider, external_id, description)
  returning id into v_binding_id;

  return admin_record_action(
    'secret_alias_bind',
    actor_id,
    reason,
    jsonb_build_object('binding_id', v_binding_id, 'org_id', org_id, 'alias', alias, 'provider', provider, 'external_id', external_id, 'description', description),
    'tenant_secret_binding',
    v_binding_id,
    p_tenant_org_id => coalesce(tenant_org_id, org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, org_id),
    p_on_behalf_of_org_id => coalesce(on_behalf_of_org_id, org_id),
    p_subject_org_id => coalesce(subject_org_id, org_id)
  );
end;
$$;

create or replace function admin_update_secret_alias(
  actor_id uuid,
  reason text,
  binding_id uuid,
  new_description text,
  new_external_id text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from tenant_secret_bindings where id = binding_id;

  if v_org_id is null then
    raise exception 'Secret binding % not found', binding_id;
  end if;

  update tenant_secret_bindings
  set description = coalesce(new_description, tenant_secret_bindings.description),
      external_id = coalesce(new_external_id, tenant_secret_bindings.external_id)
  where id = binding_id;

  return admin_record_action(
    'secret_alias_update',
    actor_id,
    reason,
    jsonb_build_object('binding_id', binding_id, 'description', new_description, 'external_id', new_external_id),
    'tenant_secret_binding',
    binding_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_org_id),
    p_on_behalf_of_org_id => coalesce(on_behalf_of_org_id, v_org_id),
    p_subject_org_id => coalesce(subject_org_id, v_org_id)
  );
end;
$$;

create or replace function admin_remove_secret_alias(
  actor_id uuid,
  reason text,
  binding_id uuid,
  second_actor_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from tenant_secret_bindings where id = binding_id;

  if v_org_id is null then
    raise exception 'Secret binding % not found', binding_id;
  end if;

  delete from tenant_secret_bindings where id = binding_id;
  return admin_record_action(
    'secret_alias_remove',
    actor_id,
    reason,
    jsonb_build_object('binding_id', binding_id),
    'tenant_secret_binding',
    binding_id,
    true,
    second_actor_id,
    coalesce(tenant_org_id, v_org_id),
    coalesce(actor_org_id, tenant_org_id, v_org_id),
    coalesce(on_behalf_of_org_id, v_org_id),
    coalesce(subject_org_id, v_org_id)
  );
end;
$$;

create or replace function admin_test_secret_alias(
  actor_id uuid,
  reason text,
  binding_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from tenant_secret_bindings where id = binding_id;

  if v_org_id is null then
    raise exception 'Secret binding % not found', binding_id;
  end if;

  return admin_record_action(
    'secret_alias_test',
    actor_id,
    reason,
    jsonb_build_object('binding_id', binding_id),
    'tenant_secret_binding',
    binding_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_org_id),
    p_on_behalf_of_org_id => coalesce(on_behalf_of_org_id, v_org_id),
    p_subject_org_id => coalesce(subject_org_id, v_org_id)
  );
end;
$$;

create or replace function admin_temporal_signal(
  actor_id uuid,
  reason text,
  run_id uuid,
  signal text,
  payload jsonb,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return admin_record_action(
    'temporal_signal',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'signal', signal, 'payload', payload),
    'workflow_run',
    run_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    p_on_behalf_of_org_id => on_behalf_of_org_id,
    p_subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    p_run_id => run_id
  );
end;
$$;

create or replace function admin_temporal_retry(
  actor_id uuid,
  reason text,
  run_id uuid,
  activity_id text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return admin_record_action(
    'temporal_retry',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'activity_id', activity_id),
    'workflow_run',
    run_id,
    p_tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    p_actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    p_on_behalf_of_org_id => on_behalf_of_org_id,
    p_subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    p_run_id => run_id
  );
end;
$$;

create or replace function admin_temporal_cancel(
  actor_id uuid,
  reason text,
  run_id uuid,
  second_actor_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return admin_record_action(
    'temporal_cancel',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id),
    'workflow_run',
    run_id,
    true,
    second_actor_id,
    coalesce(tenant_org_id, v_tenant_org_id),
    coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id,
    coalesce(subject_org_id, v_subject_org_id),
    run_id
  );
end;
$$;
