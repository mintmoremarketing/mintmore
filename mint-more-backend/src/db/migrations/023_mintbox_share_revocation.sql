ALTER TABLE mintbox_folders
  ADD COLUMN IF NOT EXISTS share_revoked_at TIMESTAMPTZ;

ALTER TABLE mintbox_files
  ADD COLUMN IF NOT EXISTS share_revoked_at TIMESTAMPTZ;

ALTER TABLE mintbox_category_shares
  ADD COLUMN IF NOT EXISTS share_revoked_at TIMESTAMPTZ;
