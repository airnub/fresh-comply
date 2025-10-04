---
title: "Live Workflow — Irish Non‐Profit Setup (Product Spec)"
version: 1.1.0
status: Stable
---








# Live Workflow — Irish Non‑Profit Setup (Product Spec)

## Schema roles: public, app, platform

- public → tenant-owned data (org_id NOT NULL, RLS tenant/provider/platform patterns).
- app → helper functions/RPCs/claims; no tables with tenant/global data.
- platform → global catalogs; admin-only writes; tenants read via views/RPCs.

## Practical recommendation & scaffolding

Practical recommendation
Keep app for functions; add platform for global tables.
Your earlier design used app.is_platform_admin() and other helpers—those should stay in app. Create platform.* for global state.

Minimal SQL scaffolding (safe defaults):

-- helpers stay here
create schema if not exists app;

-- global data lives here
create schema if not exists platform;

-- example global catalog
create table if not exists platform.rule_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  spec jsonb not null,
  published_at timestamptz not null default now(),
  unique(name, version)
);

-- RLS: admin-only writes; tenants read via a view
alter table platform.rule_packs enable row level security;

create policy admin_read_rule_packs on platform.rule_packs
  for select using (app.is_platform_admin());

create policy admin_write_rule_packs on platform.rule_packs
  for all using (app.is_platform_admin())
  with check (app.is_platform_admin());

-- tenant-facing read-only view (optional)
create or replace view public.v_rule_packs as
  select id, name, version, spec, published_at
  from platform.rule_packs;

Client/server rule of thumb

Browser/client: never write to platform.*; read via public.v_* or server RPCs.

Admin app/server: can write platform.* using service role or a server-minted JWT with role=platform_admin.



**Version:** 2025‑10‑02  
**Status:** Draft for build  
**Owner:** Alan G. (+ AI Accountant team)  
**Scope:** Turn our research + guides into a **self‑service, up‑to‑date** workflow that any person (or an agent acting for them) can use to set up and run an Irish non‑profit (any type), with adaptive steps, document generation, live rule verification, and funding discovery.

> This spec is jurisdiction‑specific to **Ireland** and designed to be adaptable to other jurisdictions later. It also anticipates integration into an **AI‑assisted accounting SaaS** module.

---

## 0) Executive Summary (TL;DR)

- **Form factor:** a **web app wizard** + **AI co‑pilot** producing a personalised checklist, filing helpers, draft documents, a compliance calendar, and funding matches.  
- **Freshness:** rule sources are **re‑verified** on demand and via **scheduled watchers** (CRO/Revenue/Charities/funding pages & datasets).  
- **Extensibility:** a **DSL** models steps, branches, rules, sources, and templates; users can **fork** and **insert** flows into their own projects.  
- **Outputs:** constitution seeds, board minutes, ROS/CRO/RBO/Charities action packs, policy pack, ICS calendar, evidence report (with links and last‑checked timestamps).  
- **Audience:** founders, community officers, accountants, and **AI agents** acting on their behalf.

---

## 1) Product Goals & Non‑Goals

### Goals
1. **Zero‑to‑setup:** Guide a novice from idea → compliant entity (any non‑profit type).  
2. **Always current:** Every legal assertion shows **“verified on {date}”** and a **Re‑verify** button.  
3. **Document factory:** Generate high‑quality, fill‑in‑the‑blanks docs (constitution, minutes, policies, TR2 helper, CHY pack).  
4. **Adaptive branching:** Ask a small set of questions → follow the correct path (CLG/charity/association/trust/co‑op).  
5. **Funding discovery:** Surface relevant Irish funding options (Pobal/DRCD/LCDC/LAG/sector bodies) and maintain a radar.  
6. **Compliance calendar:** Autogenerate ICS tasks (ARD/B1, RBO, ROS, Charities return, VAT compensation window, grant reports).  
7. **Agent‑ready:** Clean **function‑call APIs** so an **AI Accountant** can drive the workflow end‑to‑end.  

