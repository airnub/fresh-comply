begin;

create table if not exists platform.rule_pack_proposals (
  id uuid primary key default gen_random_uuid(),
  detection_id uuid not null references platform.rule_pack_detections(id) on delete cascade,
  rule_pack_id uuid references platform.rule_packs(id) on delete set null,
  rule_pack_key text not null,
  current_version text,
  proposed_version text not null,
  changelog jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','in_review','approved','rejected','amended','published','superseded')),
  review_notes text,
  created_by uuid references users(id),
  approved_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  published_at timestamptz,
  unique (detection_id)
);

create index if not exists platform_rule_pack_proposals_status_idx
  on platform.rule_pack_proposals(status);

create index if not exists platform_rule_pack_proposals_pack_idx
  on platform.rule_pack_proposals(rule_pack_key, proposed_version);

alter table platform.rule_pack_proposals enable row level security;

create policy if not exists "Platform services manage rule pack proposals" on platform.rule_pack_proposals
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());

-- Backfill interim proposal data that previously lived on detections.diff/notes
insert into platform.rule_pack_proposals (
  detection_id,
  rule_pack_id,
  rule_pack_key,
  current_version,
  proposed_version,
  changelog,
  status,
  review_notes,
  created_by,
  created_at,
  updated_at,
  approved_at
)
select
  d.id as detection_id,
  d.rule_pack_id,
  d.rule_pack_key,
  d.current_version,
  d.proposed_version,
  jsonb_build_object(
    'summary', coalesce(d.notes, ''),
    'diff', coalesce(d.diff, '{}'::jsonb),
    'detected_at', coalesce(d.detected_at, now())
  ) as changelog,
  case d.status
    when 'approved' then 'approved'
    when 'rejected' then 'rejected'
    when 'in_review' then 'in_review'
    when 'superseded' then 'superseded'
    else 'pending'
  end as status,
  nullif(d.notes, '') as review_notes,
  d.created_by,
  coalesce(d.detected_at, now()) as created_at,
  now() as updated_at,
  case when d.status = 'approved' then coalesce(d.detected_at, now()) end as approved_at
from platform.rule_pack_detections d
on conflict (detection_id) do update set
  changelog = excluded.changelog,
  status = excluded.status,
  review_notes = excluded.review_notes,
  updated_at = excluded.updated_at,
  approved_at = excluded.approved_at;

commit;
