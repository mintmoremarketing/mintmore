-- Brand-first client flow data
-- Keeps the client profile as the source of truth for optional brand metadata
-- while Mintbox and internal workspaces can read the same data.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS brand_assets JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS google_business JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS posting_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
