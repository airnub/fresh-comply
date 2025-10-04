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
      'tenant_org_id', tenant_one::text,
      'org_ids', jsonb_build_array(tenant_one::text)
    )::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_one::text, true);
  perform set_config('request.jwt.claim.tenant_org_id', tenant_one::text, true);

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
      'tenant_org_id', tenant_two::text,
      'org_ids', jsonb_build_array(tenant_two::text)
    )::text,
    true
  );
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
