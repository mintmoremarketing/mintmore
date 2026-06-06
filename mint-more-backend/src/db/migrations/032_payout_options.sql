ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS payout_mode TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (payout_mode IN ('scheduled', 'instant')),
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12,2);

UPDATE withdrawals
SET net_amount = amount - fee_amount
WHERE net_amount IS NULL;

ALTER TABLE withdrawals
  ALTER COLUMN net_amount SET NOT NULL;

INSERT INTO platform_settings (key, value, description)
VALUES (
  'payouts',
  '{"scheduled_fee":0,"instant_fee":25,"scheduled_label":"Weekly payout","instant_label":"Instant payout"}'::JSONB,
  'Freelancer payout timing and fee controls'
)
ON CONFLICT (key) DO NOTHING;

