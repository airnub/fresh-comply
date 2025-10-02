export type SupabaseClientStub = {
  from: () => SupabaseClientStub;
  select: () => Promise<unknown>;
};

export function getSupabaseClient(): SupabaseClientStub {
  return {
    from() {
      return this;
    },
    async select() {
      console.warn("Supabase client not configured; returning empty result.");
      return [];
    }
  };
}
