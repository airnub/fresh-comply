-- Auto-consolidated baseline (2025-10-04T14:42:43.519Z)
-- Tables (no FKs)

CREATE TABLE platform."global_records" (
  "id" bigserial primary key,
  "source_table" text not null,
  "payload" jsonb not null,
  "archived_at" timestamptz not null default now()
);

CREATE TABLE platform."rule_catalogs" (
  "id" uuid primary key default gen_random_uuid(),
  "slug" text not null unique,
  "title" text not null,
  "description" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

CREATE TABLE platform."rule_pack_detection_sources" (
  "detection_id" uuid references platform.rule_pack_detections(id) on delete cascade,
  "rule_source_id" uuid references platform.rule_sources(id) on delete cascade,
  "change_summary" jsonb not null default '{}'::jsonb,
  "primary" key(detection_id, rule_source_id)
);

CREATE TABLE platform."rule_pack_detections" (
  "id" uuid primary key default gen_random_uuid(),
  "rule_pack_id" uuid references platform.rule_packs(id) on delete set null,
  "rule_pack_key" text not null,
  "current_version" text,
  "proposed_version" text not null,
  "severity" text not null check (severity in ('info','minor','major','critical')),
  "status" text not null default 'open' check (status in ('open','in_review','approved','rejected','superseded')),
  "diff" jsonb not null default '{}'::jsonb,
  "detected_at" timestamptz not null default now(),
  "created_by" uuid references users(id),
  "notes" text,
  CONSTRAINT "anon_1" unique(rule_pack_key, proposed_version, detected_at)
);

CREATE TABLE platform."rule_pack_proposals" (
  "id" uuid primary key default gen_random_uuid(),
  "detection_id" uuid not null references platform.rule_pack_detections(id) on delete cascade,
  "rule_pack_id" uuid references platform.rule_packs(id) on delete set null,
  "rule_pack_key" text not null,
  "current_version" text,
  "proposed_version" text not null,
  "changelog" jsonb not null default '{}'::jsonb,
  "status" text not null default 'pending'
    check (status in ('pending','in_review','approved','rejected','amended','published','superseded')),
  "review_notes" text,
  "created_by" uuid references users(id),
  "approved_by" uuid references users(id),
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "approved_at" timestamptz,
  "published_at" timestamptz,
  CONSTRAINT "anon_1" unique(detection_id)
);

CREATE TABLE platform."rule_packs" (
  "id" uuid primary key default gen_random_uuid(),
  "pack_key" text not null,
  "version" text not null,
  "title" text not null,
  "summary" text,
  "manifest" jsonb not null default '{}'::jsonb,
  "checksum" text not null,
  "created_by" uuid references users(id),
  "created_at" timestamptz not null default now(),
  "published_at" timestamptz,
  "status" text not null default 'draft' check (status in ('draft','proposed','published','deprecated')),
  CONSTRAINT "anon_1" unique(pack_key, version)
);

CREATE TABLE platform."rule_source_snapshots" (
  "id" uuid primary key default gen_random_uuid(),
  "rule_source_id" uuid not null references platform.rule_sources(id) on delete cascade,
  "content_hash" text not null,
  "parsed_facts" jsonb not null default '{}'::jsonb,
  "fetched_at" timestamptz not null default now(),
  "created_at" timestamptz not null default now()
);

CREATE TABLE platform."rule_sources" (
  "id" uuid primary key default gen_random_uuid(),
  "name" text not null,
  "url" text not null unique,
  "parser" text not null,
  "jurisdiction" text,
  "category" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

CREATE TABLE platform."rules" (
  "id" uuid primary key default gen_random_uuid(),
  "catalog_id" uuid not null references platform.rule_catalogs(id) on delete cascade,
  "code" text not null,
  "summary" text not null,
  "body" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

CREATE TABLE platform."step_type_versions" (
  "id" uuid primary key default gen_random_uuid(),
  "step_type_id" uuid not null references platform.step_types(id) on delete cascade,
  "version" text not null,
  "definition" jsonb not null,
  "input_schema_id" uuid references json_schemas(id),
  "output_schema_id" uuid references json_schemas(id),
  "status" text check (status in ('draft','published','deprecated')) default 'draft',
  "created_by" uuid references users(id),
  "created_at" timestamptz default now(),
  "published_at" timestamptz,
  CONSTRAINT "anon_1" unique(step_type_id, version)
);

CREATE TABLE platform."step_types" (
  "id" uuid primary key default gen_random_uuid(),
  "slug" text unique not null,
  "title" text not null,
  "category" text,
  "summary" text,
  "latest_version" text,
  "created_by" uuid references users(id),
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now()
);

CREATE TABLE public."admin_actions" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "actor_id" uuid references users(id),
  "actor_org_id" uuid references organisations(id),
  "on_behalf_of_org_id" uuid references organisations(id),
  "subject_org_id" uuid references organisations(id),
  "target_kind" text,
  "target_id" uuid,
  "action" text not null,
  "reason_code" text not null,
  "lawful_basis" text,
  "payload" jsonb not null default '{}'::jsonb,
  "requires_second_approval" boolean not null default false,
  "second_actor_id" uuid references users(id),
  "prev_hash" text not null default repeat('0', 64),
  "row_hash" text not null,
  "created_at" timestamptz not null default now(),
  "inserted_at" timestamptz not null default now(),
  "approved_at" timestamptz
);

CREATE TABLE public."adoption_records" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "run_id" uuid references workflow_runs(id) on delete set null,
  "scope" text not null,
  "ref_id" text not null,
  "from_version" text,
  "to_version" text not null,
  "mode" text not null,
  "actor_id" uuid references users(id),
  "decided_at" timestamptz not null default now(),
  "notes" jsonb default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

CREATE TABLE public."audit_log" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "tenant_id" uuid not null references organisations(id),
  "actor_user_id" uuid references users(id),
  "actor_org_id" uuid references organisations(id),
  "on_behalf_of_org_id" uuid references organisations(id),
  "subject_org_id" uuid references organisations(id),
  "entity" text,
  "target_kind" text,
  "target_id" uuid,
  "run_id" uuid references workflow_runs(id),
  "step_id" uuid references steps(id),
  "action" text not null,
  "lawful_basis" text,
  "meta_json" jsonb not null default '{}'::jsonb,
  "prev_hash" text not null default repeat('0', 64),
  "row_hash" text not null,
  "chain_position" bigint not null,
  "created_at" timestamptz not null default now(),
  "inserted_at" timestamptz not null default now()
);

CREATE TABLE public."billing_prices" (
  "stripe_price_id" text primary key,
  "product_name" text not null,
  "nickname" text,
  "unit_amount" integer,
  "currency" text not null,
  "interval" text,
  "interval_count" integer,
  "is_active" boolean not null default true,
  "metadata" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

CREATE TABLE public."billing_subscriptions" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id) on delete cascade,
  "billing_tenant_id" uuid references billing_tenants(id) on delete set null,
  "stripe_subscription_id" text not null unique,
  "status" billing_subscription_status not null,
  "stripe_price_id" text references billing_prices(stripe_price_id),
  "current_period_start" timestamptz,
  "current_period_end" timestamptz,
  "cancel_at" timestamptz,
  "canceled_at" timestamptz,
  "cancel_at_period_end" boolean not null default false,
  "collection_method" text,
  "latest_invoice_id" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

CREATE TABLE public."billing_tenants" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id) on delete cascade,
  "stripe_customer_id" text unique,
  "billing_mode" billing_tenant_mode not null default 'direct',
  "partner_org_id" uuid references organisations(id),
  "default_price_id" text references billing_prices(stripe_price_id),
  "metadata" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  CONSTRAINT "billing_tenants_tenant_unique" constraint billing_tenants_tenant_unique unique (org_id)
);

