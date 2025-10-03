# @airnub/fresh-comply — Coding Agent Prompt & Repo Scaffolding

**Date:** 2025‑10‑02  
**Owner:** @airnub  
**Goal:** Generate a pnpm monorepo that delivers a single Next.js portal for **all company workflows** (non‑profit + for‑profit), powered by a **Workflow DSL**, a **Freshness & Compliance Engine**, shared **connectors**, **document templates**, **notifications**, and a **multi‑tenant engagement model** (Company A acting for Company X) with full visibility, assignments, deadlines, and audit.

> Paste this prompt into your coding agent (GitHub Models/Autocode/Copilot Workspace/etc.). The agent should create files, fill stubs, and leave the repo in a runnable state.

---

## ✅ Objectives & Acceptance Criteria

**Objectives**
1) pnpm + Turborepo monorepo with one Next.js 15 app (`apps/portal`).  
2) **Workflow DSL** package and **engine** runtime (parse → branch → steps → assignments → calendar).  
3) **Freshness & Compliance Engine** (sources registry, manual re‑verify, watcher skeleton).  
4) **Connectors**: CRO Open Services (read), Charities Register (CKAN ingest), Revenue/ROS (stubs), RBO (guided), Funding Radar (seed).  
5) **Multi‑tenant**: organisations, memberships, **engagements** (act on behalf), workflow runs, steps, documents, notifications, audit log, calendar events; RLS policies for Supabase.  
6) **Document factory**: Handlebars/MDX → Markdown/PDF (board minutes, TR2 helper, policy stubs).  
7) **Notifications**: in‑app (realtime) + email (SMTP), daily digests & overdue escalations.  
8) **Docs**: `AGENTS.md` (root), `docs/ROADMAP.md`, `docs/specs/fresh-comply-spec.md` (detailed spec).  

**Acceptance Criteria**
- `pnpm i && pnpm dev` starts the portal and loads a demo **workflow run** with visible steps, assignees, due dates, and a **timeline** + **task board** view.  
- Can toggle a demo "Acting for Company X" banner and see audit entries.  
- "Re‑verify" button on a rule works in dev mode (stubbed, marks `last_verified_at`).  
- A demo **doc** (Board Minute) renders to Markdown and downloadable PDF.  
- ICS feed endpoint returns at least one calendar item.  
- `AGENTS.md` links to `docs/specs/fresh-comply-spec.md`.  

---

## 🧱 Repo Structure (create exactly)

```
fresh-comply/
├─ apps/
│  └─ portal/
│     ├─ package.json
│     ├─ next.config.mjs
│     ├─ tsconfig.json
│     └─ src/
│        ├─ app/
│        │  ├─ layout.tsx
│        │  ├─ page.tsx
│        │  ├─ api/
│        │  │  ├─ ics/route.ts            # Calendar feed
│        │  │  └─ reverify/route.ts       # Rule re-verify stub
│        │  └─ (workflow)/
│        │     ├─ run/[id]/page.tsx       # Timeline + Evidence Drawer
│        │     └─ board/[id]/page.tsx     # Task board view
│        ├─ components/                   # Shadcn components
│        ├─ lib/                          # client helpers
│        └─ server/                       # server actions (Supabase, engine calls)
├─ packages/
│  ├─ workflows/                          # YAML/JSON DSL definitions
│  │  ├─ package.json
│  │  └─ ie-nonprofit-clg-charity.yaml
│  ├─ engine/
│  │  ├─ package.json
│  │  └─ src/{dsl.ts, engine.ts, types.ts}
│  ├─ freshness/
│  │  ├─ package.json
│  │  └─ src/{sources.ts, watcher.ts, verify.ts}
│  ├─ connectors/
│  │  ├─ package.json
│  │  └─ src/{cro.ts, charities.ts, revenue.ts, rbo.ts, funding.ts}
│  ├─ doc-templates/
│  │  ├─ package.json
│  │  └─ templates/{board_minutes_a1.hbs, policy_financial_controls.mdx}
│  ├─ notifications/
│  │  ├─ package.json
│  │  └─ src/{email.ts, realtime.ts, scheduler.ts}
│  ├─ ui/
│  │  ├─ package.json
│  │  └─ src/{Timeline.tsx, TaskBoard.tsx, EvidenceDrawer.tsx}
│  ├─ types/
│  │  ├─ package.json
│  │  └─ src/{index.ts}
│  ├─ db/
│  │  ├─ package.json
│  │  ├─ schema.sql                       # Supabase schema + RLS stubs
│  │  └─ seeds.sql                        # Demo data (Company A ↔ Company X)
│  ├─ auth/
│  │  ├─ package.json
│  │  └─ src/{auth.ts}
│  ├─ cli/
│  │  ├─ package.json
│  │  └─ src/{index.ts}
│  └─ utils/
│     ├─ package.json
│     └─ src/{date.ts, ics.ts}
├─ docs/
│  ├─ ROADMAP.md
│  └─ specs/
│     └─ fresh-comply-spec.md
├─ .vscode/settings.json
├─ .editorconfig
├─ .gitignore
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
└─ .env.example
```

