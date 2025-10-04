---
title: "ADR-0002: Stripe Billing Scaffold for White-Label Tenants"
version: 1.1.0
status: Stable
---








# ADR-0002: Stripe Billing Scaffold for White-Label Tenants

## Schema roles: public, app, platform

- public → tenant-owned data (org_id NOT NULL, RLS tenant/provider/platform patterns).
- app → helper functions/RPCs/claims; no tables with tenant/global data.
- platform → global catalogs; admin-only writes; tenants read via views/RPCs.

## Practical recommendation & scaffolding

Practical recommendation
Keep app for functions; add platform for global tables.
Your earlier design used app.is_platform_admin() and other helpers—those should stay in app. Create platform.* for global state.

Minimal SQL scaffolding (safe defaults):

-- helpers stay here
create schema if not exists app;

-- global data lives here
create schema if not exists platform;

-- example global catalog
create table if not exists platform.rule_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  spec jsonb not null,
  published_at timestamptz not null default now(),
  unique(name, version)
);

-- RLS: admin-only writes; tenants read via a view
alter table platform.rule_packs enable row level security;

create policy admin_read_rule_packs on platform.rule_packs
  for select using (app.is_platform_admin());

create policy admin_write_rule_packs on platform.rule_packs
  for all using (app.is_platform_admin())
  with check (app.is_platform_admin());

-- tenant-facing read-only view (optional)
create or replace view public.v_rule_packs as
  select id, name, version, spec, published_at
  from platform.rule_packs;

Client/server rule of thumb

Browser/client: never write to platform.*; read via public.v_* or server RPCs.

Admin app/server: can write platform.* using service role or a server-minted JWT with role=platform_admin.



- **Status:** Accepted
- **Date:** 2025-10-03
- **Related Specs:**
  - [FreshComply White-Label Multi-Tenant Architecture](../specs/white-label-architecture.v1.0.0.md)
  - [Billing Scaffold Requirements & Task Breakdown](../specs/coding_agent_prompt_link_agents.md)

## Decision

Adopt Stripe as the canonical billing partner for FreshComply and implement a Supabase-aligned mirror of core Stripe subscription data. The system will persist tenant, subscription, price, and invoice state inside Supabase, ingest updates through Stripe webhooks, and expose secure views for both partner-led and client-direct billing scenarios.

## Context

FreshComply must support white-label tenants where billing can either flow through partners (the partner is the merchant of record) or directly to end clients with optional revenue-share back to the partner. EU VAT calculation and invoicing has to be handled centrally, while involuntary churn (e.g., failed renewals or payment method expiry) needs actionable signals inside the admin portal. Existing product specs call for Stripe Connect-powered partner billing and a Supabase-first data model so that workflow rules, reporting, and RLS policies all operate on the same persisted billing state.

## Consequences

- Create Supabase Postgres tables (`billing_tenants`, `billing_subscriptions`, `billing_prices`, `billing_invoices`, and related enums/status fields) plus triggers or background jobs that upsert from webhook payloads to keep Stripe and Supabase synchronized.
- Add a Stripe webhook handler service (deployed alongside the Next.js API routes) responsible for verifying signatures, routing event types, and invoking Supabase server-side functions that encapsulate all write access.
- Store Stripe keys, Connect client IDs, and webhook secrets using Supabase Secrets aliases so that environment-specific credentials can be rotated without code changes.
- Publish RLS-safe database views/functions (`billing_subscription_overview`, `billing_partner_rollups`) that the portal and reporting layers can query without exposing raw Stripe tokens.
- Extend tenant provisioning workflows to create Stripe customers/subscriptions per billing mode and persist references in `billing_tenants` so churn handling and VAT compliance tasks can reference a single source of truth.

## Open Questions & Follow-Ups

- Confirm whether partner-led billing requires Stripe Connect Standard or Express accounts for payout management, and document the onboarding UX implications.
- Decide how EU VAT rates and evidence storage integrate with existing compliance datasets (shared `tax_rates` table vs. Stripe Tax exclusive usage).
- Define the exact lifecycle hooks for involuntary churn notifications (e.g., Temporal workflow vs. Supabase trigger) and how retries escalate to humans.
- Implement the `billing_*` migrations, Supabase functions, webhook handler, and initial read-only billing UI as tracked in the billing scaffold milestones.
