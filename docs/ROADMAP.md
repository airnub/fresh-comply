# Roadmap — FreshComply

## Milestone 1 (Weeks 1–3)
- Monorepo scaffold; Next.js portal skeleton
- Engine MVP: parse DSL, render steps; Timeline + Task Board
- Supabase schema + RLS stubs; demo seed
- Notifications (in-app) and basic email

## Milestone 2 (Weeks 4–7)
- Freshness Engine v1: sources registry, manual re-verify, CKAN watcher
- Connectors: CRO Open Services (read), Charities CKAN, Funding Radar v1
- CRO company import & sync: search CRO by name/number, ingest latest profile + ARD
- Document factory (minutes, TR2 helper, policy stubs)

## Milestone 3 (Weeks 8–11)
- Engagement flows (act on behalf), audit, ICS feeds
- SLA/escalation notifications; public read-only progress view (optional)
- ROS integration exploration (cert onboarding) or guided filing polish

## Milestone 4 (Weeks 12–14)
- Internationalization rollout: locale-aware routing, translation pipeline, ga-IE pilot content
- Theme system: light/dark/high-contrast tokens, SSR theme provider, reduced-motion defaults
- Update workflow metadata to support `*_i18n` fields; translator QA checklist

## Milestone 5 (Weeks 15–17)
- Accessibility audit (WCAG 2.2 AA), remediation of critical issues, automated lint + Pa11y CI
- Keyboard navigation scripts, focus management, accessible document outputs
- Inclusive design review with representative users

## Milestone 6 (Weeks 18–20)
- GDPR go-live: consent banner, legal pages, DSR intake queue, audit log enhancements
- DPA & subprocessor registry publication with notification workflow
- Internal tabletop exercise for breach response and annual RoPA/DPIA review
