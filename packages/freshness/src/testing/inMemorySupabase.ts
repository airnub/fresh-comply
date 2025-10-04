import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@airnub/types/supabase";

type SchemaName = keyof Pick<Database, "public" | "platform" | "app">;

type SelectState = {
  filters: { column: string; value: unknown; op: "eq" | "in" }[];
  order?: { column: string; ascending: boolean };
  limit?: number;
};

type UpdateState = SelectState & { values: Record<string, unknown> };

type TableIdentifier = `${string}.${string}`;

export type InMemorySupabase = {
  client: SupabaseClient<Database>;
  getTableRows(table: string): Record<string, unknown>[];
};

export function createInMemorySupabase(
  initialData: Partial<Record<string, Partial<Record<string, unknown>>[]>> = {}
): InMemorySupabase {
  const tables = new Map<TableIdentifier, Record<string, unknown>[]>();

  for (const [rawKey, value] of Object.entries(initialData)) {
    const { schema, table } = parseTableKey(rawKey);
    const key = makeKey(schema, table);
    const rows = value?.map((row) => ensureRowDefaults(schema, table, row)) ?? [];
    tables.set(key, rows);
  }

  function getRows(schema: SchemaName, table: string) {
    const key = makeKey(schema, table);
    if (!tables.has(key)) {
      tables.set(key, []);
    }
    return tables.get(key)!;
  }

  const client = {
    from(table: string) {
      return buildTableApi("public", table);
    },
    schema(target: SchemaName) {
      return {
        from(table: string) {
          return buildTableApi(target, table);
        }
      };
    }
  } as unknown as SupabaseClient<Database>;

  function buildTableApi(schema: SchemaName, table: string) {
    return {
      select(_columns?: string) {
        const state: SelectState = { filters: [] };
        const rows = getRows(schema, table);
        const builder = {
          eq(column: string, value: unknown) {
            state.filters.push({ column, value, op: "eq" });
            return builder;
          },
          in(column: string, values: unknown[]) {
            state.filters.push({ column, value: values, op: "in" });
            return builder;
          },
          order(column: string, options?: { ascending?: boolean }) {
            state.order = { column, ascending: options?.ascending !== false };
            return builder;
          },
          limit(value: number) {
            state.limit = value;
            return builder;
          },
          maybeSingle: async () => ({ data: applyFilters(rows, state)[0] ?? null, error: null }),
          single: async () => {
            const match = applyFilters(rows, state)[0];
            if (!match) {
              return { data: null, error: { message: "not found" } };
            }
            return { data: match, error: null };
          },
          all: async () => ({ data: applyFilters(rows, state), error: null }),
          then(onFulfilled: (value: { data: Record<string, unknown>[]; error: null }) => unknown, onRejected?: (reason?: unknown) => unknown) {
            return builder.all().then(onFulfilled, onRejected);
          }
        };
        return builder;
      },
      insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        const inserts = Array.isArray(payload) ? payload : [payload];
        const created = inserts.map((row) => ensureRowDefaults(schema, table, row));
        const rows = getRows(schema, table);
        rows.push(...created);
        return {
          select(_columns?: string) {
            return {
              single: async () => ({ data: created[0], error: null }),
              maybeSingle: async () => ({ data: created[0], error: null })
            };
          }
        };
      },
      update(values: Record<string, unknown>) {
        const state: UpdateState = { filters: [], values };
        const rows = getRows(schema, table);
        const updateBuilder = {
          eq(column: string, value: unknown) {
            state.filters.push({ column, value, op: "eq" });
            return updateBuilder;
          },
          maybeSingle: async () => {
            const matches = applyUpdate(rows, state, schema, table);
            return { data: matches[0] ?? null, error: null };
          },
          select(_columns?: string) {
            return {
              maybeSingle: async () => {
                const matches = applyUpdate(rows, state, schema, table);
                return { data: matches[0] ?? null, error: null };
              }
            };
          },
          then(onFulfilled: (value: { data: Record<string, unknown> | null; error: null }) => unknown, onRejected?: (reason?: unknown) => unknown) {
            return updateBuilder.maybeSingle().then(onFulfilled, onRejected);
          }
        };
        return updateBuilder;
      },
      upsert(payload: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) {
        const inserts = Array.isArray(payload) ? payload : [payload];
        const rows = getRows(schema, table);
        const conflictKeys = options?.onConflict?.split(",").map((key) => key.trim()).filter(Boolean) ?? [];
        for (const insert of inserts) {
          const resolved = ensureRowDefaults(schema, table, insert);
          const existing = conflictKeys.length
            ? rows.find((row) => conflictKeys.every((key) => row[key] === resolved[key]))
            : undefined;
          if (existing) {
            Object.assign(existing, resolved, updatedTimestamps(schema, table));
          } else {
            rows.push(resolved);
          }
        }
        return Promise.resolve({ data: null, error: null });
      }
    };
  }

  return {
    client,
    getTableRows(table: string) {
      const { schema, table: tableName } = parseTableKey(table);
      return getRows(schema, tableName);
    }
  };
}

