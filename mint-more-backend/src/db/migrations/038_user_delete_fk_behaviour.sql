-- Make social media user-owned rows respond automatically when a user is deleted.
-- This fixes social_post_media_user_id_fkey blocking admin/user deletion.

ALTER TABLE social_post_media
  DROP CONSTRAINT IF EXISTS social_post_media_user_id_fkey,
  ADD CONSTRAINT social_post_media_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE social_post_platforms
  DROP CONSTRAINT IF EXISTS social_post_platforms_social_account_id_fkey,
  ADD CONSTRAINT social_post_platforms_social_account_id_fkey
    FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE;
