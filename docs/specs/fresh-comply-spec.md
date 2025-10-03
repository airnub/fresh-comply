# FreshComply — Consolidated Requirements & Spec (Full Update)

**Repo:** `@airnub/fresh-comply`
**Version:** 2025‑10‑03 (Full Update)
**Owner:** @airnub
**Status:** Source of truth for engineering, agents, compliance, and UX

> Supersedes all prior specs and blends every requirement agreed in this thread, plus high‑value non‑functional standards and operational guardrails. Links back to:
>
> * *Ireland Non‑Profit (CLG) A→Z Handbook — Setup & Operations (v2025‑10‑02)*
> * *Irish Non‑Profit Structures & Charity Registration — Quick Guide (v2025‑10‑02)*
> * *Live Workflow — Irish Non‑Profit Setup (Product Spec v2025‑10‑02)*
> * *@airnub/fresh‑comply — Coding Agent Prompt & Repo Scaffolding (v2025‑10‑02)*
> * *Follow‑on Coding Agent Prompt — i18n, Theme, A11y, GDPR (v2025‑10‑02)*

---

## 0) Mission & Outcomes

**Mission:** A self‑service, always‑current workflow platform that guides any Irish organisation (non‑profit and for‑profit) from **formation → operations → compliance**, powered by live verification (the **Freshness & Compliance Engine**), generated documents, and **shared visibility** between **Company A (advisor)** and **Company X (client)**.

**Outcomes:**

* A novice completes a CRO‑ready pack in **< 60 minutes**.
* Real‑time **status, assignments, deadlines** visible to both sides.
* Every legal assertion shows **source** + **Verified on {date}**.
* GDPR‑compliant handling with **DSR** flows (export, delete, etc.).

---

## 1) Scope & Non‑Goals

**Scope (Ireland, initial):** CLG (charity), CLG (non‑charity), LTD; guided filings + document packs; CRO/RBO/Charities/Revenue lookups; funding radar; adaptive policy pack.

**Non‑Goals (initial):** Direct e‑filing to CRO/RBO/Charities; multi‑jurisdiction; full grant authoring. (Future.)

---

## 2) Architecture (Authoritative)

* **Frontend:** Next.js 15 (App Router), **next‑intl** (i18n), Tailwind, **Radix UI primitives** + **shadcn/ui** components, Tiptap for doc previews.
* **Auth:** **Supabase Auth** with `@supabase/ssr` for SSR/session hydration; RLS‑backed multi‑tenant access; optional OAuth later.
* **Backend:** **Supabase Postgres** (+ RLS), **Supabase Storage** (docs), **Redis** (jobs/queues).
* **LLM:** OpenAI Responses API + tool calls (connectors, doc generation, rule checks).
* **Connectors:** CRO Open Services (read), data.gov.ie (Charities CKAN), Revenue/ROS (where feasible), RBO (guided), Pobal/LCDC/LAG feeds.
* **Freshness & Compliance Engine:** Source registry, watchers, moderation queue, versioned rules, **Re‑verify** endpoint.
* **Document Factory:** Handlebars/MDX → Markdown/PDF with signature blocks + checksums.
* **Notifications:** In‑app realtime + Email; digests & escalations; uniform UX.
* **Calendar:** ICS feed per organisation & per workflow run.

---

## 3) Multi‑Tenant & Engagement Model

**Use‑case:** **Company A (accountant)** sets up a non‑profit for **Company X (client)**. Both see the **same run** (status, steps, assignees, deadlines, docs, evidence, audit).

* **Entities:** User, Organisation, Membership, **Engagement** (Org A↔Org X), WorkflowDef, WorkflowRun, Step/Task, Document, Rule, Verification, Notification, AuditLog, CalendarEvent.
* **RLS:** A **WorkflowRun** belongs to **subject_org_id** (Company X) and is visible to its members and to members of **engager_org_id** (Company A) via an active **Engagement** scoped to that run.
* **Audit:** Log `{ actor_user_id, actor_org_id, on_behalf_of_org_id }` on every action.

