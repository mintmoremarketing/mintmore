DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'mintbox_seen';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'work_delivered';
END $$;

ALTER TABLE mintbox_files
  ADD COLUMN IF NOT EXISTS purpose VARCHAR(30) NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS seen_by_client_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seen_by_freelancer_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_client_at TIMESTAMPTZ;

ALTER TABLE mintbox_upload_sessions
  ADD COLUMN IF NOT EXISTS purpose VARCHAR(30) NOT NULL DEFAULT 'delivery';

ALTER TABLE mintbox_revision_feedback
  ADD COLUMN IF NOT EXISTS seen_by_freelancer_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mintbox_files_timeline
  ON mintbox_files(job_id, purpose, created_at);
