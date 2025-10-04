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
    or (
      payload ? 'is_platform_admin'
      and coalesce(
        case jsonb_typeof(payload->'is_platform_admin')
          when 'boolean' then (payload->'is_platform_admin')::boolean
          when 'string' then case
            when lower(nullif(payload->>'is_platform_admin', '')) in ('true', 'false')
              then (payload->>'is_platform_admin')::boolean
            else null
          end
          else null
        end,
        false
      )
    )
  from claims;
$$;

comment on function app.is_platform_admin() is
  'Returns true when the JWT role is platform_admin or when the is_platform_admin claim is boolean true. '
  'Service role access should continue through public.is_platform_service().';

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
