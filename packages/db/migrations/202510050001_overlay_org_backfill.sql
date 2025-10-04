begin;

perform pg_advisory_xact_lock(hashtext('tenant_workflow_overlays.org_id.not_null'));

with overlay_audit_orgs as (
  select distinct on (target_id) target_id, tenant_org_id
  from audit_log
  where target_kind = 'tenant_workflow_overlay'
    and tenant_org_id is not null
  order by target_id, created_at desc
),
resolved_overlays as (
  select two.id,
         coalesce(
           overlay_audit_orgs.tenant_org_id,
           snapshot_orgs.tenant_org_id,
           wd.org_id
         ) as resolved_org_id
  from tenant_workflow_overlays two
  left join overlay_audit_orgs on overlay_audit_orgs.target_id = two.id
  left join workflow_defs wd on wd.id = two.workflow_def_id
  left join lateral (
    select wr.tenant_org_id
    from workflow_overlay_snapshots s
    join workflow_runs wr on wr.id = s.run_id
    where s.tenant_overlay_id = two.id
      and wr.tenant_org_id is not null
    order by s.created_at desc
    limit 1
  ) snapshot_orgs on true
  where two.org_id is null
)
update tenant_workflow_overlays two
set org_id = resolved_overlays.resolved_org_id
from resolved_overlays
where two.id = resolved_overlays.id
  and two.org_id is null
  and resolved_overlays.resolved_org_id is not null;

do $$
begin
  if exists (select 1 from tenant_workflow_overlays where org_id is null) then
    raise exception 'tenant_workflow_overlays has NULL org_id rows after backfill';
  end if;
end;
$$;

alter table tenant_workflow_overlays
  alter column org_id set not null;

commit;
