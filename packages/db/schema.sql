create extension if not exists pgcrypto;

create table organisations(
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

create table users(
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  created_at timestamptz default now()
);

create table memberships(
  user_id uuid references users(id),
  org_id uuid references organisations(id),
  role text check (role in ('owner','admin','member','viewer')) not null,
  primary key(user_id, org_id)
);

create table engagements(
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  engager_org_id uuid references organisations(id),
  client_org_id uuid references organisations(id),
  subject_org_id uuid references organisations(id),
  status text check (status in ('active','ended')) default 'active',
  scope text,
  created_at timestamptz default now()
);

create table workflow_defs(
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version text not null,
  title text not null,
  dsl_json jsonb not null,
  created_at timestamptz default now()
);

create table workflow_runs(
  id uuid primary key default gen_random_uuid(),
  workflow_def_id uuid references workflow_defs(id),
  subject_org_id uuid references organisations(id),
  engager_org_id uuid references organisations(id),
  tenant_org_id uuid not null references organisations(id),
  status text check (status in ('draft','active','done','archived')) default 'active',
  orchestration_provider text not null default 'none',
  orchestration_workflow_id text,
  created_by_user_id uuid references users(id),
  merged_workflow_snapshot jsonb,
  created_at timestamptz default now()
);

create table steps(
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id),
  tenant_org_id uuid not null references organisations(id),
  subject_org_id uuid references organisations(id),
  key text not null,
  title text not null,
  status text check (status in ('todo','in_progress','waiting','blocked','done')) default 'todo',
  orchestration_run_id text,
  execution_mode text check (execution_mode in ('manual','temporal')) not null default 'manual',
  due_date date,
  assignee_user_id uuid references users(id),
  step_type_version_id uuid,
  permissions text[] default '{}'::text[]
);

create table json_schemas(
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  version text not null,
  description text,
  schema jsonb not null,
  created_at timestamptz default now()
);

create table step_types(
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text,
  summary text,
  latest_version text,
  created_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table step_type_versions(
  id uuid primary key default gen_random_uuid(),
  step_type_id uuid references step_types(id) on delete cascade,
  version text not null,
  definition jsonb not null,
  input_schema_id uuid references json_schemas(id),
  output_schema_id uuid references json_schemas(id),
  status text check (status in ('draft','published','deprecated')) default 'draft',
  created_by uuid references users(id),
  created_at timestamptz default now(),
  published_at timestamptz,
  unique(step_type_id, version)
);

alter table steps
  add constraint steps_step_type_version_id_fkey
  foreign key (step_type_version_id)
  references step_type_versions(id);

create table tenant_step_type_installs(
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations(id) on delete cascade,
  step_type_version_id uuid references step_type_versions(id) on delete cascade,
  installed_at timestamptz default now(),
  status text check (status in ('enabled','disabled')) default 'enabled',
  unique(org_id, step_type_version_id)
);

create table tenant_secret_bindings(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  alias text not null,
  description text,
  provider text,
  external_id text not null,
  created_at timestamptz default now(),
  unique(org_id, alias)
);

create index tenant_secret_bindings_org_alias_idx on tenant_secret_bindings(org_id, alias);

create table tenant_workflow_overlays(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  workflow_def_id uuid references workflow_defs(id) on delete cascade,
  title text not null,
  patch jsonb not null,
  status text check (status in ('draft','published','archived')) default 'draft',
  created_by uuid references users(id),
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(org_id, workflow_def_id, title)
);

create index tenant_workflow_overlays_org_workflow_idx on tenant_workflow_overlays(org_id, workflow_def_id);

create table workflow_overlay_snapshots(
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id) on delete cascade,
  tenant_overlay_id uuid references tenant_workflow_overlays(id),
  applied_overlays jsonb not null default '[]'::jsonb,
  merged_workflow jsonb not null,
  created_at timestamptz default now()
);

create table workflow_overlay_layers(
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references workflow_overlay_snapshots(id) on delete cascade,
  source text not null,
  patch jsonb not null,
  created_at timestamptz default now()
);

create table documents(
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id),
  tenant_org_id uuid not null references organisations(id),
  subject_org_id uuid references organisations(id),
  template_id text,
  path text,
  checksum text,
  created_at timestamptz default now()
);

create table audit_log(
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  tenant_id uuid not null references organisations(id),
  actor_user_id uuid references users(id),
  actor_org_id uuid references organisations(id),
  on_behalf_of_org_id uuid references organisations(id),
  subject_org_id uuid references organisations(id),
  entity text,
  target_kind text,
  target_id uuid,
  run_id uuid references workflow_runs(id),
  step_id uuid references steps(id),
  action text not null,
  lawful_basis text,
  meta_json jsonb not null default '{}'::jsonb,
  prev_hash text not null default repeat('0', 64),
  row_hash text not null,
  chain_position bigint not null,
  created_at timestamptz not null default now(),
  inserted_at timestamptz not null default now()
);

create unique index audit_log_tenant_chain_position_key on audit_log(tenant_id, chain_position);
create unique index audit_log_tenant_row_hash_key on audit_log(tenant_id, row_hash);
comment on column audit_log.tenant_id is 'Tenant scope for hash chain enforcement.';
comment on column audit_log.chain_position is 'Monotonic position within the tenant-specific audit hash chain.';
comment on trigger audit_log_block_mutations on audit_log is 'Prevents UPDATE or DELETE on the append-only audit ledger.';

create table tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id) on delete cascade,
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

create unique index tenant_domains_tenant_domain_unique on tenant_domains(tenant_org_id, domain);
create unique index tenant_domains_primary_unique on tenant_domains(tenant_org_id) where is_primary;
create index tenant_domains_lookup_idx on tenant_domains(domain, verified_at);
create index tenant_domains_tenant_idx on tenant_domains(tenant_org_id, verified_at);

