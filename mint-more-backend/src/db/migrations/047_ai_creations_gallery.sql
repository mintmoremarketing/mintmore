-- Mint AI creations gallery metadata.
-- Additive only: favorites, soft-delete, and a draft publish target for generated assets.

ALTER TABLE ai_generations
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_generations_user_tool_project_created
  ON ai_generations(user_id, tool_type, source_job_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_generations_user_favorite
  ON ai_generations(user_id, is_favorite, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS published_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES ai_generations(id) ON DELETE SET NULL,
  media_url TEXT NOT NULL,
  caption TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  share_generation_parameters BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_published_posts_user_created
  ON published_posts(user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'published_posts_updated_at'
  ) THEN
    CREATE TRIGGER published_posts_updated_at
      BEFORE UPDATE ON published_posts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