---

## 📦 Root Workspace Config

**`pnpm-workspace.yaml`**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`package.json` (root)**
```json
{
  "name": "@airnub/fresh-comply",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "db:migrate": "pnpm --filter @airnub/db run migrate",
    "seed": "pnpm --filter @airnub/db run seed"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  }
}
```

**`turbo.json`**
```json
{
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "outputs": [] },
    "typecheck": { "outputs": [] }
  }
}
```

**`.env.example`**
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
REDIS_URL=redis://localhost:6379
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
OPENAI_API_KEY=
```

---

## 🧩 Packages — key stubs

### `packages/types/src/index.ts`
```ts
import { z } from "zod";

export const Id = z.string().uuid();

export const Org = z.object({ id: Id, name: z.string(), slug: z.string() });
export const User = z.object({ id: Id, email: z.string().email(), name: z.string().optional() });
export const Membership = z.object({ userId: Id, orgId: Id, role: z.enum(["owner","admin","member","viewer"]) });

export const Engagement = z.object({ id: Id, engagerOrgId: Id, clientOrgId: Id, status: z.enum(["active","ended"]) });

export const WorkflowDef = z.object({ id: Id, key: z.string(), version: z.string(), title: z.string() });
export const WorkflowRun = z.object({ id: Id, workflowDefId: Id, subjectOrgId: Id, engagerOrgId: Id.optional(), status: z.enum(["draft","active","done","archived"]) });

export const Step = z.object({ id: Id, runId: Id, key: z.string(), title: z.string(), status: z.enum(["todo","in_progress","waiting","blocked","done"]), dueDate: z.string().datetime().optional(), assigneeUserId: Id.optional() });

export type TOrg = z.infer<typeof Org>;
```

### `packages/engine/src/types.ts`
```ts
export type NodeKind = "question" | "info" | "action" | "upload" | "doc.generate" | "tool.call" | "verify" | "schedule" | "review";
export type RuleRef = { id: string };
export type StepDef = { id: string; kind: NodeKind; title: string; requires?: string[]; verify?: RuleRef[] };
export type WorkflowDSL = { id: string; version: string; questions?: any[]; branches?: any[]; steps: StepDef[] };
```

### `packages/engine/src/dsl.ts`
```ts
import fs from "node:fs";
import yaml from "js-yaml";
import { WorkflowDSL } from "./types";

export function loadDSL(path: string): WorkflowDSL {
  const raw = fs.readFileSync(path, "utf8");
  const dsl = (path.endsWith(".yaml") ? yaml.load(raw) : JSON.parse(raw)) as WorkflowDSL;
  if (!dsl || !dsl.id || !dsl.steps) throw new Error("Invalid DSL");
  return dsl;
}
```

### `packages/engine/src/engine.ts`
```ts
import { WorkflowDSL, StepDef } from "./types";

export function materializeSteps(dsl: WorkflowDSL): StepDef[] {
  // MVP: return steps as-is; branching handled later
  return dsl.steps;
}
```

### `packages/workflows/ie-nonprofit-clg-charity.yaml`
```yaml
id: setup-nonprofit-ie-charity
version: 2025-10-02
steps:
  - id: cro-incorporation
    kind: action
    title: "Incorporate a CLG on CRO CORE"
    requires: [two_directors, secretary, ppsn_or_vin, eea_director_or_s137_bond]
    verify:
      - id: eea_director_present_or_s137_bond
      - id: rbo_deadline_5_months
  - id: rbo
    kind: action
    title: "File beneficial ownership (RBO) within 5 months"
  - id: revenue
    kind: action
    title: "Register with Revenue (TR2) & set up ROS"
  - id: charity
    kind: action
    title: "Apply to Charities Regulator; then CHY with Revenue"
```

### `packages/freshness/src/sources.ts`
```ts
export const SOURCES = {
  cro_open_services: { url: "https://api.cro.ie/" },
  charities_ckan: { url: "https://data.gov.ie/" },
  revenue_charities: { url: "https://www.revenue.ie/" }
};
```

### `packages/freshness/src/verify.ts`
```ts
export type Rule = { id: string; name: string; sources: string[]; lastVerifiedAt?: string };