---

## 4) Workflow DSL & Runtime

* **DSL:** YAML/JSON describing Questions → Branches → Steps (`question | info | action | upload | doc.generate | tool.call | verify | schedule | review`).
* **Rules:** Versioned objects with `logic`, `sources[]`, `last_verified_at`.
* **Runtime:** Materialises steps, enforces `requires`, emits Assignments, schedules CalendarEvents, renders Evidence badges.

**Example (abridged):**

```yaml
id: setup-nonprofit-ie-charity
version: 2025-10-02
steps:
  - id: cro-incorporation
    kind: action
    title: Incorporate CLG on CRO CORE
    requires: [two_directors, secretary, ppsn_or_vin, eea_director_or_s137_bond]
    verify: [{id: eea_director_present_or_s137_bond}, {id: rbo_deadline_5_months}]
  - id: rbo
    kind: action
    title: File RBO within 5 months
```

---

## 5) Legal & Operational Content (from prior docs)

* **Handbook & Quick Guide** bundled as user help.
* **Product Spec** defines flows, connectors, funding radar.
* **Coding Agent Prompt** defines monorepo & stubs.
* **Follow‑on Prompt** mandates i18n, theme, a11y, GDPR kit.

Integrated as:

* `packages/workflows/…` (flow definitions)
* `packages/doc-templates/…` (constitutions, minutes, policies)
* `docs/specs/fresh-comply-spec.md` (detailed)

---

## 6) Functional Requirements (Canonical)

1. **Onboarding** routes to correct path with minimal Q&A (charity/non‑charity/LTD; domain; funding; ops; directors).
2. **Timeline** & **Task Board** show phases, status, due dates, assignees; block steps until prerequisites verified.
3. **Evidence Drawer** shows rules with sources & **Re‑verify**.
4. **Doc Generation** outputs Markdown/PDF with signature blocks & checksums.
5. **Calendar** emits ICS feeds; reminders & escalations via Notifications.
6. **Act‑on‑behalf** flows let Company A progress tasks for Company X with audit.
7. **Funding Radar** surfaces relevant programmes/deadlines.
8. **i18n** (en‑IE, ga‑IE) with switcher and message fallbacks.
9. **Theme** Light/Dark/High‑Contrast without flicker; reduced motion.
10. **A11y** WCAG 2.2 AA baseline.
11. **GDPR kit** & DSR endpoints.

---

## 7) Internationalization (next‑intl) — Definitive

* **Locales:** `en‑IE`, `ga‑IE` (extensible).
* **Routing:** `/(locale)/…` via middleware negotiation (Accept‑Language → cookie → default `en‑IE`).
* **Messages:** ICU JSON per route segment stored at `apps/portal/messages/<locale>/…`; **code‑split**; fallback to default; **telemetry** fires on missing keys.
* **Locale Switcher:** accessible `<select>`; updates URL & cookie; persists per user.
* **Server locale:** use `unstable_setRequestLocale` to avoid hydration mismatches.
* **Formatting:** helpers for currency/dates/lists respecting locale/timezone.
* **Translation workflow:** Nightly **XLIFF v2** exports; Lokalise‑style review; **CI rejects** incomplete keys. Content Design owns tone/terminology glossary.
* **Translatable DSL:** workflow labels/notes expose `*_i18n` dictionaries.

**Acceptance:** critical screens operate in both locales with tests (unit + snapshot) and no layout shift.

---

## 8) Theme System — Definitive

* **Tokens:** CSS variables for color/space/radius/shadow in `packages/ui/tokens.css`; mapped to Tailwind theme.
* **Modes:** Light, Dark, **High‑Contrast**; server‑computed `data-theme` to prevent flicker; persist to **`fc_theme`** cookie + user profile.
* **Reduced motion:** respect `prefers-reduced-motion`.
* **Contrast:** body text ≥ **4.5:1**; High‑Contrast targets: surfaces ≥ **7:1**; accent text ≥ **4.5:1**.
* **Visual regression:** theme snapshots (Light/Dark/High‑Contrast) gate PRs.

