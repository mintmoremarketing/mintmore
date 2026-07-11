-- Add source label for social post platform rows so imported posts can be identified cleanly.

ALTER TABLE social_post_platforms
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'manual';

