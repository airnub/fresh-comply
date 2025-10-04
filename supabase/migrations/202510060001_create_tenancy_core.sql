-- Core tenancy tables for organisations, memberships, and realms
set check_function_bodies = off;

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('platform', 'provider', 'customer')),
  parent_org_id uuid references public.orgs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orgs_parent_idx on public.orgs (parent_org_id);

create table if not exists public.org_memberships (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('member', 'org_admin', 'provider_admin', 'platform_admin')),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_memberships_user_role_idx
  on public.org_memberships (user_id, role);

create index if not exists org_memberships_org_status_idx
  on public.org_memberships (org_id, status);

create table if not exists public.realms (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  provider_org_id uuid not null references public.orgs(id) on delete cascade,
  theme jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists realms_provider_idx on public.realms (provider_org_id);
