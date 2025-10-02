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
