const AppError = require('../../utils/AppError');

const ALLOWED_PRICING_MODES = ['budget', 'expert'];
const ALLOWED_BUDGET_TYPES = ['quote', 'fixed', 'expert'];
const ALLOWED_LEVELS = ['beginner', 'intermediate', 'experienced'];

const throwIfErrors = (errors) => {
  if (errors.length > 0) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    throw err;
  }
};

const validateCreateJob = (body) => {
  const {
    title,
    description,
    category_id,
    budget_type,
    budget_amount,
    pricing_mode,
    required_level,
    deadline,
    required_skills,
  } = body;

  const errors = [];

  if (!title || title.trim().length < 5) {
    errors.push('title is required (min 5 characters)');
  }
  if (title && title.trim().length > 255) {
    errors.push('title must be under 255 characters');
  }
  if (!description || description.trim().length < 20) {
    errors.push('description is required (min 20 characters)');
  }
  if (!category_id) {
    errors.push('category_id is required');
  }
  if (!pricing_mode || !ALLOWED_PRICING_MODES.includes(pricing_mode)) {
    errors.push(`pricing_mode must be one of: ${ALLOWED_PRICING_MODES.join(', ')}`);
  }
  if (budget_type && !ALLOWED_BUDGET_TYPES.includes(budget_type)) {
    errors.push(`budget_type must be one of: ${ALLOWED_BUDGET_TYPES.join(', ')}`);
  }
  if (budget_amount !== undefined && budget_amount !== null && budget_amount !== '') {
    if (isNaN(parseFloat(budget_amount)) || parseFloat(budget_amount) <= 0) {
      errors.push('budget_amount must be a positive number when provided');
    }
  }
  if (required_level && !ALLOWED_LEVELS.includes(required_level)) {
    errors.push(`required_level must be one of: ${ALLOWED_LEVELS.join(', ')}`);
  }
  if (deadline) {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) {
      errors.push('deadline must be a valid date');
    } else if (d <= new Date()) {
      errors.push('deadline must be in the future');
    }
  }
  if (required_skills !== undefined) {
    if (!Array.isArray(required_skills)) {
      errors.push('required_skills must be an array of strings');
    } else if (required_skills.length > 15) {
      errors.push('required_skills can have at most 15 items');
    } else if (required_skills.some((s) => typeof s !== 'string' || s.length > 60)) {
      errors.push('Each skill must be a string under 60 characters');
    }
  }

  throwIfErrors(errors);
};

const validateUpdateJob = (body) => {
  const {
    title,
    description,
    budget_type,
    budget_amount,
    pricing_mode,
    required_level,
    deadline,
    required_skills,
  } = body;

  const errors = [];

  if (title !== undefined) {
    if (title.trim().length < 5) errors.push('title must be at least 5 characters');
    if (title.trim().length > 255) errors.push('title must be under 255 characters');
  }
  if (description !== undefined && description.trim().length < 20) {
    errors.push('description must be at least 20 characters');
  }
  if (pricing_mode !== undefined && !ALLOWED_PRICING_MODES.includes(pricing_mode)) {
    errors.push(`pricing_mode must be one of: ${ALLOWED_PRICING_MODES.join(', ')}`);
  }
  if (budget_type !== undefined && budget_type && !ALLOWED_BUDGET_TYPES.includes(budget_type)) {
    errors.push(`budget_type must be one of: ${ALLOWED_BUDGET_TYPES.join(', ')}`);
  }
  if (budget_amount !== undefined && budget_amount !== null && budget_amount !== '') {
    if (isNaN(parseFloat(budget_amount)) || parseFloat(budget_amount) <= 0) {
      errors.push('budget_amount must be a positive number when provided');
    }
  }
  if (required_level !== undefined && required_level && !ALLOWED_LEVELS.includes(required_level)) {
    errors.push(`required_level must be one of: ${ALLOWED_LEVELS.join(', ')}`);
  }
  if (deadline !== undefined && deadline) {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) errors.push('deadline must be a valid date');
    else if (d <= new Date()) errors.push('deadline must be in the future');
  }
  if (required_skills !== undefined) {
    if (!Array.isArray(required_skills)) {
      errors.push('required_skills must be an array');
    } else if (required_skills.length > 15) {
      errors.push('required_skills can have at most 15 items');
    }
  }

  throwIfErrors(errors);
};

module.exports = { validateCreateJob, validateUpdateJob };
