-- Trial MintCoins are a small, restricted platform-services grant.
ALTER TYPE credit_transaction_type ADD VALUE IF NOT EXISTS 'trial_grant';

UPDATE platform_settings
SET value = value || '{"mint_credits":100,"mint_credit_expiry_days":14}'::jsonb,
    description = 'First-time dashboard access, AI quotas, and trial MintCoins'
WHERE key = 'membership.trial';
