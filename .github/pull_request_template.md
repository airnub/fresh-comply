## Summary
- What and why:

## Governance
- [ ] This PR does **NOT** edit locked governance docs
- If it does:
  - [ ] Labeled **allow-spec-edit**
  - [ ] Two owners will approve

## Safety
- [ ] No RLS policies with `… IS NULL` on tenant keys
- [ ] No client writes to `platform.*`
- [ ] Migrations idempotent; backfills safe
- [ ] Tests updated