CREATE TABLE public."change_event" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "source_id" uuid not null references source_registry(id) on delete cascade,
  "from_hash" text,
  "to_hash" text not null,
  "detected_at" timestamptz not null default now(),
  "severity" text not null,
  "notes" text,
  "created_at" timestamptz not null default now()
);

CREATE TABLE public."charity_registration_metrics" (
  "metric_key" text primary key,
  "metric_label" text not null,
  "values_json" jsonb not null,
  "source_resource_id" text,
  "snapshot_fingerprint" text,
  "refreshed_at" timestamptz default now(),
  "created_at" timestamptz default now()
);

CREATE TABLE public."cro_companies" (
  "company_number" text primary key,
  "name" text not null,
  "status" text,
  "company_type" text,
  "registered_on" date,
  "dissolved_on" date,
  "last_return_date" date,
  "address" jsonb,
  "eircode" text,
  "metadata" jsonb,
  "snapshot_fingerprint" text,
  "source_resource_id" text,
  "refreshed_at" timestamptz default now(),
  "created_at" timestamptz default now()
);

CREATE TABLE public."documents" (
  "id" uuid primary key default gen_random_uuid(),
  "run_id" uuid references workflow_runs(id),
  "org_id" uuid not null references organisations(id),
  "subject_org_id" uuid references organisations(id),
  "template_id" text,
  "path" text,
  "checksum" text,
  "created_at" timestamptz default now()
);

