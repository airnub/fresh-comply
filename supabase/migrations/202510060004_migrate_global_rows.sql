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
    where column_name = 'tenant_org_id'
      and table_schema = 'public'
  loop
    execute format('select exists (select 1 from %I.%I where tenant_org_id is null)', rec.table_schema, rec.table_name)
      into has_null;

    if has_null then
      execute format(
        'insert into platform.global_records (source_table, payload)
         select %L, to_jsonb(t) from %I.%I t where tenant_org_id is null',
        rec.table_schema || '.' || rec.table_name,
        rec.table_schema,
        rec.table_name
      );

      execute format('delete from %I.%I where tenant_org_id is null', rec.table_schema, rec.table_name);
    end if;
  end loop;
end$$;
