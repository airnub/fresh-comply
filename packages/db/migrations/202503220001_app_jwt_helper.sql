-- Introduce app.jwt() helper and update platform admin checks
set check_function_bodies = off;

create schema if not exists app;

create or replace function app.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
as $$
  with claims as (
    select app.jwt() as payload
  )
  select
    coalesce(payload->>'role', '') = 'platform_admin'
    or coalesce(
      case jsonb_typeof(payload->'is_platform_admin')
        when 'boolean' then (payload->'is_platform_admin')::boolean
        when 'string' then lower(payload->>'is_platform_admin') in ('true','t','1','yes','y','on')
        when 'number' then (payload->>'is_platform_admin')::numeric <> 0
        else null
      end,
      false
    )
    or coalesce(payload->>'role', '') = 'service_role'
  from claims;
$$;

comment on function app.is_platform_admin() is
  'Returns true when the JWT role is platform_admin, when is_platform_admin is truthy, '
  'or (for legacy internal automation) when the token role is service_role.';

create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  with claims as (
    select app.jwt() as payload
  )
  select case
    when payload ? 'org_id' then nullif(payload->>'org_id', '')::uuid
    else null
  end
  from claims;
$$;

create or replace function public.jwt_has_org(target_org_id uuid)
returns boolean
language sql
stable
as $$
  with claims as (
    select app.jwt() as payload
  )
  select exists (
    select 1
    from claims,
         jsonb_array_elements_text(coalesce(payload->'org_ids', '[]'::jsonb)) as org_id(value)
    where value = target_org_id::text
  );
$$;

create or replace function public.is_platform_service()
returns boolean
language sql
stable
as $$
  with claims as (
    select app.jwt() as payload
  )
  select auth.role() = 'service_role'
    or exists (
      select 1
      from claims,
           jsonb_array_elements_text(coalesce(payload->'role_paths', '[]'::jsonb)) as role_path(value)
      where value like 'platform:service%'
    );
$$;
