# Tenancy Design – White-Label Platform

> **Note**
> The source specification content referenced in the implementation brief was not provided to the automation agent. This document captures a placeholder summary so the file path exists and is protected by governance automation. Replace this content with the official spec text during editorial review.

## Summary

- Defines the shared, provider, and tenant tenancy layers for the Fresh Comply platform.
- Documents the responsibilities of the new `platform.*` schema, including rule catalog distribution.
- Describes realm resolution and white-label theming for provider branded experiences.
- Outlines role-based access leveraging `app.has_org_access` and `app.is_platform_admin` helpers.

## Next Steps

1. Attach the authoritative specification text under governance controls.
2. Update cross-references in the consolidated architecture spec once the final copy is available.
3. Run `pnpm test:rls-smoke` after applying the supabase migrations introduced alongside this placeholder to ensure policy coverage.
