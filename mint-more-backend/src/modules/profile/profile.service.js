const { query } = require('../../config/database');
const { uploadFile } = require('../../config/supabase');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs/promises');

const AVATAR_MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const getAvatarExtension = (file) => {
  if (AVATAR_MIME_EXTENSIONS[file.mimetype]) {
    return AVATAR_MIME_EXTENSIONS[file.mimetype];
  }
  return path.extname(file.originalname || '').toLowerCase() || '.jpg';
};

const saveAvatarLocally = async (userId, file, filename) => {
  const uploadRoot = path.join(__dirname, '..', '..', '..', 'uploads', 'avatars', userId);
  await fs.mkdir(uploadRoot, { recursive: true });
  await fs.writeFile(path.join(uploadRoot, filename), file.buffer);
  return `http://localhost:${env.port}/uploads/avatars/${userId}/${filename}`;
};

/**
 * Full profile fields returned to the user.
 * Excludes: password_hash, refresh_token.
 */
const PROFILE_FIELDS = `
  id, email, phone, full_name, role, avatar_url,
  bio, skills, gender, date_of_birth,
  address_city, address_state, country,
  preferred_language, business_name, business_type, customer_profile, onboarding_checklist,
  is_active, is_email_verified,
  kyc_status, kyc_level,
  last_login_at, created_at, updated_at
`;

/**
 * Get full profile of a user by ID.
 */
const getProfile = async (userId) => {
  const result = await query(
    `SELECT ${PROFILE_FIELDS} FROM users WHERE id = $1`,
    [userId]
  );

  if (!result.rows[0]) throw new AppError('User not found', 404);
  return result.rows[0];
};

/**
 * Update allowed profile fields.
 * We build the SET clause dynamically — only update what's provided.
 */
const updateProfile = async (userId, updates) => {
  const allowed = [
    'full_name', 'phone', 'bio', 'gender',
    'date_of_birth', 'skills',
    'address_city', 'address_state', 'country',
    'preferred_language', 'business_name', 'business_type', 'customer_profile', 'onboarding_checklist',
    'price_min', 'price_max', 'pricing_visibility',
  ];

  // Filter to only allowed fields that are actually present in the request
  const fields = Object.keys(updates).filter((k) => allowed.includes(k));

  if (fields.length === 0) {
    throw new AppError('No valid fields provided for update', 400);
  }

  // Check phone uniqueness if provided
  if (updates.phone) {
    const existing = await query(
      'SELECT id FROM users WHERE phone = $1 AND id != $2',
      [updates.phone, userId]
    );
    if (existing.rows.length > 0) {
      throw new AppError('This phone number is already in use', 409);
    }
  }

  // Build parameterised SET clause: "full_name = $1, bio = $2, ..."
  const setClauses = fields.map((field, i) => `${field} = $${i + 1}`);
  const values = fields.map((field) => updates[field]);

  // userId goes at the end for the WHERE clause
  values.push(userId);

  const result = await query(
    `UPDATE users
     SET ${setClauses.join(', ')}
     WHERE id = $${values.length}
     RETURNING ${PROFILE_FIELDS}`,
    values
  );

  logger.info('Profile updated', { userId, fields });
  return result.rows[0];
};

/**
 * Upload avatar to Supabase Storage and update user record.
 */
const updateAvatar = async (userId, file) => {
  if (!file || !file.buffer) {
    throw new AppError('Avatar file is required', 400);
  }

  if (!AVATAR_MIME_EXTENSIONS[file.mimetype]) {
    throw new AppError('Avatar must be a JPG, PNG, or WebP image', 400);
  }

  const filename = `avatar-${uuidv4()}${getAvatarExtension(file)}`;
  const filePath = `${userId}/${filename}`;

  let publicUrl;

  try {
    publicUrl = await uploadFile(
      'avatars',
      filePath,
      file.buffer,
      file.mimetype
    );
  } catch (error) {
    if (!env.isDev) {
      throw error;
    }

    logger.warn('Supabase avatar upload failed; using local dev avatar storage', {
      userId,
      error: error.message,
    });
    publicUrl = await saveAvatarLocally(userId, file, filename);
  }

  const result = await query(
    `UPDATE users SET avatar_url = $1 WHERE id = $2
     RETURNING ${PROFILE_FIELDS}`,
    [publicUrl, userId]
  );

  logger.info('Avatar updated', { userId, publicUrl });
  return result.rows[0];
};

/**
 * Get public profile of any user (limited fields — for marketplace).
 */
const getPublicProfile = async (userId) => {
  const result = await query(
    `SELECT id, full_name, role, avatar_url, bio, skills,
            kyc_status, kyc_level, address_city, address_state,
            country, created_at
     FROM users
     WHERE id = $1 AND is_active = true`,
    [userId]
  );

  if (!result.rows[0]) throw new AppError('User not found', 404);
  return result.rows[0];
};

/**
 * Get pricing guidance for a freelancer based on their category + price.
 * Used to show market hints on profile page.
 */
const getFreelancerPricingGuidance = async (userId) => {
  const { getFreelancerPricingGuidance: getPricingGuidance } = require('../matching/pricing.service');

  const result = await query(
    `SELECT u.price_min, u.price_max, u.freelancer_level,
            u.skills,
            -- Get primary category from most recent proposal's job
            (SELECT j.category_id
             FROM proposals p
             JOIN jobs j ON j.id = p.job_id
             WHERE p.freelancer_id = u.id
             ORDER BY p.created_at DESC
             LIMIT 1) AS primary_category_id
     FROM users u WHERE u.id = $1`,
    [userId]
  );

  const user = result.rows[0];
  if (!user) throw new AppError('User not found', 404);

  if (!user.freelancer_level) {
    return {
      guidance: null,
      message: 'Your freelancer level has not been set yet. Contact support to set your level.',
    };
  }

  const guidance = await getPricingGuidance(
    user.primary_category_id,
    user.freelancer_level,
    user.price_min,
    user.price_max
  );

  return { guidance };
};

module.exports = { getProfile, updateProfile, updateAvatar, getPublicProfile, getFreelancerPricingGuidance };
