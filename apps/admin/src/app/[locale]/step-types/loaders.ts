import "server-only";

import { cache } from "react";
import { getSupabaseServiceRoleClient } from "@/lib/auth/supabase-service-role";

import type {
  StepTypeRegistryEntry,
  StepTypeVersionLedgerEntry,
  TenantStepTypeInstall,
  TenantSecretBinding,
  WorkflowOverlaySnapshot,
} from "./types";

interface RpcError {
  message: string;
  details?: string | null;
  hint?: string | null;
}

async function callRpc<T>(procedure: string, params: Record<string, unknown> = {}): Promise<T> {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client.rpc<T>(procedure, params);

  if (error) {
    const rpcError: RpcError = {
      message: error.message,
      details: "details" in error ? (error as RpcError).details : undefined,
      hint: "hint" in error ? (error as RpcError).hint : undefined,
    };

    throw new Error(
      `[admin:rpc] ${procedure} failed: ${rpcError.message}${rpcError.details ? ` — ${rpcError.details}` : ""}`
    );
  }

  return (data ?? []) as T;
}

export const loadStepTypeRegistry = cache(async (): Promise<StepTypeRegistryEntry[]> => {
  try {
    return await callRpc<StepTypeRegistryEntry[]>("admin_list_step_types");
  } catch (error) {
    console.error("Failed to load step type registry", error);
    return [];
  }
});

export const loadStepTypeVersions = cache(async (): Promise<StepTypeVersionLedgerEntry[]> => {
  try {
    return await callRpc<StepTypeVersionLedgerEntry[]>("admin_list_step_type_versions");
  } catch (error) {
    console.error("Failed to load step type versions", error);
    return [];
  }
});

export const loadTenantInstalls = cache(async (): Promise<TenantStepTypeInstall[]> => {
  try {
    return await callRpc<TenantStepTypeInstall[]>("admin_list_tenant_step_type_installs");
  } catch (error) {
    console.error("Failed to load tenant installs", error);
    return [];
  }
});

export const loadSecretBindings = cache(async (): Promise<TenantSecretBinding[]> => {
  try {
    return await callRpc<TenantSecretBinding[]>("admin_list_tenant_secret_bindings");
  } catch (error) {
    console.error("Failed to load secret bindings", error);
    return [];
  }
});

export const loadOverlaySnapshots = cache(async (): Promise<WorkflowOverlaySnapshot[]> => {
  try {
    return await callRpc<WorkflowOverlaySnapshot[]>("admin_list_workflow_overlay_snapshots");
  } catch (error) {
    console.error("Failed to load workflow overlays", error);
    return [];
  }
});
