begin;

alter table workflow_defs add column if not exists org_id uuid;

update workflow_defs wd
set org_id = sub.org_id
from (
  select workflow_def_id, org_id
  from (
    select workflow_def_id, org_id,
           row_number() over (partition by workflow_def_id order by created_at desc nulls last) as rn
    from workflow_def_versions
  ) ranked
  where rn = 1
) sub
where wd.id = sub.workflow_def_id
  and wd.org_id is distinct from sub.org_id;

update workflow_defs wd
set org_id = sub.org_id
from (
  select workflow_def_id, org_id
  from (
    select workflow_def_id, org_id,
           row_number() over (partition by workflow_def_id order by updated_at desc nulls last, created_at desc nulls last) as rn
    from tenant_workflow_overlays
  ) ranked
  where rn = 1
) sub
where wd.id = sub.workflow_def_id
  and wd.org_id is null;

update workflow_defs wd
set org_id = sub.org_id
from (
  select workflow_def_id, org_id,
         row_number() over (partition by workflow_def_id order by created_at desc nulls last) as rn
  from workflow_runs
  where workflow_def_id is not null
) sub
where wd.id = sub.workflow_def_id
  and sub.rn = 1
  and wd.org_id is null;

do $$
begin
  if exists (select 1 from workflow_defs where org_id is null) then
    raise exception 'workflow_defs org_id backfill failed';
  end if;
end;
$$;

alter table workflow_defs
  alter column org_id set not null;

alter table workflow_defs
  add constraint workflow_defs_org_id_fkey
    foreign key (org_id) references organisations(id);

create unique index if not exists workflow_defs_org_id_id_key on workflow_defs(org_id, id);
create index if not exists workflow_defs_org_key_idx on workflow_defs(org_id, key);

update workflow_def_versions v
set org_id = wd.org_id
from workflow_defs wd
where v.workflow_def_id = wd.id
  and v.org_id is distinct from wd.org_id;

update tenant_workflow_overlays two
set org_id = wd.org_id
from workflow_defs wd
where two.workflow_def_id = wd.id
  and two.org_id is distinct from wd.org_id;

update workflow_runs wr
set org_id = wd.org_id
from workflow_defs wd
where wr.workflow_def_id = wd.id
  and wd.org_id is distinct from wr.org_id;

alter table workflow_def_versions
  drop constraint if exists workflow_def_versions_workflow_def_id_fkey;

alter table workflow_def_versions
  add constraint workflow_def_versions_workflow_def_fk
    foreign key (org_id, workflow_def_id)
    references workflow_defs(org_id, id)
    on delete cascade;

alter table tenant_workflow_overlays
  drop constraint if exists tenant_workflow_overlays_workflow_def_id_fkey;

alter table tenant_workflow_overlays
  add constraint tenant_workflow_overlays_workflow_def_fk
    foreign key (org_id, workflow_def_id)
    references workflow_defs(org_id, id)
    on delete cascade;

alter table workflow_runs
  drop constraint if exists workflow_runs_workflow_def_id_fkey;

alter table workflow_runs
  add constraint workflow_runs_workflow_def_fk
    foreign key (org_id, workflow_def_id)
    references workflow_defs(org_id, id);

commit;
