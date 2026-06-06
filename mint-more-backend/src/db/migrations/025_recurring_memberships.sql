ALTER TABLE membership_payments
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_membership_payments_subscription
  ON membership_payments(razorpay_subscription_id, created_at DESC);

UPDATE platform_settings
SET value = value || '{"razorpay_plan_id":null,"subscription_cycles":120}'::jsonb
WHERE key = 'membership.monthly';
