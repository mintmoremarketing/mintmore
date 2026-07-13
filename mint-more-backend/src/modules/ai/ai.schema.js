const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const ensureAIEngineSchema = async () => {
  await query(`
    ALTER TABLE ai_models
      ADD COLUMN IF NOT EXISTS supports_refs BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS supports_thinking_level BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS supports_google_search BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_beta BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS avg_latency_seconds INTEGER,
      ADD COLUMN IF NOT EXISTS latency_range TEXT,
      ADD COLUMN IF NOT EXISTS is_unlimited_tier JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS best_for TEXT[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS provider_display_name TEXT,
      ADD COLUMN IF NOT EXISTS icon_key TEXT;

    ALTER TABLE ai_generations
      ADD COLUMN IF NOT EXISTS raw_prompt TEXT,
      ADD COLUMN IF NOT EXISTS enhanced_prompt TEXT,
      ADD COLUMN IF NOT EXISTS seed BIGINT,
      ADD COLUMN IF NOT EXISTS aspect_ratio TEXT,
      ADD COLUMN IF NOT EXISTS resolution_tier TEXT,
      ADD COLUMN IF NOT EXISTS style_preset_id TEXT,
      ADD COLUMN IF NOT EXISTS reference_asset_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
      ADD COLUMN IF NOT EXISTS thinking_level TEXT,
      ADD COLUMN IF NOT EXISTS google_search_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS batch_count INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS engine_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS ai_reference_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      project_id UUID NULL,
      alias TEXT NOT NULL,
      storage_bucket TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, session_id, alias)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_reference_assets_user_session
      ON ai_reference_assets(user_id, session_id, created_at);

    CREATE TABLE IF NOT EXISTS ai_style_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      thumbnail_url TEXT,
      prompt_modifier TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

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
      content_type TEXT NOT NULL DEFAULT 'image',
      destination_platforms TEXT[] NOT NULL DEFAULT '{}'::text[],
      caption TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}'::text[],
      share_generation_parameters BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_published_posts_user_created
      ON published_posts(user_id, created_at DESC);
  `);

  await query(`
    INSERT INTO ai_style_presets (id, name, thumbnail_url, prompt_modifier, sort_order)
    VALUES
      ('cinematic', 'Cinematic', '/ai-styles/cinematic.svg', 'Use cinematic lighting, filmic contrast, depth, and professional composition.', 10),
      ('anime', 'Anime', '/ai-styles/anime.svg', 'Use polished anime-inspired styling with expressive shape language and clean detail.', 20),
      ('three_d_render', '3D Render', '/ai-styles/3d-render.svg', 'Use high-quality 3D render aesthetics, soft studio lighting, and tactile materials.', 30),
      ('minimal_line_art', 'Minimalist Line Art', '/ai-styles/minimal-line-art.svg', 'Use minimalist line art with restrained details, clean negative space, and elegant contrast.', 40),
      ('editorial', 'Editorial', '/ai-styles/editorial.svg', 'Use premium editorial design language, confident layout, and refined visual hierarchy.', 50),
      ('product_studio', 'Product Studio', '/ai-styles/product-studio.svg', 'Use crisp product-studio lighting, clean background, sharp focus, and commercial polish.', 60)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      thumbnail_url = EXCLUDED.thumbnail_url,
      prompt_modifier = EXCLUDED.prompt_modifier,
      sort_order = EXCLUDED.sort_order,
      is_active = true,
      updated_at = NOW();
  `);

  logger.info('AI engine schema verified');
};

module.exports = { ensureAIEngineSchema };
