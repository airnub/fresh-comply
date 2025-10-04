-- Strengthen org hierarchy metadata and provider admin helper traversal
set check_function_bodies = off;

alter table public.orgs
  add column if not exists type text;

alter table public.orgs
  add column if not exists parent_org_id uuid;

alter table public.orgs
  drop constraint if exists orgs_type_check;

alter table public.orgs
  add constraint orgs_type_check
  check (type in ('platform', 'provider', 'customer'));

alter table public.orgs
  drop constraint if exists orgs_parent_org_id_fkey;

alter table public.orgs
  add constraint orgs_parent_org_id_fkey
  foreign key (parent_org_id)
  references public.orgs(id)
  on delete restrict;

create index if not exists orgs_type_idx on public.orgs (type);
create index if not exists orgs_parent_idx on public.orgs (parent_org_id);

-- Backfill hierarchy information for existing data
DO $$
DECLARE
  realm_customer_column text;
BEGIN
  -- Identify platform orgs from platform admin memberships
  update public.orgs o
     set type = 'platform',
         parent_org_id = null
   where exists (
           select 1
             from public.org_memberships m
            where m.org_id = o.id
              and m.role = 'platform_admin'
        );

  -- Mark providers via realm ownership or elevated memberships
  update public.orgs o
     set type = 'provider',
         parent_org_id = null
   where o.type is distinct from 'platform'
     and (
       exists (
         select 1
           from public.realms r
          where r.provider_org_id = o.id
       )
       or exists (
         select 1
           from public.org_memberships m
          where m.org_id = o.id
            and m.role in ('provider_admin', 'org_admin')
       )
     );

  -- Detect which column links realms to customer orgs if the column exists
  select column_name
    into realm_customer_column
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'realms'
    and column_name in ('org_id', 'parent_org_id', 'customer_org_id')
  order by case column_name
             when 'org_id' then 1
              when 'parent_org_id' then 2
              else 3
            end
   limit 1;

  if realm_customer_column is not null then
    execute format(
      $sql$
        update public.orgs c
           set parent_org_id = r.provider_org_id,
               type = case
                 when c.type in ('platform', 'provider') then c.type
                 else 'customer'
               end
          from public.realms r
         where r.%I = c.id
           and r.provider_org_id <> c.id
      $sql$,
      realm_customer_column
    );
  end if;

  -- Ensure providers and platform orgs do not point to parents
  update public.orgs
     set parent_org_id = null
   where type in ('platform', 'provider')
     and parent_org_id is not null;

  -- Default any remaining orgs to customer
  update public.orgs
     set type = 'customer'
   where type is null;
END$$;

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