export async function verifyRule(rule: Rule): Promise<Rule> {
  // DEV stub: simply update timestamp; real impl calls connectors/checkers
  return { ...rule, lastVerifiedAt: new Date().toISOString() };
}
```

### `packages/connectors/src/cro.ts`
```ts
export async function lookupCompanyByName(name: string) {
  // TODO: call CRO Open Services when available; return mock for now
  return [{ name, number: "000000", status: "AVAILABLE_OR_MOCK" }];
}
```

### `packages/doc-templates/templates/board_minutes_a1.hbs`
```hbs
Board Meeting of {{orgName}} CLG (the "Company")\nDate: {{date}}  Time: {{time}}  Location: {{location}}\n\nRESOLVED THAT the Company proceed to incorporate by filing Form A1 with the Companies Registration Office and that the Secretary is authorised to submit the application and pay the prescribed fee.\n\nSigned: ___________________  Chair
```

### `packages/db/schema.sql` (MVP)
```sql
create table organisations(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

create table users(
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  created_at timestamptz default now()
);

create table memberships(
  user_id uuid references users(id),
  org_id uuid references organisations(id),
  role text check (role in ('owner','admin','member','viewer')) not null,
  primary key(user_id, org_id)
);

create table engagements(
  id uuid primary key default gen_random_uuid(),
  engager_org_id uuid references organisations(id),
  client_org_id uuid references organisations(id),
  status text check (status in ('active','ended')) default 'active',
  scope text,
  created_at timestamptz default now()
);

create table workflow_defs(
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version text not null,
  title text not null,
  dsl_json jsonb not null,
  created_at timestamptz default now()
);

create table workflow_runs(
  id uuid primary key default gen_random_uuid(),
  workflow_def_id uuid references workflow_defs(id),
  subject_org_id uuid references organisations(id),
  engager_org_id uuid references organisations(id),
  status text check (status in ('draft','active','done','archived')) default 'active',
  created_by_user_id uuid references users(id),
  created_at timestamptz default now()
);

create table steps(
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id),
  key text not null,
  title text not null,
  status text check (status in ('todo','in_progress','waiting','blocked','done')) default 'todo',
  due_date date,
  assignee_user_id uuid references users(id)
);

create table documents(
  id uuid primary key default gen_random_uuid(),
  run_id uuid references workflow_runs(id),
  template_id text,
  path text,
  checksum text,
  created_at timestamptz default now()
);

create table audit_log(
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  actor_org_id uuid references organisations(id),
  on_behalf_of_org_id uuid references organisations(id),
  run_id uuid references workflow_runs(id),
  step_id uuid references steps(id),
  action text,
  meta_json jsonb,
  created_at timestamptz default now()
);
```

### `packages/db/seeds.sql` (demo)
```sql
insert into organisations (id, name, slug) values
  ('00000000-0000-0000-0000-0000000000a1','Company A (Accountants)','company-a'),
  ('00000000-0000-0000-0000-0000000000b1','Company X (Client)','company-x');
```

---

## 🌐 App (apps/portal) — minimal pages

**`apps/portal/package.json`**
```json
{ "name": "@airnub/portal", "private": true, "scripts": { "dev": "next dev", "build": "next build", "start": "next start" }, "dependencies": { "next": "15.0.0", "react": "18.3.1", "react-dom": "18.3.1" } }
```

**`apps/portal/src/app/layout.tsx`**
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b p-3">FreshComply Portal</header>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
```

**`apps/portal/src/app/page.tsx`**
```tsx
export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome to FreshComply</h1>
      <p>Start a demo workflow and view tasks, assignments, deadlines, and evidence.</p>
    </div>
  );
}
```

**`apps/portal/src/app/api/reverify/route.ts`**
```ts
import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ ok: true, verifiedAt: new Date().toISOString() });
}
```

**`apps/portal/src/app/api/ics/route.ts`**
```ts
import { NextResponse } from "next/server";
export async function GET() {
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Demo Deadline\nDTSTART:20251015T090000Z\nDTEND:20251015T100000Z\nEND:VEVENT\nEND:VCALENDAR`;
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar" } });
}
```

---

## 🧠 Docs to Create

### `AGENTS.md` (root)
```md
# AGENTS — @airnub/fresh-comply

**Purpose:** Orchestrate coding agents to keep this repo production-quality while generating workflows, connectors, and documents safely.

