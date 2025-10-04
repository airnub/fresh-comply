-- Stripe billing scaffold: tables, enums, RLS, and RPC helpers

-- Create enums if they do not already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_tenant_mode') THEN
    CREATE TYPE billing_tenant_mode AS ENUM ('direct', 'partner_managed');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_subscription_status') THEN
    CREATE TYPE billing_subscription_status AS ENUM (
      'trialing',
      'active',
      'incomplete',
      'incomplete_expired',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS billing_prices (
  stripe_price_id text PRIMARY KEY,
  product_name text NOT NULL,
  nickname text,
  unit_amount integer,
  currency text NOT NULL,
  interval text,
  interval_count integer,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  billing_mode billing_tenant_mode NOT NULL DEFAULT 'direct',
  partner_org_id uuid REFERENCES organisations(id),
  default_price_id text REFERENCES billing_prices(stripe_price_id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_tenants_tenant_unique UNIQUE (org_id)
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  billing_tenant_id uuid REFERENCES billing_tenants(id) ON DELETE SET NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  status billing_subscription_status NOT NULL,
  stripe_price_id text REFERENCES billing_prices(stripe_price_id),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  collection_method text,
  latest_invoice_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_tenants_tenant_idx ON billing_tenants(org_id);
CREATE INDEX IF NOT EXISTS billing_subscriptions_tenant_idx ON billing_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS billing_subscriptions_status_idx ON billing_subscriptions(status);
CREATE INDEX IF NOT EXISTS billing_prices_active_idx ON billing_prices(is_active);

ALTER TABLE billing_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role manages billing prices" ON billing_prices
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Authenticated read billing prices" ON billing_prices
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
  );

CREATE POLICY IF NOT EXISTS "Service role manages billing tenants" ON billing_tenants
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Tenant members read billing tenants" ON billing_tenants
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR public.is_member_of_org(org_id)
  );

CREATE POLICY IF NOT EXISTS "Service role manages billing subscriptions" ON billing_subscriptions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Tenant members read billing subscriptions" ON billing_subscriptions
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR public.is_member_of_org(org_id)
  );

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

GRANT EXECUTE ON FUNCTION public.rpc_upsert_billing_price(
  text,
  text,
  text,
  integer,
  text,
  text,
  integer,
  boolean,
  jsonb
) TO authenticated, service_role;

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

GRANT EXECUTE ON FUNCTION public.rpc_upsert_billing_tenant(
  uuid,
  text,
  billing_tenant_mode,
  uuid,
  text,
  jsonb
) TO authenticated, service_role;

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

GRANT EXECUTE ON FUNCTION public.rpc_upsert_billing_subscription(
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
) TO authenticated, service_role;

CREATE OR REPLACE VIEW billing_subscription_overview AS
SELECT
  bt.org_id,
  bt.billing_mode,
  bt.stripe_customer_id,
  bt.partner_org_id,
  bt.default_price_id,
  bt.metadata AS tenant_metadata,
  bt.updated_at AS tenant_updated_at,
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
  bs.metadata AS subscription_metadata,
  bs.updated_at AS subscription_updated_at,
  bp.product_name,
  bp.nickname,
  bp.unit_amount,
  bp.currency,
  bp.interval,
  bp.interval_count,
  bp.is_active AS price_active,
  bp.metadata AS price_metadata,
  bp.updated_at AS price_updated_at
FROM billing_tenants bt
LEFT JOIN billing_subscriptions bs ON bs.billing_tenant_id = bt.id
LEFT JOIN billing_prices bp ON bp.stripe_price_id = COALESCE(bs.stripe_price_id, bt.default_price_id);

GRANT SELECT ON billing_subscription_overview TO authenticated, service_role;
