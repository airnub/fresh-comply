-- Add tenant scoping columns across core tables
alter table organisations
  add column if not exists org_id uuid;

update organisations
set org_id = id
where org_id is null;

alter table organisations
  alter column org_id set not null;

alter table organisations
  add constraint if not exists organisations_org_id_fkey
    foreign key (org_id)
    references organisations(id);

alter table engagements
  add column if not exists org_id uuid,
  add column if not exists subject_org_id uuid;

update engagements
set org_id = coalesce(org_id, engager_org_id);

update engagements
set subject_org_id = coalesce(subject_org_id, client_org_id);

alter table engagements
  alter column org_id set not null;

alter table engagements
  add constraint if not exists engagements_org_id_fkey
    foreign key (org_id)
    references organisations(id);

alter table engagements
  add constraint if not exists engagements_subject_org_id_fkey
    foreign key (subject_org_id)
    references organisations(id);

alter table workflow_runs
  add column if not exists org_id uuid;

update workflow_runs wr
set org_id = coalesce(wr.org_id, wr.engager_org_id);

alter table workflow_runs
  alter column org_id set not null;

alter table workflow_runs
  add constraint if not exists workflow_runs_org_id_fkey
    foreign key (org_id)
    references organisations(id);

alter table steps
  add column if not exists org_id uuid,
  add column if not exists subject_org_id uuid;

update steps s
set org_id = wr.org_id,
    subject_org_id = coalesce(s.subject_org_id, wr.subject_org_id)
from workflow_runs wr
where wr.id = s.run_id;

alter table steps
  alter column org_id set not null;

alter table steps
  add constraint if not exists steps_org_id_fkey
    foreign key (org_id)
    references organisations(id);

alter table steps
  add constraint if not exists steps_subject_org_id_fkey
    foreign key (subject_org_id)
    references organisations(id);

alter table documents
  add column if not exists org_id uuid,
  add column if not exists subject_org_id uuid;

update documents d
set org_id = wr.org_id,
    subject_org_id = coalesce(d.subject_org_id, wr.subject_org_id)
from workflow_runs wr
where wr.id = d.run_id;

alter table documents
  alter column org_id set not null;

alter table documents
  add constraint if not exists documents_org_id_fkey
    foreign key (org_id)
    references organisations(id);

alter table documents
  add constraint if not exists documents_subject_org_id_fkey
    foreign key (subject_org_id)
    references organisations(id);

alter table admin_actions
  add column if not exists org_id uuid,
  add column if not exists subject_org_id uuid;

update admin_actions aa
set org_id = coalesce(org_id, (
  select wr.org_id
  from workflow_runs wr
  where aa.payload ? 'run_id'
    and (aa.payload ->> 'run_id') ~* '^[0-9a-f-]{36}$'
    and (aa.payload ->> 'run_id')::uuid = wr.id
  limit 1
));

update admin_actions aa
set subject_org_id = coalesce(subject_org_id, (
  select wr.subject_org_id
  from workflow_runs wr
  where aa.payload ? 'run_id'
    and (aa.payload ->> 'run_id') ~* '^[0-9a-f-]{36}$'
    and (aa.payload ->> 'run_id')::uuid = wr.id
  limit 1
));

alter table admin_actions
  alter column org_id set not null;

alter table admin_actions
  add constraint if not exists admin_actions_org_id_fkey
    foreign key (org_id)
    references organisations(id);

alter table admin_actions
  add constraint if not exists admin_actions_subject_org_id_fkey
    foreign key (subject_org_id)
    references organisations(id);

alter table audit_log
  add column if not exists org_id uuid,
  add column if not exists subject_org_id uuid;

update audit_log al
set org_id = coalesce(al.org_id, wr.org_id),
    subject_org_id = coalesce(al.subject_org_id, wr.subject_org_id)
from workflow_runs wr
where wr.id = al.run_id;

update audit_log
set org_id = coalesce(org_id, actor_org_id, on_behalf_of_org_id);

alter table audit_log
  alter column org_id set not null;

alter table audit_log
  add constraint if not exists audit_log_org_id_fkey
    foreign key (org_id)
    references organisations(id);

alter table audit_log
  add constraint if not exists audit_log_subject_org_id_fkey
    foreign key (subject_org_id)
    references organisations(id);
