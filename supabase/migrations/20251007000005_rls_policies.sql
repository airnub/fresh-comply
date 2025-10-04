-- Auto-consolidated baseline (2025-10-04T14:42:43.521Z)
-- RLS & Policies


create policy if not exists "Admins read json schemas" on json_schemas
  for select using (auth.role() in ('service_role', 'authenticated'));
create policy if not exists "Admins read step types" on step_types
  for select using (auth.role() in ('service_role', 'authenticated'));
create policy if not exists "Admins read step type versions" on step_type_versions
  for select using (auth.role() in ('service_role', 'authenticated'));
create policy if not exists "Tenant members read installs" on tenant_step_type_installs
  for select using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );
create policy if not exists "Tenant members manage secret bindings" on tenant_secret_bindings
  for select using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );
create policy if not exists "Tenant members manage overlays" on tenant_workflow_overlays
  for select using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );
create policy if not exists "Members read overlay snapshots" on workflow_overlay_snapshots
  for select using (
    auth.role() = 'service_role'
    or (run_id is not null and public.can_access_run(run_id))
  );
create policy if not exists "Members read overlay layers" on workflow_overlay_layers
  for select using (
    auth.role() = 'service_role'
    or exists (
      select 1 from workflow_overlay_snapshots s
      where s.id = snapshot_id and public.can_access_run(s.run_id)
    )
  );
create policy if not exists "Tenant members manage domains" on tenant_domains
  for all using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );
create policy if not exists "Tenant members manage branding" on tenant_branding
  for all using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );
CREATE POLICY IF NOT EXISTS "Authenticated read billing prices" ON billing_prices
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
  );
CREATE POLICY IF NOT EXISTS "Tenant members read billing tenants" ON billing_tenants
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR public.is_member_of_org(org_id)
  );
CREATE POLICY IF NOT EXISTS "Tenant members read billing subscriptions" ON billing_subscriptions
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR public.is_member_of_org(org_id)
  );
create policy "Service role appends audit log" on audit_log
  for insert
  with check (public.is_platform_service());
create policy "Service role appends admin actions" on admin_actions
  for insert
  with check (public.is_platform_service());
create policy "Service role manages source registry" on source_registry
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members read source registry" on source_registry
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );
create policy "Service role manages source snapshots" on source_snapshot
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members read source snapshots" on source_snapshot
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );
create policy "Service role manages change events" on change_event
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members read change events" on change_event
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );
create policy "Service role manages rule versions" on rule_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members read rule versions" on rule_versions
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );
create policy "Service role manages template versions" on template_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members read template versions" on template_versions
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );
create policy "Service role manages workflow def versions" on workflow_def_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members read workflow def versions" on workflow_def_versions
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );
create policy "Service role manages workflow pack versions" on workflow_pack_versions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members read workflow pack versions" on workflow_pack_versions
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );
create policy "Service role manages moderation queue" on moderation_queue
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members view moderation queue" on moderation_queue
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );
create policy "Service role manages release notes" on release_notes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members read release notes" on release_notes
  for select
  using (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );
create policy "Service role manages adoption records" on adoption_records
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members insert adoption records" on adoption_records
  for insert
  with check (
    public.is_platform_service()
    or app.is_platform_admin()
    or app.is_org_member(org_id)
  );
create policy if not exists "Platform services manage rule sources" on platform.rule_sources
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy if not exists "Platform services manage rule source snapshots" on platform.rule_source_snapshots
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy if not exists "Platform services manage rule packs" on platform.rule_packs
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy if not exists "Platform services manage rule pack detections" on platform.rule_pack_detections
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy if not exists "Platform services manage rule pack detection sources" on platform.rule_pack_detection_sources
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy if not exists "Platform services manage rule pack proposals" on platform.rule_pack_proposals
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy if not exists "Platform services manage step types" on platform.step_types
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy if not exists "Platform services manage step type versions" on platform.step_type_versions
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy "platform_rule_catalogs_select" on platform.rule_catalogs
  for select using (app.is_platform_admin());
create policy "platform_rule_catalogs_modify" on platform.rule_catalogs
  for all using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy "platform_rules_select" on platform.rules
  for select using (app.is_platform_admin());
create policy "platform_rules_modify" on platform.rules
  for all using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy "platform_global_records_select" on platform.global_records
  for select using (app.is_platform_admin());
create policy "platform_global_records_modify" on platform.global_records
  for all using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy "Service role manages tenant domains" on tenant_domains
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members manage domains" on tenant_domains
  for all using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );
create policy "Service role manages tenant branding" on tenant_branding
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members manage branding" on tenant_branding
  for all using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );
create policy "Service role manages billing prices" on billing_prices
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Authenticated read billing prices" on billing_prices
  for select using (
    auth.role() = 'service_role'
    or auth.role() = 'authenticated'
  );
create policy "Service role manages billing tenants" on billing_tenants
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members read billing tenants" on billing_tenants
  for select using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );
create policy "Service role manages billing subscriptions" on billing_subscriptions
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members read billing subscriptions" on billing_subscriptions
  for select using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );
create policy "Members read organisations" on organisations
  for select
  using (
    public.is_platform_service()
    or (
      org_id = public.current_org_id()
      and (
        public.is_member_of_org(id)
        or public.jwt_has_org(id)
        or id = public.current_org_id()
      )
    )
  );
create policy "Service role manages organisations" on organisations
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());
create policy "Users can update their profile" on users
  for update
  using (auth.role() = 'service_role' or id = auth.uid())
  with check (auth.role() = 'service_role' or id = auth.uid());
