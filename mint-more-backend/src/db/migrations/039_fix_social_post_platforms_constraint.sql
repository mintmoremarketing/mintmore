-- Fix social_post_platforms unique constraint
-- Old: UNIQUE(post_id, platform) — only allows one account per platform per post
-- New: UNIQUE(post_id, social_account_id) — allows multiple accounts of the same platform

ALTER TABLE social_post_platforms
  DROP CONSTRAINT IF EXISTS social_post_platforms_post_id_platform_key;

ALTER TABLE social_post_platforms
  ADD CONSTRAINT social_post_platforms_post_id_account_id_key
  UNIQUE (post_id, social_account_id);
