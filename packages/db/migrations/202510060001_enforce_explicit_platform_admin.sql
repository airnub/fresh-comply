-- Require explicit platform admin role or boolean override
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
