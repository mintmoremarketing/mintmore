-- 059: conversation-style order chat.
-- A message can carry a Mintbox file (delivery or client reference), and records
-- when it reached the other participant, so the UI can show sent / delivered / read ticks.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES mintbox_files(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at_client TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at_freelancer TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS messages_file_id_idx ON messages (file_id) WHERE file_id IS NOT NULL;
-- Existing read messages count as delivered.
UPDATE messages SET delivered_at_client = COALESCE(read_at_client, created_at) WHERE read_by_client = true AND delivered_at_client IS NULL;
UPDATE messages SET delivered_at_freelancer = COALESCE(read_at_freelancer, created_at) WHERE read_by_freelancer = true AND delivered_at_freelancer IS NULL;
