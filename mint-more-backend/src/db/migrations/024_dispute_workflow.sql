-- Disputes keep escrow locked until a support admin records a resolution.
CREATE TABLE IF NOT EXISTS disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  escrow_id       UUID NOT NULL REFERENCES escrow_records(id),
  opened_by       UUID NOT NULL REFERENCES users(id),
  opened_by_role  VARCHAR(20) NOT NULL CHECK (opened_by_role IN ('client', 'freelancer')),
  reason          VARCHAR(80) NOT NULL,
  description     TEXT NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'under_review', 'resolved_release', 'resolved_refund')),
  assigned_admin_id UUID REFERENCES users(id),
  resolution_note TEXT,
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_one_active_per_job
  ON disputes(job_id)
  WHERE status IN ('open', 'under_review');
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_job ON disputes(job_id, created_at DESC);

DROP TRIGGER IF EXISTS disputes_updated_at ON disputes;
CREATE TRIGGER disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS dispute_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id),
  sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('client', 'freelancer', 'admin')),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_messages
  ON dispute_messages(dispute_id, created_at ASC);
