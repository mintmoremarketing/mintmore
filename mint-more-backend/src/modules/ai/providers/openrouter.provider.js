const env    = require('../../../config/env');
const logger = require('../../../utils/logger');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const VIDEO_MODELS_CACHE_TTL_MS = 5 * 60 * 1000;
let videoModelsCache = null;
let videoModelsCacheExpiresAt = 0;
const openRouterHeaders = () => ({
  Authorization: `Bearer ${env.ai.openrouterKey}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://mintmoremarketing.com',
  'X-Title': 'CREATYV AI',
});

const parseProviderJson = async (response, operation) => {
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  if (!contentType.includes('application/json')) {
    const error = new Error(
      `OpenRouter ${operation} returned ${response.status} ${contentType || 'without a content type'} instead of JSON`
    );
    error.retryable = response.status >= 500;
    logger.error('OpenRouter returned non-JSON response', {
      operation,
      status: response.status,
      contentType,
      bodyPreview: body.slice(0, 180),
    });
    throw error;
  }
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error(`OpenRouter ${operation} returned invalid JSON`);
    error.retryable = response.status >= 500;
    throw error;
  }
};

const assertConfigured = () => {
  if (!env.ai.openrouterKey || !env.ai.openrouterKey.startsWith('sk-or-')) {
    throw new Error('OpenRouter is not configured with a valid OPENROUTER_API_KEY');
  }
};

const markProviderError = (error, message = '') => {
  if (/requires more credits|can only afford|upgrade to a paid account/i.test(message)) {
    error.retryable = false;
    error.code = 'OPENROUTER_INSUFFICIENT_CREDITS';
  } else if (/rate limit|too many requests/i.test(message)) {
    error.retryable = true;
    error.code = 'OPENROUTER_RATE_LIMITED';
  }
  return error;
};

/**
 * Generate text via OpenRouter.
 */

const fixMojibake = (str) => {
  if (!str || typeof str !== 'string') return str;
  if (/^[\x00-\xFF]*$/.test(str) && /(ðŸ|â€)/.test(str)) {
    try {
      return Buffer.from(str, 'latin1').toString('utf8');
    } catch(e) {
      return str;
    }
  }
  return str;
};

const generateText = async (openrouterId, prompt, params = {}, systemPromptOverride = null) => {
  assertConfigured();
  const startTime = Date.now();

  const {
    temperature = 0.7,
    max_tokens  = 2000,
    chat_history = [],
  } = params;

  const systemPrompt = systemPromptOverride ||
    'You are a helpful creative assistant for CREATYV, an Indian creative services platform. Be concise, professional, and culturally relevant for Indian businesses.';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chat_history,
    { role: 'user',   content: prompt },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  let response;
  try {
    response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${env.ai.openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mintmoremarketing.com',
        'X-Title':      'CREATYV AI',
      },
      body: JSON.stringify({
        model:       openrouterId,
        messages,
        temperature,
        max_tokens,
      }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw markProviderError(new Error(`OpenRouter fetch failed: ${err.message}`), 'Network Error');
  }
  clearTimeout(timeoutId);

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
    throw markProviderError(new Error(errorMsg), errorMsg);
  }

  return {
    text:          fixMojibake(data.choices?.[0]?.message?.content || ''),
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
    aspect_ratio,
    reference_urls = [],
    max_tokens = 1024,
    _system,
  } = params;

  const userContent = reference_urls.length > 0
    ? [
      { type: 'text', text: prompt },
      ...reference_urls.map((url) => ({
        type: 'image_url',
        image_url: { url },
      })),
    ]
    : prompt;

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${env.ai.openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mintmoremarketing.com',
      'X-Title':      'CREATYV AI',
    },
    body: JSON.stringify({
      model: openrouterId,
      messages: [
        _system ? { role: 'system', content: _system } : null,
        { role: 'user', content: userContent },
      ].filter(Boolean),
      modalities: ['image', 'text'],
      image_config: {
        aspect_ratio: aspect_ratio && aspect_ratio !== 'Auto'
          ? aspect_ratio
          : width === height ? '1:1' : `${width}:${height}`,
      },
      max_tokens,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error?.message || `OpenRouter image error: ${response.status}`;
    logger.error('OpenRouter image error', { openrouterId, error: errorMsg });
    throw markProviderError(new Error(errorMsg), errorMsg);
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

const fetchOpenRouterVideoModels = async () => {
  if (videoModelsCache && Date.now() < videoModelsCacheExpiresAt) {
    return videoModelsCache;
  }

  try {
    assertConfigured();
    const response = await fetch(`${OPENROUTER_BASE}/videos/models`, {
      headers: { Authorization: `Bearer ${env.ai.openrouterKey}` },
    });
    const data = await parseProviderJson(response, 'video model discovery');
    if (!response.ok) {
      throw new Error(data.error?.message || `OpenRouter video model discovery error: ${response.status}`);
    }

    videoModelsCache = (data.data || []).map((model) => ({
      ...model,
      supported_durations: [...(model.supported_durations || [])].sort((a, b) => a - b),
    }));
    videoModelsCacheExpiresAt = Date.now() + VIDEO_MODELS_CACHE_TTL_MS;
    return videoModelsCache;
  } catch (err) {
    logger.error('fetchOpenRouterVideoModels failed', { error: err.message });
    return videoModelsCache || [];
  }
};

const getOpenRouterVideoModel = async (openrouterId) => {
  const videoModels = await fetchOpenRouterVideoModels();
  if (videoModels.length === 0) {
    const error = new Error('OpenRouter video model catalog is temporarily unavailable');
    error.retryable = true;
    throw error;
  }

  const model = videoModels.find((candidate) => candidate.id === openrouterId);
  if (!model) {
    const error = new Error(`Model ${openrouterId} is not an available video generation model`);
    error.retryable = false;
    throw error;
  }
  return model;
};

const normalizeVideoParameters = (modelCapabilities, params = {}) => {
  const supportedDurations = modelCapabilities.supported_durations || [];
  const supportedAspectRatios = modelCapabilities.supported_aspect_ratios || [];
  const supportedResolutions = modelCapabilities.supported_resolutions || [];
  const requestedDuration = Number(params.duration);

  return {
    ...params,
    duration: supportedDurations.includes(requestedDuration)
      ? requestedDuration
      : supportedDurations[0],
    aspect_ratio: supportedAspectRatios.includes(params.aspect_ratio)
      ? params.aspect_ratio
      : supportedAspectRatios[0],
    resolution: supportedResolutions.includes(params.resolution)
      ? params.resolution
      : supportedResolutions[0],
  };
};

/**
 * Generate video via OpenRouter video generation endpoint.
 *
 * OpenRouter video generation API:
 * POST /v1/videos
 *
 * Supports:
 * - text-to-video: just a prompt
 * - image-to-video: prompt + frame_images
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

  const modelCapabilities = await getOpenRouterVideoModel(openrouterId);
  const normalizedParams = normalizeVideoParameters(modelCapabilities, params);
  const {
    duration,
    aspect_ratio,
    resolution,
    first_frame_url = null,   // image-to-video: URL of first frame
    last_frame_url  = null,   // some models support last frame too
    reference_urls = [],
  } = normalizedParams;

  // Build request body
  const body = {
    model:  openrouterId,
    prompt,
    duration,
    aspect_ratio,
    resolution,
  };

  const frameImages = [];
  for (const url of (Array.isArray(reference_urls) ? reference_urls : []).filter(Boolean)) {
    frameImages.push({
      type: 'image_url',
      image_url: { url },
    });
  }
  if (first_frame_url) {
    frameImages.push({
      type: 'image_url',
      image_url: { url: first_frame_url },
      frame_type: 'first_frame',
    });
  }
  if (last_frame_url) {
    frameImages.push({
      type: 'image_url',
      image_url: { url: last_frame_url },
      frame_type: 'last_frame',
    });
  }
  if (frameImages.length) body.frame_images = frameImages;

  // Step 1 - Submit generation request
  assertConfigured();
  const submitRes = await fetch(`${OPENROUTER_BASE}/videos`, {
    method:  'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify(body),
  });

  const submitData = await parseProviderJson(submitRes, 'video submission');

  if (!submitRes.ok) {
    const errorMsg = submitData.error?.message || `OpenRouter video error: ${submitRes.status}`;
    logger.error('OpenRouter video submit error', { openrouterId, error: errorMsg });
    const error = new Error(errorMsg);
    error.retryable = submitRes.status === 429 || submitRes.status >= 500;
    throw error;
  }

  const generationJobId = submitData.id;
  if (!generationJobId) {
    const error = new Error('OpenRouter returned no video generation ID');
    error.retryable = false;
    throw error;
  }

  logger.info('Video generation submitted', { openrouterId, generationJobId });

  // Step 2 - Poll for completion (max 10 minutes for video)
  const maxWaitMs   = 10 * 60 * 1000;
  const pollEveryMs = 10000;
  const deadline    = Date.now() + maxWaitMs;
  const pollingUrl = submitData.polling_url?.startsWith('http')
    ? submitData.polling_url
    : `${OPENROUTER_BASE}/videos/${generationJobId}`;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollEveryMs));

    const pollRes = await fetch(pollingUrl, {
      headers: { Authorization: `Bearer ${env.ai.openrouterKey}` },
    });

    const pollData = await parseProviderJson(pollRes, 'video polling');
    if (!pollRes.ok) {
      const error = new Error(pollData.error?.message || `OpenRouter video polling error: ${pollRes.status}`);
      error.retryable = pollRes.status === 429 || pollRes.status >= 500;
      throw error;
    }

    if (pollData.status === 'completed') {
      const videoUrl = pollData.unsigned_urls?.[0];
      if (!videoUrl) {
        const error = new Error('Video generation completed but no URL returned');
        error.retryable = false;
        throw error;
      }

      const duration_ms = Date.now() - startTime;
      logger.info('Video generation completed', {
        openrouterId, generationJobId, duration_ms,
      });

      return {
        url:              videoUrl,
        duration_ms,
        duration_seconds: duration,
        generation_job_id: generationJobId,
        download_headers: { Authorization: `Bearer ${env.ai.openrouterKey}` },
      };
    }

    if (['failed', 'cancelled', 'expired'].includes(pollData.status)) {
      const error = new Error(
        typeof pollData.error === 'string'
          ? pollData.error
          : pollData.error?.message || pollData.message || `Video generation ${pollData.status}`
      );
      error.retryable = false;
      throw error;
    }

    logger.debug('Video generation still processing', {
      generationJobId,
      status: pollData.status,
      elapsed_ms: Date.now() - startTime,
    });
  }

  const error = new Error('Video generation timed out after 10 minutes');
  error.retryable = true;
  throw error;
};

module.exports = {
  generateText,
  generateImage,
  generateVideo,
  fetchOpenRouterModels,
  fetchOpenRouterVideoModels,
  getOpenRouterVideoModel,
  normalizeVideoParameters,
};