create table tenant_branding (
  tenant_org_id uuid primary key references organisations(id) on delete cascade,
  tokens jsonb not null default '{}'::jsonb,
  logo_url text,
  favicon_url text,
  typography jsonb not null default '{}'::jsonb,
  pdf_header jsonb not null default '{}'::jsonb,
  pdf_footer jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_branding_updated_idx on tenant_branding(updated_at desc);
create index tenant_branding_tokens_idx on tenant_branding using gin (tokens jsonb_path_ops);

alter table tenant_domains enable row level security;
alter table tenant_branding enable row level security;

create policy "Service role manages tenant domains" on tenant_domains
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members manage domains" on tenant_domains
  for all using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Service role manages tenant branding" on tenant_branding
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members manage branding" on tenant_branding
  for all using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
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
  tenant_org_id uuid,
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
    d.tenant_org_id,
    d.domain,
    coalesce(b.tokens, '{}'::jsonb) as tokens,
    b.logo_url,
    b.favicon_url,
    coalesce(b.typography, '{}'::jsonb) as typography,
    coalesce(b.pdf_header, '{}'::jsonb) as pdf_header,
    coalesce(b.pdf_footer, '{}'::jsonb) as pdf_footer,
    coalesce(b.updated_at, d.updated_at) as updated_at
  from tenant_domains d
  left join tenant_branding b on b.tenant_org_id = d.tenant_org_id
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
  p_tenant_org_id uuid,
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
  perform public.assert_tenant_membership(p_tenant_org_id);

  select * into previous
  from tenant_branding
  where tenant_org_id = p_tenant_org_id;

  insert into tenant_branding as tb (
    tenant_org_id,
    tokens,
    logo_url,
    favicon_url,
    typography,
    pdf_header,
    pdf_footer,
    updated_at
  )
  values (
    p_tenant_org_id,
    normalized_tokens,
    p_logo_url,
    p_favicon_url,
    normalized_typography,
    normalized_pdf_header,
    normalized_pdf_footer,
    now()
  )
  on conflict (tenant_org_id) do update
    set tokens = excluded.tokens,
        logo_url = excluded.logo_url,
        favicon_url = excluded.favicon_url,
        typography = excluded.typography,
        pdf_header = excluded.pdf_header,
        pdf_footer = excluded.pdf_footer,
        updated_at = now()
  returning * into result;

  audit_payload := jsonb_build_object(
    'tenant_org_id', p_tenant_org_id,
    'previous', to_jsonb(previous),
    'current', to_jsonb(result)
  );

  audit_entry := public.rpc_append_audit_entry(
    action => 'tenant_branding_update',
    actor_id => actor_id,
    reason_code => 'tenant_branding_update',
    payload => audit_payload,
    target_kind => 'tenant_branding',
    target_id => p_tenant_org_id,
    tenant_org_id => p_tenant_org_id,
    actor_org_id => p_tenant_org_id
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

create or replace function public.rpc_get_tenant_branding(p_tenant_org_id uuid)
returns tenant_branding
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result tenant_branding;
begin
  perform public.assert_tenant_membership(p_tenant_org_id);

  select * into result
  from tenant_branding
  where tenant_org_id = p_tenant_org_id;

  return result;
end;
$$;

grant execute on function public.rpc_get_tenant_branding(uuid) to authenticated, service_role;

create or replace function public.rpc_upsert_tenant_domain(
  p_tenant_org_id uuid,
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
  perform public.assert_tenant_membership(p_tenant_org_id);

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
    if existing.tenant_org_id <> p_tenant_org_id then
      raise exception 'Domain % already claimed by another tenant', normalized_domain using errcode = '42501';
    end if;

    update tenant_domains
    set is_primary = coalesce(p_is_primary, existing.is_primary),
        updated_at = now()
    where id = existing.id
    returning * into result;
  else
    insert into tenant_domains as td (
      tenant_org_id,
      domain,
      is_primary,
      cert_status,
      updated_at
    )
    values (
      p_tenant_org_id,
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
        where tenant_org_id = p_tenant_org_id
          and id <> result.id
          and is_primary
      ),
      '[]'::jsonb
    );

    update tenant_domains
    set is_primary = false,
        updated_at = now()
    where tenant_org_id = p_tenant_org_id
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
    tenant_org_id => result.tenant_org_id,
    actor_org_id => result.tenant_org_id
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

  tenant_id := previous.tenant_org_id;

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
    tenant_org_id => result.tenant_org_id,
    actor_org_id => result.tenant_org_id
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

  perform public.assert_tenant_membership(existing.tenant_org_id);

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
      tenant_org_id => existing.tenant_org_id,
      actor_org_id => existing.tenant_org_id
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

create type billing_tenant_mode as enum ('direct', 'partner_managed');

create type billing_subscription_status as enum (
  'trialing',
  'active',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'canceled',
  'unpaid',
  'paused'
);

create table billing_prices (
  stripe_price_id text primary key,
  product_name text not null,
  nickname text,
  unit_amount integer,
  currency text not null,
  interval text,
  interval_count integer,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table billing_tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id) on delete cascade,
  stripe_customer_id text unique,
  billing_mode billing_tenant_mode not null default 'direct',
  partner_org_id uuid references organisations(id),
  default_price_id text references billing_prices(stripe_price_id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_tenants_tenant_unique unique (tenant_org_id)
);

create table billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id) on delete cascade,
  billing_tenant_id uuid references billing_tenants(id) on delete set null,
  stripe_subscription_id text not null unique,
  status billing_subscription_status not null,
  stripe_price_id text references billing_prices(stripe_price_id),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  cancel_at_period_end boolean not null default false,
  collection_method text,
  latest_invoice_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_tenants_tenant_idx on billing_tenants(tenant_org_id);
create index billing_subscriptions_tenant_idx on billing_subscriptions(tenant_org_id);
create index billing_subscriptions_status_idx on billing_subscriptions(status);
create index billing_prices_active_idx on billing_prices(is_active);

alter table billing_prices enable row level security;
alter table billing_tenants enable row level security;
alter table billing_subscriptions enable row level security;

create policy "Service role manages billing prices" on billing_prices
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Authenticated read billing prices" on billing_prices
  for select using (
    auth.role() = 'service_role'
    or auth.role() = 'authenticated'
  );

create policy "Service role manages billing tenants" on billing_tenants
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read billing tenants" on billing_tenants
  for select using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create policy "Service role manages billing subscriptions" on billing_subscriptions
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read billing subscriptions" on billing_subscriptions
  for select using (
    auth.role() = 'service_role'
    or public.is_member_of_org(tenant_org_id)
  );

create or replace function public.rpc_upsert_billing_price(
  p_stripe_price_id text,
  p_product_name text,
  p_nickname text default null,
  p_unit_amount integer default null,
  p_currency text,
  p_interval text default null,
  p_interval_count integer default null,
  p_is_active boolean default true,
  p_metadata jsonb default '{}'::jsonb
)
returns billing_prices
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_price billing_prices;
begin
  if coalesce(trim(p_stripe_price_id), '') = '' then
    raise exception 'Stripe price id is required' using errcode = '23514';
  end if;

  insert into billing_prices as bp (
    stripe_price_id,
    product_name,
    nickname,
    unit_amount,
    currency,
    interval,
    interval_count,
    is_active,
    metadata,
    updated_at
  )
  values (
    p_stripe_price_id,
    p_product_name,
    nullif(p_nickname, ''),
    p_unit_amount,
    p_currency,
    nullif(p_interval, ''),
    p_interval_count,
    coalesce(p_is_active, true),
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (stripe_price_id) do update
    set product_name = excluded.product_name,
        nickname = excluded.nickname,
        unit_amount = excluded.unit_amount,
        currency = excluded.currency,
        interval = excluded.interval,
        interval_count = excluded.interval_count,
        is_active = excluded.is_active,
        metadata = excluded.metadata,
        updated_at = now()
  returning * into v_price;

  return v_price;
end;
$$;

grant execute on function public.rpc_upsert_billing_price(
  text,
  text,
  text,
  integer,
  text,
  text,
  integer,
  boolean,
  jsonb
) to authenticated, service_role;

create or replace function public.rpc_upsert_billing_tenant(
  p_tenant_org_id uuid,
  p_stripe_customer_id text,
  p_billing_mode billing_tenant_mode default 'direct',
  p_partner_org_id uuid default null,
  p_default_price_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns billing_tenants
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tenant billing_tenants;
begin
  if p_tenant_org_id is null then
    raise exception 'Tenant organisation id is required' using errcode = '23514';
  end if;

  perform public.assert_tenant_membership(p_tenant_org_id);

  insert into billing_tenants as bt (
    tenant_org_id,
    stripe_customer_id,
    billing_mode,
    partner_org_id,
    default_price_id,
    metadata,
    updated_at
  )
  values (
    p_tenant_org_id,
    p_stripe_customer_id,
    coalesce(p_billing_mode, 'direct'),
    p_partner_org_id,
    nullif(p_default_price_id, ''),
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (tenant_org_id) do update
    set stripe_customer_id = excluded.stripe_customer_id,
        billing_mode = excluded.billing_mode,
        partner_org_id = excluded.partner_org_id,
        default_price_id = excluded.default_price_id,
        metadata = excluded.metadata,
        updated_at = now()
  returning * into v_tenant;

  return v_tenant;
end;
$$;

grant execute on function public.rpc_upsert_billing_tenant(
  uuid,
  text,
  billing_tenant_mode,
  uuid,
  text,
  jsonb
) to authenticated, service_role;

create or replace function public.rpc_upsert_billing_subscription(
  p_tenant_org_id uuid,
  p_billing_tenant_id uuid default null,
  p_stripe_subscription_id text,
  p_status billing_subscription_status,
  p_stripe_price_id text default null,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_cancel_at timestamptz default null,
  p_canceled_at timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_collection_method text default null,
  p_latest_invoice_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns billing_subscriptions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_subscription billing_subscriptions;
  v_billing_tenant_id uuid;
begin
  if p_tenant_org_id is null then
    raise exception 'Tenant organisation id is required' using errcode = '23514';
  end if;

  if coalesce(trim(p_stripe_subscription_id), '') = '' then
    raise exception 'Stripe subscription id is required' using errcode = '23514';
  end if;

  perform public.assert_tenant_membership(p_tenant_org_id);

  if p_billing_tenant_id is not null then
    v_billing_tenant_id := p_billing_tenant_id;
  else
    select id
      into v_billing_tenant_id
    from billing_tenants
    where tenant_org_id = p_tenant_org_id
    order by updated_at desc
    limit 1;
  end if;

  insert into billing_subscriptions as bs (
    tenant_org_id,
    billing_tenant_id,
    stripe_subscription_id,
    status,
    stripe_price_id,
    current_period_start,
    current_period_end,
    cancel_at,
    canceled_at,
    cancel_at_period_end,
    collection_method,
    latest_invoice_id,
    metadata,
    updated_at
  )
  values (
    p_tenant_org_id,
    v_billing_tenant_id,
    p_stripe_subscription_id,
    p_status,
    nullif(p_stripe_price_id, ''),
    p_current_period_start,
    p_current_period_end,
    p_cancel_at,
    p_canceled_at,
    coalesce(p_cancel_at_period_end, false),
    nullif(p_collection_method, ''),
    nullif(p_latest_invoice_id, ''),
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (stripe_subscription_id) do update
    set tenant_org_id = excluded.tenant_org_id,
        billing_tenant_id = excluded.billing_tenant_id,
        status = excluded.status,
        stripe_price_id = excluded.stripe_price_id,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        cancel_at = excluded.cancel_at,
        canceled_at = excluded.canceled_at,
        cancel_at_period_end = excluded.cancel_at_period_end,
        collection_method = excluded.collection_method,
        latest_invoice_id = excluded.latest_invoice_id,
        metadata = excluded.metadata,
        updated_at = now()
  returning * into v_subscription;

  return v_subscription;
end;
$$;

grant execute on function public.rpc_upsert_billing_subscription(
  uuid,
  uuid,
  text,
  billing_subscription_status,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  text,
  text,
  jsonb
) to authenticated, service_role;

create or replace view billing_subscription_overview as
select
  bt.tenant_org_id,
  bt.billing_mode,
  bt.stripe_customer_id,
  bt.partner_org_id,
  bt.default_price_id,
  bt.metadata as tenant_metadata,
  bt.updated_at as tenant_updated_at,
  bs.stripe_subscription_id,
  bs.status,
  bs.stripe_price_id,
  bs.current_period_start,
  bs.current_period_end,
  bs.cancel_at,
  bs.canceled_at,
  bs.cancel_at_period_end,
  bs.collection_method,
  bs.latest_invoice_id,
  bs.metadata as subscription_metadata,
  bs.updated_at as subscription_updated_at,
  bp.product_name,
  bp.nickname,
  bp.unit_amount,
  bp.currency,
  bp.interval,
  bp.interval_count,
  bp.is_active as price_active,
  bp.metadata as price_metadata,
  bp.updated_at as price_updated_at
from billing_tenants bt
left join billing_subscriptions bs on bs.billing_tenant_id = bt.id
left join billing_prices bp on bp.stripe_price_id = coalesce(bs.stripe_price_id, bt.default_price_id);

grant select on billing_subscription_overview to authenticated, service_role;

create table dsr_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  subject_org_id uuid references organisations(id),
  assignee_user_id uuid references users(id),
  assignee_email text,
  requester_email text,
  requester_name text,
  request_payload jsonb,
  type text not null check (type in (
    'access',
    'export',
    'rectification',
    'erasure',
    'restriction',
    'objection',
    'portability'
  )),
  status text not null check (status in (
    'received',
    'acknowledged',
    'in_progress',
    'paused',
    'completed',
    'escalated'
  )),
  received_at timestamptz not null default now(),
  ack_sent_at timestamptz,
  due_at timestamptz not null,
  resolved_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dsr_request_jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references dsr_requests(id) on delete cascade,
  job_type text not null check (job_type in ('ack_deadline', 'resolution_deadline', 'escalation_notice')),
  run_after timestamptz not null,
  payload jsonb,
  attempts integer not null default 0,
  locked_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dsr_requests_tenant_status_idx on dsr_requests(tenant_org_id, status, due_at);
create index dsr_request_jobs_schedule_idx on dsr_request_jobs(job_type, run_after) where processed_at is null;

create table cro_companies (
  company_number text primary key,
  name text not null,
  status text,
  company_type text,
  registered_on date,
  dissolved_on date,
  last_return_date date,
  address jsonb,
  eircode text,
  metadata jsonb,
  snapshot_fingerprint text,
  source_resource_id text,
  refreshed_at timestamptz default now(),
  created_at timestamptz default now()
);

create table charity_registration_metrics (
  metric_key text primary key,
  metric_label text not null,
  values_json jsonb not null,
  source_resource_id text,
  snapshot_fingerprint text,
  refreshed_at timestamptz default now(),
  created_at timestamptz default now()
);

create table revenue_charity_registry (
  id uuid primary key default gen_random_uuid(),
  charity_name text not null,
  charity_address text,
  source_resource_id text,
  snapshot_fingerprint text,
  refreshed_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(charity_name, source_resource_id)
);

create table funding_opportunities (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source_resource_id text not null,
  title text not null,
  summary text,
  call_year integer,
  call_type text,
  domain text,
  county text,
  lead_institution text,
  acronym text,
  amount_awarded numeric,
  currency text,
  metadata jsonb,
  snapshot_fingerprint text,
  refreshed_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(external_id, source_resource_id)
);

create table funding_opportunity_workflows (
  id uuid primary key default gen_random_uuid(),
  funding_opportunity_id uuid references funding_opportunities(id) on delete cascade,
  workflow_key text not null,
  created_at timestamptz default now(),
  unique(funding_opportunity_id, workflow_key)
);

create table source_registry (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  name text not null,
  url text not null,
  parser text not null,
  jurisdiction text,
  category text,
  created_at timestamptz not null default now(),
  unique(org_id, url)
);

create index source_registry_org_idx on source_registry(org_id);

create table source_snapshot (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  source_id uuid not null references source_registry(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  content_hash text not null,
  parsed_facts jsonb not null,
  storage_ref text,
  created_at timestamptz not null default now(),
  unique(source_id, content_hash)
);

create index source_snapshot_source_idx on source_snapshot(source_id, fetched_at desc);
create index source_snapshot_org_idx on source_snapshot(org_id);

create table change_event (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  source_id uuid not null references source_registry(id) on delete cascade,
  from_hash text,
  to_hash text not null,
  detected_at timestamptz not null default now(),
  severity text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index change_event_source_idx on change_event(source_id, detected_at desc);
create index change_event_org_idx on change_event(org_id, detected_at desc);

create table rule_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  rule_id text not null,
  version text not null,
  logic_jsonb jsonb not null,
  sources jsonb not null,
  checksum text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique(org_id, rule_id, version)
);

create index rule_versions_rule_idx on rule_versions(rule_id);
create index rule_versions_org_idx on rule_versions(org_id);

create table template_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  template_id text not null,
  version text not null,
  storage_ref text not null,
  checksum text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique(org_id, template_id, version)
);

create index template_versions_template_idx on template_versions(template_id);
create index template_versions_org_idx on template_versions(org_id);

create table workflow_def_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  workflow_def_id uuid not null references workflow_defs(id) on delete cascade,
  version text not null,
  graph_jsonb jsonb not null,
  rule_ranges jsonb not null default '{}'::jsonb,
  template_ranges jsonb not null default '{}'::jsonb,
  checksum text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique(workflow_def_id, version)
);

create index workflow_def_versions_org_idx on workflow_def_versions(org_id);

create table workflow_pack_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  pack_id text not null,
  version text not null,
  overlay_jsonb jsonb not null,
  checksum text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique(org_id, pack_id, version)
);

create index workflow_pack_versions_pack_idx on workflow_pack_versions(pack_id);
create index workflow_pack_versions_org_idx on workflow_pack_versions(org_id);

create table moderation_queue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  change_event_id uuid references change_event(id) on delete set null,
  proposal jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'amended')),
  classification text,
  reviewer_id uuid references users(id),
  decided_at timestamptz,
  created_by uuid references users(id),
  notes_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index moderation_queue_org_status_idx on moderation_queue(org_id, status, created_at desc);
create index moderation_queue_change_event_idx on moderation_queue(change_event_id);

create table release_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  scope text not null,
  ref_id text not null,
  from_version text,
  to_version text not null,
  classification text not null,
  effective_date date,
  notes_md text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index release_notes_scope_idx on release_notes(org_id, scope, ref_id);

create table adoption_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  run_id uuid references workflow_runs(id) on delete set null,
  scope text not null,
  ref_id text not null,
  from_version text,
  to_version text not null,
  mode text not null,
  actor_id uuid references users(id),
  decided_at timestamptz not null default now(),
  notes jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index adoption_records_scope_idx on adoption_records(org_id, scope, ref_id);
create index adoption_records_run_idx on adoption_records(run_id);

create schema if not exists platform;

create table platform.rule_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  parser text not null,
  jurisdiction text,
  category text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index platform_rule_sources_jurisdiction_category_idx
  on platform.rule_sources(jurisdiction, category);

create table platform.rule_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  rule_source_id uuid not null references platform.rule_sources(id) on delete cascade,
  content_hash text not null,
  parsed_facts jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index platform_rule_source_snapshots_source_idx
  on platform.rule_source_snapshots(rule_source_id, fetched_at desc);

create table platform.rule_packs (
  id uuid primary key default gen_random_uuid(),
  pack_key text not null,
  version text not null,
  title text not null,
  summary text,
  manifest jsonb not null default '{}'::jsonb,
  checksum text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  status text not null default 'draft' check (status in ('draft','proposed','published','deprecated')),
  unique(pack_key, version)
);

create index platform_rule_packs_key_idx on platform.rule_packs(pack_key);

create table platform.rule_pack_detections (
  id uuid primary key default gen_random_uuid(),
  rule_pack_id uuid references platform.rule_packs(id) on delete set null,
  rule_pack_key text not null,
  current_version text,
  proposed_version text not null,
  severity text not null check (severity in ('info','minor','major','critical')),
  status text not null default 'open' check (status in ('open','in_review','approved','rejected','superseded')),
  diff jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_by uuid references users(id),
  notes text,
  unique(rule_pack_key, proposed_version, detected_at)
);

create index platform_rule_pack_detections_pack_idx
  on platform.rule_pack_detections(rule_pack_key, detected_at desc);

create index platform_rule_pack_detections_status_idx
  on platform.rule_pack_detections(status);

create table platform.rule_pack_detection_sources (
  detection_id uuid references platform.rule_pack_detections(id) on delete cascade,
  rule_source_id uuid references platform.rule_sources(id) on delete cascade,
  change_summary jsonb not null default '{}'::jsonb,
  primary key(detection_id, rule_source_id)
);

create index platform_rule_pack_detection_sources_source_idx
  on platform.rule_pack_detection_sources(rule_source_id);

create schema if not exists app;

create or replace function app.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
as $$
  with claims as (
    select app.jwt() as payload
  )
  select
    coalesce(payload->>'role', '') = 'platform_admin'
    or case jsonb_typeof(payload->'is_platform_admin')
      when 'boolean' then (payload->'is_platform_admin')::boolean
      when 'string' then lower(payload->>'is_platform_admin') in ('true','t','1','yes','y','on')
      when 'number' then (payload->>'is_platform_admin')::numeric <> 0
      else false
    end
  from claims;
$$;

create or replace function public.current_tenant_org_id()
returns uuid
language sql
stable
as $$
  with claims as (
    select app.jwt() as payload
  )
  select case
    when payload ? 'tenant_org_id' then nullif(payload->>'tenant_org_id', '')::uuid
    else null
  end
  from claims;
$$;

create or replace function public.jwt_has_org(target_org_id uuid)
returns boolean
language sql
stable
as $$
  with claims as (
    select app.jwt() as payload
  )
  select exists (
    select 1
    from claims,
         jsonb_array_elements_text(coalesce(payload->'org_ids', '[]'::jsonb)) as org_id(value)
    where value = target_org_id::text
  );
$$;

create or replace function public.is_platform_service()
returns boolean
language sql
stable
as $$
  with claims as (
    select app.jwt() as payload
  )
  select auth.role() = 'service_role'
    or exists (
      select 1
      from claims,
           jsonb_array_elements_text(coalesce(payload->'role_paths', '[]'::jsonb)) as role_path(value)
      where value like 'platform:service%'
    );
$$;

create or replace function app.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_platform_service()
    or app.is_platform_admin()
    or exists (
      select 1
      from memberships m
      join organisations o on o.id = m.org_id
      where m.org_id = target_org_id
        and m.user_id = app.current_user_id()
        and (
          public.current_tenant_org_id() is null
          or o.tenant_org_id = public.current_tenant_org_id()
        )
    );
$$;

create or replace function public.is_member_of_org(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select app.is_org_member(target_org_id);
$$;

create or replace function public.can_access_run(target_run_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_platform_service()
    or exists (
      select 1
      from workflow_runs wr
      where wr.id = target_run_id
        and (
          public.current_tenant_org_id() is null
          or wr.tenant_org_id = public.current_tenant_org_id()
        )
        and (
          (wr.engager_org_id is not null and public.is_member_of_org(wr.engager_org_id))
          or (wr.subject_org_id is not null and public.is_member_of_org(wr.subject_org_id))
          or (wr.subject_org_id is not null and public.jwt_has_org(wr.subject_org_id))
        )
    );
$$;

alter table organisations enable row level security;
alter table users enable row level security;
alter table memberships enable row level security;
alter table engagements enable row level security;
alter table workflow_defs enable row level security;
alter table workflow_runs enable row level security;
alter table steps enable row level security;
alter table documents enable row level security;
alter table audit_log enable row level security;
alter table admin_actions enable row level security;
alter table json_schemas enable row level security;
alter table step_types enable row level security;
alter table step_type_versions enable row level security;
alter table tenant_step_type_installs enable row level security;
alter table tenant_secret_bindings enable row level security;
alter table tenant_workflow_overlays enable row level security;
alter table workflow_overlay_snapshots enable row level security;
alter table workflow_overlay_layers enable row level security;
alter table dsr_requests enable row level security;
alter table dsr_request_jobs enable row level security;
alter table source_registry enable row level security;
alter table source_snapshot enable row level security;
alter table change_event enable row level security;
alter table rule_versions enable row level security;
alter table template_versions enable row level security;
alter table workflow_def_versions enable row level security;
alter table workflow_pack_versions enable row level security;
alter table moderation_queue enable row level security;
alter table release_notes enable row level security;
alter table adoption_records enable row level security;
alter table platform.rule_sources enable row level security;
alter table platform.rule_source_snapshots enable row level security;
alter table platform.rule_packs enable row level security;
alter table platform.rule_pack_detections enable row level security;
alter table platform.rule_pack_detection_sources enable row level security;

create policy "Members read organisations" on organisations
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and (
        public.is_member_of_org(id)
        or public.jwt_has_org(id)
        or id = public.current_tenant_org_id()
      )
    )
  );

create policy "Service role manages organisations" on organisations
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Users can view their profile" on users
  for select
  using (auth.role() = 'service_role' or id = auth.uid());

create policy "Users can update their profile" on users
  for update
  using (auth.role() = 'service_role' or id = auth.uid())
  with check (auth.role() = 'service_role' or id = auth.uid());

create policy "Service role manages users" on users
  for insert
  with check (auth.role() = 'service_role');

create policy "Service role removes users" on users
  for delete
  using (auth.role() = 'service_role');

create policy "Users can read their memberships" on memberships
  for select
  using (auth.role() = 'service_role' or user_id = auth.uid());

create policy "Service role manages memberships" on memberships
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members view engagements" on engagements
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and (
        public.is_member_of_org(engager_org_id)
        or (client_org_id is not null and public.is_member_of_org(client_org_id))
        or (subject_org_id is not null and public.jwt_has_org(subject_org_id))
      )
    )
  );

