-- Regression: prevent cross-tenant takeover of a claimed domain
begin;

do $$
declare
  tenant_one constant uuid := '00000000-0000-0000-0000-000000000001';
  tenant_two constant uuid := '00000000-0000-0000-0000-000000000002';
  domain_record tenant_domains%rowtype;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);

  insert into organisations (id, tenant_org_id, name, slug)
  values
    (tenant_one, tenant_one, 'Tenant One', 'tenant-one'),
    (tenant_two, tenant_two, 'Tenant Two', 'tenant-two')
  on conflict (id) do nothing;

  perform public.rpc_upsert_tenant_domain(tenant_one, 'tenant.example.com', true);

  begin
    perform public.rpc_upsert_tenant_domain(tenant_two, 'tenant.example.com', false);
    raise exception 'Expected rpc_upsert_tenant_domain to reject cross-tenant takeover';
  exception
    when sqlstate '42501' then
      null; -- expected error: ownership cannot transfer to another tenant
  end;

  select *
  into domain_record
  from tenant_domains
  where domain = public.normalize_domain('tenant.example.com');

  if not found then
    raise exception 'Domain record missing after takeover attempt';
  end if;

  if domain_record.tenant_org_id <> tenant_one then
    raise exception 'Domain ownership changed unexpectedly to %', domain_record.tenant_org_id;
  end if;

  if domain_record.is_primary is distinct from true then
    raise exception 'Domain should remain primary for owning tenant';
  end if;
end;
$$;

rollback;
