---
title: "Supabase workflow guide"
version: 0.1.0
status: Draft
---









> Adapted from the FreshComply database operations playbook.

FreshComply relies on Supabase for authentication, storage, and row-level security. This guide explains how to operate the local stack, keep environment variables in sync, and follow our conventions for schema changes.

## Local stack lifecycle

Start the local containers with the Supabase CLI whenever you need database access:

```bash
supabase start
```

The CLI bootstraps Postgres, the API gateway, Realtime, and Studio. Ports follow the Supabase defaults (REST on `54321`, Postgres on `54322`, Studio on `54323`) so they line up with our `.devcontainer/devcontainer.json` forwarding rules. If you customise ports, update `supabase/config.toml` and keep the Codespaces and local documentation in sync.

Stop or reset the stack when you need a clean slate:

```bash
supabase stop
supabase db reset
```

When you reset the database, re-run `pnpm db:env:local` so regenerated keys flow into every `.env.local` file.

## Environment variable sync

`pnpm db:env:local` calls `scripts/sync-supabase-env.mjs`. The script reads `supabase status --json`, extracts the REST URL and both API keys, and writes the following variables without touching unrelated secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Copy `.env.example` to `.env.local` at the repo root (and in each app) before you run the sync so non-Supabase values are present.

## Migrations and types

We store migrations under `supabase/migrations` and generate type definitions alongside the database package. Common workflows:

```bash
pnpm db:diff            # create a new migration against the local database
pnpm db:push            # apply migrations to a linked Supabase project
pnpm db:types           # emit types into packages/db/src/types.ts
pnpm db:reset:local     # restart the local containers and reset the database
```

The Supabase CLI writes generated SQL into `supabase/migrations/<timestamp>_name.sql`. Keep the folder committed so CI can validate the database guardrails.

## Row-level security pattern

Policies follow the tenant-aware pattern below. The example shows a `contact_leads` table where users can only see rows that match their organisation:

```sql
create policy "Contacts are tenant isolated"
  on contact_leads
  for select using (
    auth.uid() is not null
    and exists (
      select 1
      from tenant_memberships tm
      where tm.tenant_id = contact_leads.tenant_id
        and tm.user_id = auth.uid()
    )
  );
```

Use the helper `packages/db/check-rls.mjs` before opening a pull request to ensure every table remains protected.

## Troubleshooting

- **Containers keep old keys** — run `supabase stop && supabase start` and then `pnpm db:env:local`.
- **Port conflicts** — confirm no other process is using `54321`/`54322`/`54323`, or adjust `supabase/config.toml` to free ports and update `.devcontainer/devcontainer.json` accordingly.
- **Types are stale** — regenerate with `pnpm db:types` after applying migrations.

For Codespaces-specific behaviour, see the [Codespaces guide](../getting-started/codespaces.md). For app bootstrap steps, follow the [Local development guide](../getting-started/local-development.md).
