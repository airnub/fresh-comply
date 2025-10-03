# ADR 0001 — Temporal Orchestration

- **Status:** Accepted
- **Date:** 2025-10-03

## Decision

Adopt Temporal as the orchestration engine for short- and medium-lived workflow actions while keeping the FreshComply Next.js portal as the sole end-user interface. Temporal Web UI remains an operations-only tool.

## Context

FreshComply needs durable retries, human-in-the-loop coordination, and consistent state transitions for external actions such as CRO lookups, TR2 helper submissions via the internal bridge, ROS/eTax checks, and document packaging uploads. Existing cron/queue approaches provide limited visibility and cannot guarantee idempotent recovery when external systems fail or require human confirmation.

## Consequences

- Introduce a new package `@airnub/orchestrator-temporal` that hosts workflows, activities, and worker bootstrap code.
- Extend infrastructure with Temporal services in local `docker-compose` for developer parity and support Temporal Cloud (EU) or self-hosted clusters in production.
- Map orchestration metadata (`orchestration_provider`, `orchestration_workflow_id`, per-step `execution.mode`, and `orchestration_run_id`) onto `workflow_runs` and `steps` records.
- Provide Temporal-backed APIs for starting workflows, sending signals, and querying status while keeping the customer experience inside the custom UI.
