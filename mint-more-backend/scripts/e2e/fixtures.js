/**
 * Dynamic Test Fixture Management & Auth Seeder
 * Zero-dependency: Uses raw SQL via pg Pool & JWT signing
 */

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

function findBackendRoot() {
  const candidates = [
    path.resolve(__dirname, '../../mint-more-backend'),
    path.resolve(__dirname, '../mint-more-backend'),
    path.resolve(__dirname, 'mint-more-backend'),
    path.resolve(__dirname, '..'),
    process.cwd(),
    path.resolve(process.cwd(), 'mint-more-backend'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'src/app.js'))) {
      return c;
    }
  }
  throw new Error(`Unable to locate mint-more-backend containing src/app.js. Checked: ${candidates.join(', ')}`);
}

const backendRoot = findBackendRoot();

// Add backend's node_modules to module resolution paths
const backendNodeModules = path.join(backendRoot, 'node_modules');
if (fs.existsSync(backendNodeModules) && !module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

// Zero-dependency pure JS .env parser
function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) return;
  const content = fs.readFileSync(envFilePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile(path.join(backendRoot, '.env'));

const { query, pool } = require(path.join(backendRoot, 'src/config/database'));
const { signAccessToken } = require(path.join(backendRoot, 'src/utils/jwt'));

class FixtureManager {
  constructor() {
    this.runId = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    this.users = {};
    this.tokens = {};
    this.createdUserIds = [];
    this.createdPostIds = [];
    this.createdNotifIds = [];
  }

  async setup() {
    // 1. Admin User
    const adminEmail = `qa_e2e_admin_${this.runId}@mintmore.test`;
    const adminRes = await query(`
      INSERT INTO users (
        email, password_hash, role, full_name, is_super_admin, is_active, admin_permissions
      ) VALUES (
        $1, 'dummy_hash_for_e2e', 'admin', 'QA E2E Admin', true, true, '{"*"}'
      ) RETURNING id, email, role, full_name
    `, [adminEmail]);
    this.users.admin = adminRes.rows[0];
    this.tokens.admin = signAccessToken({
      sub: this.users.admin.id,
      email: this.users.admin.email,
      role: 'admin',
    });
    this.createdUserIds.push(this.users.admin.id);

    // 2. Designer 1 User
    const designer1Email = `qa_e2e_designer1_${this.runId}@mintmore.test`;
    const des1Res = await query(`
      INSERT INTO users (
        email, password_hash, role, full_name, is_active
      ) VALUES (
        $1, 'dummy_hash_for_e2e', 'designer', 'QA E2E Designer 1', true
      ) RETURNING id, email, role, full_name
    `, [designer1Email]);
    this.users.designer1 = des1Res.rows[0];
    this.tokens.designer1 = signAccessToken({
      sub: this.users.designer1.id,
      email: this.users.designer1.email,
      role: 'designer',
    });
    this.createdUserIds.push(this.users.designer1.id);

    // 3. Designer 2 User
    const designer2Email = `qa_e2e_designer2_${this.runId}@mintmore.test`;
    const des2Res = await query(`
      INSERT INTO users (
        email, password_hash, role, full_name, is_active
      ) VALUES (
        $1, 'dummy_hash_for_e2e', 'designer', 'QA E2E Designer 2', true
      ) RETURNING id, email, role, full_name
    `, [designer2Email]);
    this.users.designer2 = des2Res.rows[0];
    this.tokens.designer2 = signAccessToken({
      sub: this.users.designer2.id,
      email: this.users.designer2.email,
      role: 'designer',
    });
    this.createdUserIds.push(this.users.designer2.id);

    // 4. Client Autopilot User
    const clientAutoEmail = `qa_e2e_client_auto_${this.runId}@mintmore.test`;
    const clientAutoRes = await query(`
      INSERT INTO users (
        email, password_hash, role, full_name, is_active,
        posting_preferences, brand_assets, assigned_designer_id
      ) VALUES (
        $1, 'dummy_hash_for_e2e', 'client', 'QA E2E Autopilot Client', true,
        $2::jsonb, $3::jsonb, $4
      ) RETURNING id, email, role, full_name, posting_preferences, assigned_designer_id
    `, [
      clientAutoEmail,
      JSON.stringify({ approval_mode: 'autopilot', festival_mode: 'standard' }),
      JSON.stringify({ brand_name: 'Autopilot Corp', company_name: 'Autopilot Corp' }),
      this.users.designer1.id,
    ]);
    this.users.clientAuto = clientAutoRes.rows[0];
    this.tokens.clientAuto = signAccessToken({
      sub: this.users.clientAuto.id,
      email: this.users.clientAuto.email,
      role: 'client',
    });
    this.createdUserIds.push(this.users.clientAuto.id);

    // 5. Client Manual User
    const clientManualEmail = `qa_e2e_client_manual_${this.runId}@mintmore.test`;
    const clientManualRes = await query(`
      INSERT INTO users (
        email, password_hash, role, full_name, is_active,
        posting_preferences, brand_assets, assigned_designer_id
      ) VALUES (
        $1, 'dummy_hash_for_e2e', 'client', 'QA E2E Manual Client', true,
        $2::jsonb, $3::jsonb, $4
      ) RETURNING id, email, role, full_name, posting_preferences, assigned_designer_id
    `, [
      clientManualEmail,
      JSON.stringify({ approval_mode: 'every_post', festival_mode: 'standard' }),
      JSON.stringify({ brand_name: 'Manual Crafts LLC', company_name: 'Manual Crafts LLC' }),
      this.users.designer1.id,
    ]);
    this.users.clientManual = clientManualRes.rows[0];
    this.tokens.clientManual = signAccessToken({
      sub: this.users.clientManual.id,
      email: this.users.clientManual.email,
      role: 'client',
    });
    this.createdUserIds.push(this.users.clientManual.id);

    return this;
  }

  async createSocialPost({
    userId,
    designerId = null,
    status = 'draft',
    title = 'QA Test Post',
    caption = 'Test Post Caption',
    creativeUrl = null,
    adminFeedback = null,
    clientFeedback = null,
    rejectionReason = null,
    rejectionHistory = [],
    scheduledAt = null,
    publishAt = null,
    targetPlatforms = ['instagram', 'facebook'],
  } = {}) {
    const timestamp = publishAt || scheduledAt || new Date(Date.now() + 86400000).toISOString();
    const res = await query(`
      INSERT INTO social_posts (
        user_id, designer_id, status, title, caption, creative_url,
        admin_feedback, client_feedback, rejection_reason, rejection_history,
        publish_at, target_platforms
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10::jsonb,
        $11, $12
      ) RETURNING *
    `, [
      userId,
      designerId,
      status,
      title,
      caption,
      creativeUrl,
      adminFeedback,
      clientFeedback,
      rejectionReason,
      JSON.stringify(rejectionHistory),
      timestamp,
      targetPlatforms,
    ]);

    const post = res.rows[0];
    this.createdPostIds.push(post.id);
    return post;
  }

  async getNotificationsForUser(userId) {
    const res = await query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);
    return res.rows;
  }

  async teardown() {
    try {
      if (this.createdUserIds.length > 0) {
        // Delete all notifications for created users
        await query(`
          DELETE FROM notifications
          WHERE user_id = ANY($1::uuid[])
        `, [this.createdUserIds]);

        // Delete all social posts for created users / designers
        await query(`
          DELETE FROM social_posts
          WHERE user_id = ANY($1::uuid[]) OR designer_id = ANY($1::uuid[])
        `, [this.createdUserIds]);

        // Delete test users
        await query(`
          DELETE FROM users
          WHERE id = ANY($1::uuid[])
        `, [this.createdUserIds]);
      }
    } catch (err) {
      console.warn('⚠️ Warning during fixture teardown:', err.message);
    }
  }
}

module.exports = {
  backendRoot,
  FixtureManager,
  query,
  pool,
  signAccessToken,
};
