export interface StepTypeRegistryEntry {
  id: string;
  slug: string;
  title: string;
  category: string;
  latest_version: string;
  summary: string | null;
  published_versions: number;
}

export interface StepTypeVersionLedgerEntry {
  id: string;
  step_type_slug: string;
  version: string;
  status: "draft" | "published" | "archived" | string;
  published_at: string | null;
  schema_slug: string | null;
}

export interface TenantStepTypeInstall {
  id: string;
  tenant_name: string;
  org_slug: string;
  step_type_version: string;
  status: "enabled" | "disabled" | string;
  installed_at: string | null;
}

export interface TenantSecretBinding {
  id: string;
  tenant_name: string;
  alias: string;
  provider: string;
  external_id: string;
  last_verified_at?: string | null;
}

export interface WorkflowOverlaySnapshot {
  id: string;
  workflow_slug: string;
  tenant_name: string;
  overlay_count: number;
  created_at: string;
}

export interface MutationResponse {
  audit_id?: string | null;
  reason_code?: string | null;
  warnings?: string[];
  validation_errors?: string[];
}

export interface ApiErrorShape {
  error: string;
  details?: string | null;
  validationErrors?: string[] | null;
  auditId?: string | null;
}
