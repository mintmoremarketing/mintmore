-- Make audit records easier to search and sort for admin operations.

CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_action
  ON audit_logs(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_metadata_gin
  ON audit_logs USING GIN (metadata);
