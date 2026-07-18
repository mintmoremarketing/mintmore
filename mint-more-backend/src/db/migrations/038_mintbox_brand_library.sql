CREATE TABLE IF NOT EXISTS mintbox_brand_folders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  storage_prefix  TEXT NOT NULL,
  storage_used    BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mintbox_brand_files (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id             UUID NOT NULL REFERENCES mintbox_brand_folders(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uploaded_by           UUID NOT NULL REFERENCES users(id),
  original_name         TEXT NOT NULL,
  storage_bucket        VARCHAR(100) NOT NULL DEFAULT 'mintbox',
  storage_path          TEXT NOT NULL UNIQUE,
  mime_type             VARCHAR(255),
  size_bytes            BIGINT NOT NULL DEFAULT 0,
  media_type            VARCHAR(40),
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mintbox_brand_upload_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id        UUID NOT NULL REFERENCES mintbox_brand_folders(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uploaded_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name    TEXT NOT NULL,
  storage_bucket   VARCHAR(100) NOT NULL,
  storage_path     TEXT NOT NULL UNIQUE,
  mime_type        VARCHAR(255) NOT NULL,
  size_bytes       BIGINT NOT NULL CHECK (size_bytes > 0),
  status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed', 'cancelled', 'expired')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mintbox_brand_folders_client_id
  ON mintbox_brand_folders(client_id);
CREATE INDEX IF NOT EXISTS idx_mintbox_brand_folders_created_at
  ON mintbox_brand_folders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mintbox_brand_files_folder_id
  ON mintbox_brand_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_mintbox_brand_files_client_id
  ON mintbox_brand_files(client_id);
CREATE INDEX IF NOT EXISTS idx_mintbox_brand_upload_sessions_client_pending
  ON mintbox_brand_upload_sessions(client_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_mintbox_brand_upload_sessions_uploader
  ON mintbox_brand_upload_sessions(uploaded_by, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mintbox_brand_files_storage_path_unique
  ON mintbox_brand_files(storage_path);

CREATE TRIGGER mintbox_brand_folders_updated_at
  BEFORE UPDATE ON mintbox_brand_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER mintbox_brand_files_updated_at
  BEFORE UPDATE ON mintbox_brand_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER mintbox_brand_upload_sessions_updated_at
  BEFORE UPDATE ON mintbox_brand_upload_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
