# FreshComply — Product Spec (v2025-10-02)

## Purpose
A self-service, always-current workflow platform for setting up and operating Irish organisations (non-profit & for-profit), with verifiable rules, shared visibility (Company A acting for Company X), and generated documents/policies.

## Architecture
- Next.js 15 (App Router) portal; Shadcn/Tailwind; Tiptap for docs.
- Supabase Postgres + Storage; Redis for jobs.
- Workflow DSL (YAML/JSON) → Engine runtime.
- Freshness & Compliance Engine: sources registry, watchers, versioned rules, re-verify.
- Connectors: CRO Open Services (read), Charities Register (CKAN), Revenue/ROS (where feasible), RBO (guided), Funding Radar.
- Document factory: Handlebars/MDX → Markdown/PDF.
- Notifications: in-app, email; digests & escalations.

## Data Model (core tables)
Organisations, Users, Memberships, Engagements, WorkflowDefs, WorkflowRuns, Steps, Documents, Verifications, Notifications, AuditLog, CalendarEvents.

## DSL (abridged)
Node kinds: `question|info|action|upload|doc.generate|tool.call|verify|schedule|review`.
Rules reference source links and store `last_verified_at`.

## Security
- Supabase auth via `@supabase/ssr`:
  - Middleware (`apps/portal/src/middleware.ts`) uses `createMiddlewareClient` to refresh sessions and redirect unauthenticated users to `/auth/sign-in` while preserving locale routing.
  - Server components load the active profile through `getActiveUserProfile`, and dedicated `/auth/sign-in`, `/auth/callback`, and `/auth/sign-out` routes handle magic-link OTP sign-in and global sign-out.
- Row-level security (RLS):
  - `packages/db/schema.sql` enables RLS on `organisations`, `users`, `memberships`, `engagements`, `workflow_defs`, `workflow_runs`, `steps`, `documents`, and `audit_log` with tenant-aware policies that only allow members of engager or subject organisations (or the service role) to read/write records.
  - Helper SQL functions (`is_member_of_org`, `can_access_run`) centralise membership checks for policies.
  - Automated guard: `pnpm --filter @airnub/db run verify:rls` fails if required `alter table ... enable row level security` statements, policies, or helper functions are missing from the schema.
- Audit log entries capture `actor_org_id` and `on_behalf_of_org_id` so cross-tenant actions remain traceable under RLS constraints.

## UX
Timeline with phases; Task Board; Evidence Drawer with sources & Re-verify; Doc previews; Calendar tab.

## Compliance & Freshness
- Every assertion has sources; inline badges show "Verified on {date}".
- Watchers (cron) monitor CKAN datasets, CRO/Revenue pages; changes → moderation → publish new workflow version.

## Internationalization
- Locales: `en-IE` (default) and `ga-IE`, with fallbacks to `en-IE` for missing keys. Locale-specific content is routed via `/(locale)/…` segments and negotiated via middleware using `Accept-Language`, persisted cookies, and user profile preferences.
- Messages: ICU-formatted JSON bundles stored per route segment under `apps/portal/messages/<locale>/`. Supports plurals, selects, and date/number formatting through shared utilities in `@airnub/utils`.
- Workflow & docs: Workflow metadata, notifications, and document templates expose `*_i18n` dictionaries to allow localized titles, descriptions, and body copy. Missing translations display the default locale string with a telemetry event.
- Translation workflow: Phrase-based exports (XLIFF v2) generated nightly; translators work in Lokalise-equivalent pipeline with review + QA; CI rejects incomplete keys. Content designers own tone & terminology glossary.
- Content negotiation: Locale switcher updates the URL, cookie, and profile. Server renders respect `unstable_setRequestLocale` to avoid hydration mismatches.

## Theme & Design Tokens
- Tokens: CSS variables defined in `@airnub/ui/tokens.css` derive semantic palettes (`--color-surface`, `--color-accent`) mapped to Tailwind config. Separate bundles for light, dark, and high-contrast themes.
- Persistence: `ThemeProvider` resolves theme server-side from cookie (`fc_theme`) or user profile with system fallback, injecting `data-theme` and `color-scheme` attributes to prevent flash of incorrect styles.
- Motion: Animation tokens gate transitions; respect `prefers-reduced-motion` via `data-motion="reduced"` and runtime checks.
- High contrast: Dedicated palette with ≥7:1 contrast for core surfaces and ≥4.5:1 for accent text; outlines enlarged for focus rings.
- Components: UI kit consumes tokens via design system utilities; docs include visual regression fixtures per theme.

## Accessibility (WCAG 2.2 AA)
- Keyboard: Global skip link, visible focus indicators, logical tab order, no keyboard traps. Modals/dialogs rely on accessible primitives with managed focus.
- Testing: `eslint-plugin-jsx-a11y`, axe (via Cypress), and Pa11y CI enforce automated compliance. Manual audits scheduled each release, including screen reader smoke tests (NVDA/VoiceOver).
- Content: Semantic landmarks (`header`, `main`, `nav`, `footer`), ARIA labels where needed, descriptive link text, live regions for async status.
- PDFs: Generated PDFs tagged with document language, title, and heading structure. Provide accessible HTML alternative download link if tagging is incomplete.
- Documentation: Accessibility playbook stored in docs with remediation SLAs (P0 ≤ 48h, P1 ≤ 7d).

## GDPR & EU Legal Readiness
- Roles & bases: Portal acts as processor for client-submitted data and controller for telemetry/support. Lawful bases mapped per processing purpose (contract, legal obligation, legitimate interest, consent) in legal docs.
- Data subject rights: `/api/dsr/*` endpoints intake access, rectification, erasure, restriction, objection, and portability requests. Requests logged, triaged in queue with 30-day SLA and 72h acknowledgement.
- Data lifecycle: Retention schedule documented per entity with soft-delete to hard-delete jobs. RoPA (`docs/LEGAL/ROPA.yaml`) records processing contexts and subprocessors.
- Contracts & notices: Privacy notice, Terms, processor DPA (with SCC annex), and subprocessor change policy published under `/privacy`, `/terms`, `/dpa`, `/subprocessors`, `/cookies` routes.
- Security & incident response: Audit log records administrative actions and DSR events. Incident response guide defines severity tiers and 72-hour breach notification workflow.

## Initial Workflows
- IE Non-Profit CLG (charity) — full path CRO→RBO→Revenue→Charities→CHY→Donations/VAT Comp.
- IE Non-Profit CLG (non-charity) — CRO→RBO→Revenue→banking→policies.
- IE LTD (for-profit) — CRO→RBO→Revenue (CT/PAYE/VAT)→policies.

## KPIs
Time to CRO-ready pack (<60m); RBO within 5 months; eTax Clearance within 30 days; CHY within 90 days; grant matches; overdue compliance reduction.