create policy "Service role manages engagements" on engagements
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Authenticated can view workflow definitions" on workflow_defs
  for select
  using (auth.role() in ('authenticated', 'service_role'));

create policy "Service role manages workflow definitions" on workflow_defs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members access workflow runs" on workflow_runs
  for select
  using (public.is_platform_service() or public.can_access_run(id));

create policy "Service role manages workflow runs" on workflow_runs
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Members read steps" on steps
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and public.can_access_run(run_id)
    )
  );

create policy "Service role manages steps" on steps
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Members read documents" on documents
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and public.can_access_run(run_id)
    )
  );

create policy "Service role manages documents" on documents
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Members read audit log" on audit_log
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and (
        (run_id is not null and public.can_access_run(run_id))
        or (actor_org_id is not null and public.is_member_of_org(actor_org_id))
        or (on_behalf_of_org_id is not null and public.is_member_of_org(on_behalf_of_org_id))
        or (subject_org_id is not null and public.jwt_has_org(subject_org_id))
      )
    )
  );

create policy "Service role appends audit log" on audit_log
  for insert
  with check (public.is_platform_service());

create policy "Members read admin actions" on admin_actions
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and (
        public.is_member_of_org(tenant_org_id)
        or (actor_org_id is not null and public.is_member_of_org(actor_org_id))
        or (subject_org_id is not null and public.jwt_has_org(subject_org_id))
      )
    )
  );