### Non‑Goals (MVP)
- Direct **e‑filing** to CRO/RBO/Charities (provide guided filing + packs; integrate only where official APIs exist).  
- Cross‑jurisdiction flows (Ireland first).  
- Grant application authoring for all funders (start with discovery + reminders + simple checklists).

---

## 2) Personas & Journeys

- **Founder (novice):** wants a single “do‑this‑then‑that” path and ready‑to‑sign docs.  
- **Treasurer/Accountant:** prioritises ROS setup, policies, and calendar; appreciates exportable evidence packs.  
- **AI Accountant (agent):** calls functions to collect answers, fill templates, verify rules, and schedule tasks.  

**Key journeys:**  
1) **CLG (non‑charity)** path → CRO → RBO → Revenue → banking → policies → calendar.  
2) **CLG (charity)** path → as above + Charities Regulator app → Revenue CHY → donations & VAT compensation setup.  
3) **Association/Trust/Co‑op** → correct constitution/registration + tailored policies; suggest CLG upgrade if appropriate.

---

## 3) Architecture Overview

**Frontend:** Next.js 15 (App Router), Tailwind, Shadcn/UI, Next‑Intl (en/ga), Tiptap for doc previews.  
**Backend:** Supabase Postgres (RLS), Supabase Storage (doc outputs), Redis (jobs), background workers (cron).  
**LLM:** OpenAI Responses API with **function calling** & **JSON schemas** for steps/docs/rules; store run logs for audit.  
**Connectors:** CRO Open Services (read), Charities Register open data (CKAN), Revenue guidance/ROS services (where cert APIs exist), RBO (guided), Pobal & local feeds (watchers).  
**Docs:** Handlebars/MDX templates compiled to Markdown/PDF; placeholders from state.  
**Calendar:** iCalendar (.ics) feed per organisation.

```
Browser <—> Next.js UI  
           |— AI Co‑pilot (Responses API)  
           |— Workflow Engine (DSL runtime)  
           |— Rule Verifier (sources registry + watchers)  
           |— Connectors (CRO/CKAN/Revenue/etc.)  
           |— Document Factory (templates → files)  
           |— Calendar Service (ICS generator)  
           |— Supabase (Postgres + Storage) / Redis (jobs)
```

---

## 4) Workflow Model (DSL)

A portable YAML/JSON schema describing questions, branches, steps, rules, and sources.

### 4.1 Schema (abridged)
```yaml
id: setup-nonprofit-ie
version: 2025-10-02
questions:
  - id: org_focus
    type: select
    prompt: "What is your organisation’s primary focus?"
    options: [community, sport, arts, education, environment, faith, health, other]
  - id: seek_charity_status
    type: boolean
    prompt: "Do you intend to register with the Charities Regulator?"
branches:
  - when: seek_charity_status == true
    goto: flow-clg-charity
  - when: default
    goto: flow-clg-noncharity
steps:
  - id: cro-incorporation
    kind: action
    title: "Incorporate a CLG on CRO CORE"
    requires: [two_directors, secretary, ppsn_or_vin, eea_director_or_s137_bond]
    do:
      - tool: doc.generate
        with: { template: board_minutes_a1.md }
      - tool: cro.lookup
        with: { name: "{{org_name}}" }
    verify:
      - rule: eea_director_present_or_s137_bond
      - rule: rbo_deadline_5_months
    sources:
      - cro_open_services
```

### 4.2 Node Types
- `question`, `info`, `action`, `upload`, `doc.generate`, `tool.call`, `verify`, `schedule`, `review`.

### 4.3 Verification Rules
- Rules are versioned objects with: `id`, `logic`, `message`, `sources[]`, `last_verified_at`.

---

## 5) Freshness & Compliance Engine

- **Source Registry:** canonical list of URLs/APIs/datasets for each rule.  
- **Watchers:** cron jobs for CKAN datasets (Charities Register), CRO notices, Revenue/ROS pages, Pobal programme pages, county LCDC/LAG sites.  
- **Change Pipeline:** fetch → diff → impact map (which rules/steps/templates) → human review → publish new **workflow version** with changelog.  
- **In‑app:** every step shows **Verified on {date}** + **Re‑verify**; evidence modal lists sources.

