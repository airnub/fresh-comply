# FreshComply — Consolidated Requirements & Spec

**Repo:** `@airnub/fresh-comply`
**Version:** 2025‑10‑03
**Owner:** @airnub
**Purpose:** Canonical specification that unifies **all requirements and docs** produced in this conversation and defines authoritative build standards for the FreshComply platform.

> This spec supersedes and references prior docs:
>
> * *Ireland Non‑Profit (CLG) A→Z Handbook — Setup & Operations (v2025‑10‑02)*
> * *Irish Non‑Profit Structures & Charity Registration — Quick Guide (v2025‑10‑02)*
> * *Live Workflow — Irish Non‑Profit Setup (Product Spec v2025‑10‑02)*
> * *@airnub/fresh‑comply — Coding Agent Prompt & Repo Scaffolding (v2025‑10‑02)*
> * *Follow‑on Coding Agent Prompt — i18n, Theme, A11y, GDPR (v2025‑10‑02)*

---

## 0) Mission & Outcomes

* **Mission:** Deliver a self‑service, always‑current workflow platform that guides any Irish organisation (non‑profit and for‑profit) from **formation to compliance**, with live verification (“Freshness & Compliance Engine”), generated documents, and shared visibility between **Company A (advisor)** and **Company X (client)**.
* **Outcomes:**

  * A novice can complete a CRO‑ready pack in **< 60 minutes**.
  * Real‑time **status, assignments, deadlines** shared across organisations.
  * Every legal assertion shows a **source** and a **Verified on {date}** badge.
  * GDPR‑compliant data handling with **DSR** (data subject rights) flows.

---

## 1) Scope & Non‑Goals

**In‑scope (initial):** Ireland jurisdiction (CLG charity / CLG non‑charity / LTD).  Guided filings + document packs; CRO/RBO/Charities/Revenue lookups; funding radar.

**Non‑goals (initial):** Direct e‑filing to CRO/RBO/Charities; universal grant authoring; multi‑jurisdiction (to follow).

---

## 2) Architecture (authoritative)

* **Frontend:** Next.js 15 (App Router), **next‑intl** (i18n), **Tailwind**, **Radix UI primitives** + **shadcn/ui components** (see §9), **Tiptap** for doc previews.
* **Auth:** **Supabase Auth** with `@supabase/ssr` for SSR/session hydration; RLS‑backed multi‑tenant access; optional OAuth later.
* **Backend:** **Supabase Postgres** (+ RLS), **Supabase Storage** (docs), **Redis** (jobs/queues).
* **LLM:** OpenAI Responses API + tool calls (connectors, doc generation, rule checks).
* **Connectors:** CRO Open Services (read), data.gov.ie (Charities Register CKAN), Revenue/ROS (where feasible), RBO (guided), Pobal/LCDC/LAG feeds.
* **Freshness & Compliance Engine:** Source registry, watchers, moderation queue, versioned rules, **Re‑verify** endpoint.
* **Document Factory:** Handlebars/MDX → Markdown/PDF with signature blocks + checksums.
* **Notifications:** In‑app realtime + Email; digests & escalations; uniform UX (see §10).
* **Calendar:** ICS feed per organisation & per workflow run.

---

## 3) Multi‑Tenant & Engagement Model

**Use‑case:** **Company A (accountant)** sets up a non‑profit for **Company X (client)**. Both sides see **the same run**: status, steps, assignees, deadlines, docs, evidence, audit.

* **Entities:** User, Organisation, Membership, **Engagement** (Org A↔Org X), WorkflowDef, WorkflowRun, Step/Task, Document, Rule, Verification, Notification, AuditLog, CalendarEvent.
* **RLS policy:** A **WorkflowRun** is owned by **subject_org_id** (Company X) and is visible to its members and to Engagement members of **engager_org_id** (Company A) when Engagement is **active** and scoped to the run.
* **Audit:** All actions record `{ actor_user_id, actor_org_id, on_behalf_of_org_id }`.