CREATE TABLE public."dsr_request_jobs" (
  "id" uuid primary key default gen_random_uuid(),
  "request_id" uuid not null references dsr_requests(id) on delete cascade,
  "job_type" text not null check (job_type in ('ack_deadline', 'resolution_deadline', 'escalation_notice')),
  "run_after" timestamptz not null,
  "payload" jsonb,
  "attempts" integer not null default 0,
  "locked_at" timestamptz,
  "processed_at" timestamptz,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

CREATE TABLE public."dsr_requests" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "subject_org_id" uuid references organisations(id),
  "assignee_user_id" uuid references users(id),
  "assignee_email" text,
  "requester_email" text,
  "requester_name" text,
  "request_payload" jsonb,
  "type" text not null check (type in (
    'access',
    'export',
    'rectification',
    'erasure',
    'restriction',
    'objection',
    'portability'
  )),
  "status" text not null check (status in (
    'received',
    'acknowledged',
    'in_progress',
    'paused',
    'completed',
    'escalated'
  )),
  "received_at" timestamptz not null default now(),
  "ack_sent_at" timestamptz,
  "due_at" timestamptz not null,
  "resolved_at" timestamptz,
  "paused_at" timestamptz,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

CREATE TABLE public."engagements" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "engager_org_id" uuid references organisations(id),
  "client_org_id" uuid references organisations(id),
  "subject_org_id" uuid references organisations(id),
  "status" text check (status in ('active','ended')) default 'active',
  "scope" text,
  "created_at" timestamptz default now()
);

CREATE TABLE public."funding_opportunities" (
  "id" uuid primary key default gen_random_uuid(),
  "external_id" text not null,
  "source_resource_id" text not null,
  "title" text not null,
  "summary" text,
  "call_year" integer,
  "call_type" text,
  "domain" text,
  "county" text,
  "lead_institution" text,
  "acronym" text,
  "amount_awarded" numeric,
  "currency" text,
  "metadata" jsonb,
  "snapshot_fingerprint" text,
  "refreshed_at" timestamptz default now(),
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  CONSTRAINT "anon_1" unique(external_id, source_resource_id)
);

CREATE TABLE public."funding_opportunity_workflows" (
  "id" uuid primary key default gen_random_uuid(),
  "funding_opportunity_id" uuid references funding_opportunities(id) on delete cascade,
  "workflow_key" text not null,
  "created_at" timestamptz default now(),
  CONSTRAINT "anon_1" unique(funding_opportunity_id, workflow_key)
);

CREATE TABLE public."json_schemas" (
  "id" uuid primary key default gen_random_uuid(),
  "slug" text unique not null,
  "version" text not null,
  "description" text,
  "schema" jsonb not null,
  "created_at" timestamptz default now()
);

CREATE TABLE public."memberships" (
  "user_id" uuid references users(id),
  "org_id" uuid references organisations(id),
  "role" text check (role in ('owner','admin','member','viewer')) not null,
  "primary" key(user_id, org_id)
);

CREATE TABLE public."moderation_queue" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "change_event_id" uuid references change_event(id) on delete set null,
  "proposal" jsonb not null,
  "status" text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'amended')),
  "classification" text,
  "reviewer_id" uuid references users(id),
  "decided_at" timestamptz,
  "created_by" uuid references users(id),
  "notes_md" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

CREATE TABLE public."org_memberships" (
  "org_id" uuid not null references public.orgs(id) on delete cascade,
  "user_id" uuid not null,
  "role" text not null check (role in ('member', 'org_admin', 'provider_admin', 'platform_admin')),
  "status" text not null default 'active',
  "created_at" timestamptz not null default now(),
  "primary" key (org_id, user_id)
);

CREATE TABLE public."organisations" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "name" text not null,
  "slug" text unique not null,
  "created_at" timestamptz default now()
);

