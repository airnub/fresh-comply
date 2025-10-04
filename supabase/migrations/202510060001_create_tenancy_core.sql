-- Core tenancy tables for organisations, memberships, and realms
set check_function_bodies = off;

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.org_memberships (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'member', 'provider_admin')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_memberships_user_role_idx
  on public.org_memberships (user_id, role);

create table if not exists public.realms (
  id uuid primary key default gen_random_uuid(),
  host text not null unique,
  org_id uuid not null references public.orgs(id) on delete cascade,
  provider_org_id uuid references public.orgs(id) on delete set null,
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists realms_org_idx on public.realms (org_id);
create index if not exists realms_provider_idx on public.realms (provider_org_id);