---

## 4) Workflow DSL & Runtime

* **DSL:** YAML/JSON describing Questions → Branches → Steps (`question | info | action | upload | doc.generate | tool.call | verify | schedule | review`).
* **Rules:** Versioned objects with logic, sources[], `last_verified_at`.
* **Runtime:** Materialise steps, enforce `requires`, emit Assignments, schedule CalendarEvents, render Evidence badges.

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

* **Handbook & Quick Guide** shipped as user‑facing references.
* **Product Spec** (live workflow) drives engine features, connectors, and funding radar.
* **Coding Agent Prompt & Scaffolding** defines monorepo structure and initial stubs.
* **Follow‑on Prompt** mandates i18n, theme, accessibility, GDPR kit.

These are integrated as:

* `packages/workflows/…` (flow definitions)
* `packages/doc-templates/…` (constitution seeds, minutes, policy stubs)
* `docs/specs/fresh-comply-spec.md` (expanded per §7–§12)

---

## 6) Functional Requirements (canonical)

1. **Onboarding** asks minimal questions to route to the correct path (charity/non‑charity/LTD; domain; funding; operations; directors).
2. **Timeline** & **Task Board** show phases, status, due dates, assignees; block steps until prerequisites verified.
3. **Evidence Drawer** displays rules with sources & **Re‑verify**.
4. **Doc Generation** outputs Markdown/PDF with signature blocks & checksums.
5. **Calendar** issues ICS feeds; reminders & escalations via Notifications.
6. **Act‑on‑behalf** flows enable Company A to progress tasks for Company X with full audit.
7. **Funding Radar** surfaces relevant programmes and deadlines.
8. **i18n** routes & translations (en‑IE, ga‑IE) with switcher.
9. **Theme** toggle (Light/Dark/High‑Contrast) SSR‑safe; reduced‑motion respect.
10. **A11y** WCAG 2.2 AA baseline (see §9).
11. **GDPR kit** & DSR endpoints (see §11).

---

## 7) Internationalization (next‑intl) — Definitive

* **Locales:** `en‑IE`, `ga‑IE` (extensible).
* **Routing:** `/(locale)/…` via middleware negotiation (Accept‑Language → cookie → default `en‑IE`).
* **Messages:** ICU JSON per route; code‑split; fallback to default.
* **Locale Switcher:** accessible `<select>`; updates URL & cookie; persists per user.
* **Formatting:** helpers for currency, dates, and lists respecting locale/timezone.
* **Translatable DSL:** workflow labels/notes allow per‑locale strings.

**Acceptance:** critical screens operate in both locales with tests (unit + snapshot) and no layout shift.

---

## 8) Theme System — Definitive

* **Tokens:** CSS variables for color/space/radius/shadow in `packages/ui/tokens.css`; mapped to Tailwind theme.
* **Modes:** Light, Dark, **High‑Contrast**; server‑computed `data-theme` to prevent flicker; persist to cookie + user profile.
* **Reduced motion:** respect `prefers-reduced-motion`.
* **Contrast:** minimum AA (4.5:1) on body text; lint & CI contrast check.

---

## 9) UI Components & UX Baseline (Radix + shadcn/ui)

* **Primitives:** **Radix UI** for Dialog, Popover, Menu, Tabs, Toggle, Tooltip, Toast (with ARIA patterns, focus trap, Esc handling).
* **Composites:** **shadcn/ui** wrappers for speed and consistency; extended to include *EvidenceDrawer*, *Timeline*, *TaskBoard*, *LocaleSwitcher*, *ThemeToggle*, *SkipLink*.
* **Focus & keyboard:** visible focus rings; logical tab order; `Skip to content` link; semantic landmarks.
* **Forms:** label/description association; inline errors; live region for status.

---

## 10) Notifications — Consistent UX