create policy "Service role removes users" on users
  for delete
  using (auth.role() = 'service_role');
create policy "Users can read their memberships" on memberships
  for select
  using (auth.role() = 'service_role' or user_id = auth.uid());
create policy "Service role manages memberships" on memberships
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Members view engagements" on engagements
  for select
  using (
    public.is_platform_service()
    or (
      org_id = public.current_org_id()
      and (
        public.is_member_of_org(engager_org_id)
        or (client_org_id is not null and public.is_member_of_org(client_org_id))
        or (subject_org_id is not null and public.jwt_has_org(subject_org_id))
      )
    )
  );
create policy "Service role manages engagements" on engagements
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());
create policy "Org members manage workflow definitions" on workflow_defs
  for all
  using (app.is_org_member(org_id) or app.is_platform_admin())
  with check (app.is_org_member(org_id) or app.is_platform_admin());
create policy "Members access workflow runs" on workflow_runs
  for select
  using (public.is_platform_service() or public.can_access_run(id));
create policy "Service role manages workflow runs" on workflow_runs
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());
create policy "Members read steps" on steps
  for select
  using (
    public.is_platform_service()
    or (
      org_id = public.current_org_id()
      and public.can_access_run(run_id)
    )
  );
create policy "Service role manages steps" on steps
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());
create policy "Members read documents" on documents
  for select
  using (
    public.is_platform_service()
    or (
      org_id = public.current_org_id()
      and public.can_access_run(run_id)
    )
  );
create policy "Service role manages documents" on documents
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());
create policy "Members read audit log" on audit_log
  for select
  using (
    public.is_platform_service()
    or (
      org_id = public.current_org_id()
      and (
        (run_id is not null and public.can_access_run(run_id))
        or (actor_org_id is not null and public.is_member_of_org(actor_org_id))
        or (on_behalf_of_org_id is not null and public.is_member_of_org(on_behalf_of_org_id))
        or (subject_org_id is not null and public.jwt_has_org(subject_org_id))
      )
    )
  );
create policy "Members read admin actions" on admin_actions
  for select
  using (
    public.is_platform_service()
    or (
      org_id = public.current_org_id()
      and (
        public.is_member_of_org(org_id)
        or (actor_org_id is not null and public.is_member_of_org(actor_org_id))
        or (subject_org_id is not null and public.jwt_has_org(subject_org_id))
      )
    )
  );
create policy "Members manage DSR requests" on dsr_requests
  for all
  using (
    public.is_platform_service()
    or (
      org_id = public.current_org_id()
      and public.is_member_of_org(org_id)
    )
  )
  with check (
    public.is_platform_service()
    or (
      org_id = public.current_org_id()
      and public.is_member_of_org(org_id)
    )
  );
create policy "Service role manages DSR jobs" on dsr_request_jobs
  for all
  using (public.is_platform_service())
  with check (public.is_platform_service());
create policy "Platform services manage step types" on platform.step_types
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy "Platform services manage step type versions" on platform.step_type_versions
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy "Platform services manage rule sources" on platform.rule_sources
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy "Platform services manage rule source snapshots" on platform.rule_source_snapshots
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy "Platform services manage rule packs" on platform.rule_packs
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy "Platform services manage rule pack detections" on platform.rule_pack_detections
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy "Platform services manage rule pack detection sources" on platform.rule_pack_detection_sources
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy "Platform services manage rule pack proposals" on platform.rule_pack_proposals
  for all
  using (public.is_platform_service() or app.is_platform_admin())
  with check (public.is_platform_service() or app.is_platform_admin());
create policy "Service role manages json schemas" on json_schemas
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Admins read json schemas" on json_schemas
  for select
  using (auth.role() in ('service_role', 'authenticated'));
create policy "Service role manages tenant installs" on tenant_step_type_installs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members read installs" on tenant_step_type_installs
  for select
  using (
    auth.role() = 'service_role'
    or public.is_member_of_org(org_id)
  );
create policy "Service role manages tenant secret bindings" on tenant_secret_bindings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members manage secret bindings" on tenant_secret_bindings
  for select
  using (
    auth.role() = 'service_role'
    or app.is_org_member(org_id)
  );
create policy "Service role manages tenant overlays" on tenant_workflow_overlays
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Tenant members manage overlays" on tenant_workflow_overlays
  for select
  using (
    auth.role() = 'service_role'
    or app.is_org_member(org_id)
  )
  with check (
    auth.role() = 'service_role'
    or app.is_org_member(org_id)
  );
create policy "Service role manages overlay snapshots" on workflow_overlay_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Members read overlay snapshots" on workflow_overlay_snapshots
  for select
  using (
    auth.role() = 'service_role'
    or (run_id is not null and public.can_access_run(run_id))
    or exists (
      select 1
      from tenant_workflow_overlays two
      where two.id = tenant_overlay_id
        and app.is_org_member(two.org_id)
    )
  );
create policy "Service role manages overlay layers" on workflow_overlay_layers
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "Members read overlay layers" on workflow_overlay_layers
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from workflow_overlay_snapshots s
      where s.id = snapshot_id
        and (
          (s.run_id is not null and public.can_access_run(s.run_id))
          or (
            s.tenant_overlay_id is not null
            and exists (
              select 1
              from tenant_workflow_overlays two
              where two.id = s.tenant_overlay_id
                and app.is_org_member(two.org_id)
            )
          )
        )
    )
  );