---

## 9) UI Components & UX Baseline (Radix + shadcn/ui)

* **Primitives:** **Radix UI** for Dialog, Popover, Menu, Tabs, Toggle, Tooltip, Toast (ARIA patterns, focus trap, Esc handling).
* **Composites:** **shadcn/ui** wrappers; custom: *EvidenceDrawer*, *Timeline*, *TaskBoard*, *LocaleSwitcher*, *ThemeToggle*, *SkipLink*.
* **Focus & keyboard:** visible focus rings; logical tab order; `Skip to content`; semantic landmarks.
* **Forms:** label/description association; inline errors; live region for status.

**Accessibility (WCAG 2.2 AA) — operational details**

* **Testing:** `eslint-plugin-jsx-a11y`; automated checks with **axe** (Cypress/Playwright) and **Pa11y** in CI for home/run/board (both locales).
* **Manual audits:** once per release; **NVDA** + **VoiceOver** smoke tests.
* **Remediation SLAs:** P0 ≤ **48h**, P1 ≤ **7d**.
* **PDFs:** Tag PDFs with language/title/headings where feasible; **Accessible HTML** fallback.

---

## 10) Notifications — Consistent UX

**Channels:** In‑app (Radix Toast/Alert), Email; (optional Slack/Teams later).

**Patterns:**

* **Transactional toasts**: success/failure; auto‑dismiss; undo where safe.
* **Sticky banners**: run‑level warnings (e.g., “RBO deadline approaching”).
* **Inbox panel**: per‑user due/overdue list with quick‑assign.
* **Digests:** morning summary (today + next 7 days).
* **Escalations:** overdue → ping assignee + org admin; SLA per workflow version.
* **Copy style:** concise, action‑first; include subject org; link to task; minimal PII.
* **A11y:** polite live region; keyboard actionable; color not sole cue.

---

## 11) GDPR/EU Legal & Data Governance — Canonical

* **Roles:** Platform is **processor** for client content; may be **controller** for telemetry/support.
* **Lawful Bases:** Contract, Legal obligation, Legitimate interest, Consent (for non‑essential cookies/analytics).
* **Data Subject Rights (DSR):** `/api/dsr/*` intake for access/export/rectification/erasure/restriction/objection/portability; queue + SLA; confirmation emails.
* **DSR SLAs:** Acknowledge within **72h**; resolve within **30 days** (lawful extension possible).
* **Retention & Deletion:** soft‑delete → scheduled hard‑delete; policy tables per entity; user‑initiated exports (ZIP/JSON/CSV).
* **DPA:** standard processor DPA with annexes; **Subprocessors registry** & change‑notice policy; SCC annex placeholders.
* **Records:** `docs/LEGAL/ROPA.yaml` maintained; admin UI read‑only later.
* **Security:** TLS; encryption at rest; least‑privilege RBAC; admin action audit; secrets in vault; session via `@supabase/ssr`.
* **Breach Response:** `INCIDENT‑RESPONSE.md` (72‑hour flow).
* **Consent:** Cookie banner with categories; server‑gated scripts; consent stored in cookie + DB.
* **Public legal routes:** `/[locale]/privacy`, `/[locale]/terms`, `/[locale]/dpa` (downloadable), `/[locale]/subprocessors`, `/[locale]/cookies`.
* **Audit scope:** record admin actions **and** each DSR lifecycle event with actor + org context.

---

## 12) Supabase Auth with `@supabase/ssr` — Authoritative

* **Why:** SSR‑friendly sessions, seamless RLS, first‑class App Router.
* **Implementation:**

  * Server components: `createServerClient` from `@supabase/ssr`.
  * Middleware: read/write auth cookies; refresh tokens on server.
  * Map session → memberships → **effective permissions** (subject_org vs engager_org via Engagements).
  * Route guards server‑side; `withOrg` helper resolves acting org context.
  * **Impersonation prohibition:** no silent impersonation; explicit context switch banner.

