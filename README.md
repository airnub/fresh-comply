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