---

## 6) Connectors & Automations

| Domain | Capability | Notes |
|---|---|---|
| CRO company data | **Read API** (Open Services) | name checks, company status/lookups |
| CRO filings | Guided only (no public write API) | produce A1 pack; explain CORE steps |
| RBO | Guided + reminders | calculate 5‑month deadline; log filing proof |
| Charities Register | CKAN dataset ingestion | enrich funding eligibility; show peers |
| Revenue / ROS | Mix of guidance + APIs (cert‑based) | TR2 helper; ROS setup guide; eTax Clearance flow |
| Funding Radar | Watch Pobal/DRCD/LCDC/LAG/sector feeds | categorise by domain & geography |
| Lobbying | Awareness + reminders | only if user indicates lobbying activity |

---

## 7) Document Factory (Templates)

**Formation**  
- CLG constitution seeds (charity‑ready & non‑charity)  
- Board minutes: A1 authorisation, bank mandate, charity application, CHY application  
- Director/Secretary appointment letters  

**Revenue/Charity**  
- TR2 data sheet, ROS setup guide  
- Charities Regulator application checklist  
- CHY (charity tax exemption) helper pack  

**Policies**  
- Financial Controls, Conflicts of Interest, Reserves  
- GDPR: Privacy Policy, Data Map, Retention Schedule, Incident Log  
- Safeguarding (if relevant): Child Safeguarding Statement, Vetting/Training log  
- Fundraising policy & donor communications  

**Registers & Calendars**  
- Risk Register, Conflicts Register  
- ICS Calendar: ARD/B1, RBO, ROS, Charities return, VAT compensation window (Jan–Jun), grant deadlines

---

## 8) Onboarding (Adaptive Questions)

Minimal set to route correctly:
- **Will you seek charity registration?**  
- **Activities domain(s):** community/sport/arts/education/environment/health/faith/other  
- **Funding intent:** donations, philanthropy, State grants, trading income  
- **Operations:** employing staff? premises? working with children/young people? handling sensitive data?  
- **Governance preferences:** member‑led vs board‑led  
- **International directors?** ensure EEA resident or S137 bond

Answers determine **legal form**, **policies to include**, **funding feeds**, and **step visibility**.

---

## 9) AI Co‑Pilot Design

- **Context‑aware:** knows the current step, missing fields, and jurisdiction.  
- **Ask‑first:** when data is missing, it asks minimal clarifying questions.  
- **Explainable:** each recommendation displays the governing rule(s) + effective date + source links.  
- **Structured output:** JSON blocks representing `step`, `doc`, `rule_check`, `calendar_event`.  
- **Audit trail:** store prompts, tool calls, outputs, and the rule version references.

---

## 10) Security & Privacy

- **Supabase RLS** for tenant data isolation.  
- **Secrets** vault for ROS digital certificates (per org).  
- **PII minimisation:** only collect what a filing/document requires; explicit retention policy.  
- **Exports:** user can download a zip (docs + decisions + citations + calendar .ics).

---

## 11) Roadmap

### Phase 1 (4–6 weeks)
- Wizard + CLG flows (charity + non‑charity)  
- Document factory (constitution seeds, minutes, TR2 helper, policy pack)  
- CRO Open Services connector; Charities Register ingestion; Funding Radar v1  
- ICS calendar generation

### Phase 2 (6–10 weeks)
- ROS integrations where feasible (cert onboarding); otherwise guided filing with checklists  
- Rule Freshness: source registry, watchers, moderation UI, versioned workflow publishing  
- Sector policy extensions (sport/arts/education/health/environment/faith)

### Phase 3 (ongoing)
- Add **Co‑op/IPS**, **Trust**, **Association** paths  
- Trading subsidiary patterns (charity + trading company)  
- County‑specific funders & reminders; grant report trackers  
- Multi‑jurisdiction architecture

---

## 12) Metrics (Definition of Success)

