# FreshComply Monorepo

## Getting Started

### Local development quickstart

```bash
pnpm install
supabase start
pnpm db:env:local
pnpm dev
```

This spins up the local Supabase stack, syncs generated keys into `.env.local`, and starts the FreshComply portal and admin apps in parallel. See the [Local development guide](docs/getting-started/local-development.v0.1.0.md), [Codespaces guide](docs/getting-started/codespaces.v0.1.0.md), and [Supabase workflow guide](docs/guides/supabase.v0.1.0.md) for the full walkthrough and troubleshooting steps.

If you only need the portal, run `pnpm --filter ./apps/portal dev` instead of the aggregated `pnpm dev` task.

## Temporal Orchestration

Temporal powers short-lived, retryable workflow actions such as CRO lookups, document packaging, and Revenue bridge submissions. To run the full developer stack locally:

```bash
pnpm run dev:stack    # start Temporal + Postgres + optional UI
pnpm run dev:worker   # launch the Temporal worker bundle
pnpm dev              # start the Next.js portal
```

Before starting the worker, set `TEMPORAL_TENANT_QUEUE_ALLOW_LIST` in your `.env.local` to the comma-separated tenant IDs whose queues it should process (for example, `tenant-acme-main,tenant-umbrella-main`). Workers ignore any queues not present in this allow list even if workflows reference them.

The Temporal UI (http://localhost:8080) is provided for operations engineers only and should not be exposed to end users.

## Admin Runbook

```bash
pnpm run dev:stack     # temporal + deps (if needed)
pnpm run dev:worker    # temporal worker (if using Temporal features)
pnpm run dev:admin     # admin app on :3100
```

## Repository Audit

Generate a compliance-oriented snapshot of the monorepo's configuration, docs, and APIs:

```bash
pnpm audit
# or
pnpm tsx scripts/audit.ts
```

The command prints a summary table to the console and writes both JSON and Markdown reports under `reports/` with timestamped filenames.

## CI expectations

All pull requests run an automated workflow with required status checks for linting, type safety, unit tests, accessibility regressions (Cypress axe + pa11y), Temporal worker linting, database guards, and Markdown link hygiene. Configure the `main` branch protection rule in GitHub to require the following checks before merging:

- `Lint`
- `Typecheck`
- `Unit tests`
- `Accessibility`
- `Temporal worker lint`
- `Database policies`
- `Documentation links`

Run the same commands locally before opening a PR:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @airnub/portal build
pnpm --filter @airnub/portal start -- --hostname 0.0.0.0 --port 3000 &
PORTAL_PID=$!
pnpm --filter @airnub/portal test:a11y
pnpm --filter @airnub/portal test:pa11y
kill $PORTAL_PID
pnpm --filter @airnub/orchestrator-temporal lint
pnpm --filter @airnub/db run migrate --dry-run
node packages/db/check-rls.mjs
pnpm dlx lychee --no-progress --markdown --base . ./AGENTS.md './docs/**/*.md'
```

> [!NOTE]
> Installing [`lychee`](https://github.com/lycheeverse/lychee) via `pnpm dlx` keeps the Markdown link checker aligned with CI.

## Tenancy migration plan

All future tenancy work must be encoded as Supabase SQL migrations under `supabase/migrations`. The current rollout sequence is:

1. Provision the `public.orgs`, `public.org_memberships`, and `public.realms` tables.
2. Deploy helper functions inside the `app` schema (`jwt`, `is_platform_admin`, `is_direct_member`, `is_provider_admin_for`, `has_org_access`).
3. Create the `platform` schema, including rule catalog tables guarded by RLS that only allows `app.is_platform_admin()`.
4. Archive any legacy rows with `org_id IS NULL` into `platform.global_records` before enforcing `org_id uuid not null`.
5. Rename remaining `org_id` columns to `org_id`, backfill constraints, and re-apply the four-policy `app.has_org_access` template across tenant tables.

Whenever you add a migration, run the smoke suite locally to ensure governance rules stay intact:

```bash
pnpm test:rls-smoke
```

The script verifies helper definitions, RLS policy patterns, and ensures no client bundle writes to `platform.*` tables.
