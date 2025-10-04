-- Regression: platform admin access is granted via role or explicit claim
begin;

do $$
declare
  v_source_id uuid;
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'platform_admin')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'platform_admin', true);
  perform set_config('request.jwt.claim.is_platform_admin', 'false', true);

  insert into platform.rule_sources (name, url, parser)
  values ('Admin Role Source', 'https://example.test/admin-role', 'manual')
  returning id into v_source_id;

  if v_source_id is null then
    raise exception 'Expected insert to return a platform rule source id for role claim';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.is_platform_admin', 'false', true);

  begin
    insert into platform.rule_sources (name, url, parser)
    values ('Service Role Shortcut', 'https://example.test/service-role', 'manual');
    raise exception 'Service role without explicit override should be rejected';
  exception
    when sqlstate '42501' then
      null;
  end;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.is_platform_admin', 'false', true);

  begin
    insert into platform.rule_sources (name, url, parser)
    values ('Non Admin Source', 'https://example.test/non-admin', 'manual');
    raise exception 'Non-admin JWT without override should be rejected';
  exception
    when sqlstate '42501' then
      null;
  end;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'is_platform_admin', true)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.is_platform_admin', 'true', true);

  insert into platform.rule_sources (name, url, parser)
  values ('Admin Claim Source', 'https://example.test/admin-claim', 'manual')
  returning id into v_source_id;

  if v_source_id is null then
    raise exception 'Expected insert to return a platform rule source id for boolean override';
  end if;
end;
$$;

rollback;
