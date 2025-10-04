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
  language plpgsql
  stable
as $$
declare
  claims jsonb := app.jwt();
begin
  if claims ? 'is_platform_admin' then
    return coalesce((claims->>'is_platform_admin')::boolean, false);
  end if;

  if claims ? 'role' then
    return claims->>'role' = 'service_role';
  end if;

  return false;
end;
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
    from public.realms r
    join public.org_memberships m on m.org_id = r.provider_org_id and m.role = 'provider_admin'
    where r.org_id = target_org_id
      and m.user_id = subject
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