create policy "Service role appends admin actions" on admin_actions
  for insert
  with check (public.is_platform_service());

create policy "Members view DSR requests" on dsr_requests
  for select
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and (
        public.is_member_of_org(tenant_org_id)
        or (
          subject_org_id is not null
          and (
            public.is_member_of_org(subject_org_id)
            or public.jwt_has_org(subject_org_id)
          )
        )
      )
    )
  );

create policy "Members manage DSR requests" on dsr_requests
  for all
  using (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and public.is_member_of_org(tenant_org_id)
    )
  )
  with check (
    public.is_platform_service()
    or (
      tenant_org_id = public.current_tenant_org_id()
      and public.is_member_of_org(tenant_org_id)
    )
  );

create policy "Service role manages DSR jobs" on dsr_request_jobs
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());

create policy "Service role manages source registry" on source_registry
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read source registry" on source_registry
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

create policy "Service role manages source snapshots" on source_snapshot
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read source snapshots" on source_snapshot
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

create policy "Service role manages change events" on change_event
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read change events" on change_event
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

create policy "Service role manages rule versions" on rule_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read rule versions" on rule_versions
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

create policy "Service role manages template versions" on template_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read template versions" on template_versions
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

create policy "Service role manages workflow def versions" on workflow_def_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read workflow def versions" on workflow_def_versions
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

