const { query } = require('../../config/database');
const { uploadFile } = require('../storage/app-storage.provider');
const { createSignedDownloadUrl } = require('../storage/app-storage.provider');
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

const BRAND_ASSET_MIME_EXTENSIONS = {
  ...AVATAR_MIME_EXTENSIONS,
};

const DEFAULT_BRAND_ASSETS = {
  palette: [],
  logos: [],
  references: [],
  photos: [],
  files: [],
};

const DEFAULT_GOOGLE_BUSINESS = {
  listing_name: '',
  place_id: '',
  formatted_address: '',
  phone: '',
  website: '',
  maps_url: '',
};

const DEFAULT_POSTING_PREFERENCES = {
  festival_mode: 'manual',
  content_mode: 'admin_first',
  approval_mode: 'app_or_whatsapp',
  publish_mode: 'managed',
  cadence: 'monthly',
};

const getAvatarExtension = (file) => {
  if (AVATAR_MIME_EXTENSIONS[file.mimetype]) {
    return AVATAR_MIME_EXTENSIONS[file.mimetype];
  }
  return path.extname(file.originalname || '').toLowerCase() || '.jpg';
};

const saveAvatarLocally = async (userId, file, filename) => {
  const uploadRoot = path.join(process.cwd(), 'uploads', 'avatars', userId);
  await fs.mkdir(uploadRoot, { recursive: true });
  await fs.writeFile(path.join(uploadRoot, filename), file.buffer);
  return `http://localhost:${env.port}/uploads/avatars/${userId}/${filename}`;
};

const PROFILE_SELECT_COLUMNS = [
  'id', 'email', 'phone', 'full_name', 'role', 'avatar_url',
  'bio', 'skills', 'gender', 'date_of_birth',
  'address_line1', 'address_city', 'address_state', 'country',
  'preferred_language', 'business_name', 'business_type', 'customer_profile', 'onboarding_checklist',
  'brand_assets', 'google_business', 'posting_preferences', 'whatsapp_number',
  'is_active', 'is_email_verified',
  'kyc_status', 'kyc_level',
  'last_login_at', 'created_at', 'updated_at',
];

const PROFILE_UPDATABLE_COLUMNS = [
  'full_name', 'phone', 'bio', 'gender',
  'date_of_birth', 'skills',
  'address_line1', 'address_city', 'address_state', 'country',
  'preferred_language', 'business_name', 'business_type', 'customer_profile', 'onboarding_checklist',
  'brand_assets', 'google_business', 'posting_preferences', 'whatsapp_number',
  'price_min', 'price_max', 'pricing_visibility',
];

let usersColumnCache = null;

const getUsersColumnSet = async () => {
  if (usersColumnCache) return usersColumnCache;
  const result = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'`
  );
  usersColumnCache = new Set(result.rows.map((row) => row.column_name));
  return usersColumnCache;
};

const getSafeProfileSelect = async () => {
  const columns = await getUsersColumnSet();
  return PROFILE_SELECT_COLUMNS
    .filter((column) => columns.has(column))
    .join(', ');
};

const getSafeUpdatableFields = async (updates) => {
  const columns = await getUsersColumnSet();
  return PROFILE_UPDATABLE_COLUMNS.filter((field) => columns.has(field) && Object.prototype.hasOwnProperty.call(updates, field));
};

/**
 * Full profile fields returned to the user.
 * Excludes: password_hash, refresh_token.
 */
const PROFILE_FIELDS = `
  id, email, phone, full_name, role, avatar_url,
  bio, skills, gender, date_of_birth,
  address_line1, address_city, address_state, country,
  preferred_language, business_name, business_type, customer_profile, onboarding_checklist,
  brand_assets, google_business, posting_preferences, whatsapp_number,
  is_active, is_email_verified,
  kyc_status, kyc_level,
  last_login_at, created_at, updated_at
`;

const normalizeJsonProfileField = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') {
    if (Array.isArray(fallback) && Array.isArray(value)) return value;
    if (!Array.isArray(value)) return value;
  }
  return fallback;
};

const normalizeBrandAssets = (value) => {
  const assets = normalizeJsonProfileField(value, DEFAULT_BRAND_ASSETS);
  return {
    ...DEFAULT_BRAND_ASSETS,
    ...assets,
    palette: Array.isArray(assets.palette) ? assets.palette : [],
    logos: Array.isArray(assets.logos) ? assets.logos : [],
    references: Array.isArray(assets.references) ? assets.references : [],
    photos: Array.isArray(assets.photos) ? assets.photos : [],
    files: Array.isArray(assets.files) ? assets.files : [],
  };
};

const normalizeGoogleBusiness = (value) => ({
  ...DEFAULT_GOOGLE_BUSINESS,
  ...normalizeJsonProfileField(value, DEFAULT_GOOGLE_BUSINESS),
});

const normalizePostingPreferences = (value) => ({
  ...DEFAULT_POSTING_PREFERENCES,
  ...normalizeJsonProfileField(value, DEFAULT_POSTING_PREFERENCES),
});

const resolveBrandAssetUrl = async (asset) => {
  if (!asset || typeof asset !== 'object') return asset;
  const storageRef = asset.storage_ref
    || (asset.url && typeof asset.url === 'object' ? asset.url : null)
    || null;

  if (!storageRef?.bucket || !storageRef?.path) return asset;

  const signedUrl = await createSignedDownloadUrl(storageRef.bucket, storageRef.path, 7 * 24 * 60 * 60);
  return {
    ...asset,
    storage_ref: storageRef,
    storage_path: asset.storage_path || storageRef.path,
    preview_url: signedUrl || asset.preview_url || null,
    url: signedUrl || asset.url || null,
  };
};

