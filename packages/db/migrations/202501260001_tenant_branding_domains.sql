-- Tenant domains and branding tables with RLS and helper RPCs
create table if not exists tenant_domains (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  domain text not null check (domain = lower(domain)),
  is_primary boolean not null default false,
  verified_at timestamptz,
  cert_status text not null default 'pending' check (cert_status in (
    'pending',
    'provisioning',
    'issued',
    'failed',
    'revoked'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_domains_domain_not_blank check (length(trim(domain)) > 0),
  unique(domain)
);

create unique index if not exists tenant_domains_tenant_domain_unique on tenant_domains(org_id, domain);
create unique index if not exists tenant_domains_primary_unique on tenant_domains(org_id) where is_primary;
create index if not exists tenant_domains_lookup_idx on tenant_domains(domain, verified_at);
create index if not exists tenant_domains_tenant_idx on tenant_domains(org_id, verified_at);

create table if not exists tenant_branding (
  org_id uuid primary key references organisations(id) on delete cascade,
  tokens jsonb not null default '{}'::jsonb,
  logo_url text,
  favicon_url text,
  typography jsonb not null default '{}'::jsonb,
  pdf_header jsonb not null default '{}'::jsonb,
  pdf_footer jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_branding_updated_idx on tenant_branding(updated_at desc);
create index if not exists tenant_branding_tokens_idx on tenant_branding using gin (tokens jsonb_path_ops);

alter table tenant_domains enable row level security;
alter table tenant_branding enable row level security;

create policy if not exists "Service role manages tenant domains" on tenant_domains
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Tenant members manage domains" on tenant_domains
  for all using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

create policy if not exists "Service role manages tenant branding" on tenant_branding
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Tenant members manage branding" on tenant_branding
  for all using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

create or replace function public.normalize_domain(host text)
returns text
language sql
immutable
as $$
  select lower(split_part(trim(host), ':', 1));
$$;

grant execute on function public.normalize_domain(text) to anon, authenticated, service_role;

create or replace function public.resolve_tenant_branding(p_host text)
returns table (
  org_id uuid,
  domain text,
  tokens jsonb,
  logo_url text,
  favicon_url text,
  typography jsonb,
  pdf_header jsonb,
  pdf_footer jsonb,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  normalized text;
begin
  normalized := public.normalize_domain(p_host);
  return query
  select
    d.org_id,
    d.domain,
    coalesce(b.tokens, '{}'::jsonb) as tokens,
    b.logo_url,
    b.favicon_url,
    coalesce(b.typography, '{}'::jsonb) as typography,
    coalesce(b.pdf_header, '{}'::jsonb) as pdf_header,
    coalesce(b.pdf_footer, '{}'::jsonb) as pdf_footer,
    coalesce(b.updated_at, d.updated_at) as updated_at
  from tenant_domains d
  left join tenant_branding b on b.org_id = d.org_id
  where d.domain = normalized
    and d.verified_at is not null
  order by d.is_primary desc, coalesce(b.updated_at, d.updated_at) desc
  limit 1;
end;
$$;

grant execute on function public.resolve_tenant_branding(text) to anon, authenticated, service_role;

create or replace function public.assert_tenant_membership(target_tenant uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.role() = 'service_role' then
    return;
  end if;

  if target_tenant is null then
    raise exception 'Tenant context required' using errcode = '22023';
  end if;

  if not public.is_member_of_org(target_tenant) then
    raise exception 'Permission denied for tenant %', target_tenant using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.assert_tenant_membership(uuid) to authenticated, service_role;

create or replace function public.rpc_upsert_tenant_branding(
  p_org_id uuid,
  p_tokens jsonb,
  p_logo_url text,
  p_favicon_url text,
  p_typography jsonb,
  p_pdf_header jsonb,
  p_pdf_footer jsonb
)
returns tenant_branding
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_tokens jsonb := coalesce(p_tokens, '{}'::jsonb);
  normalized_typography jsonb := coalesce(p_typography, '{}'::jsonb);
  normalized_pdf_header jsonb := coalesce(p_pdf_header, '{}'::jsonb);
  normalized_pdf_footer jsonb := coalesce(p_pdf_footer, '{}'::jsonb);
  result tenant_branding;
begin
  perform public.assert_tenant_membership(p_org_id);

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

  return result;
end;
$$;

grant execute on function public.rpc_upsert_tenant_branding(uuid, jsonb, text, text, jsonb, jsonb, jsonb) to authenticated, service_role;

create or replace function public.rpc_get_tenant_branding(p_org_id uuid)
returns tenant_branding
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result tenant_branding;
begin
  perform public.assert_tenant_membership(p_org_id);

  select * into result
  from tenant_branding
  where org_id = p_org_id;

  return result;
end;
$$;

grant execute on function public.rpc_get_tenant_branding(uuid) to authenticated, service_role;

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
  result tenant_domains;
begin
  perform public.assert_tenant_membership(p_org_id);

  normalized_domain := public.normalize_domain(p_domain);

  if normalized_domain is null or length(trim(normalized_domain)) = 0 then
    raise exception 'Domain value required' using errcode = '22023';
  end if;

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

create or replace function public.rpc_mark_tenant_domain_verified(
  p_domain_id uuid,
  p_cert_status text,
  p_verified_at timestamptz default now()
)
returns tenant_domains
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result tenant_domains;
  tenant_id uuid;
begin
  select org_id into tenant_id
  from tenant_domains
  where id = p_domain_id;

  if tenant_id is null then
    raise exception 'Domain not found' using errcode = 'P0002';
  end if;

  perform public.assert_tenant_membership(tenant_id);

  update tenant_domains
  set verified_at = p_verified_at,
      cert_status = coalesce(p_cert_status, cert_status),
      updated_at = now()
  where id = p_domain_id
  returning * into result;

  return result;
end;
$$;

grant execute on function public.rpc_mark_tenant_domain_verified(uuid, text, timestamptz) to authenticated, service_role;

create or replace function public.rpc_delete_tenant_domain(
  p_domain_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  tenant_id uuid;
  removed integer;
begin
  select org_id into tenant_id
  from tenant_domains
  where id = p_domain_id;

  if tenant_id is null then
    raise exception 'Domain not found' using errcode = 'P0002';
  end if;

  perform public.assert_tenant_membership(tenant_id);

  delete from tenant_domains
  where id = p_domain_id;
  get diagnostics removed = row_count;

  return removed > 0;
end;
$$;

grant execute on function public.rpc_delete_tenant_domain(uuid) to authenticated, service_role;
