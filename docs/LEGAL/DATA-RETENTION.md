# Data Retention Schedule

| Data Category | System | Default Retention | Notes |
| --- | --- | --- | --- |
| User accounts | Supabase Auth | Life of contract + 90 days | Soft delete immediately on deactivation |
| Workflow runs & steps | Supabase Postgres | Life of engagement + 6 years | Supports statutory record-keeping |
| Uploaded evidence | Supabase Storage | Life of engagement + 6 years | Encryption at rest; hashed filenames |
| Generated documents | Supabase Storage | Life of engagement + 6 years | Accessible HTML alternative retained |
| Audit logs | Supabase Postgres | 7 years | Immutable append-only table |
| Support tickets | Linear | 3 years | Redact sensitive data in 30 days |
| Analytics events | Sentry | 13 months | IP truncated, aggregated |
| Backups | Supabase PITR | 30 days | Encrypted, access logged |

Retention overrides may be configured per customer through contractual addenda. Legal hold suspends deletion until release by authorised counsel.
