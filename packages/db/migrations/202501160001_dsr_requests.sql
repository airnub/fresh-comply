create table if not exists dsr_requests (
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

create table if not exists dsr_request_jobs (
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

create index if not exists dsr_requests_tenant_status_idx on dsr_requests(tenant_org_id, status, due_at);
create index if not exists dsr_request_jobs_schedule_idx on dsr_request_jobs(job_type, run_after) where processed_at is null;
