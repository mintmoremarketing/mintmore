DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'delivery_reminder';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'stalled_order';
END $$;

CREATE TABLE IF NOT EXISTS workflow_reminders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_key     VARCHAR(200) NOT NULL UNIQUE,
  job_id           UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  recipient_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_type    VARCHAR(50) NOT NULL,
  metadata         JSONB NOT NULL DEFAULT '{}',
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_reminders_job
  ON workflow_reminders(job_id, reminder_type);