---

## 13) Data Model (Summary)

Tables: organisations, users, memberships, engagements, workflow_defs, workflow_runs, steps, documents, rules, verifications, notifications, audit_log, calendar_events. (Drizzle/Kysely generate; see scaffolding SQL.)

---

## 14) Freshness & Compliance Engine (Detailed)

* **Source Registry:** canonical URLs/APIs (CRO Open Services; Revenue/ROS pages; Charities CKAN; Pobal/LCDC/LAG).
* **Watchers:** cron fetch → diff → **Impact Map** (rules/steps/templates affected) → human review → publish **workflow_def.version+1**.
* **UI:** every rule shows **Verified on {date}** + **Re‑verify**.
* **Audit:** verification events store source snapshot hashes.

---

## 15) Connectors (MVP Reality)

* **CRO Open Services (read):** name/status lookup; step helpers.
* **RBO:** guided filing; deadline calc; evidence capture.
* **Charities Register (CKAN):** dataset ingest; enrich steps; peer discovery.
* **Revenue/ROS:** cert‑based where feasible; else guided TR2 & eTax Clearance.
* **Funding Radar:** Pobal + county LCDC/LAG + sector bodies.

---

## 16) Testing & CI Gates

* **Type & lint:** strict TS; `eslint-plugin-jsx-a11y`.
* **i18n:** tests for negotiation & fallbacks; snapshots per locale.
* **A11y:** Pa11y + axe on home/run/board; keyboard e2e.
* **Contrast:** token checker for WCAG AA thresholds.
* **Build:** verify i18n code‑split; bundle size guard.
* **Security:** basic auth route tests; RLS verification queries in CI.
* **i18n completeness:** CI validates translation coverage; rejects missing or unreviewed keys; validates XLIFF exports.
* **Visual regression:** per‑theme snapshots (Light/Dark/High‑Contrast) on Timeline, TaskBoard, EvidenceDrawer.

---

## 17) Acceptance Criteria (Go‑Live)

* `pnpm dev` runs portal with demo **charity CLG** run; timeline + board + evidence visible.
* **Act on behalf** banner & audit entries when Company A advances tasks for Company X.
* **Docs** render to Markdown/PDF with signatures & checksums.
* **ICS** endpoint provides events; notifications send in‑app + email.
* **i18n** operational in `en‑IE` & `ga‑IE`; **Theme** Light/Dark/High‑Contrast without flicker.
* **A11y** checks pass (no critical axe/Pa11y issues); keyboard flows OK.
* **GDPR kit** present; DSR intake endpoints live; privacy/terms/subprocessors/cookies pages linked in footer.
* Spec, AGENTS.md, and ROADMAP updated; all prior docs linked as sources.

---

## 18) Roadmap (Delta over prior)

* **M1:** i18n, theme, A11y, Supabase SSR auth, notifications v1.
* **M2:** Freshness Engine v1 (watchers + moderation), Funding Radar v1, CKAN ingest.
* **M3:** ROS integrations (where possible), admin DSR queue UI, accessible HTML alt for PDFs, public read‑only progress pages.

---

## 19) Traceability Matrix (Prior docs → Spec sections)

| Prior Document                    | Incorporated Into                           |
| --------------------------------- | ------------------------------------------- |
| A→Z Handbook                      | Workflows content; doc‑templates; user help |
| Quick Guide                       | Onboarding hints; object templates          |
| Live Workflow Product Spec        | §§2–6, 14–16                                |
| Coding Agent Prompt & Scaffolding | Repo structure & data model §§2, 13         |
| Follow‑on Prompt (i18n/A11y/GDPR) | §§7–12, 16–17                               |

---

# High‑Value Non‑Functional Standards (New)

## 20) Operational SLOs & Environments

* **Environments:** `dev`, `staging`, `prod` with separate Supabase projects and storage buckets.
* **SLOs:** Availability 99.9% (prod), P95 page TTI < 2.5s (EU), P95 API latency < 300ms on cached reads.
* **Data residency:** All primary data in **EU region**; backups remain in EU.

