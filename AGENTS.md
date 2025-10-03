# AGENTS — @airnub/fresh-comply

**Purpose:** Orchestrate coding agents to keep this repo production-quality while generating workflows, connectors, and documents safely.

## Agents

* **Repo Architect** — owns monorepo structure, Turbo/pnpm, CI, DX.
* **Workflow Engineer** — authors DSL, engine logic, branching.
* **Freshness Steward** — maintains sources registry, watchers, and rule versions.
* **Connector Builder** — implements CRO/CKAN/Revenue/RBO/Funding adapters.
* **Docs/Policy Writer** — maintains templates and specs.
* **Compliance Doc Steward** — curates `docs/LEGAL/*`, ensures GDPR/i18n/a11y spec fidelity, and coordinates audits.

## Tools & Conventions

* Language: TypeScript (Node 20+), Next.js 15, pnpm + Turborepo.
* Store workflows under `packages/workflows/`. Engine under `packages/engine/`.
* Every legal assertion must have a **source link**; use `packages/freshness`.
* Supabase RLS for multi-tenant security.

## Runbook

```bash
pnpm i
pnpm dev      # start portal
pnpm build
```

## Specs

See **[Fresh-Comply Product Spec](docs/specs/fresh-comply-spec.md)** for architecture, data model, DSL, i18n/theme/a11y/GDPR plans, and roadmap. Legal templates live in **[`docs/LEGAL/`](docs/LEGAL/)**.
