# Follow‑on Coding Agent Prompt — Add i18n (next‑intl), Theme Toggle, Accessibility, and GDPR/EU SaaS Legal Readiness

**Repo:** @airnub/fresh-comply  
**Date:** 2025‑10‑02  
**Owner:** @airnub  
**Goal:** Update the **specs and codebase** to provide full **internationalization** (next‑intl), **light/dark theme toggle** with high‑contrast options, **WCAG 2.2 AA accessibility**, and **GDPR/EU SaaS legal readiness** (Ireland/EU baseline) suitable for an accounting‑adjacent workflow platform.

> This prompt instructs the coding agent to (1) modify docs/specs, (2) scaffold code, (3) add tests and CI hooks, and (4) produce legal templates & data‑governance assets.

---

## ✅ Objectives & Acceptance Criteria

### Objectives
1) **Internationalization** with **next‑intl** using App Router: routing at `/(locale)/…`, middleware‑based locale detection, ICU messages, pluralization, date/number formatting, language negotiation, fallbacks, and content model support for localized strings.
2) **Theme system**: system‑aware light/dark toggle with persistent user preference (cookie + profile), SSR‑safe (no hydration flash), **high‑contrast** variant, and reduced‑motion support.
3) **Accessibility**: WCAG 2.2 **AA** baseline: keyboard navigation, focus management, roles/ARIA patterns, color‑contrast ≥ 4.5:1 where applicable, skip links, semantic landmarks, accessible PDFs, form validation.
4) **GDPR/EU SaaS legal readiness**: add baseline legal and data‑governance documentation, data‑subject rights workflows, audit logging policy, data retention and deletion, incident response, DPA template (processor), subprocessor registry, cookie/consent controls, exports, and Records of Processing Activities (RoPA).

### Acceptance Criteria
- App serves localized routes at `/(en-IE|ga-IE)/…` with middleware locale negotiation and URL canonicalization; runtime toggling of locale works without full refresh; messages loaded per route segment.
- Visible **Theme** toggle with system default; **no CLS/flash**; user choice persisted; **High‑Contrast** selectable; respects `prefers-reduced-motion`.
- Automated **a11y checks** pass (axe & eslint‑plugin‑jsx‑a11y) on critical screens; manual keyboard path works (no trap; visible focus rings); color contrast verified.
- **GDPR kit** present (see file list); privacy page and consent banner live; data export & deletion endpoints stubbed and wired; audit log captures access/administrative actions; legal docs link from app footer; updated **spec** documents the legal/operational model.

---

## 🧱 Tasks (Ordered)

### 1) Specs & Docs Updates
- **Update** `docs/specs/fresh-comply-spec.md` with four new sections:
  - **Internationalization**: locales, routing model, message strategy, fallback rules, language negotiation, translation workflow.
  - **Theme & Design Tokens**: CSS variables, Tailwind tokens, dark/high‑contrast modes, motion & accessibility tokens.
  - **Accessibility**: WCAG 2.2 AA checklist, testing plan, component standards, PDF accessibility policy.
  - **GDPR & EU Legal**: roles (controller/processor), lawful bases, DSR workflows, retention, DPA template, subprocessor list, SCC readiness, breach policy.
- **Add** `docs/LEGAL/` with initial templates:
  - `PRIVACY.md` (public privacy notice)
  - `TERMS.md` (SaaS terms — non‑bespoke starter)
  - `DPA-TEMPLATE.md` (processor DPA with annexes: data nature, duration, categories)
  - `SUBPROCESSORS.md` (registry with change‑notice policy)
  - `ROPA.yaml` (Records of Processing Activities skeleton)
  - `DPIA-TEMPLATE.md` (for high‑risk processing assessments)
  - `INCIDENT-RESPONSE.md` (72‑hour reporting flow; severity levels)
  - `DATA-RETENTION.md` (tables per entity; defaults & overrides)
  - `COOKIES.md` (types; consent model; strictly necessary vs others)
- **Update** `AGENTS.md` to reference the new spec sections and legal folder, and to include a doc‑maintenance agent role (**Compliance Doc Steward**).
- **Update** `docs/ROADMAP.md` with milestones for i18n rollout, a11y audit, and GDPR go‑live checkpoints.

