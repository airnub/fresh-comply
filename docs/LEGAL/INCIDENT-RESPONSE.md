# Incident Response Playbook

## Objectives
- Contain security incidents rapidly.
- Assess impact on confidentiality, integrity, and availability.
- Notify affected parties and regulators within statutory timelines.

## Severity Levels
| Level | Description | Target Response |
| --- | --- | --- |
| P0 | Active compromise of production data | Immediate (within 30 minutes); exec bridge |
| P1 | Suspected compromise or major service degradation | 1 hour |
| P2 | Contained vulnerability or non-production exposure | Same business day |
| P3 | Low-risk event, false positive | Next business day |

## Process
1. **Detect** – automated alerts (Sentry, Supabase audit logs) or manual reports.
2. **Triage** – Incident commander assigned; severity assessed; investigation logged in incident tracker.
3. **Contain** – Disable affected credentials, isolate infrastructure, block malicious IPs.
4. **Eradicate & Recover** – Patch vulnerabilities, restore from backups, validate integrity.
5. **Notify** – If personal data is likely at risk, inform DPO immediately. Regulator notification within 72 hours for P0/P1 incidents impacting EU subjects. Customer notifications coordinate with Controller responsibilities.
6. **Lessons Learned** – Post-incident review within 5 business days with remediation actions tracked to completion.

## Communications
- Internal incident Slack channel (#sec-incident)
- External counsel and breach coach available via retainer
- Draft customer communications stored in knowledge base; use templated emails from `packages/notifications`

## Evidence Handling
- Preserve logs (immutably stored for 1 year)
- Track chain-of-custody for extracted data
- Restrict access to investigation workspace to incident team only

## Testing
- Tabletop exercises twice per year
- Post-mortem outcomes feed into risk register and roadmap
