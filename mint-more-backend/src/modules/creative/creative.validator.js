const AppError = require('../../utils/AppError');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === 'string' && UUID_REGEX.test(value);

const validateUuid = (id, fieldName = 'id') => {
  if (!id || !isUuid(id)) {
    throw new AppError(`Invalid ${fieldName}: must be a valid UUID`, 400);
  }
};

const validateAssignDesigner = (params = {}, body = {}) => {
  validateUuid(params.clientId, 'clientId');

  if (body.designer_id !== undefined && body.designer_id !== null) {
    validateUuid(body.designer_id, 'designer_id');
  }
};

const validateUploadCreative = (params = {}, body = {}) => {
  validateUuid(params.postId, 'postId');

  if (!body || typeof body.creative_url !== 'string' || !body.creative_url.trim()) {
    throw new AppError('creative_url is required', 400);
  }
};

const validateAdminApprove = (params = {}, body = {}) => {
  validateUuid(params.postId, 'postId');

  const timestamp = body?.scheduled_at || body?.publish_at;
  if (timestamp) {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      throw new AppError('scheduled_at must be a valid ISO datetime', 400);
    }
  }
};

const validateRejection = (params = {}, body = {}) => {
  validateUuid(params.postId, 'postId');

  if (!body || typeof body.reason !== 'string' || !body.reason.trim()) {
    throw new AppError('Rejection reason is required', 400);
  }
};

const validateClientApprove = (params = {}) => {
  validateUuid(params.postId, 'postId');
};

const validateDirectUpload = (body = {}) => {
  if (!body || !body.client_id) {
    throw new AppError('client_id is required', 400);
  }
  validateUuid(body.client_id, 'client_id');

  if (!body.creative_url || typeof body.creative_url !== 'string' || !body.creative_url.trim()) {
    throw new AppError('creative_url is required', 400);
  }

  const timestamp = body.scheduled_at || body.publish_at;
  if (timestamp) {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      throw new AppError('scheduled_at must be a valid ISO datetime', 400);
    }
  }
};

module.exports = {
  isUuid,
  validateUuid,
  validateAssignDesigner,
  validateUploadCreative,
  validateAdminApprove,
  validateRejection,
  validateClientApprove,
  validateDirectUpload,
};
