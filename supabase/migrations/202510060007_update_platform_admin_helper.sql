-- Align app.is_platform_admin with platform_admin role claims
set check_function_bodies = off;

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
        when 'string' then lower(payload->>'is_platform_admin') in ('true', 't', '1', 'yes', 'y', 'on')
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
