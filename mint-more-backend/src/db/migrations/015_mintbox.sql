CREATE TABLE IF NOT EXISTS mintbox_folders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  share_token     VARCHAR(80) NOT NULL UNIQUE,
  storage_prefix  TEXT NOT NULL,
  storage_used    BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id)
);

CREATE TABLE IF NOT EXISTS mintbox_files (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id             UUID NOT NULL REFERENCES mintbox_folders(id) ON DELETE CASCADE,
  job_id                UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  uploaded_by           UUID NOT NULL REFERENCES users(id),
  original_name         TEXT NOT NULL,
  storage_bucket        VARCHAR(100) NOT NULL DEFAULT 'job-attachments',
  storage_path          TEXT NOT NULL,
  public_url            TEXT NOT NULL,
  mime_type             VARCHAR(255),
  size_bytes            BIGINT NOT NULL DEFAULT 0,
  status                VARCHAR(40) NOT NULL DEFAULT 'submitted',
  freelancer_note       TEXT,
  client_note           TEXT,
  reviewed_by           UUID REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mintbox_folders_client_id ON mintbox_folders(client_id);
CREATE INDEX IF NOT EXISTS idx_mintbox_folders_job_id ON mintbox_folders(job_id);
CREATE INDEX IF NOT EXISTS idx_mintbox_folders_share_token ON mintbox_folders(share_token);
CREATE INDEX IF NOT EXISTS idx_mintbox_files_folder_id ON mintbox_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_mintbox_files_job_id ON mintbox_files(job_id);
CREATE INDEX IF NOT EXISTS idx_mintbox_files_status ON mintbox_files(status);

CREATE TRIGGER mintbox_folders_updated_at
  BEFORE UPDATE ON mintbox_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER mintbox_files_updated_at
  BEFORE UPDATE ON mintbox_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