**Channels:** In‑app (Radix Toast/Alert), Email; (optional Slack/Teams webhooks later).

**Patterns:**

* **Transactional toasts** for quick success/failed actions; auto‑dismiss, with undo where safe.
* **Sticky banners** for run‑level warnings (e.g., “RBO deadline approaching”).
* **Inbox panel** (per user) listing due/overdue tasks with quick‑assign.
* **Digests:** morning summary (today + next 7 days).
* **Escalations:** overdue → ping assignee + org admin; configurable SLA per workflow version.
* **Copy style:** concise, action‑first; include subject org; link to task; no PII beyond necessity.
* **A11y:** toasts announce via polite live region; actionable via keyboard; color not sole carrier of meaning.

---

## 11) GDPR/EU Legal & Data Governance — Canonical

* **Roles:** Platform acts as **processor** for client content; may be **controller** for product analytics & service operations (documented in Privacy Notice).
* **Lawful Bases:** Contract (service delivery), Legal obligation (compliance), Legitimate interest (security/fraud), Consent (non‑essential cookies/analytics).
* **Data Subject Rights (DSR):** `/api/dsr/*` intake for access/export/rectification/erasure/restriction/objection/portability; queue + SLA; confirmation emails.
* **Retention & Deletion:** soft‑delete → scheduled hard‑delete; policy tables per entity; user‑initiated exports (ZIP/JSON/CSV).
* **DPA:** standard processor DPA with annexes; **Subprocessors registry** & change‑notice policy; SCC annex placeholders.
* **Records:** `docs/LEGAL/ROPA.yaml` maintained; admin UI read‑only later.
* **Security:** TLS; encryption at rest; least‑privilege RBAC; admin action audit; secrets in vault; session via `@supabase/ssr`.
* **Breach Response:** defined in `INCIDENT‑RESPONSE.md` (72‑hour notification flow).
* **Consent:** Cookie banner with categories; server‑gated scripts; consent stored in cookie + DB.

---

## 12) Supabase Auth with `@supabase/ssr` — Authoritative

* **Why:** SSR‑friendly sessions, seamless RLS, and first‑class Next.js App Router integration.
* **Implementation:**

  * Create client in server components using `createServerClient` from `@supabase/ssr`.
  * Read/write auth cookies in middleware; refresh tokens on server.
  * Map session → memberships → **effective permissions** (subject_org vs engager_org via Engagements).
  * Guard routes server‑side; add `withOrg` helper to resolve acting org context.
  * **Impersonation prohibition:** no silent impersonation; require explicit context switch with banner.

---

## 13) Data Model (summary)

Tables: organisations, users, memberships, engagements, workflow_defs, workflow_runs, steps, documents, rules, verifications, notifications, audit_log, calendar_events. (See scaffolding SQL; generated via Drizzle/Kysely later.)

---

## 14) Freshness & Compliance Engine (detailed)

* **Source Registry:** canonical URLs/APIs (CRO Open Services; Revenue/ROS pages; Charities CKAN; Pobal/LCDC/LAG).
* **Watchers:** cron jobs fetch → diff; on change produce **Impact Map** (rules/steps/templates affected); human review; publish **workflow_def.version+1**.
* **UI:** Every rule shows **Verified on {date}** + **Re‑verify** button.
* **Audit:** store verification events with source snapshot hashes.

---

## 15) Connectors (MVP reality)

* **CRO Open Services (read)** — name/status lookup; incorporate into step helpers.
* **RBO** — guided filing, deadline calc, evidence capture.
* **Charities Register (CKAN)** — ingest dataset; enrich charity steps; peer discovery.
* **Revenue/ROS** — cert‑based where feasible; else guided TR2 & eTax Clearance.
* **Funding Radar** — Pobal + county LCDC/LAG + sector bodies.

---

## 16) Testing & CI Gates

