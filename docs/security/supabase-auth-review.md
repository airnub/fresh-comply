# Supabase Auth & RLS Security Review

## Scope
- Verify implementation of Supabase authentication using `@supabase/ssr` within the Next.js app.
- Confirm that row-level security (RLS) policies are enabled and enforced on the relevant database tables.

## Findings
1. **Supabase client integration implemented.**
   - The portal now depends on `@supabase/ssr`/`@supabase/supabase-js`, with server helpers (`apps/portal/src/server/supabase.ts`) and the auth middleware instantiating a session-aware client.【F:apps/portal/src/server/supabase.ts†L1-L97】【F:apps/portal/src/middleware.ts†L1-L58】
2. **Authentication flows enforced.**
   - Locale-aware middleware refreshes sessions and redirects unauthenticated users, and new `/auth/sign-in`, `/auth/callback`, and `/auth/sign-out` routes drive a magic-link OTP flow via Supabase.【F:apps/portal/src/app/auth/sign-in/page.tsx†L1-L73】【F:apps/portal/src/app/auth/callback/route.ts†L1-L45】【F:apps/portal/src/app/auth/sign-out/route.ts†L1-L39】
3. **Database RLS hardened.**
   - `packages/db/schema.sql` enables RLS across all tenant tables with policies scoped to engager/subject organisations, helper functions (`is_member_of_org`, `can_access_run`), and a verification script (`packages/db/check-rls.mjs`).【F:packages/db/schema.sql†L1-L156】【F:packages/db/check-rls.mjs†L1-L54】

## Risk Assessment
- **Status:** Mitigated (controls implemented and validated).
- **Impact:** With authenticated sessions and strict RLS policies, data exposure risk is substantially reduced; remaining impact aligns with Supabase platform guarantees.
- **Likelihood:** Low, assuming environment variables are configured and verify scripts remain in CI.

## Recommendations
1. **Operationalise the auth flow.**
   - Configure Supabase project keys in deployment environments and monitor the `/auth` routes for error cookies (`supabase-auth-error`).
2. **Keep RLS verification in CI.**
   - Add `pnpm --filter @airnub/db run verify:rls` to the build pipeline so policy regressions fail fast.【F:packages/db/check-rls.mjs†L34-L54】
3. **Profile provisioning.**
   - Automate syncing Supabase auth users into the `users` table so profile reads always succeed (e.g., via triggers or server-side upserts).

## Conclusion
Supabase authentication and multi-tenant RLS are now in place. Continue to run the automated RLS check and monitor Supabase configuration to maintain the desired security posture.
