-- AI edits: tell the client when the helper's outline waits on them, or the reel is ready
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ai_edit_update';
