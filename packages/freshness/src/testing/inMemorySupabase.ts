import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@airnub/types/supabase";

type TableName = keyof Database["public"]["Tables"];

type TableRow<T extends TableName> = Database["public"]["Tables"][T]["Row"];
type TableInsert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];

type SelectState = {
  filters: { column: string; value: unknown; op: "eq" | "in" }[];
  order?: { column: string; ascending: boolean };
  limit?: number;
};

type UpdateState<T extends TableName> = SelectState & { values: Partial<TableRow<T>> };

export type InMemorySupabase = {
  client: SupabaseClient<Database>;
  getTableRows<T extends TableName>(table: T): TableRow<T>[];
};

export function createInMemorySupabase(
  initialData: Partial<{ [K in TableName]: Partial<TableRow<K>>[] }> = {}
): InMemorySupabase {
  const tables = new Map<TableName, TableRow<TableName>[]>();

  for (const [key, value] of Object.entries(initialData) as [TableName, Partial<TableRow<TableName>>[]][]) {
    tables.set(key, value.map((row) => ensureRowDefaults(key, row)) as TableRow<TableName>[]);
  }

  function getRows<T extends TableName>(table: T) {
    if (!tables.has(table)) {
      tables.set(table, []);
    }
    return tables.get(table)! as TableRow<T>[];
  }

  const client = {
    from<T extends TableName>(table: T) {
      return {
        select(_columns?: string) {
          const state: SelectState = { filters: [] };
          const rows = getRows(table);
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
            then(onFulfilled: (value: { data: TableRow<T>[]; error: null }) => unknown, onRejected?: (reason?: unknown) => unknown) {
              return builder.all().then(onFulfilled, onRejected);
            }
          };
          return builder;
        },
        insert(payload: TableInsert<T> | TableInsert<T>[]) {
          const inserts = Array.isArray(payload) ? payload : [payload];
          const created = inserts.map((row) => ensureRowDefaults(table, row));
          const rows = getRows(table);
          rows.push(...(created as TableRow<T>[]));
          return {
            select(_columns?: string) {
              return {
                single: async () => ({ data: created[0] as TableRow<T>, error: null }),
                maybeSingle: async () => ({ data: created[0] as TableRow<T>, error: null })
              };
            }
          };
        },
        update(values: Partial<TableRow<T>>) {
          const state: UpdateState<T> = { filters: [], values };
          const rows = getRows(table);
          const updateBuilder = {
            eq(column: string, value: unknown) {
              state.filters.push({ column, value, op: "eq" });
              return updateBuilder;
            },
            maybeSingle: async () => {
              const matches = applyUpdate(rows, state, table);
              return { data: matches[0] ?? null, error: null };
            },
            select(_columns?: string) {
              return {
                maybeSingle: async () => {
                  const matches = applyUpdate(rows, state, table);
                  return { data: matches[0] ?? null, error: null };
                }
              };
            },
            then(onFulfilled: (value: { data: TableRow<T> | null; error: null }) => unknown, onRejected?: (reason?: unknown) => unknown) {
              return updateBuilder.maybeSingle().then(onFulfilled, onRejected);
            }
          };
          return updateBuilder;
        },
        upsert(payload: TableInsert<T> | TableInsert<T>[], options?: { onConflict?: string }) {
          const inserts = Array.isArray(payload) ? payload : [payload];
          const rows = getRows(table);
          const conflictKeys = options?.onConflict?.split(",").map((key) => key.trim()).filter(Boolean) ?? [];
          for (const insert of inserts) {
            const resolved = ensureRowDefaults(table, insert);
            const existing = conflictKeys.length
              ? rows.find((row) => conflictKeys.every((key) => (row as Record<string, unknown>)[key] === (resolved as Record<string, unknown>)[key]))
              : undefined;
            if (existing) {
              Object.assign(existing, resolved, updatedTimestamps(table));
            } else {
              rows.push(resolved as TableRow<T>);
            }
          }
          return Promise.resolve({ data: null, error: null });
        }
      };
    }
  } as unknown as SupabaseClient<Database>;

  return { client, getTableRows: getRows };
}

function applyFilters<T extends TableName>(rows: TableRow<T>[], state: SelectState | UpdateState<T>) {
  let result = rows.slice();
  for (const filter of state.filters) {
    if (filter.op === "eq") {
      result = result.filter((row) => (row as Record<string, unknown>)[filter.column] === filter.value);
    } else if (filter.op === "in") {
      const set = new Set(filter.value as unknown[]);
      result = result.filter((row) => set.has((row as Record<string, unknown>)[filter.column]));
    }
  }

  if (state.order) {
    const { column, ascending } = state.order;
    result.sort((a, b) => {
      const av = (a as Record<string, unknown>)[column];
      const bv = (b as Record<string, unknown>)[column];
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

function applyUpdate<T extends TableName>(rows: TableRow<T>[], state: UpdateState<T>, table: T) {
  const matches = applyFilters(rows, state);
  for (const match of matches) {
    Object.assign(match, state.values, updatedTimestamps(table));
  }
  return matches;
}

function ensureRowDefaults<T extends TableName>(table: T, row: Partial<TableRow<T>> | Partial<TableInsert<T>>): TableRow<T> {
  const base = { ...row } as Record<string, unknown>;
  if (!base.id) {
    base.id = randomUUID();
  }
  if (table === "moderation_queue") {
    base.created_at = base.created_at ?? new Date().toISOString();
    base.updated_at = base.updated_at ?? new Date().toISOString();
    base.status = base.status ?? "pending";
    base.proposal = base.proposal ?? null;
  }
  if (table === "source_snapshot") {
    base.fetched_at = base.fetched_at ?? new Date().toISOString();
    base.created_at = base.created_at ?? new Date().toISOString();
  }
  if (table === "change_event") {
    base.detected_at = base.detected_at ?? new Date().toISOString();
    base.created_at = base.created_at ?? new Date().toISOString();
  }
  if (table === "workflow_defs") {
    base.created_at = base.created_at ?? new Date().toISOString();
  }
  return base as TableRow<T>;
}

function updatedTimestamps<T extends TableName>(table: T) {
  if (table === "moderation_queue") {
    return { updated_at: new Date().toISOString() };
  }
  return {};
}
