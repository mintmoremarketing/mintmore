DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'revision_requested';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'revision_delivered';
END $$;

CREATE TABLE IF NOT EXISTS mintbox_revision_rounds (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  folder_id             UUID NOT NULL REFERENCES mintbox_folders(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES users(id),
  freelancer_id         UUID NOT NULL REFERENCES users(id),
  round_number          INTEGER NOT NULL CHECK (round_number > 0),
  status                VARCHAR(30) NOT NULL DEFAULT 'feedback_open'
                        CHECK (status IN ('feedback_open', 'awaiting_delivery', 'delivered')),
  feedback_window_ends_at TIMESTAMPTZ NOT NULL,
  charge_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  charged_at            TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, round_number)
);

CREATE TABLE IF NOT EXISTS mintbox_revision_feedback (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id    UUID NOT NULL REFERENCES mintbox_revision_rounds(id) ON DELETE CASCADE,
  file_id        UUID NOT NULL REFERENCES mintbox_files(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES users(id),
  note           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mintbox_revision_feedback
  DROP CONSTRAINT IF EXISTS mintbox_revision_feedback_revision_id_file_id_key;

ALTER TABLE mintbox_files
  ADD COLUMN IF NOT EXISTS file_category VARCHAR(30) NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS revision_round INTEGER;

ALTER TABLE mintbox_upload_sessions
  ADD COLUMN IF NOT EXISTS file_category VARCHAR(30) NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS revision_round INTEGER;

CREATE INDEX IF NOT EXISTS idx_mintbox_revisions_job
  ON mintbox_revision_rounds(job_id, round_number DESC);
CREATE INDEX IF NOT EXISTS idx_mintbox_revisions_open
  ON mintbox_revision_rounds(job_id, status, feedback_window_ends_at);
CREATE INDEX IF NOT EXISTS idx_mintbox_files_category
  ON mintbox_files(folder_id, file_category);

CREATE TRIGGER mintbox_revision_rounds_updated_at
  BEFORE UPDATE ON mintbox_revision_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
