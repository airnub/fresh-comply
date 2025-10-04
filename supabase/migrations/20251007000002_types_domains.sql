-- Auto-consolidated baseline (2025-10-04T14:42:43.525Z)
-- Types & Domains

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
