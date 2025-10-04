---
title: "Secure Bidirectional Integration Architecture for Custom Steps (v2025-10-03)"
version: 1.1.0
status: Stable
---








# Secure Bidirectional Integration Architecture for Custom Steps (v2025-10-03)

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


**Status:** Canonical (stub placeholder)

This file is the canonical location for the secure bidirectional integration architecture supporting custom workflow steps in FreshComply. Populate with the latest agreed content.

> TODO: Document integration flows, security controls, and operational guidelines.
