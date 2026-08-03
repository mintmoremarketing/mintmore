ALTER TABLE creative_events 
ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'important'
CHECK (priority IN ('important', 'regional'));
