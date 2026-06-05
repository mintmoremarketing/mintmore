-- Mint More commercial and access-control foundation.

CREATE TYPE membership_status AS ENUM ('trial', 'active', 'paused', 'expired', 'cancelled');
CREATE TYPE membership_payment_kind AS ENUM ('membership', 'renewal', 'access_pass');
CREATE TYPE credit_transaction_type AS ENUM (
  'welcome_grant',
  'renewal_grant',
  'admin_grant',
  'platform_spend',
  'expiry',
  'reversal'
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key         VARCHAR(120) PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description) VALUES
  ('membership.monthly', '{"price":999,"welcome_credits":999,"renewal_credits":250,"welcome_expiry_days":90,"renewal_expiry_days":60,"mintbox_gb":10,"auto_renew":true}', 'Main business membership'),
  ('membership.trial', '{"text_generations":10,"image_generations":3,"duration_days":14}', 'Demo access and trial quotas'),
  ('ai.quotas', '{"text_generations":100,"image_generations":20,"video_generations":5}', 'Included monthly standard AI quota'),
  ('access_passes', '[{"days":7,"price":299},{"days":15,"price":499},{"days":30,"price":799}]', 'Returning-member access-only passes'),
  ('managed_margins', '{"budget_percent":15,"pro_percent":20,"marketplace_percent":10}', 'Client-facing managed-work margins'),
  ('freelancer_commission', '{"free_completed_jobs":10,"default_percent":5,"beginner_percent":5,"intermediate_percent":5,"experienced_percent":3}', 'Freelancer commission policy'),
  ('matching', '{"max_active_jobs":5,"new_freelancer_boost":0.10,"top_candidates":10,"preferred_creator_boost":0.15}', 'Managed matching capacity and ranking controls'),
  ('revisions', '{"included_rounds":3,"paid_revision_price":20,"feedback_window_hours":24}', 'Revision policy'),
  ('payouts', '{"weekly_fee":0,"instant_fee":49}', 'Freelancer payout fees')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20) NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS business_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS business_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS customer_profile TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB NOT NULL DEFAULT '{"profile":false,"language":false,"social":false,"kyc":false}',
  ADD COLUMN IF NOT EXISTS admin_permissions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_overrides JSONB NOT NULL DEFAULT '{}';

UPDATE users
SET is_super_admin = true,
    admin_permissions = ARRAY['*']::TEXT[]
WHERE role = 'admin'
  AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin' AND is_super_admin = true);

