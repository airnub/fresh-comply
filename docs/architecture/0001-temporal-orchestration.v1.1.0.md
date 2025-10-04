---
title: "ADR-0001: Temporal Orchestration (Custom UI, targeted use)"
version: 1.1.0
status: Stable
---








# ADR-0001: Temporal Orchestration (Custom UI, targeted use)

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

Adopt Temporal as the orchestration engine for short- and medium-lived workflow actions while keeping the FreshComply Next.js portal as the sole end-user interface. Temporal Web UI remains an operations-only tool.

## Context

FreshComply needs durable retries, human-in-the-loop coordination, and consistent state transitions for external actions such as CRO lookups, TR2 helper submissions via the internal bridge, ROS/eTax checks, and document packaging uploads. Existing cron/queue approaches provide limited visibility and cannot guarantee idempotent recovery when external systems fail or require human confirmation.

## Consequences

- Introduce a new package `@airnub/orchestrator-temporal` that hosts workflows, activities, and worker bootstrap code.
- Extend infrastructure with Temporal services in local `docker-compose` for developer parity and support Temporal Cloud (EU) or self-hosted clusters in production.
- Map orchestration metadata (`orchestration_provider`, `orchestration_workflow_id`, per-step `execution.mode`, and `orchestration_run_id`) onto `workflow_runs` and `steps` records.
- Provide Temporal-backed APIs for starting workflows, sending signals, and querying status while keeping the customer experience inside the custom UI.