### 2) Internationalization (next‑intl)
- **Install & wire** `next-intl` in `apps/portal`.
- **Routing**: move app to `apps/portal/src/app/(i18n)/[locale]/…` with middleware locale detection (Accept‑Language; cookie; fallback to `en-IE`).
- **Messages**: create `apps/portal/messages/{en-IE,ga-IE}/common.json` and split by route segments; add ICU examples (plurals, select, date/number formatting).
- **Locale switcher**: header component with accessible `<select>`; properly labeled; updates URL & cookie.
- **i18n utils**: date/number format helpers; currency formatter; timezone awareness; localized validation messages.
- **Content model**: in `packages/workflows`, allow translatable labels/description fields (e.g., `title_i18n` with per‑locale strings).
- **Testing**: unit test locale negotiation and message fallback; snapshot critical pages in both locales.

### 3) Theme System (light/dark/high‑contrast)
- **Design tokens**: define CSS variables for color, spacing, radius, shadow; map to Tailwind theme; store in `packages/ui/tokens.css`.
- **Provider**: `ThemeProvider` SSR‑safe (cookie‑based) + `prefers-color-scheme`; load without layout shift; persist selection to user profile when logged in.
- **Toggle**: accessible control with ARIA `aria-pressed` state; variants: **Light**, **Dark**, **High‑Contrast**; icons have text labels for screen readers.
- **Reduced motion**: respect `prefers-reduced-motion` for animations.
- **Contrast**: enforce minimum contrast in Tailwind config (lint rule) and add a check script.

### 4) Accessibility (WCAG 2.2 AA)
- **Linting**: add `eslint-plugin-jsx-a11y` rules; fix violations.
- **Testing**: add Cypress + `@axe-core` for route smoke tests; add Pa11y CI job for key pages.
- **Keyboard**: ensure tab order, focus rings, skip link, landmarks (`header`, `nav`, `main`, `footer`).
- **Forms**: labels, describedby for errors, status live regions, error summary links.
- **Components**: prefer Radix primitives for dialogs/menu; close on Esc; focus trap managed; restore focus on close.
- **PDF accessibility**: ensure generated PDFs contain document title, language, and tagged headings if feasible; otherwise include an **Accessible HTML** alternative download link.

### 5) GDPR & EU SaaS Legal Readiness
- **Roles**: document controller/processor roles for different features (most client data → **processor**; product analytics → **controller**).
- **Lawful bases**: map each processing purpose to a basis (contract, legal obligation, legitimate interest, consent) in `PRIVACY.md`.
- **DSR endpoints**: add API stubs for **access/export** (JSON/CSV/ZIP), **rectification**, **erasure**, **restriction**, **objection**, **portability**; route requests to a queue with SLA.
- **Data deletion**: implement soft‑delete → hard‑delete jobs; document retention policy and schedules.
- **Records**: maintain `ROPA.yaml` and surface a read‑only view in the admin UI.
- **DPA**: ship `DPA-TEMPLATE.md` and enable **e‑signature** placeholders; link in app footer.
- **Subprocessors**: maintain `SUBPROCESSORS.md`; add change‑notice subscription (email/webhook).
- **International transfers**: add an annex placeholder for **SCCs** where third‑country vendors are used.
- **Security**: document encryption in transit & at rest; role‑based access; least‑privilege; audit of admin actions in `audit_log`.
- **Breach response**: document 72‑hour notification flow; add an internal severity rubric.
- **Consent**: cookie banner with categories; store consent in cookie + DB; respect choices; condition analytics on consent; server‑side gating.
- **User notifications**: export deletion confirmation and DSR lifecycle emails using `packages/notifications`.

### 6) Code & Config Changes
- **Next.js middleware** for locale detection.
- **App structure** under `[locale]` segment; refactor current routes.
- **Theme CSS**: add tokens & variants; update `Tailwind` config.
- **Add** `eslint-plugin-jsx-a11y`, `@axe-core/playwright` or `cypress-axe`, `pa11y-ci`.
- **Add** legal pages: `/privacy`, `/terms`, `/subprocessors`, `/cookies` (localized).
- **Add** API: `/api/dsr/*` (request intake) and `/api/consent` (save/read).
- **Update** footer to link legal pages.

