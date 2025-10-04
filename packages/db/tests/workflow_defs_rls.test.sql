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

  insert into organisations (id, tenant_org_id, name, slug)
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
      'tenant_org_id', tenant_one::text,
      'org_ids', jsonb_build_array(tenant_one::text)
    )::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_one::text, true);
  perform set_config('request.jwt.claim.tenant_org_id', tenant_one::text, true);

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