function applyFilters(rows: Record<string, unknown>[], state: SelectState | UpdateState) {
  let result = rows.slice();
  for (const filter of state.filters) {
    if (filter.op === "eq") {
      result = result.filter((row) => row[filter.column] === filter.value);
    } else if (filter.op === "in") {
      const set = new Set(filter.value as unknown[]);
      result = result.filter((row) => set.has(row[filter.column]));
    }
  }

  if (state.order) {
    const { column, ascending } = state.order;
    result.sort((a, b) => {
      const av = a[column];
      const bv = b[column];
      if (av === bv) return 0;
      if (av === undefined || av === null) return ascending ? -1 : 1;
      if (bv === undefined || bv === null) return ascending ? 1 : -1;
      return ascending ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }

  if (state.limit !== undefined) {
    result = result.slice(0, state.limit);
  }

  return result;
}

function applyUpdate(
  rows: Record<string, unknown>[],
  state: UpdateState,
  schema: SchemaName,
  table: string
) {
  const matches = applyFilters(rows, state);
  for (const match of matches) {
    Object.assign(match, state.values, updatedTimestamps(schema, table));
  }
  return matches;
}

function ensureRowDefaults(
  schema: SchemaName,
  table: string,
  row: Partial<Record<string, unknown>>
): Record<string, unknown> {
  const base = { ...row };
  const key = makeKey(schema, table);
  const tablesWithoutId = new Set<TableIdentifier>(["platform.rule_pack_detection_sources"]);
  if (!tablesWithoutId.has(key) && base.id === undefined) {
    base.id = randomUUID();
  }
  if (key === "public.moderation_queue") {
    base.created_at = base.created_at ?? new Date().toISOString();
    base.updated_at = base.updated_at ?? new Date().toISOString();
    base.status = base.status ?? "pending";
    base.proposal = base.proposal ?? null;
  }
  if (key === "public.source_snapshot") {
    base.fetched_at = base.fetched_at ?? new Date().toISOString();
    base.created_at = base.created_at ?? new Date().toISOString();
  }
  if (key === "public.change_event") {
    base.detected_at = base.detected_at ?? new Date().toISOString();
    base.created_at = base.created_at ?? new Date().toISOString();
  }
  if (key === "public.workflow_defs") {
    base.created_at = base.created_at ?? new Date().toISOString();
  }
  if (key === "platform.rule_source_snapshots") {
    base.fetched_at = base.fetched_at ?? new Date().toISOString();
    base.created_at = base.created_at ?? new Date().toISOString();
  }
  if (key === "platform.rule_pack_detections") {
    base.detected_at = base.detected_at ?? new Date().toISOString();
    base.status = base.status ?? "open";
  }
  if (key === "platform.rule_pack_detection_sources") {
    base.change_summary = base.change_summary ?? {};
  }
  return base;
}

function updatedTimestamps(schema: SchemaName, table: string) {
  if (schema === "public" && table === "moderation_queue") {
    return { updated_at: new Date().toISOString() };
  }
  return {};
}

const KNOWN_SCHEMAS = new Set<SchemaName>(["public", "platform", "app"] as SchemaName[]);

function parseTableKey(input: string): { schema: SchemaName; table: string } {
  const [maybeSchema, maybeTable] = input.includes(".") ? input.split(".", 2) : ["public", input];
  if (KNOWN_SCHEMAS.has(maybeSchema as SchemaName)) {
    return { schema: maybeSchema as SchemaName, table: maybeTable };
  }
  return { schema: "public", table: input };
}

function makeKey(schema: SchemaName, table: string): TableIdentifier {
  return `${schema}.${table}`;
}
