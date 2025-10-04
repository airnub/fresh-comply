-- Verify provider admin hierarchy traversal does not require a realm row
DO $$
DECLARE
  provider_id uuid := gen_random_uuid();
  customer_id uuid := gen_random_uuid();
  provider_admin_id uuid := gen_random_uuid();
  has_access boolean;
BEGIN
  insert into public.orgs (id, name, type, parent_org_id)
  values
    (provider_id, 'Test Provider Org (hierarchy regression)', 'provider', null),
    (customer_id, 'Test Customer Org (hierarchy regression)', 'customer', provider_id);

  insert into public.org_memberships (org_id, user_id, role, status)
  values
    (provider_id, provider_admin_id, 'provider_admin', 'active');

  perform set_config('request.jwt.claims', jsonb_build_object('sub', provider_admin_id)::text, true);

  select app.is_provider_admin_for(customer_id) into has_access;
  if not has_access then
    raise exception 'Expected provider admin to reach customer via hierarchy metadata';
  end if;

  select app.has_org_access(customer_id) into has_access;
  if not has_access then
    raise exception 'app.has_org_access should grant provider admin access to descendant customers';
  end if;

  perform set_config('request.jwt.claims', '{}'::text, true);

  delete from public.org_memberships where org_id = provider_id and user_id = provider_admin_id;
  delete from public.orgs where id in (customer_id, provider_id);
END$$;
