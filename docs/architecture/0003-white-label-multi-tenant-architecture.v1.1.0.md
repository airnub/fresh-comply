---
title: "ADR-0003: White-Label Multi-Tenant Architecture"
version: 1.1.0
status: Stable
---








# ADR-0003: White-Label Multi-Tenant Architecture

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

## Decision

Adopt a white-label delivery model that allows partner organisations to operate branded FreshComply portals for their clients while platform administrators maintain a hardened back-office. The platform remains a single Next.js deployment backed by Supabase and Temporal, but isolates data, branding, orchestration queues, and integrations per tenant.

## Context

Partners such as accounting firms want to offer FreshComply under their own brand without sacrificing compliance guarantees or exposing other tenant data. The existing portal already supports overlays and shared workflow definitions, yet lacked domain-level branding, tenant-specific routing, and a clear separation of partner and platform responsibilities. We also need to preserve audit trails that show when partners act on behalf of client organisations and maintain secure ingress/egress for tenant-specific integrations.

## Consequences

- Introduce explicit tenant hierarchy (`platform → partner → client`) with Supabase RLS enforcing row ownership via `org_id` and `subject_org_id`.
- Add per-tenant configuration for branding, documents, and outbound communications, including custom domains, DKIM/SPF verification, and PDF/email theming.
- Route Temporal workflows through tenant-specific task queues (`tenant-{id}-main`) and tag spans/logs with tenant metadata for observability.
- Manage external integrations via tenant-scoped secret aliases and hardened webhook ingress that verifies HMAC signatures, timestamps, and replay protection.
- Deliver partner-facing admin surfaces for branding, domains, client management, overlays, and billing while operating a separate platform-admin app for global moderation and ops.
- Support partner- and client-billed monetisation options via Stripe Connect and surface subscription state in tenant records.

## References

- [White-Label Multi-Tenant Architecture Spec (v2025-10-03)](../specs/white-label-architecture.v1.0.0.md)
- [Secure Bidirectional Integration Architecture (v2025-10-03)](../specs/integration-architecture-bidirectional.v1.0.0.md)
- [ADR-0001: Temporal Orchestration](0001-temporal-orchestration.md)
