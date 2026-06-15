-- Reconcile the local AI catalog with OpenRouter's video model catalog as of
-- 2026-06-15. Runtime capability checks remain authoritative because provider
-- availability can change after this migration runs.

UPDATE ai_models
SET openrouter_id = 'bytedance/seedance-1-5-pro',
    updated_at = NOW()
WHERE openrouter_id = 'bytedance/seedance-1.5-pro'
  AND NOT EXISTS (
    SELECT 1
    FROM ai_models existing
    WHERE existing.openrouter_id = 'bytedance/seedance-1-5-pro'
  );

WITH live_video_models(openrouter_id) AS (
  VALUES
    ('alibaba/wan-2.6'),
    ('alibaba/wan-2.7'),
    ('bytedance/seedance-1-5-pro'),
    ('bytedance/seedance-2.0'),
    ('bytedance/seedance-2.0-fast'),
    ('google/veo-3.1'),
    ('google/veo-3.1-fast'),
    ('google/veo-3.1-lite'),
    ('kwaivgi/kling-v3.0-pro'),
    ('kwaivgi/kling-v3.0-std'),
    ('kwaivgi/kling-video-o1'),
    ('minimax/hailuo-2.3'),
    ('openai/sora-2-pro'),
    ('x-ai/grok-imagine-video')
)
UPDATE ai_models
SET supported_tools = array_remove(supported_tools, 'video'::ai_tool_type),
    updated_at = NOW()
WHERE supported_tools @> ARRAY['video']::ai_tool_type[]
  AND openrouter_id NOT IN (SELECT openrouter_id FROM live_video_models);

UPDATE ai_models
SET is_active = false,
    updated_at = NOW()
WHERE cardinality(supported_tools) = 0;
