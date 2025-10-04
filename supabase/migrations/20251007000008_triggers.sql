-- Auto-consolidated baseline (2025-10-04T14:42:43.528Z)
-- Triggers

create trigger audit_log_before_insert
  before insert on audit_log
  for each row execute function compute_audit_log_hash();

create trigger admin_actions_before_insert
  before insert on admin_actions
  for each row execute function compute_admin_actions_hash();

create trigger moderation_queue_audit_after_insert
  after insert on moderation_queue
  for each row execute function log_freshness_moderation_audit();

create trigger adoption_records_audit_after_insert
  after insert on adoption_records
  for each row execute function log_freshness_adoption_audit();
