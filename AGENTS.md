# AGENTS — @airnub/fresh-comply

**Purpose:** Orchestrate coding agents to keep this repo production-quality while generating workflows, connectors, documents, and admin tooling safely.

## Agents
- **Repo Architect** — monorepo/Turbo/pnpm, CI, DX.
- **Workflow Engineer** — DSL, engine logic, branching, overlays.
- **Freshness Steward** — sources registry, watchers, rule/version publishing.
- **Connector Builder** — CRO/CKAN/Revenue/RBO/Funding adapters.
- **Docs/Policy Writer** — templates and specs.
- **Compliance Doc Steward** — `docs/LEGAL/*`, GDPR/i18n/a11y, audits.

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

Consolidated Product Spec (v2025-10-03)
docs/specs/fresh-comply-spec.md

Admin App Spec (v2025-10-03)
docs/specs/admin-app-spec.md

Workflow-Agnostic Extension Model — Tenant Overlays (v2025-10-03)
docs/specs/extensions-tenant-overlays.md

White-Label Architecture (v2025-10-03)
docs/specs/fresh_comply_white_label_multi_tenant_architecture_v_2025_10_03.md

Secure Bidirectional Integration Architecture for Custom Steps (v2025-10-03)
docs/specs/integration-architecture-bidirectional.md

ADR-0001: Temporal Orchestration (Custom UI, targeted use)
docs/adr/0001-temporal-orchestration.md
ADR-0002: Stripe Billing Scaffold (White-Label Tenants)
docs/adr/0002-billing-stripe.md

ADR-0002: White-Label Multi-Tenant Architecture
docs/adr/0002-white-label-multi-tenant-architecture.md

Superseded / Archive

Live Workflow — Irish Non-Profit Setup (Product Spec) (v2025-10-02) — superseded by Consolidated Product Spec
docs/archive/2025-10-02-live-workflow-nonprofit-ie.md

See the full docs index at docs/README.md.
```

## Change Policy for Agents

Propose edits in the relevant spec first (PR with rationale).

If a spec materially replaces another, move the old one to docs/archive/ and update links here.

Code changes must point to the current canonical docs above.
