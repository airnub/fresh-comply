# AGENTS — @airnub/fresh-comply

**Purpose:** Orchestrate coding agents to keep this repo production-quality while generating workflows, connectors, documents, and admin tooling safely.

## Agents
- **Repo Architect** — monorepo/Turbo/pnpm, CI, DX.
- **Workflow Engineer** — DSL, engine logic, branching, overlays.
- **Freshness Steward** — sources registry, watchers, rule/version publishing.
- **Connector Builder** — CRO/CKAN/Revenue/RBO/Funding adapters.
- **Docs/Policy Writer** — templates and specs.
- **Compliance Doc Steward** — `docs/compliance/*`, GDPR/i18n/a11y, audits.

## Tools & Conventions
- TypeScript, Next.js 15, pnpm + Turborepo.
- Workflows under `packages/workflows/`; engine under `packages/engine/`.
- Every legal assertion must have a **source link**; use `packages/freshness`.
- Supabase RLS for multi-tenant security.

## Runbook
```bash
pnpm i
pnpm dev       # start portal
pnpm build

Documentation (Source of Truth)
Current (Canonical)

Consolidated Architecture & Tenancy Spec (v2025-10-04)
docs/specs/freshcomply-consolidated-spec.v1.0.0.md

Admin App Spec (v2025-10-03)
docs/specs/admin-app-spec.v1.0.0.md

Workflow-Agnostic Extension Model — Tenant Overlays (v2025-10-03)
docs/specs/extensions-tenant-overlays.v1.0.0.md

White-Label Architecture (v2025-10-03)
docs/specs/white-label-architecture.v1.0.0.md

Secure Bidirectional Integration Architecture for Custom Steps (v2025-10-03)
docs/specs/integration-architecture-bidirectional.v1.0.0.md

ADR-0001: Temporal Orchestration (Custom UI, targeted use)
docs/architecture/0001-temporal-orchestration.v1.0.0.md
ADR-0002: Stripe Billing Scaffold (White-Label Tenants)
docs/architecture/0002-billing-stripe.v1.0.0.md

ADR-0003: White-Label Multi-Tenant Architecture
docs/architecture/0003-white-label-multi-tenant-architecture.v1.0.0.md

Superseded / Archive

Live Workflow — Irish Non-Profit Setup (Product Spec) (v2025-10-02) — superseded by Consolidated Product Spec
docs/archive/2025-10-02-live-workflow-nonprofit-ie.md

See the full docs index at docs/INDEX.md.
```

## Change Policy for Agents

Propose edits in the relevant spec first (PR with rationale).

If a spec materially replaces another, move the old one to docs/archive/ and update links here.

Code changes must point to the current canonical docs above.
