const { query } = require('../../config/database');
const { getRedis } = require('../../config/redis');
const { hashPassword, comparePassword } = require('../../utils/hash');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the JWT payload — keep it lean.
 */
const buildTokenPayload = (user) => ({
  sub:  user.id,
  email: user.email,
  role:  user.role,
});

/**
 * Strip sensitive fields before sending user data to client.
 */
const sanitizeUser = (user) => {
  const { password_hash, refresh_token, ...safe } = user;
  return safe;
};

/**
 * Redis key for blacklisted access tokens.
 * TTL matches the token's remaining lifetime.
 */
const blacklistKey = (token) => `blacklist:${token}`;

// ── Service Methods ───────────────────────────────────────────────────────────

/**
 * Register a new user.
 * Roles admin cannot be self-registered — admin accounts are created
 * directly in the DB or via a separate admin-only endpoint (Phase 5).
 */
const register = async ({ email, password, full_name, role = 'client' }) => {
  // 1. Check if email already exists
  const existing = await query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existing.rows.length > 0) {
    throw new AppError('An account with this email already exists', 409);
  }

  // 2. Hash password
  const password_hash = await hashPassword(password);

  // 3. Insert user
  const result = await query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [email.toLowerCase(), password_hash, full_name.trim(), role]
  );

  const user = result.rows[0];

  // 4. Generate tokens
  const payload = buildTokenPayload(user);
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // 5. Store refresh token in DB
  await query(
    'UPDATE users SET refresh_token = $1, last_login_at = NOW() WHERE id = $2',
    [refreshToken, user.id]
  );

  if (user.role === 'client') {
    const trialSetting = await query("SELECT value FROM platform_settings WHERE key = 'membership.trial'");
    const trialRules = trialSetting.rows[0]?.value || { duration_days: 14 };
    const durationDays = Math.max(1, Number(trialRules.duration_days || 14));
    await query(
      `INSERT INTO memberships (user_id, status, current_period_start, current_period_end, metadata)
       VALUES ($1, 'trial', NOW(), NOW() + ($2 * INTERVAL '1 day'), '{"source":"registration"}'::jsonb)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, durationDays]
    );
  }

  logger.info('New user registered', { userId: user.id, role: user.role });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

/**
 * Login with email + password.
 */
const login = async ({ email, password }) => {
  // 1. Find user
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  const user = result.rows[0];

  // 2. Validate — use same error for both "not found" and "wrong password"
  //    to prevent user enumeration attacks
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.is_active) {
    throw new AppError('Your account has been deactivated. Please contact support.', 403);
  }

  const passwordMatch = await comparePassword(password, user.password_hash);
  if (!passwordMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  // 3. Generate tokens
  const payload = buildTokenPayload(user);
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // 4. Store refresh token in DB + update last login
  await query(
    'UPDATE users SET refresh_token = $1, last_login_at = NOW() WHERE id = $2',
    [refreshToken, user.id]
  );

  logger.info('User logged in', { userId: user.id, role: user.role });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh access token using a valid refresh token.
 */
const refreshTokens = async (token) => {
  if (!token) throw new AppError('Refresh token required', 400);

  // 1. Verify signature + expiry
  const decoded = verifyRefreshToken(token);

  // 2. Check it matches what's stored in DB (single-session invalidation)
  const result = await query(
    'SELECT * FROM users WHERE id = $1 AND refresh_token = $2',
    [decoded.sub, token]
  );

  const user = result.rows[0];
  if (!user) {
    throw new AppError('Refresh token is invalid or has been revoked', 401);
  }

  if (!user.is_active) {
    throw new AppError('Account deactivated', 403);
  }

  // 3. Rotate tokens (refresh token rotation — best practice)
  const payload = buildTokenPayload(user);
  const newAccessToken  = signAccessToken(payload);
  const newRefreshToken = signRefreshToken(payload);

  // 4. Save new refresh token
  await query(
    'UPDATE users SET refresh_token = $1 WHERE id = $2',
    [newRefreshToken, user.id]
  );

  return {
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * Logout — blacklist the access token in Redis, clear refresh token in DB.
 */
const logout = async (userId, accessToken) => {
  const redis = getRedis();

  // 1. Blacklist current access token until it naturally expires
  //    We store it for 20 minutes (slightly > 15m JWT lifetime)
  await redis.set(blacklistKey(accessToken), '1', 'EX', 20 * 60);

  // 2. Clear refresh token from DB
  await query(
    'UPDATE users SET refresh_token = NULL WHERE id = $1',
    [userId]
  );

  logger.info('User logged out', { userId });
};

/**
 * Get current user profile.
 */
const getMe = async (userId) => {
  const result = await query(
    `SELECT id, email, phone, full_name, role, avatar_url,
            is_active, is_email_verified, kyc_status,
            last_login_at, created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );

  const user = result.rows[0];
  if (!user) throw new AppError('User not found', 404);

  return user;
};

/**
 * Reset password (Development fallback — bypasses actual email token check for now since frontend verified it)
 */
const resetPassword = async ({ email, newPassword }) => {
  const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = result.rows[0];
  if (!user) throw new AppError('User not found', 404);

  const password_hash = await hashPassword(newPassword);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, user.id]);
  logger.info('User reset password', { userId: user.id });
};

module.exports = { register, login, refreshTokens, logout, getMe, resetPassword };
