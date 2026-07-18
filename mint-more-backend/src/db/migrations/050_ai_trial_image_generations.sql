-- 050_ai_trial_image_generations.sql
-- Explicit 5-image starter trial for Mint AI.

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS trial_image_generations_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS trial_image_generations_limit INTEGER NOT NULL DEFAULT 5;

DO $$
BEGIN
  UPDATE memberships m
  SET trial_image_generations_used = LEAST(
        COALESCE(m.trial_image_generations_limit, 5),
        COALESCE(imported.completed_images, 0)
      )
  FROM (
    SELECT g.user_id, COUNT(*)::INTEGER AS completed_images
    FROM ai_generations g
    WHERE g.tool_type = 'image'
      AND g.status = 'completed'
    GROUP BY g.user_id
  ) imported
  WHERE imported.user_id = m.user_id
    AND m.status = 'trial';
END $$;
