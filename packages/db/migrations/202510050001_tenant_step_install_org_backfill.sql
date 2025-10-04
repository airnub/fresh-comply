begin;

-- Backfill and enforce tenant scope on tenant_step_type_installs.org_id
perform pg_advisory_xact_lock(hashtext('tenant_step_type_installs.org_id.backfill'));

with install_audit as (
  select distinct on (target_id) target_id, org_id
  from audit_log
  where target_id is not null
    and org_id is not null
    and (
      target_kind in ('tenant_step_type_install', 'tenant_step_type_installs')
      or entity = 'tenant_step_type_installs'
    )
  order by target_id, created_at desc
)
update tenant_step_type_installs tsi
set org_id = install_audit.org_id
from install_audit
where tsi.id = install_audit.target_id
  and tsi.org_id is null;

do $$
begin
  if exists (select 1 from tenant_step_type_installs where org_id is null) then
    raise exception 'tenant_step_type_installs has NULL org_id rows after backfill';
  end if;
end;
$$;

alter table tenant_step_type_installs
  alter column org_id set not null;

commit;
