# Freshness & Compliance Engine — Versioning, Detection, Rollout & Adoption

**Repo:** `@airnub/fresh-comply`  
**Version:** 2025‑10‑03  
**Owner:** Platform Team  
**Status:** Source of truth for how Freshness works end‑to‑end (pinning, detection, moderation, rollout, and tenant adoption)

> Goal: When CRO/Revenue/Charities/funders update rules or forms, the platform detects it, maps impact, proposes versioned updates, and lets **platform admin** approve and publish. Tenants and active workflow runs are then **notified** and may **adopt** the update (auto/opt‑in/mandatory). Each workflow run is locked to a **snapshot** so results remain reproducible.

---

## 1) Design objectives

- **Reproducibility:** Every run is bound to a *snapshot* ("lockfile") of workflow + rules + templates + sources.
- **Explainability:** Every assertion shows *Verified on {date}* with sources and checksums.
- **Safety:** Updates flow through a **moderation** queue; breaking changes don’t silently alter in‑flight runs.
- **Adoption control:** Tenants decide when/how to adopt (policy‑driven), with **mandatory** lanes for urgent legal changes.
- **Auditability:** All decisions are append‑only, hash‑chained, and attributable.

---

## 2) Versioned units (what we track)

| Unit | Semver? | Stored as | Notes |
|------|---------|-----------|-------|
| **Source** (CRO/Revenue page, CKAN dataset) | Content hash | `source_registry`, `source_snapshot` | Parsed → facts (e.g., “RBO deadline = 5 months”).
| **Rule** (e.g., `rbo_deadline_5_months`) | **Yes** (`MAJOR.MINOR.PATCH`) | `rule_versions` | Logic + references to *source ids/snapshots*.
| **Template** (doc) | **Yes** | `template_versions` | Constitution, minutes, CHY pack, etc.
| **Workflow Definition** | **Yes** | `workflow_def_versions` | Graph of nodes; declares compatible rule/template ranges.
| **Overlay Pack** | **Yes** | `workflow_pack_versions` | Tenant overlays; validated against base def version.
| **Freshness Policy** | **Yes** | `freshness_policy_versions` | Adoption rules (auto/opt‑in/mandatory windows).

---

## 3) Lockfile at run creation (pinning)

When a new **WorkflowRun** is created, the engine computes and stores a materialized **Lockfile**:

```json
{
  "workflow_def": { "id": "setup-nonprofit-ie", "version": "1.7.0", "checksum": "…" },
  "overlays": [ { "id": "tenantX-overlay", "version": "2.1.1", "checksum": "…" } ],
  "rules": {
    "rbo_deadline": { "version": "2.0.0", "sources": [ {"id": "rbo_help_2024", "snapshot": "sha256:…"} ] },
    "cro_ppsn": { "version": "1.3.2", "sources": [ … ] }
  },
  "templates": {
    "constitution_clg": { "version": "3.4.0", "checksum": "…" },
    "board_minutes_a1": { "version": "1.1.0", "checksum": "…" }
  },
  "freshness": { "verified_at": "2025-10-03T12:00:00Z", "verifier": "watcher@1.2.0" }
}
```

Store this blob in `workflow_runs.merged_workflow_snapshot`. All verifications, documents, and outcomes are attributable to this lockfile.

---

## 4) Watchers → change detection → impact map

1. **Watchers** (cron jobs) fetch sources:
   - CRO/Revenue/Charities/funder pages
   - CKAN datasets (Charities Register)
   - Programmes (Pobal/LCDC/LAG) & known PDF guidance
2. Normalize to **parsed facts** (small JSONs) and compute a **content hash**.
3. On hash change, emit a `change_event` with a link to affected **sources**.
4. The **Impact Mapper** finds all **rules** referencing those sources and computes proposed **rule_version bumps** (PATCH/MINOR/MAJOR using change severity heuristics or manual label).
5. For each affected **workflow_def**, generate a candidate **workflow_def_version**; attach a **changelog** and **upgrade notes**.

> Examples: A wording tweak → PATCH; a date adjustment → MINOR; a changed eligibility test → MAJOR.

---

## 5) Moderation workflow (platform admin)

- **Queue:** `moderation_queue` lists proposed bumps with diffs:
  - Source diff (raw and parsed‑fact compare)
  - Rule diff (logic/thresholds)
  - Template diff (doc redlines)
  - Workflow diff (node text/verify edges)
- **Actions:** Approve/Reject/Amend, set **classification**:
  - **Advisory** (opt‑in; informative)
  - **Recommended** (default adopt for minors)
  - **Mandatory** (legal obligation; must adopt by *effective_date*)
- **Publish:** creates **new versions** and a **release** with notes; triggers **adoption workflow**.

---

## 6) Adoption & rollout (tenants and runs)

**Policy:** Each tenant has a `freshness_policy` (default provided platform‑wide):
- *Auto‑adopt MINOR/PATCH* within N days.
- *Prompt for MAJOR* changes with a wizard.
- *Force MANDATORY* by `effective_date` with grace period.

**What users see**
- **Workflow catalogue:** badges → *“Update available: v1.8.0”* + “What changed?”
- **Active run:** banner on relevant steps → *“New guidance available for this step.”*  
  CTA: **Review & apply** → shows side‑by‑side diff and any **migration notes**.
- **Notifications:** in‑app + email digest; calendar inserts for **mandatory** deadlines.