const resolveBrandAssetCollection = async (brandAssets) => {
  const assets = normalizeBrandAssets(brandAssets);
  const resolveList = async (list) => Promise.all(list.map(resolveBrandAssetUrl));
  return {
    ...assets,
    logos: await resolveList(assets.logos),
    references: await resolveList(assets.references),
    photos: await resolveList(assets.photos),
    files: await resolveList(assets.files),
  };
};

/**
 * Get full profile of a user by ID.
 */
const getProfile = async (userId) => {
  const safeSelect = await getSafeProfileSelect();
  const result = await query(
    `SELECT ${safeSelect || 'id, email, full_name, role, avatar_url'} FROM users WHERE id = $1`,
    [userId]
  );

  if (!result.rows[0]) throw new AppError('User not found', 404);
  const profile = result.rows[0];
  return {
    ...profile,
    brand_assets: await resolveBrandAssetCollection(profile.brand_assets),
    google_business: normalizeGoogleBusiness(profile.google_business),
    posting_preferences: normalizePostingPreferences(profile.posting_preferences),
  };
};

/**
 * Update allowed profile fields.
 * We build the SET clause dynamically — only update what's provided.
 */
const updateProfile = async (userId, updates) => {
  const fields = await getSafeUpdatableFields(updates);

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
  const profile = result.rows[0];
  return {
    ...profile,
    brand_assets: await resolveBrandAssetCollection(profile.brand_assets),
    google_business: normalizeGoogleBusiness(profile.google_business),
    posting_preferences: normalizePostingPreferences(profile.posting_preferences),
  };
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

  let storedValue;

  try {
    storedValue = await uploadFile(
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
    storedValue = await saveAvatarLocally(userId, file, filename);
  }

  const publicUrl = typeof storedValue === 'object'
    ? await createSignedDownloadUrl(storedValue.bucket, storedValue.path, 7 * 24 * 60 * 60)
    : storedValue;

  const result = await query(
    `UPDATE users SET avatar_url = $1 WHERE id = $2
     RETURNING ${await getSafeProfileSelect() || 'id, email, full_name, role, avatar_url'}`,
    [publicUrl, userId]
  );

  logger.info('Avatar updated', { userId, publicUrl });
  return result.rows[0];
};

const uploadBrandAsset = async (userId, file, { kind = 'reference', label = '' } = {}) => {
  if (!file || !file.buffer) {
    throw new AppError('Brand asset file is required', 400);
  }

  if (!BRAND_ASSET_MIME_EXTENSIONS[file.mimetype]) {
    throw new AppError('Brand asset must be a JPG, PNG, or WebP image', 400);
  }

  const safeKind = ['logo', 'reference', 'photo'].includes(String(kind).toLowerCase())
    ? String(kind).toLowerCase()
    : 'reference';
  const filename = `${safeKind}-${uuidv4()}${getAvatarExtension(file)}`;
  const filePath = `brand-assets/${userId}/${filename}`;
  const storedValue = await uploadFile(
    'mintbox-files',
    filePath,
    file.buffer,
    file.mimetype
  );
  const previewUrl = typeof storedValue === 'object'
    ? await createSignedDownloadUrl(storedValue.bucket, storedValue.path, 7 * 24 * 60 * 60)
    : storedValue;

  const profileResult = await query(
    `SELECT brand_assets FROM users WHERE id = $1`,
    [userId]
  );
  const currentAssets = normalizeBrandAssets(profileResult.rows[0]?.brand_assets);
  const asset = {
    id: uuidv4(),
    kind: safeKind,
    label: String(label || file.originalname || safeKind).trim(),
    name: file.originalname || filename,
    url: previewUrl,
    preview_url: previewUrl,
    storage_ref: typeof storedValue === 'object' ? storedValue : null,
    storage_path: filePath,
    mime_type: file.mimetype,
    size: file.size || null,
    uploaded_at: new Date().toISOString(),
  };

  const nextAssets = {
    ...currentAssets,
    files: [asset, ...currentAssets.files].slice(0, 60),
  };

  if (safeKind === 'logo') {
    nextAssets.logos = [asset, ...currentAssets.logos.filter((item) => item?.id !== asset.id)].slice(0, 10);
  } else if (safeKind === 'photo') {
    nextAssets.photos = [asset, ...currentAssets.photos.filter((item) => item?.id !== asset.id)].slice(0, 30);
  } else {
    nextAssets.references = [asset, ...currentAssets.references.filter((item) => item?.id !== asset.id)].slice(0, 30);
  }

  const result = await query(
    `UPDATE users
     SET brand_assets = $1
     WHERE id = $2
     RETURNING ${PROFILE_FIELDS}`,
    [JSON.stringify(nextAssets), userId]
  );

  logger.info('Brand asset uploaded', { userId, kind: safeKind, previewUrl });
  const profile = result.rows[0];
  return {
    ...profile,
    brand_assets: await resolveBrandAssetCollection(profile.brand_assets),
    google_business: normalizeGoogleBusiness(profile.google_business),
    posting_preferences: normalizePostingPreferences(profile.posting_preferences),
  };
};

/**
 * Get public profile of any user (limited fields — for marketplace).
 */
const getPublicProfile = async (userId) => {
  const columns = await getUsersColumnSet();
  const publicColumns = [
    'id', 'full_name', 'role', 'avatar_url', 'bio', 'skills',
    'kyc_status', 'kyc_level', 'address_city', 'address_state',
    'country', 'created_at',
  ].filter((column) => columns.has(column));
  const result = await query(
    `SELECT ${publicColumns.join(', ')}
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

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  uploadBrandAsset,
  getPublicProfile,
  getFreelancerPricingGuidance,
};
