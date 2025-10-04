create or replace function public.rpc_upsert_tenant_branding(
  p_org_id uuid,
  p_tokens jsonb,
  p_logo_url text,
  p_favicon_url text,
  p_typography jsonb,
  p_pdf_header jsonb,
  p_pdf_footer jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_tokens jsonb := coalesce(p_tokens, '{}'::jsonb);
  normalized_typography jsonb := coalesce(p_typography, '{}'::jsonb);
  normalized_pdf_header jsonb := coalesce(p_pdf_header, '{}'::jsonb);
  normalized_pdf_footer jsonb := coalesce(p_pdf_footer, '{}'::jsonb);
  previous tenant_branding;
  result tenant_branding;
  audit_payload jsonb;
  audit_entry jsonb;
  actor_id uuid := auth.uid();
begin
  perform public.assert_tenant_membership(p_org_id);

  select * into previous
  from tenant_branding
  where org_id = p_org_id;

  insert into tenant_branding as tb (
    org_id,
    tokens,
    logo_url,
    favicon_url,
    typography,
    pdf_header,
    pdf_footer,
    updated_at
  )
  values (
    p_org_id,
    normalized_tokens,
    p_logo_url,
    p_favicon_url,
    normalized_typography,
    normalized_pdf_header,
    normalized_pdf_footer,
    now()
  )
  on conflict (org_id) do update
    set tokens = excluded.tokens,
        logo_url = excluded.logo_url,
        favicon_url = excluded.favicon_url,
        typography = excluded.typography,
        pdf_header = excluded.pdf_header,
        pdf_footer = excluded.pdf_footer,
        updated_at = now()
  returning * into result;

  audit_payload := jsonb_build_object(
    'org_id', p_org_id,
    'previous', to_jsonb(previous),
    'current', to_jsonb(result)
  );

  audit_entry := public.rpc_append_audit_entry(
    action => 'tenant_branding_update',
    actor_id => actor_id,
    reason_code => 'tenant_branding_update',
    payload => audit_payload,
    target_kind => 'tenant_branding',
    target_id => p_org_id,
    org_id => p_org_id,
    actor_org_id => p_org_id
  );

  if audit_entry is not null then
    audit_entry := audit_entry || jsonb_build_object(
      'reason_code', 'tenant_branding_update',
      'payload', audit_payload
    );
  end if;

  return jsonb_build_object(
    'branding', to_jsonb(result),
    'audit_entry', audit_entry
  );
end;
$$;

grant execute on function public.rpc_upsert_tenant_branding(uuid, jsonb, text, text, jsonb, jsonb, jsonb) to authenticated, service_role;

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
  previous tenant_domains;
  result tenant_domains;
  audit_payload jsonb;
  audit_entry jsonb;
  demoted_domains jsonb := '[]'::jsonb;
  actor_id uuid := auth.uid();
begin
  perform public.assert_tenant_membership(p_org_id);

  normalized_domain := public.normalize_domain(p_domain);

  if normalized_domain is null or length(trim(normalized_domain)) = 0 then
    raise exception 'Domain value required' using errcode = '22023';
  end if;

  select * into previous
  from tenant_domains
  where domain = normalized_domain;

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
  on conflict (domain) do update
    set org_id = excluded.org_id,
        is_primary = excluded.is_primary,
        updated_at = now()
  returning * into result;

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

create or replace function public.rpc_mark_tenant_domain_verified(
  p_domain_id uuid,
  p_cert_status text,
  p_verified_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result tenant_domains;
  previous tenant_domains;
  audit_payload jsonb;
  audit_entry jsonb;
  tenant_id uuid;
  actor_id uuid := auth.uid();
begin
  select * into previous
  from tenant_domains
  where id = p_domain_id;

  if previous.id is null then
    raise exception 'Domain not found' using errcode = 'P0002';
  end if;

  tenant_id := previous.org_id;

  perform public.assert_tenant_membership(tenant_id);

  update tenant_domains
  set verified_at = p_verified_at,
      cert_status = coalesce(p_cert_status, cert_status),
      updated_at = now()
  where id = p_domain_id
  returning * into result;

  audit_payload := jsonb_build_object(
    'domain', result.domain,
    'previous', to_jsonb(previous),
    'current', to_jsonb(result)
  );

  audit_entry := public.rpc_append_audit_entry(
    action => 'tenant_domain_verify',
    actor_id => actor_id,
    reason_code => 'tenant_domain_verify',
    payload => audit_payload,
    target_kind => 'tenant_domain',
    target_id => result.id,
    org_id => result.org_id,
    actor_org_id => result.org_id
  );

  if audit_entry is not null then
    audit_entry := audit_entry || jsonb_build_object(
      'reason_code', 'tenant_domain_verify',
      'payload', audit_payload
    );
  end if;

  return jsonb_build_object(
    'domain', to_jsonb(result),
    'audit_entry', audit_entry
  );
end;
$$;

grant execute on function public.rpc_mark_tenant_domain_verified(uuid, text, timestamptz) to authenticated, service_role;

create or replace function public.rpc_delete_tenant_domain(
  p_domain_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  existing tenant_domains;
  removed boolean := false;
  removed_count integer := 0;
  audit_payload jsonb;
  audit_entry jsonb;
  actor_id uuid := auth.uid();
begin
  select * into existing
  from tenant_domains
  where id = p_domain_id;

  if existing.id is null then
    raise exception 'Domain not found' using errcode = 'P0002';
  end if;

  perform public.assert_tenant_membership(existing.org_id);

  delete from tenant_domains
  where id = p_domain_id;
  get diagnostics removed_count = row_count;
  removed := removed_count > 0;

  if removed then
    audit_payload := jsonb_build_object(
      'domain', existing.domain,
      'deleted', to_jsonb(existing)
    );

    audit_entry := public.rpc_append_audit_entry(
      action => 'tenant_domain_delete',
      actor_id => actor_id,
      reason_code => 'tenant_domain_delete',
      payload => audit_payload,
      target_kind => 'tenant_domain',
      target_id => existing.id,
      org_id => existing.org_id,
      actor_org_id => existing.org_id
    );

    if audit_entry is not null then
      audit_entry := audit_entry || jsonb_build_object(
        'reason_code', 'tenant_domain_delete',
        'payload', audit_payload
      );
    end if;
  end if;

  return jsonb_build_object(
    'removed', removed,
    'audit_entry', audit_entry
  );
end;
$$;

grant execute on function public.rpc_delete_tenant_domain(uuid) to authenticated, service_role;