CREATE TABLE public."orgs" (
  "id" uuid primary key default gen_random_uuid(),
  "name" text not null,
  "type" text,
  "parent_org_id" uuid,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  CONSTRAINT "orgs_type_check" check (type in ('platform', 'provider', 'customer'))
);

CREATE TABLE public."realms" (
  "id" uuid primary key default gen_random_uuid(),
  "domain" text not null unique,
  "provider_org_id" uuid not null references public.orgs(id) on delete cascade,
  "theme" jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

CREATE TABLE public."release_notes" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "scope" text not null,
  "ref_id" text not null,
  "from_version" text,
  "to_version" text not null,
  "classification" text not null,
  "effective_date" date,
  "notes_md" text,
  "created_by" uuid references users(id),
  "created_at" timestamptz not null default now()
);

CREATE TABLE public."revenue_charity_registry" (
  "id" uuid primary key default gen_random_uuid(),
  "charity_name" text not null,
  "charity_address" text,
  "source_resource_id" text,
  "snapshot_fingerprint" text,
  "refreshed_at" timestamptz default now(),
  "created_at" timestamptz default now(),
  CONSTRAINT "anon_1" unique(charity_name, source_resource_id)
);

CREATE TABLE public."rule_versions" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "rule_id" text not null,
  "version" text not null,
  "logic_jsonb" jsonb not null,
  "sources" jsonb not null,
  "checksum" text not null,
  "created_by" uuid references users(id),
  "created_at" timestamptz not null default now(),
  CONSTRAINT "anon_1" unique(org_id, rule_id, version)
);

CREATE TABLE public."source_registry" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "name" text not null,
  "url" text not null,
  "parser" text not null,
  "jurisdiction" text,
  "category" text,
  "created_at" timestamptz not null default now(),
  CONSTRAINT "anon_1" unique(org_id, url)
);

CREATE TABLE public."source_snapshot" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "source_id" uuid not null references source_registry(id) on delete cascade,
  "fetched_at" timestamptz not null default now(),
  "content_hash" text not null,
  "parsed_facts" jsonb not null,
  "storage_ref" text,
  "created_at" timestamptz not null default now(),
  CONSTRAINT "anon_1" unique(source_id, content_hash)
);

CREATE TABLE public."step_type_versions" (
  "id" uuid primary key default gen_random_uuid(),
  "step_type_id" uuid references step_types(id) on delete cascade,
  "version" text not null,
  "definition" jsonb not null,
  "input_schema_id" uuid references json_schemas(id),
  "output_schema_id" uuid references json_schemas(id),
  "status" text check (status in ('draft','published','deprecated')) default 'draft',
  "created_by" uuid references users(id),
  "created_at" timestamptz default now(),
  "published_at" timestamptz,
  CONSTRAINT "anon_1" unique(step_type_id, version)
);

CREATE TABLE public."step_types" (
  "id" uuid primary key default gen_random_uuid(),
  "slug" text unique not null,
  "title" text not null,
  "category" text,
  "summary" text,
  "latest_version" text,
  "created_by" uuid references users(id),
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now()
);

CREATE TABLE public."steps" (
  "id" uuid primary key default gen_random_uuid(),
  "run_id" uuid references workflow_runs(id),
  "org_id" uuid not null references organisations(id),
  "subject_org_id" uuid references organisations(id),
  "key" text not null,
  "title" text not null,
  "status" text check (status in ('todo','in_progress','waiting','blocked','done')) default 'todo',
  "orchestration_run_id" text,
  "execution_mode" text check (execution_mode in ('manual','temporal')) not null default 'manual',
  "due_date" date,
  "assignee_user_id" uuid references users(id),
  "step_type_version_id" uuid,
  "permissions" text[] default '{}'::text[]
);

CREATE TABLE public."template_versions" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "template_id" text not null,
  "version" text not null,
  "storage_ref" text not null,
  "checksum" text not null,
  "created_by" uuid references users(id),
  "created_at" timestamptz not null default now(),
  CONSTRAINT "anon_1" unique(org_id, template_id, version)
);

