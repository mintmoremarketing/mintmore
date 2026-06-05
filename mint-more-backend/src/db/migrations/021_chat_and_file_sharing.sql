ALTER TYPE message_sender_role ADD VALUE IF NOT EXISTS 'admin';

ALTER TABLE mintbox_files
  ADD COLUMN IF NOT EXISTS share_token VARCHAR(80);

UPDATE mintbox_files
SET share_token = encode(gen_random_bytes(24), 'hex')
WHERE share_token IS NULL;

ALTER TABLE mintbox_files
  ALTER COLUMN share_token SET NOT NULL,
  ALTER COLUMN share_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mintbox_files_share_token
  ON mintbox_files(share_token);

CREATE TABLE IF NOT EXISTS mintbox_category_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   UUID NOT NULL REFERENCES mintbox_folders(id) ON DELETE CASCADE,
  category    VARCHAR(30) NOT NULL,
  share_token VARCHAR(80) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(folder_id, category)
);

INSERT INTO mintbox_category_shares (folder_id, category)
SELECT DISTINCT folder_id,
       CASE WHEN purpose = 'brief' THEN 'brief' ELSE file_category END
FROM mintbox_files
ON CONFLICT (folder_id, category) DO NOTHING;