## Agents
- **Repo Architect** — owns monorepo structure, Turbo/pnpm, CI, DX.
- **Workflow Engineer** — authors DSL, engine logic, branching.
- **Freshness Steward** — maintains sources registry, watchers, and rule versions.
- **Connector Builder** — implements CRO/CKAN/Revenue/RBO/Funding adapters.
- **Docs/Policy Writer** — maintains templates and specs.

## Tools & Conventions
- Language: TypeScript (Node 20+), Next.js 15, pnpm + Turborepo.
- Store workflows under `packages/workflows/`. Engine under `packages/engine/`.
- Every legal assertion must have a **source link**; use `packages/freshness`.
- Supabase RLS for multi-tenant security.

## Runbook
```bash
pnpm i
pnpm dev      # start portal
pnpm build
```

## Specs
See **[Fresh-Comply Product Spec](docs/specs/fresh-comply-spec.md)** for architecture, data model, DSL, and roadmap.
```

### `docs/ROADMAP.md`
```md
# Roadmap — FreshComply

## Milestone 1 (Weeks 1–3)
- Monorepo scaffold; Next.js portal skeleton
- Engine MVP: parse DSL, render steps; Timeline + Task Board
- Supabase schema + RLS stubs; demo seed
- Notifications (in-app) and basic email

## Milestone 2 (Weeks 4–7)
- Freshness Engine v1: sources registry, manual re-verify, CKAN watcher
- Connectors: CRO Open Services (read), Charities CKAN, Funding Radar v1
- Document factory (minutes, TR2 helper, policy stubs)

## Milestone 3 (Weeks 8–11)
- Engagement flows (act on behalf), audit, ICS feeds
- SLA/escalation notifications; public read-only progress view (optional)
- ROS integration exploration (cert onboarding) or guided filing polish
```

### `docs/specs/fresh-comply-spec.md`
```md
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
Supabase RLS — WorkflowRun visible to subject org and engager org with active engagement. Audit includes `actor_org_id` and `on_behalf_of_org_id`.

## UX
Timeline with phases; Task Board; Evidence Drawer with sources & Re-verify; Doc previews; Calendar tab.

## Compliance & Freshness
- Every assertion has sources; inline badges show "Verified on {date}".
- Watchers (cron) monitor CKAN datasets, CRO/Revenue pages; changes → moderation → publish new workflow version.

## Initial Workflows
- IE Non-Profit CLG (charity) — full path CRO→RBO→Revenue→Charities→CHY→Donations/VAT Comp.
- IE Non-Profit CLG (non-charity) — CRO→RBO→Revenue→banking→policies.
- IE LTD (for-profit) — CRO→RBO→Revenue (CT/PAYE/VAT)→policies.

## KPIs
Time to CRO-ready pack (<60m); RBO within 5 months; eTax Clearance within 30 days; CHY within 90 days; grant matches; overdue compliance reduction.
```

---

## 🔧 Dev Tasks for the Agent (ordered)
1) Create the workspace files and root configs.  
2) Scaffold `apps/portal` and render a demo run with 3–4 steps.  
3) Add `packages/types`, `engine`, `workflows` with sample YAML and materialization.  
4) Add `packages/freshness` with a dummy `verifyRule` and sources registry.  
5) Add `packages/connectors` with CRO mock lookup.  
6) Add `packages/doc-templates` with 1–2 templates and a simple renderer (Node script OK).  
7) Add `packages/db` with SQL schema + demo seeds.  
8) Implement API routes: `/api/ics` and `/api/reverify`.  
9) Create docs: `AGENTS.md`, `docs/ROADMAP.md`, `docs/specs/fresh-comply-spec.md`.  
10) Provide a `README.md` snippet in root explaining `pnpm i`, `pnpm dev`.

---

## 🔒 Notes & Guardrails
- **No secrets** committed; use `.env.example` only.  
- All new rules must include `sources[]` and display **last verified** in UI.  
- Document outputs must include a signature block and checksum in metadata.  
- All actions on behalf must log `{ actor_user_id, actor_org_id, on_behalf_of_org_id }`.

---

## 🧪 Smoke Test Checklist (run locally)
- [ ] Home page loads.  
- [ ] Demo workflow run exists with 3–4 steps.  
- [ ] Task board shows assignees & due dates.  
- [ ] Evidence Drawer lists a rule with **Verified on …** and the **Re-verify** button updates the timestamp.  
- [ ] Download a sample Board Minute (Markdown/PDF).  
- [ ] Subscribe to `/api/ics` in a calendar client and see one event.  
- [ ] `AGENTS.md` opens and links to the spec.  

---

**End of coding agent brief.**

