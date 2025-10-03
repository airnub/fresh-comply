# Coding Agent Prompt — Implement Freshness & Compliance Engine (Incremental Issues & PRs)

**Repo:** `airnub/fresh-comply`  
**Branch:** `main`  
**Source Spec (canonical):** `docs/specs/Freshness & Compliance Engine — Versioning, Detection, Rollout & Adoption (v2025-10-03).md`  
*(If your filename differs inside `docs/specs/`, update the link when opening issues.)*

**Goal:** Turn the Freshness/Compliance design into a series of small, safe **issues/PRs** delivering: **tables → lockfile → watchers → moderation UI → tenant adoption → migration engine**, with strict **RLS**, full **audit**, and tests.

**Guardrails:** additive migrations only; do not break existing flows; secrets via aliases; platform admin via service-role only; everything audited.

---

## Milestone Map (overview)

- **M1 — Data Model & RLS** *(tables)*
- **M2 — Lockfile @ run creation**
- **M3 — Watchers & Impact Map**
- **M4 — Moderation UI (platform admin)**
- **M5 — Tenant Adoption (policy, prompts, notifications)**
- **M6 — Migration Engine (in‑flight runs)**
- **M7 — QA: Tests, Telemetry, CI, Docs** *(cross‑cutting)*

Each milestone lists GitHub‑issue‑sized tasks with acceptance criteria. Open issues under labels: `freshness`, `db`, `ui`, `backend`, `platform-admin`, `tenant-portal`, `temporal`, `tests`, `docs`.

---

## M1 — Data Model & RLS (tables)

**Issues**
1. **DB: Core Tables for Freshness**  
   Create migrations for:
   - `source_registry(id, name, url, parser, jurisdiction, category, created_at)`
   - `source_snapshot(id, source_id, fetched_at, content_hash, parsed_facts jsonb, storage_ref)`
   - `change_event(id, source_id, from_hash, to_hash, detected_at, severity, notes)`
   - `rule_versions(id, rule_id, version, logic_jsonb, sources jsonb, checksum, created_at)`
   - `template_versions(id, template_id, version, storage_ref, checksum, created_at)`
   - `workflow_def_versions(id, def_id, version, graph_jsonb, rule_ranges jsonb, template_ranges jsonb, checksum, created_at)`
   - `workflow_pack_versions(id, pack_id, version, overlay_jsonb, checksum, created_at)`
   - `moderation_queue(id, change_event_id, proposal jsonb, status, reviewer_id, decided_at)`
   - `release_notes(id, scope, ref_id, from_version, to_version, classification, effective_date, notes_md, created_at)`
   - `adoption_records(id, tenant_id, run_id null, scope, ref_id, from_version, to_version, mode, actor_id, decided_at)`
   - Extend `workflow_runs` with `merged_workflow_snapshot jsonb` (lockfile)

2. **RLS: Tenant Isolation & Platform Admin**  
   - Add `tenant_id` on all new rows (nullable where global, else required).  
   - Policies: tenants can read only their tenant rows; platform admin via service role.  
   - Create RLS views for reporting where useful.

3. **Audit: Hash‑Chained Logs for Freshness Ops**  
   - Ensure `audit_log` append‑only with `row_hash` + `prev_hash` (per tenant chain).  
   - Write triggers to compute hashes.

**Acceptance**  
- Migrations apply cleanly; RLS blocks cross‑tenant reads/writes; platform admin can read all via service role.  
- Inserting a moderation/adoption record writes an `audit_log` row with hash chain.

---

## M2 — Lockfile @ run creation

**Issues**
1. **Engine: Materialize Lockfile**  
   - Implement `engine.materialize(defId, defVersion, overlays[])` → exact `rule_versions`, `template_versions`, checksums.  
   - Persist in `workflow_runs.merged_workflow_snapshot` on **run create**.

2. **Verify Now + Badges**  
   - Add `engine.verify(lockfile)` → returns per‑rule “Verified on {date}” with source snapshots.  
   - Portal step UI: show verified badge + Evidence drawer.

**Acceptance**  
- New runs store a complete lockfile; UI shows verified badges with timestamps.

---

## M3 — Watchers & Impact Map

**Issues**
1. **Watcher Framework**  
   - Worker cron stubs for: CRO guidance page, Revenue CHY guidance page, Charities VAT scheme page, CKAN dataset.  
   - Fetch → normalise to `parsed_facts` → compute `content_hash` → write `source_snapshot` & `change_event` if changed.

2. **Impact Mapper**  
   - Map `change_event` → affected `rule_versions` candidates; suggest `PATCH|MINOR|MAJOR`.  
   - Propose `workflow_def_versions` deltas when rules/templates change.

3. **Diff Generation**  
   - JSON diff for rules; redline for templates (markdown); node/edge diff for workflow graphs.

