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
