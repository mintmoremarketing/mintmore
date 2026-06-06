ALTER TABLE ai_models
  ADD COLUMN IF NOT EXISTS provider_cost_per_1k_tokens NUMERIC(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_price_per_1k_tokens NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failover_model_id UUID REFERENCES ai_models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_labels TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS margin_alert_below_pct NUMERIC(6,2) NOT NULL DEFAULT 20;

UPDATE ai_models
SET user_price_per_1k_tokens = cost_per_1k_tokens
WHERE user_price_per_1k_tokens = 0
  AND cost_per_1k_tokens > 0;

CREATE INDEX IF NOT EXISTS idx_ai_models_failover
  ON ai_models(failover_model_id);