* **Type & lint:** strict TS; `eslint-plugin-jsx-a11y`.
* **i18n:** unit tests for negotiation & fallbacks; snapshot major screens per locale.
* **A11y:** Pa11y + axe on home, run, board; keyboard e2e.
* **Contrast:** token checker script for WCAG AA thresholds.
* **Build:** ensure i18n message code‑split; bundle size guard.
* **Security:** basic auth route tests; RLS verification queries in CI.

---

## 17) Acceptance Criteria (go‑live)

* `pnpm dev` runs portal with demo **charity CLG** run; timeline + board + evidence visible.
* **Act on behalf** banner & audit entries when Company A advances tasks for Company X.
* **Docs** render to Markdown/PDF with signatures & checksums.
* **ICS** endpoint provides events; notifications send in‑app + email.
* **i18n** operational in `en‑IE` & `ga‑IE`; **Theme** Light/Dark/High‑Contrast without flicker.
* **A11y** checks pass (no critical axe/Pa11y issues); keyboard flows OK.
* **GDPR kit** present; DSR intake endpoints live; privacy/terms/subprocessors/cookies pages linked in footer.
* Spec, AGENTS.md, and ROADMAP updated; all prior docs linked as sources.

---

## 18) Roadmap (delta over prior)

* **M1**: i18n, theme, A11y, Supabase SSR auth, notifications v1.
* **M2**: Freshness Engine v1 (watchers + moderation), Funding Radar v1, CKAN ingest.
* **M3**: ROS integrations (where possible), admin DSR queue UI, accessible HTML alt for PDFs, public read‑only progress pages.

---

## 19) Traceability Matrix (prior docs → spec sections)

| Prior Document                    | Incorporated Into                           |
| --------------------------------- | ------------------------------------------- |
| A→Z Handbook                      | Workflows content; doc‑templates; user help |
| Quick Guide                       | Onboarding hints; object templates          |
| Live Workflow Product Spec        | §§2–6, 14–16                                |
| Coding Agent Prompt & Scaffolding | Repo structure & data model §§2, 13         |
| Follow‑on Prompt (i18n/A11y/GDPR) | §§7–12, 16–17                               |

---

**End of Consolidated Spec (v2025‑10‑03).**
*This is the single source of truth for engineering, agents, and compliance reviewers.*

---

## 20) Operational A→Z Workflow (Implementation‑Ready)

**Status:** Canonical, implementation‑ready version of the end‑to‑end **Irish non‑profit** workflow you provided. This section converts the narrative checklist into **explicit steps with IDs**, required inputs, outputs, verification rules, deadlines, and connectors. Builders should treat this as the *source of truth* for the initial non‑profit flows in `packages/workflows/`.

> **Currency note:** Authored for Ireland as of **02 Oct 2025 (Europe/Dublin)**. The **Freshness & Compliance Engine** must re‑verify rules and links.

### 20.1 Phases & Steps (Do‑This‑Then‑That)

**Phase A — Form the company**

1. **choose‑legal‑form** — Decide legal structure (default: **CLG without share capital**).
   *Inputs:* org intent, activity domain(s).  *Outputs:* form type.  *Verify:* charity intent → use charity‑friendly clauses.  *Sources:* Citizens Information.
2. **name‑and‑constitution** — Check name availability on CRO CORE; draft **CLG constitution** with charity‑friendly clauses (objects; income & property; winding‑up).
   *Inputs:* candidate name; objects; clauses.  *Outputs:* constitution file.  *Verify:* charity‑compliant wording present.  *Sources:* Arts Council model; Law Society note.
3. **cro‑incorporation** — Create CORE account; file **Form A1** + constitution. Ensure **director PPSN** or **VIN (VIF)** and **EEA‑resident director** or **S137 bond**.
   *Inputs:* directors/secretary, PPSN/VIN, bond if needed.  *Outputs:* CRO number; ARD.  *Verify:* `eea_director_present_or_s137_bond`; `director_identity_ok`.  *Deadline:* ARD tracking begins.  *Sources:* CRO; PPSN/VIN notice.
