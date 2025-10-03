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
  v_moderation_id uuid;
  v_adoption_id uuid;
  v_count integer;
  audit_rows integer;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);

  insert into organisations (id, tenant_org_id, name, slug)
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

  insert into source_registry (tenant_org_id, name, url, parser, jurisdiction, category)
  values (tenant_one, 'CRO Guidance', 'https://example.test/cro', 'html', 'ie', 'cro')
  returning id into v_source_id;

  insert into source_snapshot (tenant_org_id, source_id, content_hash, parsed_facts, storage_ref)
  values (tenant_one, v_source_id, 'hash-1', '{"facts":[]}'::jsonb, 's3://bucket/object');

  insert into change_event (tenant_org_id, source_id, from_hash, to_hash, severity, notes)
  values (tenant_one, v_source_id, 'hash-0', 'hash-1', 'minor', 'Detected diff')
  returning id into v_change_event_id;

  select count(*) into audit_rows from audit_log;

  insert into moderation_queue (tenant_org_id, change_event_id, proposal, status, classification, created_by)
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

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_one::text, true);
  perform set_config('request.jwt.claim.tenant_org_id', tenant_one::text, true);

  select count(*) into v_count from source_registry;
  if v_count <> 1 then
    raise exception 'Tenant member should read own source registry entries';
  end if;

  select count(*) into v_count from moderation_queue;
  if v_count <> 1 then
    raise exception 'Tenant member should read moderation queue entries';
  end if;

  select count(*) into audit_rows from audit_log;

  insert into adoption_records (tenant_org_id, scope, ref_id, from_version, to_version, mode, actor_id)
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

  perform set_config('request.jwt.claim.sub', user_two::text, true);
  perform set_config('request.jwt.claim.tenant_org_id', tenant_two::text, true);

  select count(*) into v_count from source_registry;
  if v_count <> 0 then
    raise exception 'Cross-tenant read should be blocked by RLS';
  end if;

  begin
    insert into adoption_records (tenant_org_id, scope, ref_id, to_version, mode, actor_id)
    values (tenant_one, 'workflow', 'setup', '2.0.0', 'manual', user_two);
    raise exception 'Cross-tenant insert should have been blocked';
  exception
    when sqlstate '42501' then
      null;
  end;
end;
$$;

rollback;
