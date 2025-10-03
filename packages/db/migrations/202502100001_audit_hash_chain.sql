begin;

create extension if not exists pgcrypto;

alter table audit_log
  add column if not exists target_kind text,
  add column if not exists target_id uuid,
  add column if not exists lawful_basis text,
  add column if not exists prev_hash text,
  add column if not exists row_hash text,
  add column if not exists inserted_at timestamptz;

alter table audit_log
  alter column meta_json set default '{}'::jsonb,
  alter column meta_json set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column prev_hash set default repeat('0', 64),
  alter column prev_hash set not null;

update audit_log
  set target_kind = coalesce(target_kind, entity, case when step_id is not null then 'step' when run_id is not null then 'workflow_run' else null end),
      target_id = coalesce(target_id, case when step_id is not null then step_id when run_id is not null then run_id else null end),
      inserted_at = coalesce(inserted_at, created_at, now()),
      meta_json = coalesce(meta_json, '{}'::jsonb);

alter table admin_actions
  rename column if exists reason to reason_code;

alter table admin_actions
  add column if not exists target_kind text,
  add column if not exists target_id uuid,
  add column if not exists lawful_basis text,
  add column if not exists prev_hash text,
  add column if not exists row_hash text,
  add column if not exists inserted_at timestamptz;

alter table admin_actions
  alter column actor_id drop not null,
  alter column payload set default '{}'::jsonb,
  alter column payload set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column prev_hash set default repeat('0', 64),
  alter column prev_hash set not null,
  alter column reason_code set not null;

update admin_actions
  set inserted_at = coalesce(inserted_at, created_at, now()),
      payload = coalesce(payload, '{}'::jsonb);

create unique index if not exists audit_log_row_hash_key on audit_log(row_hash);
create unique index if not exists admin_actions_row_hash_key on admin_actions(row_hash);

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
    order by tenant_org_id, created_at, id
  loop
    if v_tenant is distinct from rec.tenant_org_id then
      v_prev := repeat('0', 64);
      v_tenant := rec.tenant_org_id;
    end if;

    update audit_log
    set prev_hash = v_prev,
        row_hash = encode(
          digest(
            jsonb_build_object(
              'tenant_org_id', rec.tenant_org_id,
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
    order by tenant_org_id, created_at, id
  loop
    if v_tenant is distinct from rec.tenant_org_id then
      v_prev := repeat('0', 64);
      v_tenant := rec.tenant_org_id;
    end if;

    update admin_actions
    set prev_hash = v_prev,
        row_hash = encode(
          digest(
            jsonb_build_object(
              'tenant_org_id', rec.tenant_org_id,
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

create or replace function raise_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Ledger tables are append-only';
end;
$$;

create or replace function compute_audit_log_hash()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prev_hash text;
begin
  new.created_at := coalesce(new.created_at, now());
  new.inserted_at := coalesce(new.inserted_at, now());
  new.meta_json := coalesce(new.meta_json, '{}'::jsonb);
  new.target_kind := coalesce(new.target_kind, new.entity);

  select row_hash
    into v_prev_hash
  from audit_log
  where tenant_org_id = new.tenant_org_id
  order by inserted_at desc, created_at desc, id desc
  limit 1
  for update;

  if v_prev_hash is null then
    v_prev_hash := repeat('0', 64);
  end if;

  if new.prev_hash is null then
    new.prev_hash := v_prev_hash;
  elsif new.prev_hash <> v_prev_hash then
    raise exception 'Invalid prev_hash for tenant %', new.tenant_org_id;
  end if;

  new.row_hash := encode(
    digest(
      jsonb_build_object(
        'tenant_org_id', new.tenant_org_id,
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

create or replace function compute_admin_actions_hash()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prev_hash text;
begin
  new.created_at := coalesce(new.created_at, now());
  new.inserted_at := coalesce(new.inserted_at, now());
  new.payload := coalesce(new.payload, '{}'::jsonb);

  select row_hash
    into v_prev_hash
  from admin_actions
  where tenant_org_id = new.tenant_org_id
  order by inserted_at desc, created_at desc, id desc
  limit 1
  for update;

  if v_prev_hash is null then
    v_prev_hash := repeat('0', 64);
  end if;

  if new.prev_hash is null then
    new.prev_hash := v_prev_hash;
  elsif new.prev_hash <> v_prev_hash then
    raise exception 'Invalid prev_hash for tenant %', new.tenant_org_id;
  end if;

  new.row_hash := encode(
    digest(
      jsonb_build_object(
        'tenant_org_id', new.tenant_org_id,
        'actor_id', new.actor_id,
        'actor_org_id', new.actor_org_id,
        'on_behalf_of_org_id', new.on_behalf_of_org_id,
        'subject_org_id', new.subject_org_id,
        'target_kind', new.target_kind,
        'target_id', new.target_id,
        'action', new.action,
        'reason_code', new.reason_code,
        'lawful_basis', new.lawful_basis,
        'payload', new.payload,
        'requires_second_approval', new.requires_second_approval,
        'second_actor_id', new.second_actor_id,
        'prev_hash', new.prev_hash,
        'created_at', to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'inserted_at', to_char(new.inserted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'approved_at', case when new.approved_at is not null then to_char(new.approved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') else null end
      )::text,
      'sha256'
    ),
    'hex'
  );

  return new;
end;
$$;

drop trigger if exists audit_log_before_insert on audit_log;
create trigger audit_log_before_insert
  before insert on audit_log
  for each row execute function compute_audit_log_hash();

drop trigger if exists admin_actions_before_insert on admin_actions;
create trigger admin_actions_before_insert
  before insert on admin_actions
  for each row execute function compute_admin_actions_hash();

drop trigger if exists audit_log_block_mutations on audit_log;
create constraint trigger audit_log_block_mutations
  after update or delete on audit_log
  for each statement execute function raise_append_only();

drop trigger if exists admin_actions_block_mutations on admin_actions;
create constraint trigger admin_actions_block_mutations
  after update or delete on admin_actions
  for each statement execute function raise_append_only();

alter table audit_log enable row level security;
alter table admin_actions enable row level security;

drop policy if exists "Service role manages audit log" on audit_log;
create policy "Service role appends audit log" on audit_log
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages admin actions" on admin_actions;
create policy "Service role appends admin actions" on admin_actions
  for insert
  with check (auth.role() = 'service_role');

commit;
