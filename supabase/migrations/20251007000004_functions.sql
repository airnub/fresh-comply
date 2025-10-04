-- Auto-consolidated baseline (2025-10-04T14:42:43.526Z)
-- Functions

create or replace function public.normalize_domain(host text)
returns text
language sql
immutable
as $$
  select lower(split_part(trim(host), ':', 1));
$$;

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

CREATE OR REPLACE FUNCTION public.rpc_upsert_billing_price(
  p_stripe_price_id text,
  p_product_name text,
  p_nickname text DEFAULT NULL,
  p_unit_amount integer DEFAULT NULL,
  p_currency text,
  p_interval text DEFAULT NULL,
  p_interval_count integer DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS billing_prices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_price billing_prices;
BEGIN
  IF coalesce(trim(p_stripe_price_id), '') = '' THEN
    RAISE EXCEPTION 'Stripe price id is required' USING errcode = '23514';
  END IF;

  INSERT INTO billing_prices AS bp (
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
  VALUES (
    p_stripe_price_id,
    p_product_name,
    NULLIF(p_nickname, ''),
    p_unit_amount,
    p_currency,
    NULLIF(p_interval, ''),
    p_interval_count,
    COALESCE(p_is_active, true),
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  )
  ON CONFLICT (stripe_price_id) DO UPDATE
    SET product_name = EXCLUDED.product_name,
        nickname = EXCLUDED.nickname,
        unit_amount = EXCLUDED.unit_amount,
        currency = EXCLUDED.currency,
        interval = EXCLUDED.interval,
        interval_count = EXCLUDED.interval_count,
        is_active = EXCLUDED.is_active,
        metadata = EXCLUDED.metadata,
        updated_at = now()
  RETURNING * INTO v_price;

  RETURN v_price;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_billing_tenant(
  p_org_id uuid,
  p_stripe_customer_id text,
  p_billing_mode billing_tenant_mode DEFAULT 'direct',
  p_partner_org_id uuid DEFAULT NULL,
  p_default_price_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS billing_tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_tenant billing_tenants;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Tenant organisation id is required' USING errcode = '23514';
  END IF;

  PERFORM public.assert_tenant_membership(p_org_id);

  INSERT INTO billing_tenants AS bt (
    org_id,
    stripe_customer_id,
    billing_mode,
    partner_org_id,
    default_price_id,
    metadata,
    updated_at
  )
  VALUES (
    p_org_id,
    NULLIF(p_stripe_customer_id, ''),
    COALESCE(p_billing_mode, 'direct'),
    p_partner_org_id,
    NULLIF(p_default_price_id, ''),
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  )
  ON CONFLICT (org_id) DO UPDATE
    SET stripe_customer_id = EXCLUDED.stripe_customer_id,
        billing_mode = EXCLUDED.billing_mode,
        partner_org_id = EXCLUDED.partner_org_id,
        default_price_id = EXCLUDED.default_price_id,
        metadata = EXCLUDED.metadata,
        updated_at = now()
  RETURNING * INTO v_tenant;

  RETURN v_tenant;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_billing_subscription(
  p_org_id uuid,
  p_billing_tenant_id uuid DEFAULT NULL,
  p_stripe_subscription_id text,
  p_status billing_subscription_status,
  p_stripe_price_id text DEFAULT NULL,
  p_current_period_start timestamptz DEFAULT NULL,
  p_current_period_end timestamptz DEFAULT NULL,
  p_cancel_at timestamptz DEFAULT NULL,
  p_canceled_at timestamptz DEFAULT NULL,
  p_cancel_at_period_end boolean DEFAULT false,
  p_collection_method text DEFAULT NULL,
  p_latest_invoice_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS billing_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_subscription billing_subscriptions;
  v_billing_tenant_id uuid;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Tenant organisation id is required' USING errcode = '23514';
  END IF;

  IF coalesce(trim(p_stripe_subscription_id), '') = '' THEN
    RAISE EXCEPTION 'Stripe subscription id is required' USING errcode = '23514';
  END IF;

  PERFORM public.assert_tenant_membership(p_org_id);

  IF p_billing_tenant_id IS NOT NULL THEN
    v_billing_tenant_id := p_billing_tenant_id;
  ELSE
    SELECT id
      INTO v_billing_tenant_id
    FROM billing_tenants
    WHERE org_id = p_org_id
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  INSERT INTO billing_subscriptions AS bs (
    org_id,
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
  VALUES (
    p_org_id,
    v_billing_tenant_id,
    p_stripe_subscription_id,
    p_status,
    NULLIF(p_stripe_price_id, ''),
    p_current_period_start,
    p_current_period_end,
    p_cancel_at,
    p_canceled_at,
    COALESCE(p_cancel_at_period_end, false),
    NULLIF(p_collection_method, ''),
    NULLIF(p_latest_invoice_id, ''),
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE
    SET org_id = EXCLUDED.org_id,
        billing_tenant_id = EXCLUDED.billing_tenant_id,
        status = EXCLUDED.status,
        stripe_price_id = EXCLUDED.stripe_price_id,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at = EXCLUDED.cancel_at,
        canceled_at = EXCLUDED.canceled_at,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        collection_method = EXCLUDED.collection_method,
        latest_invoice_id = EXCLUDED.latest_invoice_id,
        metadata = EXCLUDED.metadata,
        updated_at = now()
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;

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
  new.tenant_id := coalesce(new.tenant_id, new.org_id);

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
        'org_id', new.org_id,
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
  where org_id = new.org_id
  order by inserted_at desc, created_at desc, id desc
  limit 1
  for update;

  if v_prev_hash is null then
    v_prev_hash := repeat('0', 64);
  end if;

  if new.prev_hash is null then
    new.prev_hash := v_prev_hash;
  elsif new.prev_hash <> v_prev_hash then
    raise exception 'Invalid prev_hash for tenant %', new.org_id;
  end if;

  new.row_hash := encode(
    digest(
      jsonb_build_object(
        'org_id', new.org_id,
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

create or replace function log_freshness_moderation_audit()
returns trigger
language plpgsql
as $$
begin
  insert into audit_log(
    org_id,
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
    org_id,
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

create or replace function app.__ensure_not_null(_table regclass, _column text) returns void
language plpgsql
as $$
declare
  v_has_null boolean;
begin
  execute format('select exists (select 1 from %s where %I is null)', _table, _column)
    into v_has_null;
  if coalesce(v_has_null, false) then
    raise exception '% has NULL %. Manual backfill required before applying migration.', _table::text, _column;
  end if;
end;
$$;

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
    or (
      payload ? 'is_platform_admin'
      and coalesce(
        case jsonb_typeof(payload->'is_platform_admin')
          when 'boolean' then (payload->'is_platform_admin')::boolean
          when 'string' then case
            when lower(nullif(payload->>'is_platform_admin', '')) in ('true', 'false')
              then (payload->>'is_platform_admin')::boolean
            else null
          end
          else null
        end,
        false
      )
    )
  from claims;
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  with claims as (
    select app.jwt() as payload
  )
  select case
    when payload ? 'org_id' then nullif(payload->>'org_id', '')::uuid
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

create or replace function app.is_direct_member(target_org_id uuid)
  returns boolean
  language plpgsql
  stable
as $$
declare
  subject uuid;
begin
  begin
    subject := (app.jwt()->>'sub')::uuid;
  exception when others then
    return false;
  end;

  if subject is null then
    return false;
  end if;

  return exists (
    select 1
    from public.org_memberships m
    where m.org_id = target_org_id
      and m.user_id = subject
  );
end;
$$;

create or replace function app.is_provider_admin_for(target_org_id uuid)
  returns boolean
  language plpgsql
  stable
as $$
declare
  subject uuid;
begin
  if target_org_id is null then
    return false;
  end if;

  begin
    subject := (app.jwt()->>'sub')::uuid;
  exception when others then
    return false;
  end;

  if subject is null then
    return false;
  end if;

  return exists (
    with recursive ancestors as (
      select o.id, o.parent_org_id, o.type
        from public.orgs o
       where o.id = target_org_id
      union all
      select parent.id, parent.parent_org_id, parent.type
        from public.orgs parent
        join ancestors child
          on child.parent_org_id = parent.id
    )
    select 1
      from ancestors a
      join public.orgs provider
        on provider.id = a.id
       and provider.type = 'provider'
      join public.org_memberships m
        on m.org_id = provider.id
       and m.user_id = subject
       and m.status = 'active'
       and m.role in ('provider_admin', 'org_admin')
  );
end;
$$;

create or replace function app.has_org_access(target_org_id uuid)
  returns boolean
  language plpgsql
  stable
as $$
begin
  if target_org_id is null then
    return app.is_platform_admin();
  end if;

  if app.is_platform_admin() then
    return true;
  end if;

  if app.is_direct_member(target_org_id) then
    return true;
  end if;

  if app.is_provider_admin_for(target_org_id) then
    return true;
  end if;

  return false;
end;
$$;

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

create or replace function public.rpc_upsert_billing_tenant(
  p_org_id uuid,
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
  if p_org_id is null then
    raise exception 'Tenant organisation id is required' using errcode = '23514';
  end if;

  perform public.assert_tenant_membership(p_org_id);

  insert into billing_tenants as bt (
    org_id,
    stripe_customer_id,
    billing_mode,
    partner_org_id,
    default_price_id,
    metadata,
    updated_at
  )
  values (
    p_org_id,
    p_stripe_customer_id,
    coalesce(p_billing_mode, 'direct'),
    p_partner_org_id,
    nullif(p_default_price_id, ''),
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (org_id) do update
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

create or replace function public.rpc_upsert_billing_subscription(
  p_org_id uuid,
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
  if p_org_id is null then
    raise exception 'Tenant organisation id is required' using errcode = '23514';
  end if;

  if coalesce(trim(p_stripe_subscription_id), '') = '' then
    raise exception 'Stripe subscription id is required' using errcode = '23514';
  end if;

  perform public.assert_tenant_membership(p_org_id);

  if p_billing_tenant_id is not null then
    v_billing_tenant_id := p_billing_tenant_id;
  else
    select id
      into v_billing_tenant_id
    from billing_tenants
    where org_id = p_org_id
    order by updated_at desc
    limit 1;
  end if;

  insert into billing_subscriptions as bs (
    org_id,
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
    p_org_id,
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
    set org_id = excluded.org_id,
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

create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
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
          public.current_org_id() is null
          or o.org_id = public.current_org_id()
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
          public.current_org_id() is null
          or wr.org_id = public.current_org_id()
        )
        and (
          (wr.engager_org_id is not null and public.is_member_of_org(wr.engager_org_id))
          or (wr.subject_org_id is not null and public.is_member_of_org(wr.subject_org_id))
          or (wr.subject_org_id is not null and public.jwt_has_org(wr.subject_org_id))
        )
    );
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
    raise exception 'org_id is required';
  end if;

  perform set_config('app.admin_actions_allow_update', 'on', true);

  for rec in
    select *
    from admin_actions
    where org_id = p_tenant_id
    order by inserted_at, created_at, id
  loop
    v_row_hash := encode(
      digest(
        jsonb_build_object(
          'org_id', rec.org_id,
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

create or replace function rpc_append_audit_entry(
  action text,
  actor_id uuid,
  reason_code text,
  payload jsonb default '{}'::jsonb,
  target_kind text default null,
  target_id uuid default null,
  requires_second boolean default false,
  second_actor_id uuid default null,
  org_id uuid default null,
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
  v_org_id uuid;
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

  v_org_id := coalesce(org_id, actor_org_id, on_behalf_of_org_id, subject_org_id);
  if v_org_id is null then
    raise exception 'org_id is required';
  end if;

  v_subject_org_id := subject_org_id;
  v_target_kind := coalesce(target_kind, case when run_id is not null then 'workflow_run' when step_id is not null then 'step' else null end);
  v_target_id := coalesce(target_id, case when v_target_kind = 'workflow_run' then run_id when v_target_kind = 'step' then step_id else null end);
  v_payload := coalesce(payload, '{}'::jsonb);

  insert into admin_actions(
    org_id,
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
    v_org_id,
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
    org_id,
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
    v_org_id,
    v_org_id,
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
    'org_id', v_org_id
  );
end;
$$;

create or replace function rpc_confirm_admin_action(
  action_id uuid,
  actor_id uuid,
  org_id uuid,
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

  if org_id is null then
    raise exception 'org_id is required';
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

  if v_action.org_id <> org_id then
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

  perform refresh_admin_actions_hash_chain(v_action.org_id);

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
    org_id,
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
    v_action.org_id,
    v_action.org_id,
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
  org_id uuid default null,
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
    org_id => org_id,
    actor_org_id => coalesce(actor_org_id, org_id),
    on_behalf_of_org_id => on_behalf_of_org_id
  );
end;
$$;

create or replace function admin_update_step_type(
  actor_id uuid,
  reason text,
  step_type_id uuid,
  patch jsonb,
  org_id uuid default null,
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
    org_id => org_id,
    actor_org_id => coalesce(actor_org_id, org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_org_id is null then
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
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_org_id is null then
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
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_org_id is null then
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
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return rpc_append_audit_entry(
    'document_regenerate',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'document_id', document_id),
    'document',
    document_id,
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return rpc_append_audit_entry(
    'run_digest_resend',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'recipient_email', recipient_email),
    'workflow_run',
    run_id,
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_org_id is null then
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
    coalesce(org_id, v_org_id),
    coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
    org_id => org_id,
    actor_org_id => coalesce(actor_org_id, org_id),
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
  org_id uuid default null,
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
    org_id => org_id,
    actor_org_id => coalesce(actor_org_id, org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_org_id is null then
    raise exception 'DSR request % not found', request_id;
  end if;

  return rpc_append_audit_entry(
    'dsr_acknowledge',
    actor_id,
    reason,
    jsonb_build_object('request_id', request_id, 'notes', notes),
    'dsr_request',
    request_id,
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_org_id is null then
    raise exception 'DSR request % not found', request_id;
  end if;

  return rpc_append_audit_entry(
    'dsr_resolve',
    actor_id,
    reason,
    jsonb_build_object('request_id', request_id, 'resolution', resolution),
    'dsr_request',
    request_id,
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_org_id is null then
    raise exception 'DSR request % not found', request_id;
  end if;

  return rpc_append_audit_entry(
    'dsr_export',
    actor_id,
    reason,
    jsonb_build_object('request_id', request_id, 'destination', destination),
    'dsr_request',
    request_id,
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from dsr_requests
  where id = request_id;

  if v_org_id is null then
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
    coalesce(org_id, v_org_id),
    coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
    org_id => coalesce(org_id, org_id),
    actor_org_id => coalesce(actor_org_id, org_id, org_id),
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
  org_id uuid default null,
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
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
    coalesce(org_id, v_org_id),
    coalesce(actor_org_id, org_id, v_org_id),
    coalesce(on_behalf_of_org_id, v_org_id),
    coalesce(subject_org_id, v_org_id)
  );
end;
$$;

create or replace function admin_test_secret_alias(
  actor_id uuid,
  reason text,
  binding_id uuid,
  org_id uuid default null,
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
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return rpc_append_audit_entry(
    'temporal_signal',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'signal', signal, 'payload', payload),
    'workflow_run',
    run_id,
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_org_id is null then
    raise exception 'Workflow run % not found', run_id;
  end if;

  return rpc_append_audit_entry(
    'temporal_retry',
    actor_id,
    reason,
    jsonb_build_object('run_id', run_id, 'activity_id', activity_id),
    'workflow_run',
    run_id,
    org_id => coalesce(org_id, v_org_id),
    actor_org_id => coalesce(actor_org_id, org_id, v_org_id),
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
  org_id uuid default null,
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
  v_subject_org_id uuid;
begin
  select org_id, subject_org_id
    into v_org_id, v_subject_org_id
  from workflow_runs
  where id = run_id;

  if v_org_id is null then
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
    coalesce(org_id, v_org_id),
    coalesce(actor_org_id, org_id, v_org_id),
    on_behalf_of_org_id,
    coalesce(subject_org_id, v_subject_org_id),
    run_id
  );
end;
$$;
