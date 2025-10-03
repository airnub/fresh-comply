# FreshComply Privacy Notice

_Last updated: 2 October 2025_

FreshComply ("we", "us") provides a workflow platform that enables accounting and compliance professionals to collaborate with their clients. This notice explains how we process personal data as a controller and as a processor in accordance with the GDPR and Irish Data Protection Acts.

## 1. Roles & Scope
- **Controller**: Product analytics, platform telemetry, billing, marketing, and support requests.
- **Processor**: Client-uploaded documents, workflow inputs, generated policies, audit evidence, and data subject request artifacts processed on behalf of customer organisations.

We process data for users located in the European Economic Area (EEA) and the United Kingdom.

## 2. Lawful Bases & Purposes
| Processing Purpose | Lawful Basis | Description |
| --- | --- | --- |
| Account provisioning, authentication, tenant administration | Contract (Art. 6(1)(b)) | Required to deliver contracted services |
| Workflow storage, evidence handling, document generation | Contract (Art. 6(1)(b)) | Processor activities executed per customer instruction |
| Product analytics (pseudonymised) | Legitimate Interest (Art. 6(1)(f)) | Improve reliability and usability; subject to opt-out |
| Regulatory notifications and safety logs | Legal Obligation (Art. 6(1)(c)) | Maintain statutory compliance trail |
| Marketing communications | Consent (Art. 6(1)(a)) | Optional; withdraw via account settings |
| Cookie categories beyond strictly necessary | Consent (Art. 6(1)(a)) | Captured via consent banner |

## 3. Categories of Data
- Identification (name, email, organisation)
- Authentication (password hash, OAuth identifiers, multi-factor secrets)
- Workflow content (questionnaire responses, uploaded evidence)
- Audit records (actions, timestamps, actor metadata)
- Support interactions (tickets, chat transcripts)
- Telemetry (IP, device, browser, feature usage)

## 4. Retention
Retention policies are defined in `docs/LEGAL/DATA-RETENTION.md`. We apply soft deletion immediately on user-initiated erasure and purge backups within 30 days unless legal obligations require longer retention.

## 5. Subprocessors & International Transfers
Our subprocessors, their services, and hosting regions are listed in `docs/LEGAL/SUBPROCESSORS.md`. For transfers outside the EEA/UK we rely on Standard Contractual Clauses (SCCs) with supplementary measures.

## 6. Data Subject Rights
Data subjects may exercise access, rectification, erasure, restriction, objection, and portability rights by visiting `/api/dsr/<type>` or contacting privacy@freshcomply.eu. Requests receive acknowledgement within 72 hours and fulfilment within 30 days (extendable per Art. 12(3)). Identity verification is performed prior to disclosure. All requests enter the DSR console where authorised administrators can:

- View queue status (`received`, `acknowledged`, `in_progress`, `paused`, `completed`, `escalated`) with received, acknowledgement, and due timestamps.
- Reassign handlers or pause processing with documented reasons while preserving legal-hold requirements.
- Trigger completion workflows that mark the request resolved and produce audit evidence.

Each state transition writes to the audit log (actor, timestamp, reason), and automated jobs escalate overdue requests to the privacy team daily until completion.

## 7. Security
- Encryption in transit (TLS 1.3) and at rest (AES-256)
- Role-based access controls (RBAC) with least privilege
- Annual penetration testing and quarterly vulnerability scanning
- Administrative actions captured in immutable audit logs

## 8. Cookies & Tracking
Strictly necessary cookies ensure authentication and session security. Analytics, preference, and marketing cookies are optional and disabled until consent. See `docs/LEGAL/COOKIES.md` for details.

## 9. Incident Response
We follow the procedure outlined in `docs/LEGAL/INCIDENT-RESPONSE.md`, including 72-hour supervisory authority notifications when required.

## 10. Contact
FreshComply Privacy Team  
Stephen Court, Hanover Street, Dublin 2, D02K285, Ireland  
privacy@freshcomply.eu  
Data Protection Officer: outsourced to DataTrust IE Ltd.
