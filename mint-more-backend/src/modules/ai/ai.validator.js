const AppError = require('../../utils/AppError');

const TOOL_TYPES = ['text', 'image', 'video', 'video_script', 'caption', 'repurpose'];

const validateGenerateRequest = (body) => {
  const { tool_type, model_id, prompt } = body;
  const errors = [];

  if (!tool_type || !TOOL_TYPES.includes(tool_type)) {
    errors.push(`tool_type must be one of: ${TOOL_TYPES.join(', ')}`);
  }

  if (!model_id) {
    errors.push('model_id is required (UUID from GET /ai/models)');
  }

  if (!prompt || prompt.trim().length < 1) {
    errors.push('prompt is required');
  }

  if (prompt && prompt.length > 4000) {
    errors.push('prompt must be under 4000 characters');
  }

  if (errors.length > 0) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    throw err;
  }
};

module.exports = { validateGenerateRequest };