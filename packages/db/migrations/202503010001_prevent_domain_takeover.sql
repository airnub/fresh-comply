-- Prevent tenant domain takeovers by ensuring ownership cannot change across tenants
create or replace function public.rpc_upsert_tenant_domain(
  p_org_id uuid,
  p_domain text,
  p_is_primary boolean default false
)
returns tenant_domains
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_domain text;
  existing tenant_domains%rowtype;
  result tenant_domains%rowtype;
begin
  perform public.assert_tenant_membership(p_org_id);

  normalized_domain := public.normalize_domain(p_domain);

  if normalized_domain is null or length(trim(normalized_domain)) = 0 then
    raise exception 'Domain value required' using errcode = '22023';
  end if;

  select *
  into existing
  from tenant_domains
  where domain = normalized_domain
  for update;

  if found then
    if existing.org_id <> p_org_id then
      raise exception 'Domain % already claimed by another tenant', normalized_domain using errcode = '42501';
    end if;

    update tenant_domains
    set is_primary = coalesce(p_is_primary, existing.is_primary),
        updated_at = now()
    where id = existing.id
    returning * into result;
  else
    insert into tenant_domains as td (
      org_id,
      domain,
      is_primary,
      cert_status,
      updated_at
    )
    values (
      p_org_id,
      normalized_domain,
      coalesce(p_is_primary, false),
      'pending',
      now()
    )
    returning * into result;
  end if;

  if result.is_primary then
    update tenant_domains
    set is_primary = false,
        updated_at = now()
    where org_id = p_org_id
      and id <> result.id
      and is_primary;
  end if;

  return result;
end;
$$;

grant execute on function public.rpc_upsert_tenant_domain(uuid, text, boolean) to authenticated, service_role;
