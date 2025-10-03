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