**After tenant chooses**
- Engine computes a **Migration Plan** (see §7), applies it, updates the run’s **Lockfile** and adds an **Audit** record.

---

## 7) Migrating in‑flight runs safely

**Rules**
- **Forward‑only**: never rewrite past outcomes.
- **Step‑local adoption** when possible (update validate/verify logic for *upcoming* steps only).
- **Document regeneration** allowed only when the doc has not been signed/submitted; otherwise create a **new revision**.

**Mechanics**
1. Identify affected steps (by rule/template id).
2. For each, apply **migration hooks** declared on the new version:
   - `precheck(run_state)` → can we update?
   - `migrate(config, state)` → transform pending state.
   - `postcheck(state)` → sanity check.
3. Write new **Lockfile** for the run, pinning updated versions.
4. **Audit** the change (actor, reason, list of updated nodes, old→new semvers, hashes).

If migration cannot be applied (e.g., a form version mismatch already filed), the wizard explains **why** and leaves the run pinned.

---

## 8) Data model (tables)

```sql
-- Sources & snapshots
source_registry(id, name, url, parser, jurisdiction, category)
source_snapshot(id, source_id, fetched_at, content_hash, parsed_facts jsonb, storage_ref)

-- Detected changes & moderation
change_event(id, source_id, from_hash, to_hash, detected_at, severity)
moderation_queue(id, change_event_id, proposal jsonb, status, reviewer_id, decided_at)
release_notes(id, scope, ref_id, from_version, to_version, classification, effective_date, notes_md)

-- Versioned assets
rule_versions(id, rule_id, version, logic_jsonb, sources jsonb, checksum)
template_versions(id, template_id, version, body_ref, checksum)
workflow_def_versions(id, def_id, version, graph_jsonb, rule_ranges jsonb, template_ranges jsonb, checksum)
workflow_pack_versions(id, pack_id, version, overlay_jsonb, checksum)

-- Adoption
adoption_records(id, tenant_id, run_id null, scope, ref_id, from_version, to_version, mode, actor_id, decided_at)

-- Lockfile (per run)
workflow_runs(… , merged_workflow_snapshot jsonb, …)
```

RLS scopes rows by `tenant_id`; platform admin reads all via service role. All writes go through **RPCs** that also append to `audit_log`.

---

## 9) Algorithms (API sketch)

```ts
// Generate lockfile
lockfile = engine.materialize(defId, defVersion, overlays[]) // resolves exact rule/template versions + checksums

// Verify now
engine.verify(lockfile) // re-check sources; returns badges + timestamps

// Propose updates after change_event
proposals = engine.impactMap(changeEventId)

// Publish new versions after moderation
release = engine.publish(approvedProposals, classification, effectiveDate)

// Compute migration plan for a run
plan = engine.planMigration(runId, targetVersions)
engine.applyMigration(plan)
```

All functions attach **citations** (source snapshots) and emit **audit** entries.

---

## 10) UI/UX patterns

- **Badges:** *Verified on 03 Oct 2025* / *Update available* / *Mandatory update by 20 Nov 2025*.
- **Evidence drawer:** source links, snapshot hashes, *Re‑verify* button.
- **Diff views:** rule logic (JSON diff), template redlines, workflow graph diff (added/removed/changed nodes and edges).
- **Adoption wizard:** policy summary, migration preview, “apply now / snooze / never for this run”.

---

## 11) Notifications & calendar

- Digest: *“3 updates require review (1 mandatory)”* with quick actions.
- Calendar entries for **effective dates** of mandatory updates.
- Per‑run notifications when pinned items have a newer mandatory version.

---

## 12) Security, privacy, audit

- Lockfiles include only hashes/ids for sources and templates; large blobs stored in object storage.
- All moderation and adoption decisions produce entries in **`audit_log`** (hash‑chained), capturing `{actor, tenant, run, scope, from→to, reason}`.
- DSR exports include a list of versions and sources that governed a subject’s documents and decisions.

---

## 13) Acceptance criteria

- New runs store a **Lockfile** with exact versions + hashes.
- Watchers create `change_event` on source change with parsed‑fact deltas.
- Platform admin can approve proposals and **publish** new versions with classification.
- Tenants receive **notifications**; can adopt according to policy; **Mandatory** changes enforce by effective date.
- In‑flight runs can adopt updates via a wizard; if blocked, the reason is shown and the run remains pinned.
- All actions are **audited**; reports show adoption over time per tenant.

---

## 14) Migration plan (from current code)

1. Add tables: `source_snapshot`, `change_event`, `moderation_queue`, `rule_versions`, `template_versions`, `workflow_def_versions`, `release_notes`, `adoption_records`.
2. Update engine to emit **Lockfile** on run creation.
3. Build a minimal watcher for 2–3 high‑value sources (e.g., CRO A1 guidance, Revenue CHY guidance, Charities VAT Compensation portal dates).
4. Add **Moderation UI** (platform app): queue → approve → publish.
5. Portal: badges + evidence drawer + adoption wizard.
6. Add lints & tests; switch on enforcement gradually by feature flag.

---

## 15) Nice‑to‑have (later)

- **Superseded‑by graph:** let users browse historic guidance chains.
- **Semantic impact:** annotate steps with *risk if stale* and highlight critical items sooner.
- **Auto‑draft release notes** (LLM) from diffs; editor approves.

---

**End of Freshness & Compliance Engine spec (v2025‑10‑03).**

