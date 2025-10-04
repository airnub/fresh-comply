-- Rename tenant_org_id columns to org_id and enforce strict constraints
set check_function_bodies = off;

do $$
declare
  rec record;
  has_null boolean;
  idx_name text;
  qualified text;
begin
  for rec in
    select table_schema, table_name
    from information_schema.columns
    where column_name = 'tenant_org_id'
      and table_schema = 'public'
  loop
    qualified := format('%I.%I', rec.table_schema, rec.table_name);

    execute format('select exists (select 1 from %s where tenant_org_id is null)', qualified)
      into has_null;

    if has_null then
      raise exception 'Table % has NULL tenant_org_id rows; global rows must be migrated before enforcing tenancy.', qualified;
    end if;

    execute format('alter table %s alter column tenant_org_id type uuid using tenant_org_id::uuid', qualified);
    execute format('alter table %s alter column tenant_org_id set not null', qualified);
    execute format('alter table %s rename column tenant_org_id to org_id', qualified);

    idx_name := format('%s_org_id_idx', rec.table_name);
    execute format('create index if not exists %I on %s (org_id)', idx_name, qualified);
  end loop;
end$$;
