begin;

-- Ensure tenant_step_type_installs rows are fully scoped
perform pg_advisory_xact_lock(hashtext('tenant_step_type_installs.org_id.not_null'));

do $$
begin
  if exists (select 1 from tenant_step_type_installs where org_id is null) then
    raise exception 'tenant_step_type_installs has NULL org_id rows';
  end if;
end;
$$;

alter table tenant_step_type_installs
  alter column org_id set not null;

create index if not exists tenant_step_type_installs_org_idx
  on tenant_step_type_installs(org_id);

-- Ensure tenant_workflow_overlays rows are fully scoped
perform pg_advisory_xact_lock(hashtext('tenant_workflow_overlays.org_id.not_null'));

do $$
begin
  if exists (select 1 from tenant_workflow_overlays where org_id is null) then
    raise exception 'tenant_workflow_overlays has NULL org_id rows';
  end if;
end;
$$;

alter table tenant_workflow_overlays
  alter column org_id set not null;

create index if not exists tenant_workflow_overlays_org_idx
  on tenant_workflow_overlays(org_id);

commit;
