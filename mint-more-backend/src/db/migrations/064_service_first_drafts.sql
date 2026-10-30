CREATE TABLE IF NOT EXISTS service_draft_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL UNIQUE REFERENCES mintbox_upload_sessions(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  freelancer_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'changes_requested')),
  review_note TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  file_id UUID REFERENCES mintbox_files(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_draft_submissions_review_idx
  ON service_draft_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS service_draft_submissions_freelancer_idx
  ON service_draft_submissions(freelancer_id, created_at DESC);
