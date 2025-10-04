-- Helper functions consumed by RLS policies
set check_function_bodies = off;

create schema if not exists app;

do $$
begin
  if not exists (
    select 1 from pg_proc
    where proname = 'jwt' and pg_catalog.pg_function_is_visible(oid) and pg_get_function_identity_arguments(oid) = ''
      and pronamespace = 'app'::regnamespace
  ) then
    create function app.jwt()
      returns jsonb
      language sql
      stable
    as $$
      select coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
    $$;
  end if;
end$$;

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

create or replace function app.is_direct_member(target_org_id uuid)
  returns boolean
  language plpgsql
  stable
as $$
declare
  subject uuid;
begin
  begin
    subject := (app.jwt()->>'sub')::uuid;
  exception when others then
    return false;
  end;

  if subject is null then
    return false;
  end if;

  return exists (
    select 1
    from public.org_memberships m
    where m.org_id = target_org_id
      and m.user_id = subject
  );
end;
$$;

create or replace function app.is_provider_admin_for(target_org_id uuid)
  returns boolean
  language plpgsql
  stable
as $$
declare
  subject uuid;
begin
  if target_org_id is null then
    return false;
  end if;

  begin
    subject := (app.jwt()->>'sub')::uuid;
  exception when others then
    return false;
  end;

  if subject is null then
    return false;
  end if;

  return exists (
    with recursive ancestors as (
      select o.id, o.parent_org_id, o.type
        from public.orgs o
       where o.id = target_org_id
      union all
      select parent.id, parent.parent_org_id, parent.type
        from public.orgs parent
        join ancestors child
          on child.parent_org_id = parent.id
    )
    select 1
      from ancestors a
      join public.orgs provider
        on provider.id = a.id
       and provider.type = 'provider'
      join public.org_memberships m
        on m.org_id = provider.id
       and m.user_id = subject
       and m.status = 'active'
       and m.role in ('provider_admin', 'org_admin')
  );
end;
$$;

create or replace function app.has_org_access(target_org_id uuid)
  returns boolean
  language plpgsql
  stable
as $$
begin
  if target_org_id is null then
    return app.is_platform_admin();
  end if;

  if app.is_platform_admin() then
    return true;
  end if;

  if app.is_direct_member(target_org_id) then
    return true;
  end if;

  if app.is_provider_admin_for(target_org_id) then
    return true;
  end if;

  return false;
end;
$$;
