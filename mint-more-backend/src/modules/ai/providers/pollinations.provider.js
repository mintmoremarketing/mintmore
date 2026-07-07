const logger = require('../../../utils/logger');

const POLLINATIONS_IMAGE_BASE = 'https://image.pollinations.ai/prompt';

const ASPECT_RATIO_DIMENSIONS = {
  Auto: [1024, 1024],
  '1:1': [1024, 1024],
  '21:9': [1344, 576],
  '8:1': [1536, 192],
  '4:1': [1536, 384],
  '16:9': [1344, 768],
  '9:16': [768, 1344],
  '1:4': [384, 1536],
  '1:8': [192, 1536],
  '4:3': [1152, 864],
  '4:5': [1024, 1280],
};

const RESOLUTION_SCALE = {
  '1K': 1,
  '2K': 1.25,
  '4K': 1.5,
};

const normalizeModel = (modelId) => {
  const model = String(modelId || '').replace(/^pollinations\//, '').trim();
  return model || 'flux';
};

const getDimensions = ({ aspect_ratio = 'Auto', resolution_tier = '1K' } = {}) => {
  const [baseWidth, baseHeight] = ASPECT_RATIO_DIMENSIONS[aspect_ratio] || ASPECT_RATIO_DIMENSIONS.Auto;
  const scale = RESOLUTION_SCALE[resolution_tier] || 1;
  return {
    width: Math.min(1536, Math.round(baseWidth * scale)),
    height: Math.min(1536, Math.round(baseHeight * scale)),
  };
};

const generateImage = async (modelId, prompt, params = {}) => {
  const startTime = Date.now();
  const model = normalizeModel(modelId);
  const { width, height } = getDimensions(params);
  const url = new URL(`${POLLINATIONS_IMAGE_BASE}/${encodeURIComponent(prompt)}`);
  url.searchParams.set('model', model);
  url.searchParams.set('width', String(width));
  url.searchParams.set('height', String(height));
  url.searchParams.set('safe', 'true');
  url.searchParams.set('private', 'true');

  if (params.seed) {
    url.searchParams.set('seed', String(params.seed));
  }

  if (params.ai_prompt || params.enhance) {
    url.searchParams.set('enhance', 'true');
  }

  logger.info('Pollinations image requested', { model, width, height });

  return {
    url: url.toString(),
    duration_ms: Date.now() - startTime,
  };
};

module.exports = { generateImage };