create policy "Service role manages workflow pack versions" on workflow_pack_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read workflow pack versions" on workflow_pack_versions
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

create policy "Service role manages moderation queue" on moderation_queue
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members view moderation queue" on moderation_queue
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

create policy "Service role manages release notes" on release_notes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read release notes" on release_notes
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

create policy "Service role manages adoption records" on adoption_records
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read adoption records" on adoption_records
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

create policy "Tenant members insert adoption records" on adoption_records
  for insert
  with check (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );

create policy "Platform services manage rule sources" on platform.rule_sources
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

create policy "Platform services manage rule source snapshots" on platform.rule_source_snapshots
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

create policy "Platform services manage rule packs" on platform.rule_packs
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

create policy "Platform services manage rule pack detections" on platform.rule_pack_detections
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

create policy "Platform services manage rule pack detection sources" on platform.rule_pack_detection_sources
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

create policy "Service role manages json schemas" on json_schemas
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Admins read json schemas" on json_schemas
  for select
  using (auth.role() in ('service_role', 'authenticated'));

create policy "Service role manages step types" on step_types
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Admins read step types" on step_types
  for select
  using (auth.role() in ('service_role', 'authenticated'));

create policy "Service role manages step type versions" on step_type_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Admins read step type versions" on step_type_versions
  for select
  using (auth.role() in ('service_role', 'authenticated'));

create policy "Service role manages tenant installs" on tenant_step_type_installs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members read installs" on tenant_step_type_installs
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );

create policy "Service role manages tenant secret bindings" on tenant_secret_bindings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members manage secret bindings" on tenant_secret_bindings
  for select
  using (
    auth.role() = 'service_role'
    or app.is_org_member(org_id)
  );

create policy "Service role manages tenant overlays" on tenant_workflow_overlays
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Tenant members manage overlays" on tenant_workflow_overlays
  for select
  using (
    auth.role() = 'service_role'
    or app.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or app.is_org_member(org_id)
  );

create policy "Service role manages overlay snapshots" on workflow_overlay_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members read overlay snapshots" on workflow_overlay_snapshots
  for select
  using (
    auth.role() = 'service_role'
    or (run_id is not null and public.can_access_run(run_id))
    or exists (
      select 1
      from tenant_workflow_overlays two
      where two.id = tenant_overlay_id
        and app.is_org_member(two.org_id)
    )
  );

create policy "Service role manages overlay layers" on workflow_overlay_layers
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Members read overlay layers" on workflow_overlay_layers
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from workflow_overlay_snapshots s
      where s.id = snapshot_id
        and (
          (s.run_id is not null and public.can_access_run(s.run_id))
          or (
            s.tenant_overlay_id is not null
            and exists (
              select 1
              from tenant_workflow_overlays two
              where two.id = s.tenant_overlay_id
                and app.is_org_member(two.org_id)
            )
          )
        )
    )
  );

create table if not exists admin_actions(
  id uuid primary key default gen_random_uuid(),
  tenant_org_id uuid not null references organisations(id),
  actor_id uuid references users(id),
  actor_org_id uuid references organisations(id),
  on_behalf_of_org_id uuid references organisations(id),
  subject_org_id uuid references organisations(id),
  target_kind text,
  target_id uuid,
  action text not null,
  reason_code text not null,
  lawful_basis text,
  payload jsonb not null default '{}'::jsonb,
  requires_second_approval boolean not null default false,
  second_actor_id uuid references users(id),
  prev_hash text not null default repeat('0', 64),
  row_hash text not null,
  created_at timestamptz not null default now(),
  inserted_at timestamptz not null default now(),
  approved_at timestamptz
);

create unique index admin_actions_row_hash_key on admin_actions(row_hash);

create or replace function raise_append_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and tg_table_name = 'admin_actions' then
    if current_setting('app.admin_actions_allow_update', true) = 'on' then
      return null;
    end if;
  end if;

  raise exception 'Ledger tables are append-only';
end;
$$;

create or replace function compute_audit_log_hash()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prev_hash text;
  v_prev_position bigint;
