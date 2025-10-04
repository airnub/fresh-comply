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
