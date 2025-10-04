begin;

alter table audit_log
  add column if not exists tenant_id uuid,
  add column if not exists chain_position bigint;

update audit_log
set tenant_id = coalesce(tenant_id, org_id)
where tenant_id is distinct from coalesce(org_id, tenant_id);

alter table audit_log
  alter column tenant_id set not null;

alter table audit_log
  add constraint if not exists audit_log_tenant_id_fkey
    foreign key (tenant_id)
    references organisations(id);

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

alter table audit_log
  alter column chain_position set not null;

drop index if exists audit_log_row_hash_key;
create unique index if not exists audit_log_tenant_chain_position_key
  on audit_log(tenant_id, chain_position);
create unique index if not exists audit_log_tenant_row_hash_key
  on audit_log(tenant_id, row_hash);

create or replace function compute_audit_log_hash()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prev_hash text;
  v_prev_position bigint;
begin
  new.created_at := coalesce(new.created_at, now());
  new.inserted_at := coalesce(new.inserted_at, now());
  new.meta_json := coalesce(new.meta_json, '{}'::jsonb);
  new.target_kind := coalesce(new.target_kind, new.entity);
  new.tenant_id := coalesce(new.tenant_id, new.org_id);

  if new.tenant_id is null then
    raise exception 'tenant_id is required for audit chain';
  end if;

  select row_hash, chain_position
    into v_prev_hash, v_prev_position
  from audit_log
  where tenant_id = new.tenant_id
  order by chain_position desc
  limit 1
  for update;

  if v_prev_hash is null then
    v_prev_hash := repeat('0', 64);
    v_prev_position := 0;
  end if;

  if new.prev_hash is null then
    new.prev_hash := v_prev_hash;
  elsif new.prev_hash <> v_prev_hash then
    raise exception 'Invalid prev_hash for tenant %', new.tenant_id;
  end if;

  if new.chain_position is null then
    new.chain_position := v_prev_position + 1;
  elsif new.chain_position <> v_prev_position + 1 then
    raise exception 'Invalid chain_position % for tenant % (expected %)',
      new.chain_position,
      new.tenant_id,
      v_prev_position + 1;
  end if;

  new.row_hash := encode(
    digest(
      jsonb_build_object(
        'tenant_id', new.tenant_id,
        'org_id', new.org_id,
        'actor_user_id', new.actor_user_id,
        'actor_org_id', new.actor_org_id,
        'on_behalf_of_org_id', new.on_behalf_of_org_id,
        'subject_org_id', new.subject_org_id,
        'entity', new.entity,
        'target_kind', new.target_kind,
        'target_id', new.target_id,
        'run_id', new.run_id,
        'step_id', new.step_id,
        'action', new.action,
        'lawful_basis', new.lawful_basis,
        'meta_json', new.meta_json,
        'prev_hash', new.prev_hash,
        'chain_position', new.chain_position,
        'created_at', to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'inserted_at', to_char(new.inserted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      )::text,
      'sha256'
    ),
    'hex'
  );

  return new;
end;
$$;

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
create trigger audit_log_before_insert
  before insert on audit_log
  for each row execute function compute_audit_log_hash();
comment on trigger audit_log_before_insert on audit_log is 'Computes prev_hash, row_hash, and chain_position for tenant-scoped audit ledger.';

commit;
