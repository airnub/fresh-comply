-- Auto-consolidated baseline (2025-10-04T14:42:43.528Z)
-- Views & Materialized Views

create or replace view billing_subscription_overview as
select
  bt.org_id,
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

create or replace view v_step_types as
select
  st.id,
  st.slug,
  st.title,
  st.category,
  st.summary,
  st.latest_version,
  st.created_by,
  st.created_at,
  st.updated_at
from platform.step_types st;

create or replace view v_step_type_versions as
select
  stv.id,
  stv.step_type_id,
  st.slug as step_type_slug,
  stv.version,
  stv.definition,
  stv.input_schema_id,
  stv.output_schema_id,
  stv.status,
  stv.created_by,
  stv.created_at,
  stv.published_at
from platform.step_type_versions stv
join platform.step_types st on st.id = stv.step_type_id;

-- Tenant facing view
create or replace view public.rule_catalogs_public as
  select c.slug,
         c.title,
         c.description,
         coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'code', r.code,
           'summary', r.summary,
           'body', r.body
         ) order by r.code) filter (where r.id is not null), '[]'::jsonb) as rules
  from platform.rule_catalogs c
  left join platform.rules r on r.catalog_id = c.id
  group by c.id;