### 7) CI & Quality Gates
- **CI jobs**: lint (incl. a11y), typecheck, unit, i18n route build, Pa11y on `/en-IE` and `/ga-IE` home & two inner pages.
- **Contrast check**: script to analyze Tailwind tokens against WCAG AA thresholds.
- **Bundle guard**: ensure i18n messages are code‑split and not over‑bundled.

---

## 📄 Files to Create/Update

**Docs**
- `docs/specs/fresh-comply-spec.md` — add new sections (i18n, Theme, A11y, GDPR)
- `docs/LEGAL/PRIVACY.md`
- `docs/LEGAL/TERMS.md`
- `docs/LEGAL/DPA-TEMPLATE.md`
- `docs/LEGAL/SUBPROCESSORS.md`
- `docs/LEGAL/ROPA.yaml`
- `docs/LEGAL/DPIA-TEMPLATE.md`
- `docs/LEGAL/INCIDENT-RESPONSE.md`
- `docs/LEGAL/DATA-RETENTION.md`
- `docs/LEGAL/COOKIES.md`
- `AGENTS.md` — new role; links to legal docs
- `docs/ROADMAP.md` — new milestones

**App**
- `apps/portal/src/middleware.ts` (locale)
- `apps/portal/src/i18n/request.ts` (helpers)
- `apps/portal/messages/{en-IE,ga-IE}/common.json`
- Move routes to `apps/portal/src/app/[locale]/...`
- `apps/portal/src/components/LocaleSwitcher.tsx`
- `apps/portal/src/components/ThemeToggle.tsx`
- `apps/portal/src/components/SkipLink.tsx`
- `apps/portal/src/app/[locale]/(legal)/privacy/page.tsx`
- `apps/portal/src/app/[locale]/(legal)/terms/page.tsx`
- `apps/portal/src/app/[locale]/(legal)/subprocessors/page.tsx`
- `apps/portal/src/app/[locale]/(legal)/cookies/page.tsx`
- `apps/portal/src/app/api/dsr/[type]/route.ts` (intake)
- `apps/portal/src/app/api/consent/route.ts`

**Packages**
- `packages/ui/tokens.css` (design tokens)
- `packages/ui/src/ThemeProvider.tsx`
- `packages/ui/src/A11y.tsx` (landmark wrappers, VisuallyHidden)
- `packages/utils/src/i18n.ts` (formatting utilities)
- `packages/notifications/src/email-templates/dsr/*.hbs`

**Config**
- Add `eslint-plugin-jsx-a11y` to root and fix violations
- Add Pa11y CI config `pa11yci.json`

---

## 🔧 Implementation Notes
- **next-intl**: use `createTranslator` server helpers; code‑split messages by route.
- **Hydration**: compute theme on server and embed `data-theme` on `<html>`; avoid flicker.
- **High-Contrast**: create a separate token set; ensure semantic colors (success/warn/error) meet AA.
- **PDFs**: if full tagging is not feasible, expose an HTML accessible export; name PDFs with language tag.
- **Consent**: compress consent state (bitmask or JSON) and persist; gate any non‑essential scripts server‑side.
- **DSR**: provide admin queue UI in a later milestone; for now, log requests + send confirmation emails.

---

## 🧪 Tests (add or update)
- Unit tests for **locale negotiation** and **message fallback**.
- E2E keyboard path (Tab flow) on 3 core pages.
- Axe checks: no critical violations on home, workflow run, and task board in both locales.
- Snapshot test ensuring **no hydration flash** when toggling theme.
- API tests: `/api/consent` read/write, basic `/api/dsr/*` intake.

---

## 📌 Deliverables Checklist
- [ ] Spec updated (four sections) with diagrams as needed.  
- [ ] Legal folder created with templates and policies.  
- [ ] i18n wired (`en-IE`, `ga-IE`), locale switcher live.  
- [ ] Theme toggle (Light/Dark/High‑Contrast) + reduced motion.  
- [ ] A11y lint/tests passing; focus management verified.  
- [ ] GDPR endpoints & pages in place; consent banner functioning.  
- [ ] CI includes Pa11y & axe checks; contrast script runs on tokens.  

---

**End of follow‑on coding agent prompt.**

