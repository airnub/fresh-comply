-- Regression: is_platform_admin claim grants admin access without role claim
begin;

do $$
declare
  v_source_id uuid;
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('is_platform_admin', true)::text,
    true
  );
  perform set_config('request.jwt.claim.is_platform_admin', 'true', true);

  insert into platform.rule_sources (name, url, parser)
  values ('Admin Claim Source', 'https://example.test/admin-claim', 'manual')
  returning id into v_source_id;

  if v_source_id is null then
    raise exception 'Expected insert to return a platform rule source id';
  end if;
end;
$$;

rollback;