**Acceptance**  
- Simulating a source change creates `change_event`, generated proposals, and human‑readable diffs.

---

## M4 — Moderation UI (platform admin)

**Issues**
1. **Queue List & Detail**  
   - New pages in **platform admin app**: list moderation items; detail view showing source/rule/template/workflow diffs and proposed bumps.

2. **Decisions & Publish**  
   - Actions: Approve / Reject / Amend; set classification: `Advisory|Recommended|Mandatory`, set `effective_date`.  
   - On publish: write new `rule_versions` / `template_versions` / `workflow_def_versions` + `release_notes`; audit the decision.

**Acceptance**  
- Admin can publish a release; release notes appear; audit rows recorded.

---

## M5 — Tenant Adoption (policy, prompts, notifications)

**Issues**
1. **Policy Model**  
   - `freshness_policy_versions` (or tenant settings) with defaults: auto‑adopt `PATCH/MINOR` after N days; prompt for `MAJOR`; force `MANDATORY` by `effective_date`.

2. **Tenant Notifications & Banners**  
   - Catalog: workflow card shows *“Update available vX.Y.Z”*.  
   - In‑run banner: *“New guidance available for this step”* with CTA → **Adoption Wizard**.

3. **Adoption Wizard**  
   - Summarise changes, impact on upcoming steps, and migration preview.  
   - Choices: **Apply now / Snooze / Keep pinned** (unless `MANDATORY`).  
   - Record in `adoption_records`; notify assignees; calendar insert for mandatory.

**Acceptance**  
- Tenants see prompts and can adopt per policy; mandatory updates enforce after effective date.

---

## M6 — Migration Engine (in‑flight runs)

**Issues**
1. **Plan & Apply**  
   - Implement `engine.planMigration(runId, targetVersions)` → list affected steps, checks, and actions.  
   - Implement `engine.applyMigration(plan)` with **hooks**: `precheck`, `migrate`, `postcheck` per new version.

2. **Safety Rules**  
   - Forward‑only; do not change past outcomes.  
   - Regenerate documents only if not signed/submitted; otherwise create a new revision.

3. **Audit & Rollback**  
   - Every migration writes detailed `audit_log` with from→to versions and hashes.  
   - Allow roll‑back **only** when no state changed post‑migration (idempotent replay), else keep forward-only.

**Acceptance**  
- A sample run upgrades a rule/template; the wizard applies migration; lockfile updates; audit trail records the change.

---

## M7 — QA: Tests, Telemetry, CI, Docs

**Issues**
1. **Tests**  
   - Unit: lockfile resolution, watcher hash change, impact map, migration hooks.  
   - Integration: moderation publish, tenant adoption flows.  
   - E2E: simulate a CRO change → publish → tenant adopts → run migrates.

2. **Telemetry**  
   - OpenTelemetry spans with `{ tenant_id, run_id, step_id, change_event_id }`; logs include correlation IDs.

3. **CI**  
   - Add jobs: migrations dry‑run, tests, markdown link check for specs, typecheck.  
   - Feature flags to gate production rollout.

4. **Docs**  
   - Link the spec from `AGENTS.md` as **canonical**.  
   - Add developer how‑to: watcher authoring, impact rules, moderation, adoption, migration.

**Acceptance**  
- Green CI; docs published (Docusaurus) including the new spec and developer guide.

---

## Shared Implementation Notes

- **RLS**: All new tables include `tenant_id` and enforce tenant isolation; some global assets (e.g., base sources/rules) can have `tenant_id = NULL` with read‑only access; writes allowed to platform admin only.  
- **Audit**: Use stored procedures for privileged writes to guarantee audit rows.  
- **Storage**: Large blobs (HTML/PDF snapshots) referenced by `storage_ref` (object storage) not in row JSON.  
- **Citations**: store source snapshot ids and content hashes alongside rules and release notes.  
- **Feature Flags**: `FRESHNESS_WATCHERS_ENABLED`, `FRESHNESS_ADOPTION_ENABLED` for gradual rollout.

---

## Quick Issue Template (copy for each GH issue)

```
**Spec:** <link to the section in docs/specs>
**Context:** Why this is needed; user impact.
**Tasks:**
- [ ] …
**Acceptance Criteria:**
- [ ] …
**Risk/Notes:** Rollout flag, RLS touchpoints, audit entries expected.
```

---

## Definition of Done (global)

- New runs contain a **lockfile** snapshot.  
- Watchers detect changes and produce human‑readable diffs.  
- Platform admin can **moderate** and **publish** versioned updates with classifications & effective dates.  
- Tenants receive prompts and can **adopt** updates; **mandatory** updates enforce by date.
- In‑flight runs can **migrate** safely; all changes audited; RLS enforced.
- CI green; docs updated and deployed.