begin
  new.created_at := coalesce(new.created_at, now());
  new.inserted_at := coalesce(new.inserted_at, now());
  new.meta_json := coalesce(new.meta_json, '{}'::jsonb);
  new.target_kind := coalesce(new.target_kind, new.entity);
  new.tenant_id := coalesce(new.tenant_id, new.tenant_org_id);

  if new.tenant_id is null then
    raise exception 'tenant_id is required for audit chain';
  end if;

  select row_hash, chain_position
    into v_prev_hash, v_prev_position
  from audit_log
  where tenant_id = new.tenant_id
  order by chain_position desc
  limit 1
  for update;

  if v_prev_hash is null then
    v_prev_hash := repeat('0', 64);
    v_prev_position := 0;
  end if;

  if new.prev_hash is null then
    new.prev_hash := v_prev_hash;
  elsif new.prev_hash <> v_prev_hash then
    raise exception 'Invalid prev_hash for tenant %', new.tenant_id;
  end if;

  if new.chain_position is null then
    new.chain_position := v_prev_position + 1;
  elsif new.chain_position <> v_prev_position + 1 then
    raise exception 'Invalid chain_position % for tenant % (expected %)',
      new.chain_position,
      new.tenant_id,
      v_prev_position + 1;
  end if;

  new.row_hash := encode(
    digest(
      jsonb_build_object(
        'tenant_id', new.tenant_id,
        'tenant_org_id', new.tenant_org_id,
        'actor_user_id', new.actor_user_id,
        'actor_org_id', new.actor_org_id,
        'on_behalf_of_org_id', new.on_behalf_of_org_id,
        'subject_org_id', new.subject_org_id,
        'entity', new.entity,
        'target_kind', new.target_kind,
        'target_id', new.target_id,
        'run_id', new.run_id,
        'step_id', new.step_id,
        'action', new.action,
        'lawful_basis', new.lawful_basis,
        'meta_json', new.meta_json,
        'prev_hash', new.prev_hash,
        'chain_position', new.chain_position,
        'created_at', to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'inserted_at', to_char(new.inserted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      )::text,
      'sha256'
    ),
    'hex'
  );

  return new;
end;
$$;

create or replace function compute_admin_actions_hash()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prev_hash text;
begin
  new.created_at := coalesce(new.created_at, now());
  new.inserted_at := coalesce(new.inserted_at, now());
  new.payload := coalesce(new.payload, '{}'::jsonb);

  select row_hash
    into v_prev_hash
  from admin_actions
  where tenant_org_id = new.tenant_org_id
  order by inserted_at desc, created_at desc, id desc
  limit 1
  for update;

  if v_prev_hash is null then
    v_prev_hash := repeat('0', 64);
  end if;

  if new.prev_hash is null then
    new.prev_hash := v_prev_hash;
  elsif new.prev_hash <> v_prev_hash then
    raise exception 'Invalid prev_hash for tenant %', new.tenant_org_id;
  end if;

  new.row_hash := encode(
    digest(
      jsonb_build_object(
        'tenant_org_id', new.tenant_org_id,
        'actor_id', new.actor_id,
        'actor_org_id', new.actor_org_id,
        'on_behalf_of_org_id', new.on_behalf_of_org_id,
        'subject_org_id', new.subject_org_id,
        'target_kind', new.target_kind,
        'target_id', new.target_id,
        'action', new.action,
        'reason_code', new.reason_code,
        'lawful_basis', new.lawful_basis,
        'payload', new.payload,
        'requires_second_approval', new.requires_second_approval,
        'second_actor_id', new.second_actor_id,
        'prev_hash', new.prev_hash,
        'created_at', to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'inserted_at', to_char(new.inserted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'approved_at', case when new.approved_at is not null then to_char(new.approved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') else null end
      )::text,
      'sha256'
    ),
    'hex'
  );

  return new;
end;
$$;

create or replace function refresh_admin_actions_hash_chain(p_tenant_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_prev_hash text := repeat('0', 64);
  v_row_hash text;
  rec admin_actions%rowtype;
begin
  if p_tenant_id is null then
    raise exception 'tenant_org_id is required';
  end if;

  perform set_config('app.admin_actions_allow_update', 'on', true);

  for rec in
    select *
    from admin_actions
    where tenant_org_id = p_tenant_id
    order by inserted_at, created_at, id
  loop
    v_row_hash := encode(
      digest(
        jsonb_build_object(
          'tenant_org_id', rec.tenant_org_id,
          'actor_id', rec.actor_id,
          'actor_org_id', rec.actor_org_id,
          'on_behalf_of_org_id', rec.on_behalf_of_org_id,
          'subject_org_id', rec.subject_org_id,
          'target_kind', rec.target_kind,
          'target_id', rec.target_id,
          'action', rec.action,
          'reason_code', rec.reason_code,
          'lawful_basis', rec.lawful_basis,
          'payload', coalesce(rec.payload, '{}'::jsonb),
          'requires_second_approval', rec.requires_second_approval,
          'second_actor_id', rec.second_actor_id,
          'prev_hash', v_prev_hash,
          'created_at', to_char(rec.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'inserted_at', to_char(rec.inserted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'approved_at', case when rec.approved_at is not null then to_char(rec.approved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') else null end
        )::text,
        'sha256'
      ),
      'hex'
    );

    update admin_actions
    set prev_hash = v_prev_hash,
        row_hash = v_row_hash
    where id = rec.id;

    v_prev_hash := v_row_hash;
  end loop;

  perform set_config('app.admin_actions_allow_update', 'off', true);
end;
$$;

create trigger audit_log_before_insert
  before insert on audit_log
  for each row execute function compute_audit_log_hash();
comment on trigger audit_log_before_insert on audit_log is 'Computes prev_hash, row_hash, and chain_position for tenant-scoped audit ledger.';

create trigger admin_actions_before_insert
  before insert on admin_actions
  for each row execute function compute_admin_actions_hash();

create constraint trigger audit_log_block_mutations
  after update or delete on audit_log
  for each statement execute function raise_append_only();

create constraint trigger admin_actions_block_mutations
  after update or delete on admin_actions
  for each statement execute function raise_append_only();

create or replace function log_freshness_moderation_audit()
returns trigger
language plpgsql
as $$
begin
  insert into audit_log(
    tenant_org_id,
    tenant_id,
    actor_user_id,
    actor_org_id,
    subject_org_id,
    entity,
    target_kind,
    target_id,
    action,
    meta_json
  )
  values (
    new.org_id,
    new.org_id,
    coalesce(new.reviewer_id, new.created_by),
    new.org_id,
    new.org_id,
    'moderation_queue',
    'freshness_moderation',
    new.id,
    'enqueue',
    jsonb_build_object(
      'change_event_id', new.change_event_id,
      'status', new.status,
      'classification', new.classification,
      'proposal', new.proposal
    )
  );

  return new;
end;
$$;

create or replace function log_freshness_adoption_audit()
returns trigger
language plpgsql
as $$
begin
  insert into audit_log(
    tenant_org_id,
    tenant_id,
    actor_user_id,
    actor_org_id,
    subject_org_id,
    run_id,
    entity,
    target_kind,
    target_id,
    action,
    meta_json
  )
  values (
    new.org_id,
    new.org_id,
    new.actor_id,
    new.org_id,
    new.org_id,
    new.run_id,
    'adoption_records',
    'freshness_adoption',
    new.id,
    'adopt',
    jsonb_build_object(
      'scope', new.scope,
      'ref_id', new.ref_id,
      'from_version', new.from_version,
      'to_version', new.to_version,
      'mode', new.mode
    )
  );

  return new;
end;
$$;

create trigger moderation_queue_audit_after_insert
  after insert on moderation_queue
  for each row execute function log_freshness_moderation_audit();

create trigger adoption_records_audit_after_insert
  after insert on adoption_records
  for each row execute function log_freshness_adoption_audit();

create or replace function rpc_append_audit_entry(
  action text,
  actor_id uuid,
  reason_code text,
  payload jsonb default '{}'::jsonb,
  target_kind text default null,
  target_id uuid default null,
  requires_second boolean default false,
  second_actor_id uuid default null,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null,
  run_id uuid default null,
  step_id uuid default null,
  lawful_basis text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_action_id uuid;
  v_audit_id uuid;
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
  v_target_kind text;
  v_target_id uuid;
  v_payload jsonb;
begin
  if action is null or length(trim(action)) = 0 then
    raise exception 'Action is required';
  end if;

  if reason_code is null or length(trim(reason_code)) = 0 then
    raise exception 'Reason code is required';
  end if;

  if requires_second and (second_actor_id is null or second_actor_id = actor_id) then
    raise exception 'Second approver required';
  end if;

  v_tenant_org_id := coalesce(tenant_org_id, actor_org_id, on_behalf_of_org_id, subject_org_id);
  if v_tenant_org_id is null then
    raise exception 'tenant_org_id is required';
  end if;

  v_subject_org_id := subject_org_id;
  v_target_kind := coalesce(target_kind, case when run_id is not null then 'workflow_run' when step_id is not null then 'step' else null end);
  v_target_id := coalesce(target_id, case when v_target_kind = 'workflow_run' then run_id when v_target_kind = 'step' then step_id else null end);
  v_payload := coalesce(payload, '{}'::jsonb);

  insert into admin_actions(
    tenant_org_id,
    actor_id,
    actor_org_id,
    on_behalf_of_org_id,
    subject_org_id,
    target_kind,
    target_id,
    action,
    reason_code,
    lawful_basis,
    payload,
    requires_second_approval,
    second_actor_id,
    approved_at
  )
  values(
    v_tenant_org_id,
    actor_id,
    actor_org_id,
    on_behalf_of_org_id,
    v_subject_org_id,
    v_target_kind,
    v_target_id,
    action,
    reason_code,
    lawful_basis,
    v_payload,
    requires_second,
    second_actor_id,
    case when requires_second then null else now() end
  )
  returning id into v_admin_action_id;

  insert into audit_log(
    tenant_org_id,
    tenant_id,
    actor_user_id,
    actor_org_id,
    on_behalf_of_org_id,
    subject_org_id,
    entity,
    target_kind,
    target_id,
    run_id,
    step_id,
    action,
    lawful_basis,
    meta_json
  )
  values(
    v_tenant_org_id,
    v_tenant_org_id,
    actor_id,
    actor_org_id,
    on_behalf_of_org_id,
    v_subject_org_id,
    v_target_kind,
    v_target_kind,
    v_target_id,
    run_id,
    step_id,
    action,
    lawful_basis,
    v_payload
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'admin_action_id', v_admin_action_id,
    'audit_id', v_audit_id,
    'action', action,
    'tenant_org_id', v_tenant_org_id
  );
end;
$$;

create or replace function rpc_confirm_admin_action(
  action_id uuid,
  actor_id uuid,
  tenant_org_id uuid,
  actor_org_id uuid,
  on_behalf_of_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action admin_actions%rowtype;
  v_now timestamptz := now();
  v_audit_id uuid;
  v_run_id uuid;
  v_step_id uuid;
  v_target_kind text;
  v_meta jsonb;
begin
  if action_id is null then
    raise exception 'action_id is required';
  end if;

  if actor_id is null then
    raise exception 'actor_id is required';
  end if;

  if tenant_org_id is null then
    raise exception 'tenant_org_id is required';
  end if;

  if actor_org_id is null then
    raise exception 'actor_org_id is required';
  end if;

  select *
    into v_action
  from admin_actions
  where id = action_id
  for update;

  if not found then
    raise exception 'Admin action % not found', action_id;
  end if;

  if v_action.tenant_org_id <> tenant_org_id then
    raise exception 'Tenant mismatch for admin action %', action_id;
  end if;

  if not v_action.requires_second_approval then
    raise exception 'Admin action % does not require second approval', action_id;
  end if;

  if v_action.approved_at is not null then
    raise exception 'Admin action % already approved', action_id;
  end if;

  if v_action.actor_id = actor_id then
    raise exception 'Second approver must be a different admin';
  end if;

  if v_action.second_actor_id is not null and v_action.second_actor_id <> actor_id then
    raise exception 'Admin action % requires approval by the nominated admin', action_id;
  end if;

  perform set_config('app.admin_actions_allow_update', 'on', true);
  update admin_actions
    set second_actor_id = actor_id,
        approved_at = v_now
    where id = action_id;
  perform set_config('app.admin_actions_allow_update', 'off', true);

  perform refresh_admin_actions_hash_chain(v_action.tenant_org_id);

  v_run_id := case
    when v_action.payload ? 'run_id' and jsonb_typeof(v_action.payload->'run_id') = 'string' then (v_action.payload->>'run_id')::uuid
    else null
  end;
  v_step_id := case
    when v_action.payload ? 'step_id' and jsonb_typeof(v_action.payload->'step_id') = 'string' then (v_action.payload->>'step_id')::uuid
    else null
  end;
  v_target_kind := coalesce(v_action.target_kind, 'admin_action');
  v_meta := jsonb_build_object(
    'admin_action_id', action_id,
    'initiator_id', v_action.actor_id,
    'approver_id', actor_id,
    'action', v_action.action,
    'reason_code', v_action.reason_code,
    'payload', coalesce(v_action.payload, '{}'::jsonb)
  );

  insert into audit_log(
    tenant_org_id,
    tenant_id,
    actor_user_id,
    actor_org_id,
    on_behalf_of_org_id,
    subject_org_id,
    entity,
    target_kind,
    target_id,
    run_id,
    step_id,
    action,
    lawful_basis,
    meta_json
  )
  values(
    v_action.tenant_org_id,
    v_action.tenant_org_id,
    actor_id,
    actor_org_id,
    on_behalf_of_org_id,
    v_action.subject_org_id,
    v_target_kind,
    v_target_kind,
    v_action.target_id,
    v_run_id,
    v_step_id,
    'admin_action_confirmed',
    v_action.lawful_basis,
    v_meta
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'admin_action_id', action_id,
    'approved_at', v_now,
    'audit_id', v_audit_id
  );
end;
$$;


create or replace function admin_create_step_type(
  actor_id uuid,
  reason text,
  step_type jsonb,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return rpc_append_audit_entry(
    'step_type_create',
    actor_id,
    reason,
    jsonb_build_object('step_type', step_type),
    tenant_org_id => tenant_org_id,
    actor_org_id => coalesce(actor_org_id, tenant_org_id),
    on_behalf_of_org_id => on_behalf_of_org_id
  );
end;
$$;

create or replace function admin_update_step_type(
  actor_id uuid,
  reason text,
  step_type_id uuid,
  patch jsonb,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return rpc_append_audit_entry(
    'step_type_update',
    actor_id,
    reason,
    jsonb_build_object('step_type_id', step_type_id, 'patch', patch),
    'step_type',
    step_type_id,
    tenant_org_id => tenant_org_id,
    actor_org_id => coalesce(actor_org_id, tenant_org_id),
    on_behalf_of_org_id => on_behalf_of_org_id
  );
end;
$$;

create or replace function admin_reassign_step(
  actor_id uuid,
  reason text,
  run_id uuid,
  step_id uuid,
  assignee_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  update steps set assignee_user_id = assignee_id where id = step_id;
  return rpc_append_audit_entry(
    'step_reassign',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'step_id', step_id, 'assignee_id', assignee_id),
    'step',
    step_id,
    tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id => on_behalf_of_org_id,
    subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    run_id => run_id,
    step_id => step_id
  );
end;
$$;

create or replace function admin_update_step_due_date(
  actor_id uuid,
  reason text,
  run_id uuid,
  step_id uuid,
  new_due_date text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  update steps set due_date = new_due_date::date where id = step_id;
  return rpc_append_audit_entry(
    'step_due_date_update',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'step_id', step_id, 'due_date', new_due_date),
    'step',
    step_id,
    tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id => on_behalf_of_org_id,
    subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    run_id => run_id,
    step_id => step_id
  );
end;
$$;

create or replace function admin_update_step_status(
  actor_id uuid,
  reason text,
  run_id uuid,
  step_id uuid,
  new_status text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  update steps set status = new_status where id = step_id;
  return rpc_append_audit_entry(
    'step_status_update',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'step_id', step_id, 'status', new_status),
    'step',
    step_id,
    tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id => on_behalf_of_org_id,
    subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    run_id => run_id,
    step_id => step_id
  );
end;
$$;

create or replace function admin_regenerate_document(
  actor_id uuid,
  reason text,
  run_id uuid,
  document_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return rpc_append_audit_entry(
    'document_regenerate',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'document_id', document_id),
    'document',
    document_id,
    tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id => on_behalf_of_org_id,
    subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    run_id => run_id
  );
end;
$$;

create or replace function admin_resend_run_digest(
  actor_id uuid,
  reason text,
  run_id uuid,
  recipient_email text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return rpc_append_audit_entry(
    'run_digest_resend',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'recipient_email', recipient_email),
    'workflow_run',
    run_id,
    tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id => on_behalf_of_org_id,
    subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    run_id => run_id
  );
end;
$$;

create or replace function admin_cancel_run(
  actor_id uuid,
  reason text,
  run_id uuid,
  second_actor_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return rpc_append_audit_entry(
    'run_cancel',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id),
    'workflow_run',
    run_id,
    true,
    second_actor_id,
    coalesce(tenant_org_id, v_tenant_org_id),
    coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id,
    coalesce(subject_org_id, v_subject_org_id),
    run_id
  );
end;
$$;

create or replace function admin_approve_freshness_diff(
  actor_id uuid,
  reason text,
  diff_id uuid,
  notes text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return rpc_append_audit_entry(
    'freshness_diff_approve',
    actor_id,
    reason,
    jsonb_build_object('diff_id', diff_id, 'notes', notes),
    tenant_org_id => tenant_org_id,
    actor_org_id => coalesce(actor_org_id, tenant_org_id),
    on_behalf_of_org_id => on_behalf_of_org_id,
    subject_org_id => subject_org_id
  );
end;
$$;

create or replace function admin_reject_freshness_diff(
  actor_id uuid,
  reason text,
  diff_id uuid,
  notes text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return rpc_append_audit_entry(
    'freshness_diff_reject',
    actor_id,
    reason,
    jsonb_build_object('diff_id', diff_id, 'notes', notes),
    tenant_org_id => tenant_org_id,
    actor_org_id => coalesce(actor_org_id, tenant_org_id),
    on_behalf_of_org_id => on_behalf_of_org_id,
    subject_org_id => subject_org_id
  );
end;
$$;

create or replace function admin_acknowledge_dsr(
  actor_id uuid,
  reason text,
  request_id uuid,
  notes text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_tenant_org_id is null then
    raise exception 'DSR request % not found', request_id;
  end if;

  return rpc_append_audit_entry(
    'dsr_acknowledge',
    actor_id,
    reason,
    jsonb_build_object('request_id', request_id, 'notes', notes),
    'dsr_request',
    request_id,
    tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id => coalesce(on_behalf_of_org_id, v_subject_org_id),
    subject_org_id => coalesce(subject_org_id, v_subject_org_id)
  );
end;
$$;

create or replace function admin_resolve_dsr(
  actor_id uuid,
  reason text,
  request_id uuid,
  resolution text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_tenant_org_id is null then
    raise exception 'DSR request % not found', request_id;
  end if;

  return rpc_append_audit_entry(
    'dsr_resolve',
    actor_id,
    reason,
    jsonb_build_object('request_id', request_id, 'resolution', resolution),
    'dsr_request',
    request_id,
    tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id => coalesce(on_behalf_of_org_id, v_subject_org_id),
    subject_org_id => coalesce(subject_org_id, v_subject_org_id)
  );
end;
$$;

create or replace function admin_export_dsr_bundle(
  actor_id uuid,
  reason text,
  request_id uuid,
  destination text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_tenant_org_id is null then
    raise exception 'DSR request % not found', request_id;
  end if;

  return rpc_append_audit_entry(
    'dsr_export',
    actor_id,
    reason,
    jsonb_build_object('request_id', request_id, 'destination', destination),
    'dsr_request',
    request_id,
    tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id => coalesce(on_behalf_of_org_id, v_subject_org_id),
    subject_org_id => coalesce(subject_org_id, v_subject_org_id)
  );
end;
$$;

create or replace function admin_toggle_legal_hold(
  actor_id uuid,
  reason text,
  request_id uuid,
  enabled boolean,
  second_actor_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_tenant_org_id is null then
    raise exception 'DSR request % not found', request_id;
  end if;

  return rpc_append_audit_entry(
    case when enabled then 'legal_hold_enable' else 'legal_hold_disable' end,
    actor_id,
    reason,
    jsonb_build_object('request_id', request_id, 'enabled', enabled),
    'dsr_request',
    request_id,
    enabled,
    second_actor_id,
    coalesce(tenant_org_id, v_tenant_org_id),
    coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    coalesce(on_behalf_of_org_id, v_subject_org_id),
    coalesce(subject_org_id, v_subject_org_id)
  );
end;
$$;

create or replace function admin_bind_secret_alias(
  actor_id uuid,
  reason text,
  org_id uuid,
  alias text,
  provider text,
  external_id text,
  description text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_binding_id uuid;
begin
  insert into tenant_secret_bindings(org_id, alias, provider, external_id, description)
  values(org_id, alias, provider, external_id, description)
  returning id into v_binding_id;

  return rpc_append_audit_entry(
    'secret_alias_bind',
    actor_id,
    reason,
    jsonb_build_object('binding_id', v_binding_id, 'org_id', org_id, 'alias', alias, 'provider', provider, 'external_id', external_id, 'description', description),
    'tenant_secret_binding',
    v_binding_id,
    tenant_org_id => coalesce(tenant_org_id, org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, org_id),
    on_behalf_of_org_id => coalesce(on_behalf_of_org_id, org_id),
    subject_org_id => coalesce(subject_org_id, org_id)
  );
end;
$$;

create or replace function admin_update_secret_alias(
  actor_id uuid,
  reason text,
  binding_id uuid,
  new_description text,
  new_external_id text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from tenant_secret_bindings where id = binding_id;

  if v_org_id is null then
    raise exception 'Secret binding % not found', binding_id;
  end if;

  update tenant_secret_bindings
  set description = coalesce(new_description, tenant_secret_bindings.description),
      external_id = coalesce(new_external_id, tenant_secret_bindings.external_id)
  where id = binding_id;

  return rpc_append_audit_entry(
    'secret_alias_update',
    actor_id,
    reason,
    jsonb_build_object('binding_id', binding_id, 'description', new_description, 'external_id', new_external_id),
    'tenant_secret_binding',
    binding_id,
    tenant_org_id => coalesce(tenant_org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_org_id),
    on_behalf_of_org_id => coalesce(on_behalf_of_org_id, v_org_id),
    subject_org_id => coalesce(subject_org_id, v_org_id)
  );
end;
$$;

create or replace function admin_remove_secret_alias(
  actor_id uuid,
  reason text,
  binding_id uuid,
  second_actor_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from tenant_secret_bindings where id = binding_id;

  if v_org_id is null then
    raise exception 'Secret binding % not found', binding_id;
  end if;

  delete from tenant_secret_bindings where id = binding_id;
  return rpc_append_audit_entry(
    'secret_alias_remove',
    actor_id,
    reason,
    jsonb_build_object('binding_id', binding_id),
    'tenant_secret_binding',
    binding_id,
    true,
    second_actor_id,
    coalesce(tenant_org_id, v_org_id),
    coalesce(actor_org_id, tenant_org_id, v_org_id),
    coalesce(on_behalf_of_org_id, v_org_id),
    coalesce(subject_org_id, v_org_id)
  );
end;
$$;

create or replace function admin_test_secret_alias(
  actor_id uuid,
  reason text,
  binding_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from tenant_secret_bindings where id = binding_id;

  if v_org_id is null then
    raise exception 'Secret binding % not found', binding_id;
  end if;

  return rpc_append_audit_entry(
    'secret_alias_test',
    actor_id,
    reason,
    jsonb_build_object('binding_id', binding_id),
    'tenant_secret_binding',
    binding_id,
    tenant_org_id => coalesce(tenant_org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_org_id),
    on_behalf_of_org_id => coalesce(on_behalf_of_org_id, v_org_id),
    subject_org_id => coalesce(subject_org_id, v_org_id)
  );
end;
$$;

create or replace function admin_temporal_signal(
  actor_id uuid,
  reason text,
  run_id uuid,
  signal text,
  payload jsonb,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return rpc_append_audit_entry(
    'temporal_signal',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'signal', signal, 'payload', payload),
    'workflow_run',
    run_id,
    tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id => on_behalf_of_org_id,
    subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    run_id => run_id
  );
end;
$$;

create or replace function admin_temporal_retry(
  actor_id uuid,
  reason text,
  run_id uuid,
  activity_id text,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return rpc_append_audit_entry(
    'temporal_retry',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'activity_id', activity_id),
    'workflow_run',
    run_id,
    tenant_org_id => coalesce(tenant_org_id, v_tenant_org_id),
    actor_org_id => coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id => on_behalf_of_org_id,
    subject_org_id => coalesce(subject_org_id, v_subject_org_id),
    run_id => run_id
  );
end;
$$;

create or replace function admin_temporal_cancel(
  actor_id uuid,
  reason text,
  run_id uuid,
  second_actor_id uuid,
  tenant_org_id uuid default null,
  actor_org_id uuid default null,
  on_behalf_of_org_id uuid default null,
  subject_org_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_org_id uuid;
  v_subject_org_id uuid;
begin
  select tenant_org_id, subject_org_id
    into v_tenant_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_tenant_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return rpc_append_audit_entry(
    'temporal_cancel',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id),
    'workflow_run',
    run_id,
    true,
    second_actor_id,
    coalesce(tenant_org_id, v_tenant_org_id),
    coalesce(actor_org_id, tenant_org_id, v_tenant_org_id),
    on_behalf_of_org_id,
    coalesce(subject_org_id, v_subject_org_id),
    run_id
  );
end;
$$;
