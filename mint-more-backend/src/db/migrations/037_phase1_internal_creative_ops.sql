-- Phase 1 pivot: internal Mint More creative calendar and custom requests.
-- Additive only: existing marketplace/freelancer tables stay intact behind flags.

INSERT INTO platform_settings (key, value, description) VALUES
  (
    'feature_flags',
    '{
      "calendar_creatives": true,
      "internal_ops": true,
      "custom_requests": true,
      "mintbox": true,
      "chat": true,
      "social_insights": true,
      "mint_ai": true,
      "wallet_ui": false,
      "marketplace": false,
      "freelancer_portal": false,
      "freelancer_matching": false,
      "negotiation": false
    }',
    'Phase 1 product surface flags'
  ),
  (
    'calendar_creatives',
    '{"monthly_mintcoins":10,"default_event_coin_cost":1,"carry_forward":true}',
    'Monthly internal creative calendar controls'
  ),
  (
    'custom_requests',
    '{"default_coin_cost":1,"requires_ops_review":true}',
    'Custom Mint More request controls'
  ),
  (
    'ops_slots',
    '{"slots":["morning","evening","night"]}',
    'Internal production work slots'
  )
ON CONFLICT (key) DO NOTHING;

UPDATE users
SET admin_permissions = (
  SELECT ARRAY(
    SELECT DISTINCT permission
    FROM unnest(
      COALESCE(admin_permissions, '{}'::TEXT[])
      || ARRAY['calendar.manage','ops.manage','tasks.assign','tasks.review','insights.manage']::TEXT[]
    ) AS permission
  )
)
WHERE role = 'admin' AND (is_super_admin = true OR '*' = ANY(admin_permissions));

CREATE TABLE IF NOT EXISTS creative_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(180) NOT NULL,
  description   TEXT,
  event_date    DATE NOT NULL,
  month_key     CHAR(7) NOT NULL,
  category_id   UUID REFERENCES categories(id),
  asset_type    VARCHAR(80) NOT NULL DEFAULT 'social_post',
  coin_cost     NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (coin_cost >= 0),
  tags          TEXT[] NOT NULL DEFAULT '{}',
  status        VARCHAR(30) NOT NULL DEFAULT 'published'
                CHECK (status IN ('draft','published','archived')),
  created_by    UUID REFERENCES users(id),
  updated_by    UUID REFERENCES users(id),
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_events_month_status
  ON creative_events(month_key, status, event_date);

CREATE TABLE IF NOT EXISTS client_event_selections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id       UUID NOT NULL REFERENCES creative_events(id) ON DELETE CASCADE,
  job_id         UUID REFERENCES jobs(id) ON DELETE SET NULL,
  task_id        UUID,
  status         VARCHAR(40) NOT NULL DEFAULT 'selected'
                 CHECK (status IN (
                   'selected','pending_review','approved','rejected',
                   'in_production','delivered','completed','cancelled'
                 )),
  coin_cost      NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (coin_cost >= 0),
  credit_tx_id   UUID REFERENCES mint_credit_transactions(id),
  client_note    TEXT,
  admin_note     TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_client_event_selections_client
  ON client_event_selections(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_event_selections_status
  ON client_event_selections(status, created_at DESC);

CREATE TABLE IF NOT EXISTS creative_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id         UUID REFERENCES jobs(id) ON DELETE SET NULL,
  task_id        UUID,
  request_type   VARCHAR(80) NOT NULL DEFAULT 'other',
  title          VARCHAR(180) NOT NULL,
  description    TEXT,
  deadline       DATE,
  attachments    JSONB NOT NULL DEFAULT '[]',
  status         VARCHAR(40) NOT NULL DEFAULT 'pending_ops_review'
                 CHECK (status IN (
                   'draft','pending_ops_review','approved','rejected',
                   'in_production','delivered','completed','cancelled'
                 )),
  coin_cost      NUMERIC(12,2),
  credit_tx_id   UUID REFERENCES mint_credit_transactions(id),
  admin_note     TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_requests_client
  ON creative_requests(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creative_requests_status
  ON creative_requests(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creative_requests_unique_job
  ON creative_requests(job_id)
  WHERE job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS creative_tasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type        VARCHAR(40) NOT NULL CHECK (source_type IN ('calendar_event','custom_request')),
  source_id          UUID NOT NULL,
  client_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id             UUID REFERENCES jobs(id) ON DELETE SET NULL,
  title              VARCHAR(180) NOT NULL,
  description        TEXT,
  status             VARCHAR(40) NOT NULL DEFAULT 'pending'
                     CHECK (status IN (
                       'pending','assigned','in_progress','delivered',
                       'revision','completed','blocked','cancelled'
                     )),
  client_status      VARCHAR(80) NOT NULL DEFAULT 'Queued with Mint More',
  assigned_to        UUID REFERENCES users(id),
  work_slot          VARCHAR(30),
  due_date           DATE,
  coin_cost          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (coin_cost >= 0),
  mintbox_folder_id  UUID REFERENCES mintbox_folders(id) ON DELETE SET NULL,
  internal_notes     TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_by_admin   UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_tasks_client
  ON creative_tasks(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creative_tasks_status
  ON creative_tasks(status, due_date NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_creative_tasks_assigned
  ON creative_tasks(assigned_to, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_event_selections_task_fk'
  ) THEN
    ALTER TABLE client_event_selections
      ADD CONSTRAINT client_event_selections_task_fk
      FOREIGN KEY (task_id) REFERENCES creative_tasks(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creative_requests_task_fk'
  ) THEN
    ALTER TABLE creative_requests
      ADD CONSTRAINT creative_requests_task_fk
      FOREIGN KEY (task_id) REFERENCES creative_tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS creative_events_updated_at ON creative_events;
CREATE TRIGGER creative_events_updated_at
  BEFORE UPDATE ON creative_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS client_event_selections_updated_at ON client_event_selections;
CREATE TRIGGER client_event_selections_updated_at
  BEFORE UPDATE ON client_event_selections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS creative_requests_updated_at ON creative_requests;
CREATE TRIGGER creative_requests_updated_at
  BEFORE UPDATE ON creative_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS creative_tasks_updated_at ON creative_tasks;
CREATE TRIGGER creative_tasks_updated_at
  BEFORE UPDATE ON creative_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