4. **rbo‑initial‑filing** — Register **beneficial owners** with **RBO** within **5 months** of incorporation.
   *Inputs:* beneficial owner data.  *Outputs:* RBO submission receipt.  *Verify:* `rbo_deadline_5_months`.  *Sources:* RBO.

**Phase B — Revenue & banking**

5. **open‑bank‑account** — Board minute + IDs; open community/non‑profit account.
   *Outputs:* account details; mandate.  *Sources:* sector guidance.
6. **revenue‑registrations‑tr2** — Submit **TR2** (CT mandatory; PAYE if hiring; VAT if required).
   *Outputs:* tax reg numbers.  *Verify:* CT present; PAYE/VAT per answers.  *Sources:* Revenue.
7. **ros‑access‑and‑etax** — Acquire **RAN**, install **ROS digital certificate**, obtain **eTax Clearance** when eligible.
   *Outputs:* ROS cert; Tax Clearance.  *Verify:* business tax registration exists.  *Sources:* Revenue/ROS.

**Phase C — Charity status & reliefs (if applicable)**

8. **charity‑registration** — Apply on **Charities Regulator** portal (exclusively charitable purposes; public benefit). Use **Regulator‑approved constitution**.
   *Outputs:* Charity Reg. Number.  *Verify:* purposes/public benefit; objects match.  *Sources:* Citizens Information; Regulator.
9. **revenue‑chy‑exemption** — Apply for **charitable tax exemption (CHY)** once registered.
   *Outputs:* CHY number.  *Verify:* approved constitution on file.  *Sources:* Revenue.
10. **donation‑scheme‑enablement** — Implement **CHY3/CHY4**; 31% specified rate gross‑up on €250+ annual individual gifts; **2‑year waiting period removed from 01 Jan 2025**.
    *Outputs:* donor flow docs; forms.  *Verify:* CHY active.  *Sources:* Revenue.
11. **vat‑compensation‑scheme** — Claim eligible VAT **Jan–Jun** each year for prior calendar year; overall **€10m** State cap (pro‑rata).
    *Outputs:* ROS claim pack.  *Verify:* non‑public funding proportion; deadlines.  *Sources:* Revenue.

**Phase D — Always‑on compliance**

12. **governance‑policies** — Adopt **Charities Governance Code** practices; Financial Controls; Conflicts; GDPR; Safeguarding (if relevant); Fundraising policy.
    *Outputs:* approved policy pack.  *Verify:* safeguarding only if relevant services; GDPR DPIA where needed.  *Sources:* Regulator; DPC; Tusla.
13. **accounting‑and‑reporting** — Maintain minutes; registers; accounts; CRO financial statements obligations; audit where required.
    *Outputs:* accounts; directors’ report.  *Verify:* exemptions; ARD schedule.  *Sources:* CRO guidance.
14. **payroll‑rtí** — If employing, register PAYE; run RTI payroll via **ROS**.
    *Outputs:* payroll submissions.  *Sources:* Revenue.
15. **calendar‑and‑notifications** — Track CRO B1 by ARD; RBO changes; Charities annual return; VAT Comp window; grant deadlines.
    *Outputs:* ICS + reminders + escalations.  *Verify:* SLAs configured.
16. **lobbying‑register** — If communicating with DPOs about policy/law/funding, register and file returns on **lobbying.ie**.
    *Outputs:* lobbying returns.  *Sources:* Standards in Public Office.

### 20.2 Printable Minimal Checklist (mirrors steps)

