---
title: "Local development"
version: 0.1.0
status: Draft
---









> Adapted from the FreshComply internal onboarding notes for Supabase-first projects.

FreshComply is a pnpm + Turborepo monorepo with multiple Next.js apps and a local Supabase stack. This guide walks through the prerequisites, common scripts, and the Quickstart workflow that mirrors our Codespaces experience.

## Prerequisites

- **Node.js 20.x LTS** — matches production and the default Docker images for our apps. The Codespaces devcontainer ships with Node 24; if you stay on 24 locally, install `corepack enable` and confirm `pnpm -v` matches the workspace version in `package.json`.
- **pnpm** — the workspace uses pnpm 10 (see the version pin in `package.json`).
- **Supabase CLI** — install from [the official instructions](https://supabase.com/docs/guides/cli) or via `pnpm dlx supabase@latest init`. The CLI must be able to talk to Docker.
- **Docker Desktop / Colima** — required for the Supabase stack.

After installing the prerequisites, clone the repo and make sure Docker is running.

## Quickstart

```bash
pnpm install
supabase start
pnpm db:env:local
pnpm dev
```

The commands do the following:

1. Install workspace dependencies and hydrate the pnpm store cache.
2. Launch the local Supabase stack defined by the CLI (Postgres, API, Studio, storage).
3. Sync Supabase-generated URLs and keys into `.env.local` files for the root, `apps/portal`, and `apps/admin` using `scripts/sync-supabase-env.mjs`.
4. Start all dev servers with Turborepo so both the portal and admin apps boot in parallel.

Use `CTRL+C` to stop the dev servers. The Supabase containers continue running in Docker until you run `supabase stop`.

## Running individual apps

The monorepo defines dev scripts per app. To run a single Next.js target, filter the command:

```bash
pnpm --filter ./apps/portal dev
# or
pnpm --filter ./apps/admin dev
```

The portal runs on `http://localhost:3000` and the admin app on `http://localhost:3001` by default. When you only need one surface, filtering reduces resource usage and hot reload noise.

## Useful scripts

| Script | Description |
| --- | --- |
| `pnpm db:env:local` | Read `supabase status --json` and write Supabase URLs and keys into `.env.local` files without overwriting other values. |
| `pnpm db:types` | Generate TypeScript definitions from the local Supabase schema into `packages/db/src/types.ts`. |
| `pnpm db:push` | Apply the current schema to your linked Supabase project. |
| `pnpm db:diff` | Create a migration diff against the local database into `supabase/migrations`. |
| `pnpm db:reset:local` | Restart the local stack and reset the database using Supabase CLI helpers. |
| `pnpm dev` | Run all app dev servers in parallel via Turborepo. |
| `pnpm --filter ./apps/portal lint` | Example of targeting workspace scripts for a specific app. |

## Environment variables

Copy `.env.example` to `.env.local` at the repo root and fill in any service credentials you need. The Supabase sync script updates only the keys it manages (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and their `NEXT_PUBLIC_*` variants) so you can safely keep other secrets side by side.

When running the Temporal worker locally, set `TEMPORAL_TENANT_QUEUE_ALLOW_LIST` to the comma-separated tenant IDs whose queues the worker should poll (for example, `tenant-acme-main,tenant-umbrella-main`). This prevents a dev worker from accidentally processing another tenant's tasks.

See the [Supabase guide](../guides/supabase.v0.1.0.md) for details on migrations, type generation, and policy patterns.
