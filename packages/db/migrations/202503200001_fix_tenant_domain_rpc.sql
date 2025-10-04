-- Restore audit metadata response while keeping tenant domain takeover guard
create or replace function public.rpc_upsert_tenant_domain(
  p_org_id uuid,
  p_domain text,
  p_is_primary boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_domain text;
  existing tenant_domains%rowtype;
  previous tenant_domains%rowtype;
  result tenant_domains%rowtype;
  demoted_domains jsonb := '[]'::jsonb;
  audit_payload jsonb;
  audit_entry jsonb;
  actor_id uuid := auth.uid();
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

  previous := existing;

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
    demoted_domains := coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', id, 'domain', domain))
        from tenant_domains
        where org_id = p_org_id
          and id <> result.id
          and is_primary
      ),
      '[]'::jsonb
    );

    update tenant_domains
    set is_primary = false,
        updated_at = now()
    where org_id = p_org_id
      and id <> result.id
      and is_primary;
  end if;

  audit_payload := jsonb_build_object(
    'domain', result.domain,
    'previous', to_jsonb(previous),
    'current', to_jsonb(result),
    'demoted_domains', demoted_domains
  );

  audit_entry := public.rpc_append_audit_entry(
    action => 'tenant_domain_claim',
    actor_id => actor_id,
    reason_code => 'tenant_domain_claim',
    payload => audit_payload,
    target_kind => 'tenant_domain',
    target_id => result.id,
    org_id => result.org_id,
    actor_org_id => result.org_id
  );

  if audit_entry is not null then
    audit_entry := audit_entry || jsonb_build_object(
      'reason_code', 'tenant_domain_claim',
      'payload', audit_payload
    );
  end if;

  return jsonb_build_object(
    'domain', to_jsonb(result),
    'audit_entry', audit_entry
  );
end;
$$;

grant execute on function public.rpc_upsert_tenant_domain(uuid, text, boolean) to authenticated, service_role;
