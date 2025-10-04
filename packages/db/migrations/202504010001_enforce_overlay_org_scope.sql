begin;

with latest_bindings as (
  select distinct on (target_id) target_id, tenant_org_id
  from audit_log
  where target_kind = 'tenant_secret_binding'
    and tenant_org_id is not null
  order by target_id, created_at desc
)
update tenant_secret_bindings tsb
set org_id = latest_bindings.tenant_org_id
from latest_bindings
where tsb.id = latest_bindings.target_id
  and tsb.org_id is null;

with overlay_orgs as (
  select distinct on (target_id) target_id, tenant_org_id
  from audit_log
  where target_kind = 'tenant_workflow_overlay'
    and tenant_org_id is not null
  order by target_id, created_at desc
),
resolved_overlays as (
  select two.id,
         coalesce(overlay_orgs.tenant_org_id,
           (
             select wr.tenant_org_id
             from workflow_overlay_snapshots s
             join workflow_runs wr on wr.id = s.run_id
             where s.tenant_overlay_id = two.id
               and wr.tenant_org_id is not null
             order by s.created_at desc
             limit 1
           )
         ) as tenant_org_id
  from tenant_workflow_overlays two
  left join overlay_orgs on overlay_orgs.target_id = two.id
  where two.org_id is null
)
update tenant_workflow_overlays two
set org_id = resolved_overlays.tenant_org_id
from resolved_overlays
where two.id = resolved_overlays.id
  and two.org_id is null
  and resolved_overlays.tenant_org_id is not null;

alter table tenant_secret_bindings
  alter column org_id set not null;

alter table tenant_workflow_overlays
  alter column org_id set not null;

create index if not exists tenant_secret_bindings_org_alias_idx
  on tenant_secret_bindings(org_id, alias);

create index if not exists tenant_workflow_overlays_org_workflow_idx
  on tenant_workflow_overlays(org_id, workflow_def_id);

alter policy "Tenant members manage secret bindings" on tenant_secret_bindings
  for select using (
    auth.role() = 'service_role'
    or app.is_org_member(org_id)
  );

alter policy "Tenant members manage overlays" on tenant_workflow_overlays
  for select using (
    auth.role() = 'service_role'
    or app.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or app.is_org_member(org_id)
  );

alter policy "Members read overlay snapshots" on workflow_overlay_snapshots
  for select using (
    auth.role() = 'service_role'
    or (run_id is not null and public.can_access_run(run_id))
    or exists (
      select 1
      from tenant_workflow_overlays two
      where two.id = tenant_overlay_id
        and app.is_org_member(two.org_id)
    )
  );

alter policy "Members read overlay layers" on workflow_overlay_layers
  for select using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from workflow_overlay_snapshots s
      where s.id = snapshot_id
        and (
          (s.run_id is not null and public.can_access_run(s.run_id))
          or (
            s.tenant_overlay_id is not null
            and exists (
              select 1
              from tenant_workflow_overlays two
              where two.id = s.tenant_overlay_id
                and app.is_org_member(two.org_id)
            )
          )
        )
    )
  );

commit;
