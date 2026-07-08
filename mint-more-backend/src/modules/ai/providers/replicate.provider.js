const Replicate = require('replicate');
const env       = require('../../../config/env');
const logger    = require('../../../utils/logger');

const replicate = new Replicate({ auth: env.ai.replicateToken });

const ensureReplicateConfigured = () => {
  if (!env.ai.replicateToken) {
    throw new Error('Replicate image generation is not configured. Add REPLICATE_API_TOKEN to the backend environment.');
  }
};

const normalizeAspectRatio = (value, fallback = '1:1') => {
  const allowed = new Set(['match_input_image', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9']);
  const ratio = String(value || '').trim();
  if (!ratio || ratio === 'Auto') return fallback;
  return allowed.has(ratio) ? ratio : fallback;
};

const buildSeedreamInput = (prompt, params) => {
  const referenceUrls = Array.isArray(params.reference_urls)
    ? params.reference_urls.filter(Boolean)
    : [];
  const resolutionTier = String(params.resolution_tier || '1K').toUpperCase();
  const systemPrompt = String(params._system || '').trim();
  const providerPrompt = systemPrompt
    ? `${systemPrompt}\n\nProvider creative brief:\n${prompt}`
    : prompt;
  return {
    prompt: providerPrompt,
    image_input: referenceUrls,
    size: resolutionTier === '4K' ? '3K' : '2K',
    aspect_ratio: normalizeAspectRatio(params.aspect_ratio, referenceUrls.length ? 'match_input_image' : '1:1'),
    sequential_image_generation: 'disabled',
    max_images: 1,
    output_format: 'png',
  };
};

/**
 * Generate an image via Replicate.
 * Polls until complete then returns the output URL.
 *
 * @param {string} modelId   - Replicate model string (e.g. 'black-forest-labs/flux-schnell')
 * @param {string} prompt    - image generation prompt
 * @param {object} params    - width, height, num_outputs, guidance_scale, etc.
 * @returns {{ url, duration_ms }}
 */
const generateImage = async (modelId, prompt, params = {}) => {
  ensureReplicateConfigured();
  const startTime = Date.now();

  const {
    width          = 1024,
    height         = 1024,
    num_outputs    = 1,
    guidance_scale = 3.5,
    num_inference_steps = 4,  // flux-schnell uses 4 steps
    output_format  = 'webp',
    output_quality = 90,
  } = params;

  let input = {
    prompt,
    width,
    height,
    num_outputs,
    output_format,
    output_quality,
  };

  // Model-specific parameters
  if (modelId.includes('seedream-5-lite')) {
    input = buildSeedreamInput(prompt, params);
  } else if (modelId.includes('flux')) {
    input.guidance_scale         = guidance_scale;
    input.num_inference_steps    = num_inference_steps;
  } else if (modelId.includes('sdxl')) {
    input.negative_prompt        = params.negative_prompt || 'blurry, low quality, watermark';
    input.num_inference_steps    = params.num_inference_steps || 30;
  }

  try {
    const output = await replicate.run(modelId, { input });

    // output is an array of URLs
    const imageUrls = Array.isArray(output) ? output : [output];
    const url       = imageUrls[0];
    const duration_ms = Date.now() - startTime;

    if (!url) throw new Error('Replicate returned no image URL');

    logger.info('Replicate image generated', { modelId, duration_ms });
    return { url, duration_ms };
  } catch (err) {
    const msg = err.message || 'Replicate generation failed';
    logger.error('Replicate error', { modelId, error: msg });
    throw new Error(`Image generation failed: ${msg}`);
  }
};

module.exports = { generateImage };
