begin;

alter table organisations
  add column if not exists tenant_org_id uuid;

update organisations
set tenant_org_id = coalesce(tenant_org_id, id);

alter table organisations
  alter column tenant_org_id set not null;

alter table organisations
  add constraint if not exists organisations_tenant_org_id_fkey
    foreign key (tenant_org_id) references organisations(id) on delete restrict;

create index if not exists organisations_tenant_org_id_idx on organisations(tenant_org_id);

alter table engagements
  add column if not exists tenant_org_id uuid,
  add column if not exists subject_org_id uuid;

update engagements
set tenant_org_id = coalesce(tenant_org_id, engager_org_id, client_org_id),
    subject_org_id = coalesce(subject_org_id, client_org_id);

alter table engagements
  alter column tenant_org_id set not null;

alter table engagements
  add constraint if not exists engagements_tenant_org_id_fkey
    foreign key (tenant_org_id) references organisations(id) on delete restrict;

alter table engagements
  add constraint if not exists engagements_subject_org_id_fkey
    foreign key (subject_org_id) references organisations(id) on delete set null;

create index if not exists engagements_tenant_org_id_idx on engagements(tenant_org_id);

alter table workflow_runs
  add column if not exists tenant_org_id uuid;

update workflow_runs
set tenant_org_id = coalesce(tenant_org_id, engager_org_id, subject_org_id);

alter table workflow_runs
  alter column tenant_org_id set not null;

alter table workflow_runs
  add constraint if not exists workflow_runs_tenant_org_id_fkey
    foreign key (tenant_org_id) references organisations(id) on delete restrict;

create index if not exists workflow_runs_tenant_org_id_idx on workflow_runs(tenant_org_id);

alter table steps
  add column if not exists tenant_org_id uuid,
  add column if not exists subject_org_id uuid;

update steps s
set tenant_org_id = coalesce(s.tenant_org_id, wr.tenant_org_id),
    subject_org_id = coalesce(s.subject_org_id, wr.subject_org_id)
from workflow_runs wr
where s.run_id = wr.id;

alter table steps
  alter column tenant_org_id set not null;

alter table steps
  add constraint if not exists steps_tenant_org_id_fkey
    foreign key (tenant_org_id) references organisations(id) on delete restrict;

alter table steps
  add constraint if not exists steps_subject_org_id_fkey
    foreign key (subject_org_id) references organisations(id) on delete set null;

create index if not exists steps_tenant_org_id_idx on steps(tenant_org_id);

alter table documents
  add column if not exists tenant_org_id uuid,
  add column if not exists subject_org_id uuid;

update documents d
set tenant_org_id = coalesce(d.tenant_org_id, wr.tenant_org_id),
    subject_org_id = coalesce(d.subject_org_id, wr.subject_org_id)
from workflow_runs wr
where d.run_id = wr.id;

alter table documents
  alter column tenant_org_id set not null;

alter table documents
  add constraint if not exists documents_tenant_org_id_fkey
    foreign key (tenant_org_id) references organisations(id) on delete restrict;

alter table documents
  add constraint if not exists documents_subject_org_id_fkey
    foreign key (subject_org_id) references organisations(id) on delete set null;

create index if not exists documents_tenant_org_id_idx on documents(tenant_org_id);

alter table admin_actions
  add column if not exists tenant_org_id uuid,
  add column if not exists actor_org_id uuid,
  add column if not exists on_behalf_of_org_id uuid,
  add column if not exists subject_org_id uuid;

update admin_actions aa
set tenant_org_id = coalesce(aa.tenant_org_id, wr.tenant_org_id),
    subject_org_id = coalesce(aa.subject_org_id, wr.subject_org_id)
from workflow_runs wr
where aa.payload ? 'run_id'
  and (aa.payload ->> 'run_id')::uuid = wr.id;

update admin_actions aa
set tenant_org_id = coalesce(aa.tenant_org_id, wr.tenant_org_id),
    subject_org_id = coalesce(aa.subject_org_id, wr.subject_org_id)
from steps s
join workflow_runs wr on wr.id = s.run_id
where aa.payload ? 'step_id'
  and (aa.payload ->> 'step_id')::uuid = s.id;

update admin_actions aa
set tenant_org_id = coalesce(aa.tenant_org_id, wr.tenant_org_id),
    subject_org_id = coalesce(aa.subject_org_id, wr.subject_org_id)
from documents d
join workflow_runs wr on wr.id = d.run_id
where aa.payload ? 'document_id'
  and (aa.payload ->> 'document_id')::uuid = d.id;

update admin_actions
set tenant_org_id = coalesce(tenant_org_id, actor_org_id);

update admin_actions
set actor_org_id = tenant_org_id
where actor_org_id is null and tenant_org_id is not null;

update admin_actions
set on_behalf_of_org_id = subject_org_id
where on_behalf_of_org_id is null and subject_org_id is not null;

alter table admin_actions
  add constraint if not exists admin_actions_tenant_org_id_fkey
    foreign key (tenant_org_id) references organisations(id) on delete restrict;

alter table admin_actions
  add constraint if not exists admin_actions_actor_org_id_fkey
    foreign key (actor_org_id) references organisations(id) on delete set null;

alter table admin_actions
  add constraint if not exists admin_actions_on_behalf_of_org_id_fkey
    foreign key (on_behalf_of_org_id) references organisations(id) on delete set null;

alter table admin_actions
  add constraint if not exists admin_actions_subject_org_id_fkey
    foreign key (subject_org_id) references organisations(id) on delete set null;

create index if not exists admin_actions_tenant_org_id_idx on admin_actions(tenant_org_id);

alter table audit_log
  add column if not exists tenant_org_id uuid,
  add column if not exists subject_org_id uuid;

update audit_log al
set tenant_org_id = coalesce(al.tenant_org_id, al.actor_org_id, al.on_behalf_of_org_id),
    subject_org_id = coalesce(al.subject_org_id, al.on_behalf_of_org_id);

alter table audit_log
  alter column tenant_org_id set not null;

alter table audit_log
  add constraint if not exists audit_log_tenant_org_id_fkey
    foreign key (tenant_org_id) references organisations(id) on delete restrict;

alter table audit_log
  add constraint if not exists audit_log_subject_org_id_fkey
    foreign key (subject_org_id) references organisations(id) on delete set null;

create index if not exists audit_log_tenant_org_id_idx on audit_log(tenant_org_id);

commit;
