# FreshComply Monorepo

## Getting Started

```bash
pnpm i
pnpm dev
```

This starts the FreshComply portal with demo data, including a workflow run that showcases the timeline, task board, and evidence drawer views.

## Temporal Orchestration

Temporal powers short-lived, retryable workflow actions such as CRO lookups, document packaging, and Revenue bridge submissions. To run the full developer stack locally:

```bash
pnpm run dev:stack    # start Temporal + Postgres + optional UI
pnpm run dev:worker   # launch the Temporal worker bundle
pnpm dev              # start the Next.js portal
```

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
