-- 060: senders can edit a chat message for a short window after sending.
-- edited_at drives the "Edited" label next to the message time.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
