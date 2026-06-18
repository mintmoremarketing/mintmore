-- Internal Mint More production designers for Phase 1 operations.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'designer';

CREATE INDEX IF NOT EXISTS idx_creative_tasks_designer_queue
  ON creative_tasks(assigned_to, status, due_date NULLS LAST, created_at DESC);