CREATE TABLE public."tenant_branding" (
  "org_id" uuid primary key references organisations(id) on delete cascade,
  "tokens" jsonb not null default '{}'::jsonb,
  "logo_url" text,
  "favicon_url" text,
  "typography" jsonb not null default '{}'::jsonb,
  "pdf_header" jsonb not null default '{}'::jsonb,
  "pdf_footer" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

CREATE TABLE public."tenant_domains" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id) on delete cascade,
  "domain" text not null check (domain = lower(domain)),
  "is_primary" boolean not null default false,
  "verified_at" timestamptz,
  "cert_status" text not null default 'pending' check (cert_status in (
    'pending',
    'provisioning',
    'issued',
    'failed',
    'revoked'
  )),
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  CONSTRAINT "tenant_domains_domain_not_blank" constraint tenant_domains_domain_not_blank check (length(trim(domain)) > 0),
  CONSTRAINT "anon_2" unique(domain)
);

CREATE TABLE public."tenant_secret_bindings" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id) on delete cascade,
  "alias" text not null,
  "description" text,
  "provider" text,
  "external_id" text not null,
  "created_at" timestamptz default now(),
  CONSTRAINT "anon_1" unique(org_id, alias)
);

CREATE TABLE public."tenant_step_type_installs" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not  references organisations(id) on delete cascade NOT NULL,
  "step_type_version_id" uuid,
  "installed_at" timestamptz default now(),
  "status" text check (status in ('enabled','disabled')) default 'enabled',
  CONSTRAINT "anon_1" unique(org_id, step_type_version_id)
);

CREATE TABLE public."tenant_workflow_overlays" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id) on delete cascade,
  "workflow_def_id" uuid not null,
  "title" text not null,
  "patch" jsonb not null,
  "status" text check (status in ('draft','published','archived')) default 'draft',
  "created_by" uuid references users(id),
  "updated_at" timestamptz default now(),
  "created_at" timestamptz default now(),
  CONSTRAINT "anon_1" unique(org_id, workflow_def_id, title)
);

CREATE TABLE public."users" (
  "id" uuid primary key default gen_random_uuid(),
  "email" text unique not null,
  "name" text,
  "created_at" timestamptz default now()
);

CREATE TABLE public."workflow_def_versions" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "workflow_def_id" uuid not null,
  "version" text not null,
  "graph_jsonb" jsonb not null,
  "rule_ranges" jsonb not null default '{}'::jsonb,
  "template_ranges" jsonb not null default '{}'::jsonb,
  "checksum" text not null,
  "created_by" uuid references users(id),
  "created_at" timestamptz not null default now(),
  CONSTRAINT "anon_1" unique(workflow_def_id, version)
);

CREATE TABLE public."workflow_defs" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "key" text not null,
  "version" text not null,
  "title" text not null,
  "dsl_json" jsonb not null,
  "created_at" timestamptz default now(),
  CONSTRAINT "anon_1" unique(org_id, id)
);

CREATE TABLE public."workflow_overlay_layers" (
  "id" uuid primary key default gen_random_uuid(),
  "snapshot_id" uuid references workflow_overlay_snapshots(id) on delete cascade,
  "source" text not null,
  "patch" jsonb not null,
  "created_at" timestamptz default now()
);

CREATE TABLE public."workflow_overlay_snapshots" (
  "id" uuid primary key default gen_random_uuid(),
  "run_id" uuid references workflow_runs(id) on delete cascade,
  "tenant_overlay_id" uuid references tenant_workflow_overlays(id),
  "applied_overlays" jsonb not null default '[]'::jsonb,
  "merged_workflow" jsonb not null,
  "created_at" timestamptz default now()
);

CREATE TABLE public."workflow_pack_versions" (
  "id" uuid primary key default gen_random_uuid(),
  "org_id" uuid not null references organisations(id),
  "pack_id" text not null,
  "version" text not null,
  "overlay_jsonb" jsonb not null,
  "checksum" text not null,
  "created_by" uuid references users(id),
  "created_at" timestamptz not null default now(),
  CONSTRAINT "anon_1" unique(org_id, pack_id, version)
);

CREATE TABLE public."workflow_runs" (
  "id" uuid primary key default gen_random_uuid(),
  "workflow_def_id" uuid,
  "subject_org_id" uuid references organisations(id),
  "engager_org_id" uuid references organisations(id),
  "org_id" uuid not null references organisations(id),
  "status" text check (status in ('draft','active','done','archived')) default 'active',
  "orchestration_provider" text not null default 'none',
  "orchestration_workflow_id" text,
  "created_by_user_id" uuid references users(id),
  "merged_workflow_snapshot" jsonb,
  "created_at" timestamptz default now()
);