- Time to produce a **CRO‑ready pack** (< 60 minutes)  
- % of users who **file RBO** within 5 months  
- % with **eTax Clearance** within 30 days  
- % eligible charities granted **CHY** within 90 days  
- Funding: # of matched opportunities; grant success rate  
- Governance: policy adoption rate; overdue compliance items

---

## 13) Risks & Mitigations

- **API coverage gaps:** CRO/RBO filing lacks write APIs → Guided filing + doc packs + evidence capture.  
- **Regulatory drift:** use watchers + moderation queue + versioned rules.  
- **User overwhelm:** progressive disclosure; show only relevant steps; plain English + examples.  
- **Data sensitivity:** minimisation + secure secrets handling; clear exports & deletion controls.

---

## 14) Branching Map (Any Non‑Profit Type)

**Legal form paths**  
- CLG (non‑charity)  
- CLG (charity)  
- Unincorporated Association  
- Charitable Trust  
- Co‑operative / IPS  

Each path provides the correct **constitution template**, **mandatory registrations**, and **policy pack**; charity paths include **Charities Regulator** + **CHY** steps; co‑ops include **RFS** guidance.

---

## 15) Data Model (Core Entities)

- **Organisation** (profile, answers, jurisdiction, directors)  
- **WorkflowRun** (current step, state, branch path)  
- **Step** (definition id, status, outputs, evidence)  
- **Rule** (id, logic, sources[], last_verified_at, version)  
- **Source** (name, URL/API, parser type)  
- **Template** (id, type, version, placeholders)  
- **Document** (rendered output, checksum, signature block)  
- **CalendarItem** (ics fields, due date, recurrence)  
- **ConnectorLog** (calls, responses, latency, errors)

---

## 16) UI Notes

- **Timeline view**: phases with progress chips; each step has Explain • Ask • Do • Verify • Schedule.  
- **Evidence drawer**: sources, last‑checked, and Re‑verify.  
- **Doc previews**: Markdown → PDF with sign blocks.  
- **Calendar tab**: ICS link + list of upcoming tasks.  
- **Funding tab**: matches with filters (domain, county, size, deadline).

---

## 17) Appendix — Sample Templates

**Board Minute — CRO A1 Authorisation**
```
RESOLVED THAT the Company proceed to incorporate by filing Form A1 with the Companies Registration Office and that the Secretary is authorised to submit the application and pay the prescribed fee.
```

**Board Minute — Bank Mandate**
```
RESOLVED THAT a current account be opened with <Bank>; any two authorised signatories may sign; the Bank is authorised to honour such instructions.
```

**Risk Register (starter)**
| Risk | Likelihood | Impact | Owner | Controls | Next Review |
|---|---:|---:|---|---|---|
| Late annual return (ARD/B1) | Medium | High | Secretary | Calendar reminders; external accountant | Quarterly |

---

## 18) Appendix — Sample Policy Stubs

- **Financial Controls:** approvals matrix; dual authorisation; procurement thresholds; reserves policy.  
- **GDPR:** data map; privacy notice; retention schedule; DPIA where needed.  
- **Safeguarding:** Children First; Child Safeguarding Statement; training tracker (if relevant).  
- **Fundraising:** acceptance/refusal policy; restricted funds; donor privacy; street/house‑to‑house permits.

---

## 19) Appendix — MVP Backlog (Engineering)

- [ ] Next.js app skeleton (App Router, Shadcn, Tailwind, Next‑Intl)  
- [ ] Supabase schema (entities in §15) + RLS  
- [ ] Workflow DSL parser + runtime  
- [ ] Document factory (Handlebars/MDX → Markdown/PDF)  
- [ ] CRO Open Services connector  
- [ ] CKAN ingestion (Charities Register dataset)  
- [ ] Funding Radar v1 (Pobal + county LCDC/LAG seeds)  
- [ ] Calendar service (ICS)  
- [ ] Co‑pilot tool schema (function calls)  
- [ ] Freshness watchers + moderation UI  
- [ ] Export: zip bundle (docs + decisions + ICS)  

---

**End of Spec (v2025‑10‑02).**  
Next: generate a starter repo plan with folder structure, DSL schema file, and first two flows (CLG charity / CLG non‑charity).
