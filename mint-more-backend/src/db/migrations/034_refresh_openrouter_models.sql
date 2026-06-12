-- Stable OpenRouter routing entries. The router keeps text generation working
-- when individual free model slugs are retired, while the image entry uses a
-- model that supports OpenRouter's multimodal image-generation response.
INSERT INTO ai_models
  (openrouter_id, name, description, provider_name, supported_tools, tier,
   cost_per_1k_tokens, context_window, tags, is_trending, is_active, sort_order)
VALUES
  (
    'openrouter/free',
    'OpenRouter Free',
    'Automatically selects an available free text model.',
    'OpenRouter',
    ARRAY['text','caption','repurpose','video_script']::ai_tool_type[],
    'free', 0, 0, ARRAY['free','automatic','reliable'], true, true, 0
  ),
  (
    'google/gemini-2.5-flash-image',
    'Gemini 2.5 Flash Image',
    'Fast image generation through OpenRouter.',
    'Google',
    ARRAY['image']::ai_tool_type[],
    'standard', 1, 32768, ARRAY['image','fast','google'], true, true, 5
  )
ON CONFLICT (openrouter_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  provider_name = EXCLUDED.provider_name,
  supported_tools = EXCLUDED.supported_tools,
  tier = EXCLUDED.tier,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