## 21) Observability & Logging

* **Tracing:** OpenTelemetry; trace IDs across API → engine → DB.
* **Logs:** Structured JSON; redact PII; correlate with user/run IDs.
* **Metrics:** RPS, latency, error rates; workflow progression funnel; rule verification cadence.
* **Alerts:** On error spikes, failed watcher jobs, missed SLA (DSR, notifications).

## 22) Security & Threat Model

* **Standards:** OWASP ASVS L2 baseline; supply‑chain scanning (Snyk/GHAS), SAST/Dependabot.
* **Secrets:** Managed via environment vault; no secrets in git.
* **Rate limiting:** Per IP + per user; exponential backoff on auth & API.
* **Abuse prevention:** CAPTCHA challenge on suspicious patterns; email verification.
* **Pen‑tests:** Annual external + ad‑hoc for high‑risk changes.

## 23) Data Protection & Classification

* **Classes:** Public, Internal, Confidential (Client), Special Category (avoid storing; if unavoidable, DPIA required).
* **Backups:** Daily full, 7‑day point‑in‑time; **RPO 24h**, **RTO 8h**.
* **Data minimisation:** Collect only fields required for each filing/document.

## 24) Delivery & CI/CD

* **Branching:** trunk‑based with short‑lived PRs; conventional commits; semantic release for packages.
* **Pipelines:** lint → typecheck → unit → e2e → a11y → build → deploy (staging) → smoke → promote to prod.
* **Feature flags:** Configurable per environment; safe rollbacks.

## 25) Config & Feature Management

* **Config:** Twelve‑Factor; `.env` per env; runtime config surfaced via server components only.
* **Flags:** Gate early/incomplete features (e.g., ROS integration) and run A/B tests while respecting consent.

## 26) Browser & Device Support

* **Browsers:** Evergreen (Chrome/Edge/Firefox/Safari last 2); **no IE**.
* **Devices:** Responsive from 360px; target mobile PWA later.

## 27) API Surface (Internal)

* **REST endpoints:** `/api/reverify`, `/api/ics`, `/api/dsr/*`, `/api/consent`.
* **Engine APIs:** server‑only helpers to load DSL, materialise steps, run verifications.
* **Idempotency:** Require `Idempotency-Key` on mutating endpoints.

## 28) AI Safety & Guardrails

* **System prompts:** constrain output to structured JSON for engine actions.
* **PII controls:** never echo secrets; mask in logs; classify content; block uploads that violate policy.
* **Citations:** include source links for legal assertions; re‑verify button triggers fresh lookup.
* **Cost control:** token budgets per request; fallbacks to cached answers with visible timestamp.

## 29) OSS & Licensing

* **Licences:** Track all third‑party licences; avoid copyleft where incompatible; notice file included.
* **Attribution:** UI footer credits icons/fonts where required.

## 30) Design Governance

* **Design tokens:** single source in `packages/ui/tokens.css`.
* **Component audits:** quarterly a11y & contrast reviews; deprecate non‑compliant components.

## 31) Change Management for Workflows

* **Versioning:** `workflow_def.version` increments on any rule/step/template change.
* **Migration:** Existing runs retain old version; offer upgrade wizard when safe.
* **Changelog:** auto‑generated from moderation queue approvals.

---

## 32) KPIs (Operational)

* **Time to CRO‑ready pack:** < **60 minutes**.
* **RBO compliance:** % filing within **5 months**.
* **Tax readiness:** % achieving **eTax Clearance** within **30 days**.
* **Charity enablement:** % eligible charities granted **CHY** within **90 days** of Regulator approval.
* **Funding discovery:** Matched opportunities per org; grant success‑rate uplift.
* **Compliance hygiene:** Reduction in overdue filings/tasks QoQ.

---

**End of Consolidated Requirements & Spec (Full Update, 2025‑10‑03)**
*This is the single source of truth for engineering, agents, compliance, and UX.*
