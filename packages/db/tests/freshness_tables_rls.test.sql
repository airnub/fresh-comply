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
  v_moderation_id uuid;
  v_adoption_id uuid;
  v_count integer;
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

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_one::text, true);
  perform set_config('request.jwt.claim.tenant_org_id', tenant_one::text, true);

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

  perform set_config('request.jwt.claim.sub', user_two::text, true);
  perform set_config('request.jwt.claim.tenant_org_id', tenant_two::text, true);

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