* Decide CLG; draft constitution (charity‑ready).
* Line up 2+ directors + secretary; ensure EEA director or S137 bond; confirm PPSN/VIN.
* Incorporate on CORE (A1 + constitution) → get CRO number; note ARD.
* Within **5 months**, file **RBO**.
* Open bank account (constitution + CRO docs + IDs + minute).
* Register taxes via **TR2** (CT mandatory; PAYE/VAT as needed).
* Get **ROS** access (RAN → cert) and **eTax Clearance** (if eligible).
* If charity path: apply to **Charities Regulator** → then **CHY** with Revenue.
* Enable **CHY3/CHY4** donations at 31%; claim **VAT Compensation** Jan–Jun for prior year.
* Adopt policies; track filings; keep minutes/registers/accounts.
* Register/report lobbying if in scope.

### 20.3 DSL Mapping (initial IDs)

```
setup-nonprofit-ie-charity (or -noncharity)
  - choose-legal-form (question/info)
  - name-and-constitution (doc.generate | verify)
  - cro-incorporation (action | verify)
  - rbo-initial-filing (action | schedule)
  - open-bank-account (action | doc.generate)
  - revenue-registrations-tr2 (action)
  - ros-access-and-etax (action | verify)
  - charity-registration (branch: charity==true)
  - revenue-chy-exemption (branch: charity==true)
  - donation-scheme-enablement (branch: charity==true)
  - vat-compensation-scheme (branch: charity==true)
  - governance-policies (doc.generate)
  - accounting-and-reporting (info | schedule)
  - payroll-rti (branch: employs_staff==true)
  - calendar-and-notifications (schedule)
  - lobbying-register (branch: lobbying==true)
```

### 20.4 Inputs, Outputs, Verify & Deadlines (snapshot)

| Step ID                    | Required Inputs                                           | Output/Artifact         | Verify Rules                                                 | Deadline                        |
| -------------------------- | --------------------------------------------------------- | ----------------------- | ------------------------------------------------------------ | ------------------------------- |
| cro-incorporation          | Directors, Secretary, PPSN/VIN, EEA director or S137 bond | CRO no., ARD            | `eea_director_present_or_s137_bond`, `director_identity_ok`  | ARD set                         |
| rbo-initial-filing         | Beneficial owners                                         | RBO receipt             | `rbo_deadline_5_months`                                      | **5 months** post‑incorporation |
| revenue-registrations-tr2  | Trading intent, employees, VAT thresholds                 | TR2 submitted           | `ct_registered`, conditional `paye_registered`, `vat_needed` | Asap after CRO                  |
| ros-access-and-etax        | Tax reg active                                            | ROS cert, Tax Clearance | `business_tax_present`                                       | Before grant apps               |
| donation-scheme-enablement | CHY active                                                | CHY3/CHY4 process live  | `chy_active`, `donation_forms_ready`                         | Ongoing                         |
| vat-compensation-scheme    | Non‑public income %, VAT invoices                         | ROS claim               | `vat_comp_eligibility`, `claim_window_open`                  | **Jan–Jun** each year           |

### 20.5 Appendices Mapping

* **Funding & grants:** seed **Funding Radar** with Pobal, DRCD LEP, CSP, LEADER (LAGs), Rethink Ireland, sector bodies (Arts Council, Sport Ireland, local authorities).
* **Compliance calendar:** pre‑seed ICS with ARD/B1, RBO, ROS payroll, Charities annual return, VAT Comp Jan–Jun, grant milestones.
* **Templates:** CLG constitution (charity‑ready), board minutes (A1, bank), policy pack (Financial Controls, GDPR, Safeguarding), CHY3/CHY4.

---

## 21) KPIs (Operational)

* **Time to CRO‑ready pack**: < **60 minutes** (novice baseline).
* **RBO compliance**: % of new companies filing within **5 months**.
* **Tax readiness**: % achieving **eTax Clearance** within **30 days** of incorporation.
* **Charity enablement**: % eligible charities granted **CHY** within **90 days** of Regulator approval.
* **Funding discovery**: matched opportunities per org; grant success rate uplift.
* **Compliance hygiene**: reduction in overdue filings/tasks quarter‑over‑quarter.
