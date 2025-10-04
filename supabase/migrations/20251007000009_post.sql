-- Auto-consolidated baseline (2025-10-04T14:42:43.529Z)
-- Verbatim leftovers (sequences, grants, unsupported ops)


grant execute on function public.normalize_domain(text) to anon, authenticated, service_role;
grant execute on function public.resolve_tenant_branding(text) to anon, authenticated, service_role;
grant execute on function public.assert_tenant_membership(uuid) to authenticated, service_role;
grant execute on function public.rpc_upsert_tenant_branding(uuid, jsonb, text, text, jsonb, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.rpc_get_tenant_branding(uuid) to authenticated, service_role;
grant execute on function public.rpc_upsert_tenant_domain(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.rpc_mark_tenant_domain_verified(uuid, text, timestamptz) to authenticated, service_role;
grant execute on function public.rpc_delete_tenant_domain(uuid) to authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_billing_price(
  text,
  text,
  text,
  integer,
  text,
  text,
  integer,
  boolean,
  jsonb
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_billing_tenant(
  uuid,
  text,
  billing_tenant_mode,
  uuid,
  text,
  jsonb
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_billing_subscription(
  uuid,
  uuid,
  text,
  billing_subscription_status,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  text,
  text,
  jsonb
) TO authenticated, service_role;
GRANT SELECT ON billing_subscription_overview TO authenticated, service_role;
grant execute on function public.rpc_upsert_tenant_branding(uuid, jsonb, text, text, jsonb, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.rpc_upsert_tenant_domain(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.rpc_mark_tenant_domain_verified(uuid, text, timestamptz) to authenticated, service_role;
grant execute on function public.rpc_delete_tenant_domain(uuid) to authenticated, service_role;
grant execute on function public.rpc_upsert_tenant_domain(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.rpc_upsert_tenant_domain(uuid, text, boolean) to authenticated, service_role;
grant select on public.v_step_types to authenticated, service_role;
grant select on public.v_step_type_versions to authenticated, service_role;
-- Ensure tenants can read the view while platform admins retain write access
grant select on public.rule_catalogs_public to public;
grant execute on function public.normalize_domain(text) to anon, authenticated, service_role;
grant execute on function public.resolve_tenant_branding(text) to anon, authenticated, service_role;
grant execute on function public.assert_tenant_membership(uuid) to authenticated, service_role;
grant execute on function public.rpc_upsert_tenant_branding(uuid, jsonb, text, text, jsonb, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.rpc_get_tenant_branding(uuid) to authenticated, service_role;
grant execute on function public.rpc_upsert_tenant_domain(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.rpc_mark_tenant_domain_verified(uuid, text, timestamptz) to authenticated, service_role;
grant execute on function public.rpc_delete_tenant_domain(uuid) to authenticated, service_role;
grant execute on function public.rpc_upsert_billing_price(
  text,
  text,
  text,
  integer,
  text,
  text,
  integer,
  boolean,
  jsonb
) to authenticated, service_role;
grant execute on function public.rpc_upsert_billing_tenant(
  uuid,
  text,
  billing_tenant_mode,
  uuid,
  text,
  jsonb
) to authenticated, service_role;
grant execute on function public.rpc_upsert_billing_subscription(
  uuid,
  uuid,
  text,
  billing_subscription_status,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  text,
  text,
  jsonb
) to authenticated, service_role;
grant select on billing_subscription_overview to authenticated, service_role;
grant select on v_step_types to authenticated, service_role;
grant select on v_step_type_versions to authenticated, service_role;

-- Unsupported/kept verbatim:
-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.json_schemas enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.step_types enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.step_type_versions enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.tenant_step_type_installs enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.tenant_secret_bindings enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.tenant_workflow_overlays enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_overlay_snapshots enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_overlay_layers enable row level security;

update organisations
set org_id = id
where org_id is null;

update engagements
set org_id = coalesce(org_id, engager_org_id);

update engagements
set subject_org_id = coalesce(subject_org_id, client_org_id);

update workflow_runs wr
set org_id = coalesce(wr.org_id, wr.engager_org_id);

update steps s
set org_id = wr.org_id,
    subject_org_id = coalesce(s.subject_org_id, wr.subject_org_id)
from workflow_runs wr
where wr.id = s.run_id;

update documents d
set org_id = wr.org_id,
    subject_org_id = coalesce(d.subject_org_id, wr.subject_org_id)
from workflow_runs wr
where wr.id = d.run_id;

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

update audit_log al
set org_id = coalesce(al.org_id, wr.org_id),
    subject_org_id = coalesce(al.subject_org_id, wr.subject_org_id)
from workflow_runs wr
where wr.id = al.run_id;

update audit_log
set org_id = coalesce(org_id, actor_org_id, on_behalf_of_org_id);

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.tenant_domains enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.tenant_branding enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.billing_prices ENABLE ROW LEVEL SECURITY;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.billing_tenants ENABLE ROW LEVEL SECURITY;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

begin;

update audit_log
  set target_kind = coalesce(target_kind, entity, case when step_id is not null then 'step' when run_id is not null then 'workflow_run' else null end),
      target_id = coalesce(target_id, case when step_id is not null then step_id when run_id is not null then run_id else null end),
      inserted_at = coalesce(inserted_at, created_at, now()),
      meta_json = coalesce(meta_json, '{}'::jsonb);

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.admin_actions rename column if exists reason to reason_code;

update admin_actions
  set inserted_at = coalesce(inserted_at, created_at, now()),
      payload = coalesce(payload, '{}'::jsonb);

-- backfill hash chains for existing rows
do $$
declare
  rec record;
  v_prev text := repeat('0', 64);
  v_tenant uuid := null;
begin
  for rec in
    select *
    from audit_log
    order by org_id, created_at, id
  loop
    if v_tenant is distinct from rec.org_id then
      v_prev := repeat('0', 64);
      v_tenant := rec.org_id;
    end if;

    update audit_log
    set prev_hash = v_prev,
        row_hash = encode(
          digest(
            jsonb_build_object(
              'org_id', rec.org_id,
              'actor_user_id', rec.actor_user_id,
              'actor_org_id', rec.actor_org_id,
              'on_behalf_of_org_id', rec.on_behalf_of_org_id,
              'subject_org_id', rec.subject_org_id,
              'entity', rec.entity,
              'target_kind', rec.target_kind,
              'target_id', rec.target_id,
              'run_id', rec.run_id,
              'step_id', rec.step_id,
              'action', rec.action,
              'lawful_basis', rec.lawful_basis,
              'meta_json', rec.meta_json,
              'prev_hash', v_prev,
              'created_at', to_char(rec.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
              'inserted_at', to_char(rec.inserted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
            )::text,
            'sha256'
          ),
          'hex'
        )
    where id = rec.id;

    select row_hash into v_prev from audit_log where id = rec.id;
  end loop;
end;
$$;

do $$
declare
  rec record;
  v_prev text := repeat('0', 64);
  v_tenant uuid := null;
begin
  for rec in
    select *
    from admin_actions
    order by org_id, created_at, id
  loop
    if v_tenant is distinct from rec.org_id then
      v_prev := repeat('0', 64);
      v_tenant := rec.org_id;
    end if;

    update admin_actions
    set prev_hash = v_prev,
        row_hash = encode(
          digest(
            jsonb_build_object(
              'org_id', rec.org_id,
              'actor_id', rec.actor_id,
              'actor_org_id', rec.actor_org_id,
              'on_behalf_of_org_id', rec.on_behalf_of_org_id,
              'subject_org_id', rec.subject_org_id,
              'target_kind', rec.target_kind,
              'target_id', rec.target_id,
              'action', rec.action,
              'reason_code', rec.reason_code,
              'lawful_basis', rec.lawful_basis,
              'payload', rec.payload,
              'requires_second_approval', rec.requires_second_approval,
              'second_actor_id', rec.second_actor_id,
              'prev_hash', v_prev,
              'created_at', to_char(rec.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
              'inserted_at', to_char(rec.inserted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
              'approved_at', case when rec.approved_at is not null then to_char(rec.approved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') else null end
            )::text,
            'sha256'
          ),
          'hex'
        )
    where id = rec.id;

    select row_hash into v_prev from admin_actions where id = rec.id;
  end loop;
end;
$$;

drop trigger if exists audit_log_before_insert on audit_log;

drop trigger if exists admin_actions_before_insert on admin_actions;

drop trigger if exists audit_log_block_mutations on audit_log;

create constraint trigger audit_log_block_mutations
  after update or delete on audit_log
  for each statement execute function raise_append_only();

drop trigger if exists admin_actions_block_mutations on admin_actions;

create constraint trigger admin_actions_block_mutations
  after update or delete on admin_actions
  for each statement execute function raise_append_only();

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.audit_log enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.admin_actions enable row level security;

drop policy if exists "Service role manages audit log" on audit_log;

drop policy if exists "Service role manages admin actions" on admin_actions;

commit;

begin;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.source_registry enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.source_snapshot enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.change_event enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.rule_versions enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.template_versions enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_def_versions enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_pack_versions enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.moderation_queue enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.release_notes enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.adoption_records enable row level security;

commit;

begin;

select app.__ensure_not_null('source_registry', 'org_id');

select app.__ensure_not_null('source_snapshot', 'org_id');

select app.__ensure_not_null('change_event', 'org_id');

select app.__ensure_not_null('rule_versions', 'org_id');

select app.__ensure_not_null('template_versions', 'org_id');

select app.__ensure_not_null('workflow_def_versions', 'org_id');

select app.__ensure_not_null('workflow_pack_versions', 'org_id');

select app.__ensure_not_null('moderation_queue', 'org_id');

select app.__ensure_not_null('release_notes', 'org_id');

select app.__ensure_not_null('adoption_records', 'org_id');

drop function app.__ensure_not_null(regclass, text);

-- Restore strict tenant scoping policies without NULL bypasses. These match the
-- definitions introduced in 202503150001_freshness_tables.sql.

alter policy "Tenant members read source registry" on source_registry
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read source snapshots" on source_snapshot
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read change events" on change_event
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read rule versions" on rule_versions
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read template versions" on template_versions
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read workflow def versions" on workflow_def_versions
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read workflow pack versions" on workflow_pack_versions
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members view moderation queue" on moderation_queue
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read release notes" on release_notes
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members read adoption records" on adoption_records
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

alter policy "Tenant members insert adoption records" on adoption_records
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

commit;

-- Introduce app.jwt() helper and update platform admin checks
set check_function_bodies = off;

comment on function app.is_platform_admin() is
  'Returns true when the JWT role is platform_admin or when the is_platform_admin claim is boolean true. '
  'Service role access should continue through public.is_platform_service().';

begin;

update audit_log
set tenant_id = coalesce(tenant_id, org_id)
where tenant_id is distinct from coalesce(org_id, tenant_id);

with ordered as (
  select
    id,
    tenant_id,
    row_number() over (
      partition by tenant_id
      order by coalesce(inserted_at, created_at), created_at, id
    ) as seq
  from audit_log
)
update audit_log a
set chain_position = ordered.seq
from ordered
where ordered.id = a.id;

update audit_log
set chain_position = 1
where chain_position is null;

drop index if exists audit_log_row_hash_key;

do $$
declare
  rec record;
  v_prev text := repeat('0', 64);
  v_prev_tenant uuid := null;
  v_position bigint := 0;
begin
  for rec in
    select *
    from audit_log
    order by tenant_id, chain_position, inserted_at, created_at, id
  loop
    if v_prev_tenant is distinct from rec.tenant_id then
      v_prev := repeat('0', 64);
      v_prev_tenant := rec.tenant_id;
      v_position := 0;
    end if;

    v_position := v_position + 1;

    update audit_log
    set prev_hash = case when v_position = 1 then repeat('0', 64) else v_prev end,
        chain_position = v_position,
        row_hash = encode(
          digest(
            jsonb_build_object(
              'tenant_id', rec.tenant_id,
              'org_id', rec.org_id,
              'actor_user_id', rec.actor_user_id,
              'actor_org_id', rec.actor_org_id,
              'on_behalf_of_org_id', rec.on_behalf_of_org_id,
              'subject_org_id', rec.subject_org_id,
              'entity', rec.entity,
              'target_kind', rec.target_kind,
              'target_id', rec.target_id,
              'run_id', rec.run_id,
              'step_id', rec.step_id,
              'action', rec.action,
              'lawful_basis', rec.lawful_basis,
              'meta_json', rec.meta_json,
              'prev_hash', case when v_position = 1 then repeat('0', 64) else v_prev end,
              'chain_position', v_position,
              'created_at', to_char(rec.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
              'inserted_at', to_char(rec.inserted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
            )::text,
            'sha256'
          ),
          'hex'
        )
    where id = rec.id;

    select row_hash into v_prev from audit_log where id = rec.id;
  end loop;
end;
$$;

comment on column audit_log.tenant_id is 'Tenant scope for hash chain enforcement.';

comment on column audit_log.chain_position is 'Monotonic position within the tenant-specific audit hash chain.';

comment on trigger audit_log_block_mutations on audit_log is 'Prevents UPDATE or DELETE on the append-only audit ledger.';

drop trigger if exists audit_log_before_insert on audit_log;

comment on trigger audit_log_before_insert on audit_log is 'Computes prev_hash, row_hash, and chain_position for tenant-scoped audit ledger.';

commit;

begin;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_sources enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_source_snapshots enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_packs enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_pack_detections enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_pack_detection_sources enable row level security;

insert into platform.rule_sources (id, name, url, parser, jurisdiction, category, created_at)
select id, name, url, parser, jurisdiction, category, created_at
from source_registry
where org_id is null
on conflict (id) do update set
  name = excluded.name,
  url = excluded.url,
  parser = excluded.parser,
  jurisdiction = excluded.jurisdiction,
  category = excluded.category,
  updated_at = now();

delete from source_registry where org_id is null;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.source_registry rename column org_id to org_id;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.source_snapshot rename column org_id to org_id;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.change_event rename column org_id to org_id;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.rule_versions rename column org_id to org_id;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.template_versions rename column org_id to org_id;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_def_versions rename column org_id to org_id;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_pack_versions rename column org_id to org_id;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.moderation_queue rename column org_id to org_id;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.release_notes rename column org_id to org_id;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.adoption_records rename column org_id to org_id;

drop index if exists source_registry_tenant_idx;

drop index if exists source_snapshot_tenant_idx;

drop index if exists change_event_tenant_idx;

drop index if exists rule_versions_tenant_idx;

drop index if exists template_versions_tenant_idx;

drop index if exists workflow_def_versions_tenant_idx;

drop index if exists workflow_pack_versions_tenant_idx;

drop index if exists moderation_queue_tenant_status_idx;

drop index if exists release_notes_scope_idx;

drop index if exists adoption_records_scope_idx;

alter policy "Tenant members read source registry" on source_registry
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read source snapshots" on source_snapshot
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read change events" on change_event
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read rule versions" on rule_versions
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read template versions" on template_versions
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read workflow def versions" on workflow_def_versions
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read workflow pack versions" on workflow_pack_versions
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members view moderation queue" on moderation_queue
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read release notes" on release_notes
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members read adoption records" on adoption_records
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

alter policy "Tenant members insert adoption records" on adoption_records
  with check (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

commit;

begin;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_pack_proposals enable row level security;

-- Backfill interim proposal data that previously lived on detections.diff/notes
insert into platform.rule_pack_proposals (
  detection_id,
  rule_pack_id,
  rule_pack_key,
  current_version,
  proposed_version,
  changelog,
  status,
  review_notes,
  created_by,
  created_at,
  updated_at,
  approved_at
)
select
  d.id as detection_id,
  d.rule_pack_id,
  d.rule_pack_key,
  d.current_version,
  d.proposed_version,
  jsonb_build_object(
    'summary', coalesce(d.notes, ''),
    'diff', coalesce(d.diff, '{}'::jsonb),
    'detected_at', coalesce(d.detected_at, now())
  ) as changelog,
  case d.status
    when 'approved' then 'approved'
    when 'rejected' then 'rejected'
    when 'in_review' then 'in_review'
    when 'superseded' then 'superseded'
    else 'pending'
  end as status,
  nullif(d.notes, '') as review_notes,
  d.created_by,
  coalesce(d.detected_at, now()) as created_at,
  now() as updated_at,
  case when d.status = 'approved' then coalesce(d.detected_at, now()) end as approved_at
from platform.rule_pack_detections d
on conflict (detection_id) do update set
  changelog = excluded.changelog,
  status = excluded.status,
  review_notes = excluded.review_notes,
  updated_at = excluded.updated_at,
  approved_at = excluded.approved_at;

commit;

begin;

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

commit;

begin;

with latest_bindings as (
  select distinct on (target_id) target_id, org_id
  from audit_log
  where target_kind = 'tenant_secret_binding'
    and org_id is not null
  order by target_id, created_at desc
)
update tenant_secret_bindings tsb
set org_id = latest_bindings.org_id
from latest_bindings
where tsb.id = latest_bindings.target_id
  and tsb.org_id is null;

with overlay_orgs as (
  select distinct on (target_id) target_id, org_id
  from audit_log
  where target_kind = 'tenant_workflow_overlay'
    and org_id is not null
  order by target_id, created_at desc
),
resolved_overlays as (
  select two.id,
         coalesce(overlay_orgs.org_id,
           (
             select wr.org_id
             from workflow_overlay_snapshots s
             join workflow_runs wr on wr.id = s.run_id
             where s.tenant_overlay_id = two.id
               and wr.org_id is not null
             order by s.created_at desc
             limit 1
           )
         ) as org_id
  from tenant_workflow_overlays two
  left join overlay_orgs on overlay_orgs.target_id = two.id
  where two.org_id is null
)
update tenant_workflow_overlays two
set org_id = resolved_overlays.org_id
from resolved_overlays
where two.id = resolved_overlays.id
  and two.org_id is null
  and resolved_overlays.org_id is not null;

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

-- Ensure any existing timestamps are populated prior to tightening constraints
update public.step_types
set created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());

update public.step_type_versions
set created_at = coalesce(created_at, now());

-- Copy existing registry data into the platform schema
insert into platform.step_types (id, slug, title, category, summary, latest_version, created_by, created_at, updated_at)
select id, slug, title, category, summary, latest_version, created_by, created_at, updated_at
from public.step_types
on conflict (id) do update
  set slug = excluded.slug,
      title = excluded.title,
      category = excluded.category,
      summary = excluded.summary,
      latest_version = excluded.latest_version,
      created_by = excluded.created_by,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;

insert into platform.step_type_versions (id, step_type_id, version, definition, input_schema_id, output_schema_id, status, created_by, created_at, published_at)
select id, step_type_id, version, definition, input_schema_id, output_schema_id, status, created_by, created_at, published_at
from public.step_type_versions
on conflict (id) do update
  set step_type_id = excluded.step_type_id,
      version = excluded.version,
      definition = excluded.definition,
      input_schema_id = excluded.input_schema_id,
      output_schema_id = excluded.output_schema_id,
      status = excluded.status,
      created_by = excluded.created_by,
      created_at = excluded.created_at,
      published_at = excluded.published_at;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.step_types enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.step_type_versions enable row level security;

drop view if exists public.step_type_versions cascade;

drop view if exists public.step_types cascade;

drop table if exists public.step_type_versions cascade;

drop table if exists public.step_types cascade;

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

-- Ensure tenant_workflow_overlays rows are fully scoped
perform pg_advisory_xact_lock(hashtext('tenant_workflow_overlays.org_id.not_null'));

do $$
begin
  if exists (select 1 from tenant_workflow_overlays where org_id is null) then
    raise exception 'tenant_workflow_overlays has NULL org_id rows';
  end if;
end;
$$;

commit;

begin;

perform pg_advisory_xact_lock(hashtext('tenant_workflow_overlays.org_id.not_null'));

with overlay_audit_orgs as (
  select distinct on (target_id) target_id, org_id
  from audit_log
  where target_kind = 'tenant_workflow_overlay'
    and org_id is not null
  order by target_id, created_at desc
),
resolved_overlays as (
  select two.id,
         coalesce(
           overlay_audit_orgs.org_id,
           snapshot_orgs.org_id,
           wd.org_id
         ) as resolved_org_id
  from tenant_workflow_overlays two
  left join overlay_audit_orgs on overlay_audit_orgs.target_id = two.id
  left join workflow_defs wd on wd.id = two.workflow_def_id
  left join lateral (
    select wr.org_id
    from workflow_overlay_snapshots s
    join workflow_runs wr on wr.id = s.run_id
    where s.tenant_overlay_id = two.id
      and wr.org_id is not null
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

commit;

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

commit;

-- Core tenancy tables for organisations, memberships, and realms
set check_function_bodies = off;

-- Require explicit platform admin role or boolean override
set check_function_bodies = off;

comment on function app.is_platform_admin() is
  'Returns true when the JWT role is platform_admin or when the is_platform_admin claim is boolean true. '
  'Service role access should continue through public.is_platform_service().';

-- Helper functions consumed by RLS policies
set check_function_bodies = off;

$$;
  end if;
end$$;

-- Platform catalog schema reserved for global data
set check_function_bodies = off;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_catalogs enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rules enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.global_records enable row level security;

-- Restrict catalog tables to platform administrators
drop policy if exists "platform_rule_catalogs_select" on platform.rule_catalogs;

drop policy if exists "platform_rule_catalogs_modify" on platform.rule_catalogs;

drop policy if exists "platform_rules_select" on platform.rules;

drop policy if exists "platform_rules_modify" on platform.rules;

drop policy if exists "platform_global_records_select" on platform.global_records;

drop policy if exists "platform_global_records_modify" on platform.global_records;

-- Archive existing global rows before enforcing strict tenancy requirements
set check_function_bodies = off;

do $$
declare
  rec record;
  has_null boolean;
begin
  for rec in
    select table_schema, table_name
    from information_schema.columns
    where column_name = 'org_id'
      and table_schema = 'public'
  loop
    execute format('select exists (select 1 from %I.%I where org_id is null)', rec.table_schema, rec.table_name)
      into has_null;

    if has_null then
      execute format(
        'insert into platform.global_records (source_table, payload)
         select %L, to_jsonb(t) from %I.%I t where org_id is null',
        rec.table_schema || '.' || rec.table_name,
        rec.table_schema,
        rec.table_name
      );

      execute format('delete from %I.%I where org_id is null', rec.table_schema, rec.table_name);
    end if;
  end loop;
end$$;

-- Enforce strict constraints on org_id columns
set check_function_bodies = off;

-- Apply standard tenancy RLS policies using app.has_org_access
set check_function_bodies = off;

do $$
declare
  rec record;
  policy record;
  qualified text;
  policy_name text;
begin
  -- Drop legacy policies referencing NULL tenancy checks
  for policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname is not null
      and definition ilike '%org_id is null%'
  loop
    execute format('drop policy if exists %I on %I.%I', policy.policyname, policy.schemaname, policy.tablename);
  end loop;

  for rec in
    select table_schema, table_name
    from information_schema.columns
    where column_name = 'org_id'
      and table_schema = 'public'
  loop
    qualified := format('%I.%I', rec.table_schema, rec.table_name);

    execute format('alter table %s enable row level security', qualified);
    execute format('alter table %s force row level security', qualified);

    -- Remove duplicate policies so template can be applied idempotently
    for policy in
      select policyname
      from pg_policies
      where schemaname = rec.table_schema
        and tablename = rec.table_name
    loop
      execute format('drop policy if exists %I on %s', policy.policyname, qualified);
    end loop;

    policy_name := format('%s_select', rec.table_name);
    execute format('create policy %I on %s for select using (app.has_org_access(org_id))', policy_name, qualified);

    policy_name := format('%s_insert', rec.table_name);
    execute format('create policy %I on %s for insert with check (app.has_org_access(org_id))', policy_name, qualified);

    policy_name := format('%s_update', rec.table_name);
    execute format('create policy %I on %s for update using (app.has_org_access(org_id)) with check (app.has_org_access(org_id))', policy_name, qualified);

    policy_name := format('%s_delete', rec.table_name);
    execute format('create policy %I on %s for delete using (app.has_org_access(org_id))', policy_name, qualified);
  end loop;
end$$;

-- Enrich org hierarchy metadata and update provider admin helper
set check_function_bodies = off;

-- Backfill hierarchy data based on existing memberships and realm ownership
DO $$
DECLARE
  realm_customer_column text;
BEGIN
  -- Identify platform orgs from existing platform admin memberships
  update public.orgs o
     set type = 'platform',
         parent_org_id = null
   where exists (
           select 1
             from public.org_memberships m
            where m.org_id = o.id
              and m.role = 'platform_admin'
         );

  -- Flag providers using realm ownership or elevated memberships
  update public.orgs o
     set type = 'provider',
         parent_org_id = null
   where o.type is distinct from 'platform'
     and (
       exists (
         select 1
           from public.realms r
          where r.provider_org_id = o.id
       )
       or exists (
         select 1
           from public.org_memberships m
          where m.org_id = o.id
            and m.role in ('provider_admin', 'org_admin')
       )
     );

  -- Detect which column (if any) links realms to customer orgs
  select column_name
    into realm_customer_column
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'realms'
    and column_name in ('org_id', 'parent_org_id', 'customer_org_id')
  order by case column_name
             when 'org_id' then 1
              when 'parent_org_id' then 2
              else 3
            end
   limit 1;

  if realm_customer_column is not null then
    execute format(
      $sql$
        update public.orgs c
           set parent_org_id = r.provider_org_id,
               type = case
                 when c.type in ('platform', 'provider') then c.type
                 else 'customer'
               end
          from public.realms r
         where r.%I = c.id
           and r.provider_org_id <> c.id
      $sql$,
      realm_customer_column
    );
  end if;

  -- Default any remaining orgs to customers when type is still null
  update public.orgs
     set type = 'customer'
   where type is null;
END$$;

-- Align app.is_platform_admin with platform_admin role claims
set check_function_bodies = off;

comment on function app.is_platform_admin() is
  'Returns true when the JWT role is platform_admin or when the is_platform_admin claim is boolean true. '
  'Service role access should continue through public.is_platform_service().';

-- Require explicit platform admin role or boolean override
set check_function_bodies = off;

comment on function app.is_platform_admin() is
  'Returns true when the JWT role is platform_admin or when the is_platform_admin claim is boolean true. '
  'Service role access should continue through public.is_platform_service().';

-- Strengthen org hierarchy metadata and provider admin helper traversal
set check_function_bodies = off;

-- Backfill hierarchy information for existing data
DO $$
DECLARE
  realm_customer_column text;
BEGIN
  -- Identify platform orgs from platform admin memberships
  update public.orgs o
     set type = 'platform',
         parent_org_id = null
   where exists (
           select 1
             from public.org_memberships m
            where m.org_id = o.id
              and m.role = 'platform_admin'
        );

  -- Mark providers via realm ownership or elevated memberships
  update public.orgs o
     set type = 'provider',
         parent_org_id = null
   where o.type is distinct from 'platform'
     and (
       exists (
         select 1
           from public.realms r
          where r.provider_org_id = o.id
       )
       or exists (
         select 1
           from public.org_memberships m
          where m.org_id = o.id
            and m.role in ('provider_admin', 'org_admin')
       )
     );

  -- Detect which column links realms to customer orgs if the column exists
  select column_name
    into realm_customer_column
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'realms'
    and column_name in ('org_id', 'parent_org_id', 'customer_org_id')
  order by case column_name
             when 'org_id' then 1
              when 'parent_org_id' then 2
              else 3
            end
   limit 1;

  if realm_customer_column is not null then
    execute format(
      $sql$
        update public.orgs c
           set parent_org_id = r.provider_org_id,
               type = case
                 when c.type in ('platform', 'provider') then c.type
                 else 'customer'
               end
          from public.realms r
         where r.%I = c.id
           and r.provider_org_id <> c.id
      $sql$,
      realm_customer_column
    );
  end if;

  -- Ensure providers and platform orgs do not point to parents
  update public.orgs
     set parent_org_id = null
   where type in ('platform', 'provider')
     and parent_org_id is not null;

  -- Default any remaining orgs to customer
  update public.orgs
     set type = 'customer'
   where type is null;
END$$;

-- Freshness tables enforce tenant isolation and audit logging
begin;

do $$
declare
  tenant_one constant uuid := '00000000-0000-0000-0000-000000000101';
  tenant_two constant uuid := '00000000-0000-0000-0000-000000000202';
  user_one constant uuid := '00000000-0000-0000-0000-000000000901';
  user_two constant uuid := '00000000-0000-0000-0000-000000000902';
  v_source_id uuid;
  v_change_event_id uuid;
  v_platform_source_id uuid;
  v_rule_pack_id uuid;
  v_detection_id uuid;
  v_snapshot_id uuid;
  v_moderation_id uuid;
  v_adoption_id uuid;
  v_proposal_id uuid;
  v_admin_source_id uuid;
  v_admin_adoption_id uuid;
  v_step_type_id uuid;
  v_step_type_version_id uuid;
  v_text text;
  v_count integer;
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);

  insert into organisations (id, org_id, name, slug)
  values
    (tenant_one, tenant_one, 'Tenant One', 'tenant-one'),
    (tenant_two, tenant_two, 'Tenant Two', 'tenant-two')
  on conflict (id) do nothing;

  insert into users (id, email)
  values
    (user_one, 'user1@example.com'),
    (user_two, 'user2@example.com')
  on conflict (id) do nothing;

  insert into memberships (user_id, org_id, role)
  values
    (user_one, tenant_one, 'admin'),
    (user_two, tenant_two, 'admin')
  on conflict do nothing;

  insert into source_registry (org_id, name, url, parser, jurisdiction, category)
  values (tenant_one, 'CRO Guidance', 'https://example.test/cro', 'html', 'ie', 'cro')
  returning id into v_source_id;

  begin
    insert into source_registry (org_id, name, url, parser, jurisdiction, category)
    values (null, 'Invalid Source', 'https://example.test/invalid', 'html', 'ie', 'invalid');
    raise exception 'source_registry.org_id should reject NULL values';
  exception
    when not_null_violation then
      null;
  end;

  insert into platform.rule_sources (name, url, parser, jurisdiction, category)
  values ('Platform CRO Guidance', 'https://example.test/platform-cro', 'html', 'ie', 'platform')
  returning id into v_platform_source_id;

  insert into platform.rule_source_snapshots (rule_source_id, content_hash, parsed_facts)
  values (
    v_platform_source_id,
    'hash-platform-1',
    jsonb_build_object('records', jsonb_build_array())
  )
  returning id into v_snapshot_id;

  select count(*)
  into v_count
  from platform.rule_source_snapshots
  where rule_source_id = v_platform_source_id;

  if v_count <> 1 then
    raise exception 'Platform snapshots should be persisted for platform rule sources';
  end if;

  insert into platform.rule_packs (pack_key, version, title, summary, manifest, checksum, created_by)
  values (
    'freshness_pack',
    '1.0.0',
    'Freshness Pack',
    'Initial platform pack',
    '{}'::jsonb,
    'sha-1',
    user_one
  )
  returning id into v_rule_pack_id;

  insert into platform.rule_pack_detections (
    rule_pack_id,
    rule_pack_key,
    current_version,
    proposed_version,
    severity,
    diff,
    created_by,
    notes
  )
  values (
    v_rule_pack_id,
    'freshness_pack',
    '1.0.0',
    '1.1.0',
    'minor',
    jsonb_build_object('changes', 'diff'),
    user_one,
    'Automated watcher'
  )
  returning id into v_detection_id;

  insert into platform.rule_pack_detection_sources (detection_id, rule_source_id, change_summary)
  values (v_detection_id, v_platform_source_id, jsonb_build_object('field', 'deadline'));

  select count(*)
  into v_count
  from platform.rule_pack_detection_sources
  where detection_id = v_detection_id;

  if v_count <> 1 then
    raise exception 'Detection should reference exactly one rule source';
  end if;

  insert into platform.step_types (slug, title, category, summary, latest_version, created_by)
  values ('demo-platform-step', 'Demo Platform Step', 'demo', 'Platform demo step', '1.0.0', user_one)
  returning id into v_step_type_id;

  insert into platform.step_type_versions (step_type_id, version, definition, status, created_by)
  values (v_step_type_id, '1.0.0', '{}'::jsonb, 'published', user_one)
  returning id into v_step_type_version_id;

  update platform.step_types
  set latest_version = '1.0.0'
  where id = v_step_type_id;

  insert into tenant_step_type_installs (org_id, step_type_version_id, status)
  values (tenant_one, v_step_type_version_id, 'enabled')
  on conflict do nothing;

  begin
    v_text := null;
    insert into tenant_step_type_installs (org_id, step_type_version_id, status)
    values (null, v_step_type_version_id, 'enabled');
    raise exception 'tenant_step_type_installs.org_id should reject NULL values';
  exception
    when not_null_violation then
      get stacked diagnostics v_text = RETURNED_SQLSTATE;
      if v_text <> '23502' then
        raise exception 'Expected SQLSTATE 23502 for tenant_step_type_installs.org_id, got %', v_text;
      end if;
  end;
  insert into platform.rule_pack_proposals (
    detection_id,
    rule_pack_id,
    rule_pack_key,
    current_version,
    proposed_version,
    changelog,
    status
  )
  values (
    v_detection_id,
    v_rule_pack_id,
    'freshness_pack',
    '1.0.0',
    '1.1.0',
    jsonb_build_object('summary', 'Initial proposal'),
    'pending'
  )
  returning id into v_proposal_id;

  select status
  into v_text
  from platform.rule_pack_proposals
  where id = v_proposal_id;

  if v_text <> 'pending' then
    raise exception 'Service role should insert pending proposals';
  end if;

  insert into source_snapshot (org_id, source_id, content_hash, parsed_facts, storage_ref)
  values (tenant_one, v_source_id, 'hash-1', '{"facts":[]}'::jsonb, 's3://bucket/object');

  insert into change_event (org_id, source_id, from_hash, to_hash, severity, notes)
  values (tenant_one, v_source_id, 'hash-0', 'hash-1', 'minor', 'Detected diff')
  returning id into v_change_event_id;

  insert into moderation_queue (org_id, change_event_id, proposal, status, classification, created_by)
  values (
    tenant_one,
    v_change_event_id,
    jsonb_build_object('rule', 'rbo_deadline', 'bump', 'minor'),
    'pending',
    null,
    user_one
  )
  returning id into v_moderation_id;

  select count(*)
  into v_count
  from audit_log
  where entity = 'moderation_queue'
    and target_id = v_moderation_id;

  if v_count <> 1 then
    raise exception 'Moderation queue insert did not append audit log entry';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'authenticated',
      'sub', user_one::text,
      'org_id', tenant_one::text,
      'org_ids', jsonb_build_array(tenant_one::text)
    )::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_one::text, true);
  perform set_config('request.jwt.claim.org_id', tenant_one::text, true);

  begin
    perform 1
    from platform.step_types
    where id = v_step_type_id;
    raise exception 'Tenant member should not read platform step types';
  exception
    when sqlstate '42501' then
      null;
  end;

  begin
    insert into platform.step_types (slug, title)
    values ('tenant-attempt-step', 'Tenant Attempt Step');
    raise exception 'Tenant member should not insert platform step types';
  exception
    when sqlstate '42501' then
      null;
  end;

  select count(*)
  into v_count
  from v_step_types
  where id = v_step_type_id;

  if v_count <> 1 then
    raise exception 'Tenant member should read step type registry via view';
  end if;

  select count(*)
  into v_count
  from v_step_type_versions
  where id = v_step_type_version_id;

  if v_count <> 1 then
    raise exception 'Tenant member should read step type versions via view';
  end if;

  select count(*)
  into v_count
  from source_registry
  where org_id = tenant_one;
  if v_count <> 1 then
    raise exception 'Tenant member should read own source registry entries';
  end if;

  begin
    perform 1 from platform.rule_sources;
    raise exception 'Tenant member should not read platform rule sources';
  exception
    when sqlstate '42501' then
      null;
  end;

  begin
    perform 1 from platform.rule_source_snapshots;
    raise exception 'Tenant member should not read platform rule source snapshots';
  exception
    when sqlstate '42501' then
      null;
  end;

  begin
    perform 1 from platform.rule_pack_proposals;
    raise exception 'Tenant member should not read platform rule pack proposals';
  exception
    when sqlstate '42501' then
      null;
  end;

  begin
    update platform.rule_sources
    set parser = 'xml'
    where id = v_platform_source_id;
    raise exception 'Tenant member should not modify platform rule sources';
  exception
    when sqlstate '42501' then
      null;
  end;

  select count(*) into v_count from moderation_queue;
  if v_count <> 1 then
    raise exception 'Tenant member should read moderation queue entries';
  end if;

  insert into adoption_records (org_id, scope, ref_id, from_version, to_version, mode, actor_id)
  values (tenant_one, 'rule', 'rbo_deadline', '1.0.0', '1.1.0', 'manual', user_one)
  returning id into v_adoption_id;

  select count(*)
  into v_count
  from audit_log
  where entity = 'adoption_records'
    and target_id = v_adoption_id;

  if v_count <> 1 then
    raise exception 'Adoption record insert did not append audit log entry';
  end if;

  -- Platform administrators should bypass tenant-level RLS
  perform set_config('request.jwt.claim.role', 'platform_admin', true);
  perform set_config('request.jwt.claim.sub', user_one::text, true);

  insert into source_registry (org_id, name, url, parser, jurisdiction, category)
  values (tenant_two, 'Admin Source', 'https://example.test/admin-source', 'html', 'ie', 'platform-admin')
  returning id into v_admin_source_id;

  select count(*)
  into v_count
  from source_registry
  where id = v_admin_source_id
    and org_id = tenant_two;

  if v_count <> 1 then
    raise exception 'Platform admin should read and insert cross-tenant source registry rows';
  end if;

  update source_registry
  set parser = 'xml'
  where id = v_admin_source_id;

  select parser into v_text
  from source_registry
  where id = v_admin_source_id;

  if v_text <> 'xml' then
    raise exception 'Platform admin update on tenant sources should succeed';
  end if;

  perform 1
  from platform.rule_sources
  where id = v_platform_source_id;

  update platform.rule_sources
  set parser = 'json'
  where id = v_platform_source_id;

  select parser into v_text
  from platform.rule_sources
  where id = v_platform_source_id;

  if v_text <> 'json' then
    raise exception 'Platform admin should be able to update platform rule sources';
  end if;

  perform 1
  from platform.rule_pack_detections
  where id = v_detection_id;

  update platform.rule_pack_detections
  set severity = 'major'
  where id = v_detection_id;

  select severity into v_text
  from platform.rule_pack_detections
  where id = v_detection_id;

  if v_text <> 'major' then
    raise exception 'Platform admin should be able to update platform rule pack detections';
  end if;

  select status into v_text
  from platform.rule_pack_proposals
  where id = v_proposal_id;

  if v_text is null then
    raise exception 'Platform admin should read platform rule pack proposals';
  end if;

  update platform.rule_pack_proposals
  set status = 'approved', review_notes = 'looks good'
  where id = v_proposal_id;

  select status into v_text
  from platform.rule_pack_proposals
  where id = v_proposal_id;

  if v_text <> 'approved' then
    raise exception 'Platform admin should be able to update platform rule pack proposals';
  end if;

  insert into adoption_records (org_id, scope, ref_id, from_version, to_version, mode, actor_id)
  values (tenant_two, 'rule', 'admin_rule', '1.0.0', '1.2.0', 'manual', user_one)
  returning id into v_admin_adoption_id;

  select count(*)
  into v_count
  from adoption_records
  where id = v_admin_adoption_id
    and org_id = tenant_two;

  if v_count <> 1 then
    raise exception 'Platform admin should be able to manage adoption records for any tenant';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'authenticated',
      'sub', user_two::text,
      'org_id', tenant_two::text,
      'org_ids', jsonb_build_array(tenant_two::text)
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', user_two::text, true);
  perform set_config('request.jwt.claim.org_id', tenant_two::text, true);

  select count(*)
  into v_count
  from source_registry
  where org_id = tenant_one;
  if v_count <> 0 then
    raise exception 'Cross-tenant read should be blocked by RLS';
  end if;

  begin
    perform 1 from platform.rule_pack_detections;
    raise exception 'Tenant member should not read platform detections';
  exception
    when sqlstate '42501' then
      null;
  end;

  begin
    insert into adoption_records (org_id, scope, ref_id, to_version, mode, actor_id)
    values (tenant_one, 'workflow', 'setup', '2.0.0', 'manual', user_two);
    raise exception 'Cross-tenant insert should have been blocked';
  exception
    when sqlstate '42501' then
      null;
  end;
end;
$$;

rollback;

-- Regression: platform admin access is granted via role or explicit claim
begin;

do $$
declare
  v_source_id uuid;
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'platform_admin')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'platform_admin', true);
  perform set_config('request.jwt.claim.is_platform_admin', 'false', true);

  insert into platform.rule_sources (name, url, parser)
  values ('Admin Role Source', 'https://example.test/admin-role', 'manual')
  returning id into v_source_id;

  if v_source_id is null then
    raise exception 'Expected insert to return a platform rule source id for role claim';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.is_platform_admin', 'false', true);

  begin
    insert into platform.rule_sources (name, url, parser)
    values ('Service Role Shortcut', 'https://example.test/service-role', 'manual');
    raise exception 'Service role without explicit override should be rejected';
  exception
    when sqlstate '42501' then
      null;
  end;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.is_platform_admin', 'false', true);

  begin
    insert into platform.rule_sources (name, url, parser)
    values ('Non Admin Source', 'https://example.test/non-admin', 'manual');
    raise exception 'Non-admin JWT without override should be rejected';
  exception
    when sqlstate '42501' then
      null;
  end;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'is_platform_admin', true)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.is_platform_admin', 'true', true);

  insert into platform.rule_sources (name, url, parser)
  values ('Admin Claim Source', 'https://example.test/admin-claim', 'manual')
  returning id into v_source_id;

  if v_source_id is null then
    raise exception 'Expected insert to return a platform rule source id for boolean override';
  end if;
end;
$$;

rollback;

comment on column audit_log.tenant_id is 'Tenant scope for hash chain enforcement.';

comment on column audit_log.chain_position is 'Monotonic position within the tenant-specific audit hash chain.';

comment on trigger audit_log_block_mutations on audit_log is 'Prevents UPDATE or DELETE on the append-only audit ledger.';

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.tenant_domains enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.tenant_branding enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.billing_prices enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.billing_tenants enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.billing_subscriptions enable row level security;

comment on function app.is_platform_admin() is
  'Returns true when the JWT role is platform_admin or when the is_platform_admin claim is boolean true. '
  'Service role access should continue through public.is_platform_service().';

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.organisations enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.users enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.memberships enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.engagements enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_defs enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_runs enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.steps enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.documents enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.audit_log enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.admin_actions enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.json_schemas enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.tenant_step_type_installs enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.tenant_secret_bindings enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.tenant_workflow_overlays enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_overlay_snapshots enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_overlay_layers enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.dsr_requests enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.dsr_request_jobs enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.source_registry enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.source_snapshot enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.change_event enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.rule_versions enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.template_versions enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_def_versions enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.workflow_pack_versions enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.moderation_queue enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.release_notes enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE public.adoption_records enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.step_types enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.step_type_versions enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_sources enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_source_snapshots enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_packs enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_pack_detections enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_pack_detection_sources enable row level security;

-- UNSUPPORTED ALTER TABLE op kept verbatim:
ALTER TABLE platform.rule_pack_proposals enable row level security;

comment on trigger audit_log_before_insert on audit_log is 'Computes prev_hash, row_hash, and chain_position for tenant-scoped audit ledger.';

create constraint trigger audit_log_block_mutations
  after update or delete on audit_log
  for each statement execute function raise_append_only();

create constraint trigger admin_actions_block_mutations
  after update or delete on admin_actions
  for each statement execute function raise_append_only();

insert into organisations (id, org_id, name, slug) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','Company A (Accountants)','company-a'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','Company X (Client)','company-x');

-- Regression: prevent cross-tenant takeover of a claimed domain
begin;

do $$
declare
  tenant_one constant uuid := '00000000-0000-0000-0000-000000000001';
  tenant_two constant uuid := '00000000-0000-0000-0000-000000000002';
  domain_record tenant_domains%rowtype;
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);

  insert into organisations (id, org_id, name, slug)
  values
    (tenant_one, tenant_one, 'Tenant One', 'tenant-one'),
    (tenant_two, tenant_two, 'Tenant Two', 'tenant-two')
  on conflict (id) do nothing;

  perform public.rpc_upsert_tenant_domain(tenant_one, 'tenant.example.com', true);

  begin
    perform public.rpc_upsert_tenant_domain(tenant_two, 'tenant.example.com', false);
    raise exception 'Expected rpc_upsert_tenant_domain to reject cross-tenant takeover';
  exception
    when sqlstate '42501' then
      null; -- expected error: ownership cannot transfer to another tenant
  end;

  select *
  into domain_record
  from tenant_domains
  where domain = public.normalize_domain('tenant.example.com');

  if not found then
    raise exception 'Domain record missing after takeover attempt';
  end if;

  if domain_record.org_id <> tenant_one then
    raise exception 'Domain ownership changed unexpectedly to %', domain_record.org_id;
  end if;

  if domain_record.is_primary is distinct from true then
    raise exception 'Domain should remain primary for owning tenant';
  end if;
end;
$$;

rollback;

-- Tenant-scoped secrets and overlays enforce org_id isolation with admin override
begin;

do $$
declare
  tenant_one constant uuid := '00000000-0000-0000-0000-000000000111';
  tenant_two constant uuid := '00000000-0000-0000-0000-000000000222';
  user_one constant uuid := '00000000-0000-0000-0000-000000000911';
  user_two constant uuid := '00000000-0000-0000-0000-000000000922';
  workflow_def_one uuid;
  workflow_def_two uuid;
  overlay_two uuid;
  snapshot_two uuid;
  v_count integer;
  binding_id uuid;
  overlay_id uuid;
begin
  -- bootstrap data with elevated privileges
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );

  insert into organisations (id, org_id, name, slug)
  values
    (tenant_one, tenant_one, 'Tenant One', 'tenant-one'),
    (tenant_two, tenant_two, 'Tenant Two', 'tenant-two')
  on conflict (id) do nothing;

  insert into users (id, email)
  values
    (user_one, 'member1@example.com'),
    (user_two, 'member2@example.com')
  on conflict (id) do nothing;

  insert into memberships (user_id, org_id, role)
  values
    (user_one, tenant_one, 'admin'),
    (user_two, tenant_two, 'admin')
  on conflict do nothing;

  insert into workflow_defs (id, key, version, title, dsl_json)
  values
    (gen_random_uuid(), 'core', '1.0.0', 'Core Workflow', '{}'::jsonb)
  returning id into workflow_def_one;

  insert into workflow_defs (id, key, version, title, dsl_json)
  values
    (gen_random_uuid(), 'core-two', '1.0.0', 'Core Workflow Two', '{}'::jsonb)
  returning id into workflow_def_two;

  begin
    insert into tenant_workflow_overlays (org_id, workflow_def_id, title, patch)
    values (null, workflow_def_one, 'Missing Org Overlay', '[]'::jsonb);
    raise exception 'Overlay insert should fail when org_id is NULL';
  exception
    when sqlstate '23502' then
      null;
  end;

  insert into tenant_workflow_overlays (org_id, workflow_def_id, title, patch)
  values (tenant_two, workflow_def_two, 'Tenant Two Overlay', '[]'::jsonb)
  returning id into overlay_two;

  insert into tenant_secret_bindings (org_id, alias, provider, external_id)
  values (tenant_two, 'tenant-two-alias', 'env', 'TENANT_TWO_SECRET')
  on conflict do nothing;

  insert into workflow_overlay_snapshots (tenant_overlay_id, applied_overlays, merged_workflow)
  values (overlay_two, '[]'::jsonb, jsonb_build_object('steps', jsonb_build_array()))
  returning id into snapshot_two;

  insert into workflow_overlay_layers (snapshot_id, source, patch)
  values (snapshot_two, 'tenant-two', '[]'::jsonb);

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'authenticated',
      'sub', user_one::text,
      'org_id', tenant_one::text,
      'org_ids', jsonb_build_array(tenant_one::text)
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', user_one::text, true);
  perform set_config('request.jwt.claim.org_id', tenant_one::text, true);

  -- Tenant member can create resources for their org
  insert into tenant_secret_bindings (org_id, alias, provider, external_id)
  values (tenant_one, 'tenant-one-alias', 'env', 'TENANT_ONE_SECRET')
  returning id into binding_id;

  insert into tenant_workflow_overlays (org_id, workflow_def_id, title, patch)
  values (tenant_one, workflow_def_one, 'Tenant One Overlay', '[]'::jsonb)
  returning id into overlay_id;

  -- Cross-tenant insert should fail
  begin
    insert into tenant_secret_bindings (org_id, alias, provider, external_id)
    values (tenant_two, 'forbidden-alias', 'env', 'DENIED');
    raise exception 'Cross-tenant secret binding insert should fail';
  exception
    when sqlstate '42501' then
      null;
  end;

  begin
    insert into tenant_workflow_overlays (org_id, workflow_def_id, title, patch)
    values (tenant_two, workflow_def_two, 'Forbidden Overlay', '[]'::jsonb);
    raise exception 'Cross-tenant overlay insert should fail';
  exception
    when sqlstate '42501' then
      null;
  end;

  -- Cross-tenant reads should return nothing
  select count(*) into v_count
  from tenant_secret_bindings
  where org_id = tenant_two;

  if v_count <> 0 then
    raise exception 'Tenant member should not see other tenant secret bindings';
  end if;

  select count(*) into v_count
  from tenant_workflow_overlays
  where org_id = tenant_two;

  if v_count <> 0 then
    raise exception 'Tenant member should not see other tenant overlays';
  end if;

  select count(*) into v_count
  from workflow_overlay_snapshots s
  where s.tenant_overlay_id = overlay_two;

  if v_count <> 0 then
    raise exception 'Tenant member should not see other tenant overlay snapshots';
  end if;

  select count(*) into v_count
  from workflow_overlay_layers l
  where l.snapshot_id = snapshot_two;

  if v_count <> 0 then
    raise exception 'Tenant member should not see other tenant overlay layers';
  end if;

  -- Platform admin claim bypasses tenant scoping
  perform set_config('request.jwt.claim.role', 'platform_admin', true);
  perform set_config('request.jwt.claim.is_platform_admin', 'true', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'platform_admin',
      'sub', user_one::text,
      'is_platform_admin', true
    )::text,
    true
  );

  insert into tenant_secret_bindings (org_id, alias, provider, external_id)
  values (tenant_two, 'admin-alias', 'env', 'PLATFORM_OVERRIDE')
  on conflict do nothing;

  insert into tenant_workflow_overlays (org_id, workflow_def_id, title, patch)
  values (tenant_two, workflow_def_two, 'Admin Overlay', '[]'::jsonb)
  on conflict do nothing;

  select count(*) into v_count
  from tenant_secret_bindings
  where org_id = tenant_two
    and alias = 'admin-alias';

  if v_count <> 1 then
    raise exception 'Platform admin should insert cross-tenant secret binding';
  end if;

  select count(*) into v_count
  from tenant_workflow_overlays
  where org_id = tenant_two
    and title = 'Admin Overlay';

  if v_count <> 1 then
    raise exception 'Platform admin should insert cross-tenant overlay';
  end if;
end;
$$;

rollback;

-- Workflow definitions enforce tenant scoping and admin overrides
begin;

do $$
declare
  tenant_one constant uuid := '00000000-0000-0000-0000-000000000101';
  tenant_two constant uuid := '00000000-0000-0000-0000-000000000202';
  user_one constant uuid := '00000000-0000-0000-0000-000000000901';
  def_one constant uuid := '11111111-1111-1111-1111-111111110001';
  def_two constant uuid := '22222222-2222-2222-2222-222222220002';
  inserted_id uuid;
  visible_count integer;
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);

  insert into organisations (id, org_id, name, slug)
  values
    (tenant_one, tenant_one, 'Tenant One', 'tenant-one'),
    (tenant_two, tenant_two, 'Tenant Two', 'tenant-two')
  on conflict (id) do nothing;

  insert into users (id, email)
  values
    (user_one, 'workflow-user@example.com')
  on conflict (id) do nothing;

  insert into memberships (user_id, org_id, role)
  values (user_one, tenant_one, 'admin')
  on conflict do nothing;

  insert into workflow_defs (id, org_id, key, version, title, dsl_json)
  values
    (def_one, tenant_one, 'tenant.workflow.one', '1.0.0', 'Tenant Workflow One', '{}'::jsonb),
    (def_two, tenant_two, 'tenant.workflow.two', '1.0.0', 'Tenant Workflow Two', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into workflow_def_versions (org_id, workflow_def_id, version, graph_jsonb, checksum)
  values
    (tenant_one, def_one, '1.0.0', '{}'::jsonb, 'checksum-one'),
    (tenant_two, def_two, '1.0.0', '{}'::jsonb, 'checksum-two')
  on conflict (id) do nothing;

  begin
    insert into tenant_workflow_overlays (org_id, workflow_def_id, title, patch, status)
    values (null, def_one, 'Invalid Overlay', '{}'::jsonb, 'draft');
    raise exception 'tenant_workflow_overlays.org_id should reject NULL values';
  exception
    when not_null_violation then
      null;
  end;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'authenticated',
      'sub', user_one::text,
      'org_id', tenant_one::text,
      'org_ids', jsonb_build_array(tenant_one::text)
    )::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_one::text, true);
  perform set_config('request.jwt.claim.org_id', tenant_one::text, true);

  select count(*) into visible_count from workflow_defs;
  if visible_count <> 1 then
    raise exception 'Tenant members should only see workflow definitions in their org';
  end if;

  begin
    insert into workflow_defs (org_id, key, version, title, dsl_json)
    values (tenant_two, 'cross.tenant', '1.0.0', 'Cross Tenant', '{}'::jsonb);
    raise exception 'Cross-tenant workflow definition insert should be rejected';
  exception
    when sqlstate '42501' then
      null;
  end;

  insert into workflow_defs (org_id, key, version, title, dsl_json)
  values (tenant_one, 'tenant.workflow.one', '1.1.0', 'Tenant Workflow One v2', '{}'::jsonb)
  returning id into inserted_id;

  delete from workflow_defs where id = inserted_id;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('is_platform_admin', true)::text,
    true
  );
  perform set_config('request.jwt.claim.is_platform_admin', 'true', true);

  select count(*) into visible_count from workflow_defs;
  if visible_count <> 2 then
    raise exception 'Platform admins should see all workflow definitions';
  end if;

  insert into workflow_defs (org_id, key, version, title, dsl_json)
  values (tenant_two, 'admin.workflow', '9.9.9', 'Admin Workflow', '{}'::jsonb);
end;
$$;

rollback;
