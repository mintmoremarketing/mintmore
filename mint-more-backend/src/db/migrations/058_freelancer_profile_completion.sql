-- 058: fields behind the freelancer "Complete your profile" checklist.
-- Additive only: a public handle and the tools a freelancer works with.

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(32);

ALTER TABLE users ADD COLUMN IF NOT EXISTS tools TEXT[] NOT NULL DEFAULT '{}';

-- Handles are unique regardless of case.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uidx
  ON users (lower(username))
  WHERE username IS NOT NULL;
