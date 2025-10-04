---
title: "ADR-0003: White-Label Multi-Tenant Architecture"
version: 1.0.0
status: Stable
---








# ADR-0003: White-Label Multi-Tenant Architecture

- **Status:** Accepted
- **Date:** 2025-10-03

## Decision

Adopt a white-label delivery model that allows partner organisations to operate branded FreshComply portals for their clients while platform administrators maintain a hardened back-office. The platform remains a single Next.js deployment backed by Supabase and Temporal, but isolates data, branding, orchestration queues, and integrations per tenant.

## Context

Partners such as accounting firms want to offer FreshComply under their own brand without sacrificing compliance guarantees or exposing other tenant data. The existing portal already supports overlays and shared workflow definitions, yet lacked domain-level branding, tenant-specific routing, and a clear separation of partner and platform responsibilities. We also need to preserve audit trails that show when partners act on behalf of client organisations and maintain secure ingress/egress for tenant-specific integrations.

## Consequences

- Introduce explicit tenant hierarchy (`platform → partner → client`) with Supabase RLS enforcing row ownership via `org_id` and `subject_org_id`.
- Add per-tenant configuration for branding, documents, and outbound communications, including custom domains, DKIM/SPF verification, and PDF/email theming.
- Route Temporal workflows through tenant-specific task queues (`tenant-{id}-main`) and tag spans/logs with tenant metadata for observability.
- Manage external integrations via tenant-scoped secret aliases and hardened webhook ingress that verifies HMAC signatures, timestamps, and replay protection.
- Deliver partner-facing admin surfaces for branding, domains, client management, overlays, and billing while operating a separate platform-admin app for global moderation and ops.
- Support partner- and client-billed monetisation options via Stripe Connect and surface subscription state in tenant records.

## References

- [White-Label Multi-Tenant Architecture Spec (v2025-10-03)](../specs/white-label-architecture.v1.0.0.md)
- [Secure Bidirectional Integration Architecture (v2025-10-03)](../specs/integration-architecture-bidirectional.v1.0.0.md)
- [ADR-0001: Temporal Orchestration](0001-temporal-orchestration.md)
