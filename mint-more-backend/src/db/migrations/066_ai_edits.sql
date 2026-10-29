-- ── Migration: 066_ai_edits.sql ──────────────────────────────────────────────
-- "Make with AI": a client buys AI edits for a service instead of hiring a freelancer.
-- The edit runs in the Creatyv desktop app on the client's computer, and each paid video gets an
-- unlock code, swapped in the app for a token that only works through our AI and licence proxies.
-- Additive only. No DO $$ blocks: the runner splits this file on semicolons.

-- 1. Which services offer AI, and an optional per-variant AI price (else derived from settings)
ALTER TABLE service_templates ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE service_variants ADD COLUMN IF NOT EXISTS ai_price NUMERIC(12,2) CHECK (ai_price IS NULL OR ai_price > 0);

-- Reel and short-video edits are what the AI editor does well today.
UPDATE service_templates t SET ai_enabled = true
FROM categories c
WHERE c.id = t.category_id AND c.slug = 'video-editing' AND t.slug LIKE '%reel%' AND t.ai_enabled = false;

-- 2. One AI project per purchase (a variant x quantity, so a pack of 3 is 3 videos)
CREATE TABLE IF NOT EXISTS ai_edits (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id          UUID REFERENCES service_templates(id) ON DELETE SET NULL,
  variant_id           UUID REFERENCES service_variants(id) ON DELETE SET NULL,
  title                VARCHAR(200) NOT NULL,
  option_label         VARCHAR(80),
  pack_size            INTEGER NOT NULL DEFAULT 1 CHECK (pack_size >= 1),
  quantity             INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  videos               INTEGER NOT NULL DEFAULT 1 CHECK (videos >= 1),
  unit_price           NUMERIC(12,2) NOT NULL CHECK (unit_price > 0),
  subtotal             NUMERIC(12,2) NOT NULL,
  gst_rate             NUMERIC(5,2) NOT NULL DEFAULT 18,
  gst_amount           NUMERIC(12,2) NOT NULL,
  total                NUMERIC(12,2) NOT NULL,
  budget_usd           NUMERIC(8,2) NOT NULL DEFAULT 6,
  status               VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','paid','cancelled')),
  payment_mode         VARCHAR(10) CHECK (payment_mode IN ('mock','razorpay')),
  razorpay_order_id    VARCHAR(60),
  razorpay_payment_id  VARCHAR(60),
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_edits_client ON ai_edits(client_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_edits_order ON ai_edits(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;

DROP TRIGGER IF EXISTS ai_edits_updated_at ON ai_edits;
CREATE TRIGGER ai_edits_updated_at
  BEFORE UPDATE ON ai_edits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. One unlock per paid video. The code is shown to the client until it is used. The app's
--    token is stored only as a hash.
CREATE TABLE IF NOT EXISTS ai_edit_unlocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_edit_id      UUID NOT NULL REFERENCES ai_edits(id) ON DELETE CASCADE,
  video_number    INTEGER NOT NULL,
  code            VARCHAR(24) NOT NULL UNIQUE,
  token_hash      CHAR(64) UNIQUE,
  device          VARCHAR(64),
  budget_usd      NUMERIC(8,2) NOT NULL,
  spent_usd       NUMERIC(10,4) NOT NULL DEFAULT 0,
  app_state       VARCHAR(30),
  app_state_at    TIMESTAMPTZ,
  redeemed_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_edit_unlocks_video UNIQUE (ai_edit_id, video_number)
);

-- 4. Every AI call made through the proxy, for cost tracking per video
CREATE TABLE IF NOT EXISTS ai_edit_usage (
  id                 BIGSERIAL PRIMARY KEY,
  unlock_id          UUID NOT NULL REFERENCES ai_edit_unlocks(id) ON DELETE CASCADE,
  model              VARCHAR(80),
  input_tokens       INTEGER NOT NULL DEFAULT 0,
  output_tokens      INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd           NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_edit_usage_unlock ON ai_edit_usage(unlock_id, created_at)
