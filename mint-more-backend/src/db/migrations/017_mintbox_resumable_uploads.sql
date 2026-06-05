CREATE TABLE IF NOT EXISTS mintbox_upload_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id        UUID NOT NULL REFERENCES mintbox_folders(id) ON DELETE CASCADE,
  job_id           UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uploaded_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name    TEXT NOT NULL,
  storage_bucket   VARCHAR(100) NOT NULL,
  storage_path     TEXT NOT NULL UNIQUE,
  mime_type        VARCHAR(255) NOT NULL,
  size_bytes       BIGINT NOT NULL CHECK (size_bytes > 0),
  freelancer_note  TEXT,
  status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed', 'cancelled', 'expired')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mintbox_upload_sessions_client_pending
  ON mintbox_upload_sessions(client_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_mintbox_upload_sessions_uploader
  ON mintbox_upload_sessions(uploaded_by, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mintbox_files_storage_path_unique
  ON mintbox_files(storage_path);

CREATE TRIGGER mintbox_upload_sessions_updated_at
  BEFORE UPDATE ON mintbox_upload_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