CREATE TABLE IF NOT EXISTS memberships (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status                     membership_status NOT NULL DEFAULT 'trial',
  current_period_start       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end         TIMESTAMPTZ,
  paused_at                  TIMESTAMPTZ,
  cancelled_at               TIMESTAMPTZ,
  razorpay_subscription_id   VARCHAR(120) UNIQUE,
  auto_renew                 BOOLEAN NOT NULL DEFAULT true,
  metadata                   JSONB NOT NULL DEFAULT '{}',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_period_end ON memberships(current_period_end);

INSERT INTO memberships (user_id, status, current_period_start, current_period_end, metadata)
SELECT id, 'trial', NOW(), NOW() + INTERVAL '14 days', '{"backfilled":true}'::JSONB
FROM users
WHERE role = 'client'
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS membership_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id         UUID REFERENCES memberships(id) ON DELETE SET NULL,
  user_id               UUID NOT NULL REFERENCES users(id),
  kind                  membership_payment_kind NOT NULL,
  amount                NUMERIC(12,2) NOT NULL,
  currency              VARCHAR(10) NOT NULL DEFAULT 'INR',
  razorpay_order_id     VARCHAR(120) UNIQUE,
  razorpay_payment_id   VARCHAR(120) UNIQUE,
  idempotency_key       VARCHAR(160) UNIQUE,
  status                VARCHAR(30) NOT NULL DEFAULT 'created',
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at               TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS access_passes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  days                  INTEGER NOT NULL CHECK (days > 0),
  price                 NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  starts_at             TIMESTAMPTZ NOT NULL,
  ends_at               TIMESTAMPTZ NOT NULL,
  payment_id            UUID REFERENCES membership_payments(id),
  status                VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_passes_user_active
  ON access_passes(user_id, ends_at DESC);

CREATE TABLE IF NOT EXISTS mint_credit_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mint_credit_transactions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID NOT NULL REFERENCES mint_credit_accounts(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES users(id),
  type               credit_transaction_type NOT NULL,
  amount             NUMERIC(12,2) NOT NULL,
  balance_after      NUMERIC(12,2) NOT NULL CHECK (balance_after >= 0),
  expires_at         TIMESTAMPTZ,
  reference_id       UUID,
  reference_type     VARCHAR(60),
  idempotency_key    VARCHAR(160) UNIQUE,
  description        TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON mint_credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_expiry ON mint_credit_transactions(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS mint_credit_lots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grant_tx_id      UUID NOT NULL UNIQUE REFERENCES mint_credit_transactions(id) ON DELETE CASCADE,
  granted_amount   NUMERIC(12,2) NOT NULL CHECK (granted_amount > 0),
  remaining_amount NUMERIC(12,2) NOT NULL CHECK (remaining_amount >= 0),
  expires_at       TIMESTAMPTZ,
  expired_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_lots_spend
  ON mint_credit_lots(user_id, expires_at, created_at)
  WHERE remaining_amount > 0 AND expired_at IS NULL;

INSERT INTO mint_credit_accounts (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION create_commercial_accounts_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO mint_credit_accounts (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  IF NEW.role = 'client' THEN
    INSERT INTO memberships (user_id, status, current_period_end)
    VALUES (NEW.id, 'trial', NOW() + INTERVAL '14 days')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_commercial_accounts ON users;
CREATE TRIGGER auto_create_commercial_accounts
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_commercial_accounts_for_new_user();

CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       UUID REFERENCES users(id),
  actor_role     VARCHAR(30),
  action         VARCHAR(120) NOT NULL,
  entity_type    VARCHAR(80) NOT NULL,
  entity_id      VARCHAR(160),
  before_state   JSONB,
  after_state    JSONB,
  metadata       JSONB NOT NULL DEFAULT '{}',
  ip_address     INET,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key             VARCHAR(180) PRIMARY KEY,
  user_id         UUID REFERENCES users(id),
  operation       VARCHAR(120) NOT NULL,
  response_status INTEGER,
  response_body   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS platform_margin_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS freelancer_payout NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS client_total NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS brief_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pro_reviewed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS pro_reviewed_at TIMESTAMPTZ;

ALTER TABLE escrow_records
  ADD COLUMN IF NOT EXISTS freelancer_payout NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS platform_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

UPDATE escrow_records SET freelancer_payout = amount WHERE freelancer_payout IS NULL;

CREATE TABLE IF NOT EXISTS platform_financial_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            VARCHAR(60) NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  currency        VARCHAR(10) NOT NULL DEFAULT 'INR',
  reference_id    UUID,
  reference_type  VARCHAR(60),
  idempotency_key VARCHAR(160) UNIQUE,
  description     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_financial_reference
  ON platform_financial_ledger(reference_id, reference_type);

CREATE TABLE IF NOT EXISTS preferred_creators (
  client_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  freelancer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, freelancer_id)
);

ALTER TABLE negotiations
  ALTER COLUMN max_rounds SET DEFAULT 4;

UPDATE negotiations SET max_rounds = 4 WHERE max_rounds < 4 AND status IN ('pending', 'active');

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS brief_adherence_rating INTEGER CHECK (brief_adherence_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS timeliness_rating INTEGER CHECK (timeliness_rating BETWEEN 1 AND 5);

DROP TRIGGER IF EXISTS memberships_updated_at ON memberships;
CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS mint_credit_accounts_updated_at ON mint_credit_accounts;
CREATE TRIGGER mint_credit_accounts_updated_at
  BEFORE UPDATE ON mint_credit_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
