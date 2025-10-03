---
id: codespaces
title: GitHub Codespaces
sidebar_label: Codespaces
description: Develop FreshComply inside the maintained GitHub Codespaces devcontainer.
---

> Adapted from the FreshComply GitHub Codespaces runbook.

Our `.devcontainer` folder defines the GitHub Codespaces image for FreshComply. It installs the Supabase CLI, pnpm, and Node.js, and configures port forwarding for the portal, admin app, and Supabase services so you can prototype without touching your local Docker daemon.

## What the devcontainer provides

- **Node.js 24 with pnpm 10** (via `ghcr.io/devcontainers/features/node`). You can still target Node 20 in production; the workspace tooling is tested on both.
- **Supabase CLI** installed during the `post-create` hook.
- **pnpm store caching** and workspace bootstrapping via `pnpm -w fetch` and `pnpm -w install --frozen-lockfile`.
- **Forwarded ports** for web apps and Supabase services:
  - `3000` — Portal app (`apps/portal`)
  - `3001` — Admin app (`apps/admin`)
  - `54321` — Supabase REST API
  - `54322` — Supabase Postgres (psql/debugging)
  - `54323` — Supabase Studio
  - `8233` — Temporal Web UI (optional; start via `pnpm dev:stack` locally if needed)

## First boot checklist

1. The post-create script installs dependencies and the Supabase CLI. Open a new terminal once it completes.
2. Copy the environment example files:
   ```bash
   cp .env.example .env.local
   cp apps/portal/.env.example apps/portal/.env.local 2>/dev/null || true
   cp apps/admin/.env.example apps/admin/.env.local 2>/dev/null || true
   ```
   Only populate the secrets you need; Supabase keys will be synced automatically.
3. Start the Supabase stack (the devcontainer keeps `AUTO_START_SUPABASE=false` so you control when Docker spins up):
   ```bash
   supabase start
   ```
4. Sync environment variables into every `.env.local` file:
   ```bash
   pnpm db:env:local
   ```
5. Launch the dev servers:
   ```bash
   pnpm dev
   ```

You can now open the forwarded ports from the Codespaces Ports panel. GitHub will prompt you to open the portal and admin apps in the browser the first time traffic flows.

## Day-to-day workflows

- **Restart Supabase** if you change configuration or need a clean slate:
  ```bash
  supabase stop || true
  supabase start
  pnpm db:env:local
  ```
- **Update dependencies** after pulling new code:
  ```bash
  pnpm -w install --frozen-lockfile
  ```
- **Filter apps** the same way as local development: `pnpm --filter ./apps/portal dev`.

## Troubleshooting tips

- If the Supabase containers fail to start, verify Docker-in-Docker is healthy with `docker ps`. Codespaces may require a rebuild after enabling the Docker feature the first time.
- When port forwarding stalls, use the Ports panel to mark the service as `Public` temporarily, then revert to `Private` once the tunnel restarts.
- For stubborn env sync issues, delete the generated `.env.local` files and re-run `pnpm db:env:local` after confirming `supabase status --json` shows `RUNNING` for the API.

Refer to the [Local development guide](./local-development.md) and the [Supabase guide](../guides/supabase.md) for additional context on migrations, RLS policies, and CLI tooling.
