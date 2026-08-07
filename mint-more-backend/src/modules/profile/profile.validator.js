const AppError = require('../../utils/AppError');

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeHex = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : null;
};

const validatePalette = (palette, errors) => {
  if (palette === undefined) return;
  if (!Array.isArray(palette)) {
    errors.push('brand_assets.palette must be an array of colors');
    return;
  }
  if (palette.length > 12) {
    errors.push('brand_assets.palette can contain up to 12 colors');
  }
  palette.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      errors.push(`brand_assets.palette[${index}] must be an object`);
      return;
    }
    if (entry.hex === undefined || normalizeHex(entry.hex) === null) {
      errors.push(`brand_assets.palette[${index}].hex must be a valid hex color`);
    }
    if (entry.label !== undefined && (typeof entry.label !== 'string' || entry.label.trim().length > 40)) {
      errors.push(`brand_assets.palette[${index}].label must be a string under 40 characters`);
    }
  });
};

const validateAssetList = (assets, fieldName, errors, limit = 20) => {
  if (assets === undefined) return;
  if (!Array.isArray(assets)) {
    errors.push(`${fieldName} must be an array`);
    return;
  }
  if (assets.length > limit) {
    errors.push(`${fieldName} can contain up to ${limit} items`);
  }
  assets.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      errors.push(`${fieldName}[${index}] must be an object`);
      return;
    }
    if (entry.url !== undefined && (typeof entry.url !== 'string' || !entry.url.trim())) {
      errors.push(`${fieldName}[${index}].url must be a string`);
    }
    if (entry.kind !== undefined && !['logo', 'reference', 'photo', 'file'].includes(entry.kind)) {
      errors.push(`${fieldName}[${index}].kind must be one of: logo, reference, photo, file`);
    }
  });
};

const validateBrandAssets = (value, errors) => {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    errors.push('brand_assets must be an object');
    return;
  }
  validatePalette(value.palette, errors);
  validateAssetList(value.logos, 'brand_assets.logos', errors, 10);
  validateAssetList(value.references, 'brand_assets.references', errors, 30);
  validateAssetList(value.photos, 'brand_assets.photos', errors, 30);
  validateAssetList(value.files, 'brand_assets.files', errors, 60);
};

const validateGoogleBusiness = (value, errors) => {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    errors.push('google_business must be an object');
    return;
  }
  const checks = [
    ['listing_name', 120],
    ['place_id', 255],
    ['formatted_address', 255],
    ['phone', 30],
    ['website', 255],
    ['maps_url', 255],
  ];
  checks.forEach(([key, maxLength]) => {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].trim().length > maxLength)) {
      errors.push(`google_business.${key} must be a string under ${maxLength} characters`);
    }
  });
};

const validatePostingPreferences = (value, errors) => {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    errors.push('posting_preferences must be an object');
    return;
  }
  const enums = {
    festival_mode: ['manual', 'managed', 'hybrid'],
    content_mode: ['admin_first', 'client_first', 'mixed'],
    approval_mode: ['app_or_whatsapp', 'app_only', 'whatsapp_only', 'every_post', 'autopilot'],
    publish_mode: ['managed', 'manual', 'hybrid'],
    cadence: ['monthly', 'weekly', 'custom'],
  };
  Object.entries(enums).forEach(([key, allowed]) => {
    if (value[key] !== undefined && !allowed.includes(value[key])) {
      errors.push(`posting_preferences.${key} must be one of: ${allowed.join(', ')}`);
    }
  });
};

const validateProfileUpdate = (body) => {
  const { full_name, phone, bio, gender, date_of_birth, skills } = body;
  const errors = [];

  if (full_name !== undefined) {
    if (typeof full_name !== 'string' || full_name.trim().length < 2) {
      errors.push('full_name must be at least 2 characters');
    }
  }

  if (phone !== undefined) {
    // Basic Indian phone number validation
    if (!/^[6-9]\d{9}$/.test(phone)) {
      errors.push('phone must be a valid 10-digit Indian mobile number');
    }
  }

  if (bio !== undefined) {
    if (typeof bio !== 'string' || bio.length > 500) {
      errors.push('bio must be a string under 500 characters');
    }
  }

  if (gender !== undefined) {
    const allowed = ['male', 'female', 'non_binary', 'prefer_not_to_say'];
    if (!allowed.includes(gender)) {
      errors.push(`gender must be one of: ${allowed.join(', ')}`);
    }
  }

  if (date_of_birth !== undefined) {
    const dob = new Date(date_of_birth);
    if (isNaN(dob.getTime())) {
      errors.push('date_of_birth must be a valid date (YYYY-MM-DD)');
    } else {
      const age = Math.floor((Date.now() - dob) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) errors.push('You must be at least 18 years old');
      if (age > 100) errors.push('Invalid date of birth');
    }
  }

  if (skills !== undefined) {
    if (!Array.isArray(skills)) {
      errors.push('skills must be an array of strings');
    } else if (skills.length > 20) {
      errors.push('You can add up to 20 skills');
    } else if (skills.some((s) => typeof s !== 'string' || s.length > 50)) {
      errors.push('Each skill must be a string under 50 characters');
    }
  }

  validateBrandAssets(body.brand_assets, errors);
  validateGoogleBusiness(body.google_business, errors);
  validatePostingPreferences(body.posting_preferences, errors);

  const { price_min, price_max, pricing_visibility } = body;

  if (price_min !== undefined) {
    const val = parseFloat(price_min);
    if (isNaN(val) || val < 0) {
      errors.push('price_min must be a positive number');
    }
  }

  if (price_max !== undefined) {
    const val = parseFloat(price_max);
    if (isNaN(val) || val < 0) {
      errors.push('price_max must be a positive number');
    }
  }

  if (price_min !== undefined && price_max !== undefined) {
    if (parseFloat(price_min) >= parseFloat(price_max)) {
      errors.push('price_min must be less than price_max');
    }
  }

  if (pricing_visibility !== undefined && typeof pricing_visibility !== 'boolean') {
    errors.push('pricing_visibility must be a boolean');
  }

  if (errors.length > 0) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    throw err;
  }
};

module.exports = { validateProfileUpdate };
