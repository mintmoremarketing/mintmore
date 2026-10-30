-- 070: admin moderation for order chats. Additive only.
-- Flagged chats stand out in the admin list; closed chats take no new messages.
-- Every flag, warning, close and reopen is also written to the audit log.
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS flagged_at   TIMESTAMPTZ;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS flagged_by   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS flag_reason  TEXT;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMPTZ;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS closed_by    UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS close_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_rooms_flagged ON chat_rooms(flagged_at) WHERE flagged_at IS NOT NULL;
