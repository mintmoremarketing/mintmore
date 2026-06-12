const env    = require('../../../config/env');
const logger = require('../../../utils/logger');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const assertConfigured = () => {
  if (!env.ai.openrouterKey || !env.ai.openrouterKey.startsWith('sk-or-')) {
    throw new Error('OpenRouter is not configured with a valid OPENROUTER_API_KEY');
  }
};

/**
 * Generate text via OpenRouter.
 */
const generateText = async (openrouterId, prompt, params = {}, systemPromptOverride = null) => {
  assertConfigured();
  const startTime = Date.now();

  const {
    temperature = 0.7,
    max_tokens  = 2000,
  } = params;

  const systemPrompt = systemPromptOverride ||
    'You are a helpful creative assistant for Mint More, an Indian creative services platform. Be concise, professional, and culturally relevant for Indian businesses.';

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${env.ai.openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mintmoremarketing.com',
      'X-Title':      'Mint More AI',
    },
    body: JSON.stringify({
      model:       openrouterId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: prompt },
      ],
      temperature,
      max_tokens,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error?.message || `OpenRouter error: ${response.status}`;
    logger.error('OpenRouter error', { openrouterId, error: errorMsg, status: response.status });
    if (
      openrouterId !== 'openrouter/free' &&
      [400, 404].includes(response.status) &&
      /model|provider|endpoint|available|found/i.test(errorMsg)
    ) {
      logger.warn('OpenRouter model unavailable, using free router fallback', { openrouterId });
      return generateText('openrouter/free', prompt, params, systemPromptOverride);
    }
    throw new Error(errorMsg);
  }

  return {
    text:          data.choices?.[0]?.message?.content || '',
    tokens_input:  data.usage?.prompt_tokens     || 0,
    tokens_output: data.usage?.completion_tokens || 0,
    duration_ms:   Date.now() - startTime,
  };
};

/**
 * Generate image via OpenRouter.
 * Supports models like dall-e-3, stable-diffusion via OpenRouter's image endpoint.
 */
const generateImage = async (openrouterId, prompt, params = {}) => {
  assertConfigured();
  const startTime = Date.now();

  const {
    width  = 1024,
    height = 1024,
  } = params;

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${env.ai.openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mintmoremarketing.com',
      'X-Title':      'Mint More AI',
    },
    body: JSON.stringify({
      model: openrouterId,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: width === height ? '1:1' : `${width}:${height}` },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error?.message || `OpenRouter image error: ${response.status}`;
    logger.error('OpenRouter image error', { openrouterId, error: errorMsg });
    throw new Error(errorMsg);
  }

  const image = data.choices?.[0]?.message?.images?.[0];
  const url = image?.image_url?.url || image?.url || data.data?.[0]?.url || data.data?.[0]?.b64_json;
  if (!url) throw new Error('OpenRouter returned no image URL');

  return {
    url,
    duration_ms: Date.now() - startTime,
  };
};

/**
 * Fetch all available models from OpenRouter.
 * Used by admin to browse and add new models.
 */
const fetchOpenRouterModels = async () => {
  try {
    assertConfigured();
    const response = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: { Authorization: `Bearer ${env.ai.openrouterKey}` },
    });
    const data = await response.json();
    return (data.data || []).map((m) => ({
      openrouter_id:  m.id,
      name:           m.name,
      description:    m.description,
      context_window: m.context_length,
      pricing:        m.pricing,
      is_free:        parseFloat(m.pricing?.completion || '0') === 0,
    }));
  } catch (err) {
    logger.error('fetchOpenRouterModels failed', { error: err.message });
    return [];
  }
};

/**
 * Generate video via OpenRouter video generation endpoint.
 *
 * OpenRouter video generation API:
 * POST /v1/video/generations
 *
 * Supports:
 * - text-to-video: just a prompt
 * - image-to-video: prompt + first_frame_image (base64 or URL)
 *
 * Returns a generation ID -> we poll for completion.
 *
 * @param {string} openrouterId   - OpenRouter video model string
 * @param {string} prompt         - text description of the video
 * @param {object} params         - duration, aspect_ratio, first_frame_url, etc.
 * @returns {{ url, duration_ms, duration_seconds }}
 */
const generateVideo = async (openrouterId, prompt, params = {}) => {
  const startTime = Date.now();

  const {
    duration        = 5,      // seconds (4-10 depending on model)
    aspect_ratio    = '16:9', // '16:9' | '9:16' | '1:1'
    first_frame_url = null,   // image-to-video: URL of first frame
    last_frame_url  = null,   // some models support last frame too
    resolution      = '720p', // '720p' | '1080p'
  } = params;

  // Build request body
  const body = {
    model:  openrouterId,
    prompt,
    duration,
    aspect_ratio,
    resolution,
  };

  if (first_frame_url) body.first_frame_image = first_frame_url;
  if (last_frame_url)  body.last_frame_image  = last_frame_url;

  // Step 1 - Submit generation request
  const submitRes = await fetch(`${OPENROUTER_BASE}/video/generations`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${env.ai.openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mintmoremarketing.com',
      'X-Title':      'Mint More AI',
    },
    body: JSON.stringify(body),
  });

  const submitData = await submitRes.json();

  if (!submitRes.ok) {
    const errorMsg = submitData.error?.message || `OpenRouter video error: ${submitRes.status}`;
    logger.error('OpenRouter video submit error', { openrouterId, error: errorMsg });
    throw new Error(errorMsg);
  }

  const generationJobId = submitData.id;
  if (!generationJobId) throw new Error('OpenRouter returned no video generation ID');

  logger.info('Video generation submitted', { openrouterId, generationJobId });

  // Step 2 - Poll for completion (max 10 minutes for video)
  const maxWaitMs   = 10 * 60 * 1000;
  const pollEveryMs = 5000;
  const deadline    = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollEveryMs));

    const pollRes = await fetch(
      `${OPENROUTER_BASE}/video/generations/${generationJobId}`,
      {
        headers: {
          Authorization: `Bearer ${env.ai.openrouterKey}`,
        },
      }
    );

    const pollData = await pollRes.json();

    if (pollData.status === 'completed' || pollData.status === 'succeeded') {
      const videoUrl = pollData.url || pollData.video_url || pollData.output?.[0];
      if (!videoUrl) throw new Error('Video generation completed but no URL returned');

      const duration_ms = Date.now() - startTime;
      logger.info('Video generation completed', {
        openrouterId, generationJobId, duration_ms,
      });

      return {
        url:              videoUrl,
        duration_ms,
        duration_seconds: duration,
        generation_job_id: generationJobId,
      };
    }

    if (pollData.status === 'failed' || pollData.status === 'error') {
      const msg = pollData.error?.message || pollData.message || 'Video generation failed';
      throw new Error(msg);
    }

    logger.debug('Video generation still processing', {
      generationJobId,
      status: pollData.status,
      elapsed_ms: Date.now() - startTime,
    });
  }

  throw new Error('Video generation timed out after 10 minutes');
};

module.exports = {
  generateText,
  generateImage,
  generateVideo,
  fetchOpenRouterModels,
};
