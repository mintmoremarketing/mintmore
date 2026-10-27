#!/usr/bin/env node

/**
 * Adversarial Challenger 2 Test Suite — Milestone 2 Workflow Engine & API
 *
 * Specific Adversarial Targets:
 * 1. Autopilot vs Manual Review Decision Matrix
 * 2. Admin Direct Upload Matrix (bypass_client_review: true vs false)
 * 3. Notification Triggers (all 7 event types verified in database notifications table)
 * 4. State Transition Guards & Multi-Cycle Rejection History Integrity
 */

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');
const crypto = require('node:crypto');

const backendRoot = path.resolve(__dirname, '..');

// Load environment variables
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
const { HttpClient } = require(path.join(backendRoot, 'scripts/e2e/http-client'));

class AdversarialFixtureManager {
  constructor() {
    this.runId = `adv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    this.users = {};
    this.tokens = {};
    this.createdUserIds = [];
    this.createdPostIds = [];
  }

  async setup() {
    // 1. Active Admin
    const adminRes = await query(`
      INSERT INTO users (email, password_hash, role, full_name, is_super_admin, is_active, admin_permissions)
      VALUES ($1, 'dummy_hash', 'admin', 'Active Admin', true, true, '{"*"}')
      RETURNING id, email, role, full_name
    `, [`admin_${this.runId}@mintmore.test`]);
    this.users.admin = adminRes.rows[0];
    this.tokens.admin = signAccessToken({ sub: this.users.admin.id, email: this.users.admin.email, role: 'admin' });
    this.createdUserIds.push(this.users.admin.id);

    // 2. Inactive Admin (to test inactive admin notification filtering)
    const inactiveAdminRes = await query(`
      INSERT INTO users (email, password_hash, role, full_name, is_super_admin, is_active, admin_permissions)
      VALUES ($1, 'dummy_hash', 'admin', 'Inactive Admin', true, false, '{"*"}')
      RETURNING id, email, role, full_name
    `, [`inactive_admin_${this.runId}@mintmore.test`]);
    this.users.inactiveAdmin = inactiveAdminRes.rows[0];
    this.tokens.inactiveAdmin = signAccessToken({ sub: this.users.inactiveAdmin.id, email: this.users.inactiveAdmin.email, role: 'admin' });
    this.createdUserIds.push(this.users.inactiveAdmin.id);

    // 3. Designer
    const desRes = await query(`
      INSERT INTO users (email, password_hash, role, full_name, is_active)
      VALUES ($1, 'dummy_hash', 'designer', 'Adv Designer', true)
      RETURNING id, email, role, full_name
    `, [`designer_${this.runId}@mintmore.test`]);
    this.users.designer = desRes.rows[0];
    this.tokens.designer = signAccessToken({ sub: this.users.designer.id, email: this.users.designer.email, role: 'designer' });
    this.createdUserIds.push(this.users.designer.id);

    // 4. Client A (Autopilot: approval_mode = autopilot, festival_mode = manual)
    const clientARes = await query(`
      INSERT INTO users (email, password_hash, role, full_name, business_name, is_active, posting_preferences)
      VALUES ($1, 'dummy_hash', 'client', 'Client Autopilot A', 'AutoBiz A', true, $2::jsonb)
      RETURNING id, email, role, full_name
    `, [`client_auto_${this.runId}@mintmore.test`, JSON.stringify({ approval_mode: 'autopilot', festival_mode: 'manual' })]);
    this.users.clientAuto = clientARes.rows[0];
    this.tokens.clientAuto = signAccessToken({ sub: this.users.clientAuto.id, email: this.users.clientAuto.email, role: 'client' });
    this.createdUserIds.push(this.users.clientAuto.id);

    // 5. Client B (Managed: approval_mode = every_post, festival_mode = managed)
    const clientBRes = await query(`
      INSERT INTO users (email, password_hash, role, full_name, business_name, is_active, posting_preferences)
      VALUES ($1, 'dummy_hash', 'client', 'Client Managed B', 'ManagedBiz B', true, $2::jsonb)
      RETURNING id, email, role, full_name
    `, [`client_managed_${this.runId}@mintmore.test`, JSON.stringify({ approval_mode: 'every_post', festival_mode: 'managed' })]);
    this.users.clientManaged = clientBRes.rows[0];
    this.tokens.clientManaged = signAccessToken({ sub: this.users.clientManaged.id, email: this.users.clientManaged.email, role: 'client' });
    this.createdUserIds.push(this.users.clientManaged.id);

    // 6. Client C (Manual: approval_mode = every_post, festival_mode = manual)
    const clientCRes = await query(`
      INSERT INTO users (email, password_hash, role, full_name, business_name, is_active, posting_preferences)
      VALUES ($1, 'dummy_hash', 'client', 'Client Manual C', 'ManualBiz C', true, $2::jsonb)
      RETURNING id, email, role, full_name
    `, [`client_manual_${this.runId}@mintmore.test`, JSON.stringify({ approval_mode: 'every_post', festival_mode: 'manual' })]);
    this.users.clientManual = clientCRes.rows[0];
    this.tokens.clientManual = signAccessToken({ sub: this.users.clientManual.id, email: this.users.clientManual.email, role: 'client' });
    this.createdUserIds.push(this.users.clientManual.id);

    // 7. Client D (Empty preferences: {})
    const clientDRes = await query(`
      INSERT INTO users (email, password_hash, role, full_name, business_name, is_active, posting_preferences)
      VALUES ($1, 'dummy_hash', 'client', 'Client Null Prefs D', 'NullBiz D', true, '{}'::jsonb)
      RETURNING id, email, role, full_name
    `, [`client_null_${this.runId}@mintmore.test`]);
    this.users.clientNull = clientDRes.rows[0];
    this.tokens.clientNull = signAccessToken({ sub: this.users.clientNull.id, email: this.users.clientNull.email, role: 'client' });
    this.createdUserIds.push(this.users.clientNull.id);

    // 8. Client E (Custom preferences: approval_mode = manual)
    const clientERes = await query(`
      INSERT INTO users (email, password_hash, role, full_name, business_name, is_active, posting_preferences)
      VALUES ($1, 'dummy_hash', 'client', 'Client Custom Manual E', 'CustomBiz E', true, $2::jsonb)
      RETURNING id, email, role, full_name
    `, [`client_cust_manual_${this.runId}@mintmore.test`, JSON.stringify({ approval_mode: 'manual' })]);
    this.users.clientCustManual = clientERes.rows[0];
    this.tokens.clientCustManual = signAccessToken({ sub: this.users.clientCustManual.id, email: this.users.clientCustManual.email, role: 'client' });
    this.createdUserIds.push(this.users.clientCustManual.id);
  }

  async createSocialPost({ clientId, designerId = null, status = 'draft', title = 'Adv Test Post', creativeUrl = null }) {
    const res = await query(`
      INSERT INTO social_posts (user_id, designer_id, status, title, caption, creative_url, publish_at, target_platforms, content_type)
      VALUES ($1, $2, $3, $4, 'Test Caption', $5, NOW() + INTERVAL '2 days', ARRAY['instagram'::social_platform, 'facebook'::social_platform], 'image')
      RETURNING *
    `, [clientId, designerId, status, title, creativeUrl]);
    const post = res.rows[0];
    this.createdPostIds.push(post.id);
    return post;
  }

  async cleanup() {
    if (this.createdUserIds.length > 0) {
      await query(`DELETE FROM notifications WHERE user_id = ANY($1::uuid[])`, [this.createdUserIds]);
      await query(`DELETE FROM social_posts WHERE user_id = ANY($1::uuid[])`, [this.createdUserIds]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [this.createdUserIds]);
    }
  }
}

async function runAdversarialTests() {
  const results = { passed: 0, failed: 0, tests: [] };
  const recordTest = async (name, fn) => {
    const start = Date.now();
    try {
      await fn();
      const dur = Date.now() - start;
      results.passed++;
      results.tests.push({ name, passed: true, duration: dur });
      console.log(`  \x1b[32m✔ PASS\x1b[0m ${name} \x1b[90m(${dur}ms)\x1b[0m`);
    } catch (err) {
      const dur = Date.now() - start;
      results.failed++;
      results.tests.push({ name, passed: false, duration: dur, error: err.message });
      console.log(`  \x1b[31m✖ FAIL\x1b[0m ${name} \x1b[90m(${dur}ms)\x1b[0m`);
      console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
      if (err.stack) console.log(`\x1b[90m${err.stack}\x1b[0m`);
    }
  };

  const app = require(path.join(backendRoot, 'src/app.js'));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const httpCl = new HttpClient(baseUrl);

  console.log(`\n================================================================================`);
  console.log(`  ADVERSARIAL CHALLENGER 2: WORKFLOW ENGINE & NOTIFICATION ROUTING MATRIX`);
  console.log(`================================================================================`);
  console.log(`Server running on: ${baseUrl}`);

  const fixtures = new AdversarialFixtureManager();
  await fixtures.setup();
  console.log(`Dynamic Fixtures initialized (Run: ${fixtures.runId})\n`);

  try {
    // ════════════════════════════════════════════════════════════════════════════
    // SUITE 1: Autopilot vs Manual Review Decision Matrix
    // ════════════════════════════════════════════════════════════════════════════
    console.log(`--- 🎯 SUITE 1: Autopilot vs Manual Review Decision Matrix ---`);

    await recordTest('TC-ADV-01: approval_mode="autopilot" routes directly to "scheduled" with creative_scheduled event', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientAuto.id,
        designerId: fixtures.users.designer.id,
        status: 'pending_admin_review',
        creativeUrl: 'https://cdn.mintmore.test/adv1.png',
      });

      const res = await httpCl.post(`/creative/admin/posts/${post.id}/approve`, {}, { token: fixtures.tokens.admin });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.data.status, 'scheduled');
      assert.strictEqual(res.data.routing_mode, 'autopilot');

      // Verify DB row
      const check = await query('SELECT status FROM social_posts WHERE id = $1', [post.id]);
      assert.strictEqual(check.rows[0].status, 'scheduled');
    });

    await recordTest('TC-ADV-02: festival_mode="managed" routes directly to "scheduled" even if approval_mode="every_post"', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManaged.id,
        designerId: fixtures.users.designer.id,
        status: 'pending_admin_review',
        creativeUrl: 'https://cdn.mintmore.test/adv2.png',
      });

      const res = await httpCl.post(`/creative/admin/posts/${post.id}/approve`, {}, { token: fixtures.tokens.admin });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.data.status, 'scheduled');
      assert.strictEqual(res.data.routing_mode, 'autopilot');
    });

    await recordTest('TC-ADV-03: approval_mode="every_post" + festival_mode="manual" routes to "pending_client_review"', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        designerId: fixtures.users.designer.id,
        status: 'pending_admin_review',
        creativeUrl: 'https://cdn.mintmore.test/adv3.png',
      });

      const res = await httpCl.post(`/creative/admin/posts/${post.id}/approve`, {}, { token: fixtures.tokens.admin });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.data.status, 'pending_client_review');
      assert.strictEqual(res.data.routing_mode, 'manual_review');
    });

    await recordTest('TC-ADV-04: approval_mode="manual" routes safely to "pending_client_review"', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientCustManual.id,
        designerId: fixtures.users.designer.id,
        status: 'pending_admin_review',
        creativeUrl: 'https://cdn.mintmore.test/adv4.png',
      });

      const res = await httpCl.post(`/creative/admin/posts/${post.id}/approve`, {}, { token: fixtures.tokens.admin });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.data.status, 'pending_client_review');
    });

    await recordTest('TC-ADV-05: Missing / NULL posting_preferences defaults safely to "pending_client_review"', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientNull.id,
        designerId: fixtures.users.designer.id,
        status: 'pending_admin_review',
        creativeUrl: 'https://cdn.mintmore.test/adv5.png',
      });

      const res = await httpCl.post(`/creative/admin/posts/${post.id}/approve`, {}, { token: fixtures.tokens.admin });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.data.status, 'pending_client_review');
    });

    await recordTest('TC-ADV-06: Mid-flight preference update before Admin approval is honored dynamically from DB', async () => {
      // Create post for manual client
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        designerId: fixtures.users.designer.id,
        status: 'pending_admin_review',
        creativeUrl: 'https://cdn.mintmore.test/adv6.png',
      });

      try {
        // Update client preference to autopilot mid-flight
        await query(`UPDATE users SET posting_preferences = '{"approval_mode":"autopilot"}'::jsonb WHERE id = $1`, [fixtures.users.clientManual.id]);

        const res = await httpCl.post(`/creative/admin/posts/${post.id}/approve`, {}, { token: fixtures.tokens.admin });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.json.success, true);
        assert.strictEqual(res.data.status, 'scheduled');
        assert.strictEqual(res.data.routing_mode, 'autopilot');
      } finally {
        // Always revert back to manual preferences for clientManual
        await query(`UPDATE users SET posting_preferences = '{"approval_mode":"every_post","festival_mode":"manual"}'::jsonb WHERE id = $1`, [fixtures.users.clientManual.id]);
      }
    });

    // ════════════════════════════════════════════════════════════════════════════
    // SUITE 2: Admin Direct Upload Matrix
    // ════════════════════════════════════════════════════════════════════════════
    console.log(`\n--- 🎯 SUITE 2: Admin Direct Upload Matrix ---`);

    await recordTest('TC-ADV-07: Direct upload for Manual Client with bypass_client_review=true sets status to "scheduled"', async () => {
      const res = await httpCl.post('/creative/admin/direct-upload', {
        client_id: fixtures.users.clientManual.id,
        creative_url: 'https://cdn.mintmore.test/direct_bypass_true.png',
        title: 'Direct Bypass True',
        bypass_client_review: true,
      }, { token: fixtures.tokens.admin });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.post.status, 'scheduled');
      fixtures.createdPostIds.push(res.data.post.id);
    });

    await recordTest('TC-ADV-08: Direct upload for Manual Client with bypass_client_review=false sets status to "pending_client_review"', async () => {
      const res = await httpCl.post('/creative/admin/direct-upload', {
        client_id: fixtures.users.clientManual.id,
        creative_url: 'https://cdn.mintmore.test/direct_bypass_false.png',
        title: 'Direct Bypass False',
        bypass_client_review: false,
      }, { token: fixtures.tokens.admin });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.post.status, 'pending_client_review');
      fixtures.createdPostIds.push(res.data.post.id);
    });

    await recordTest('TC-ADV-09: Direct upload for Autopilot Client with bypass_client_review=false preserves "scheduled"', async () => {
      const res = await httpCl.post('/creative/admin/direct-upload', {
        client_id: fixtures.users.clientAuto.id,
        creative_url: 'https://cdn.mintmore.test/direct_auto_false.png',
        title: 'Direct Auto False',
        bypass_client_review: false,
      }, { token: fixtures.tokens.admin });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.post.status, 'scheduled');
      fixtures.createdPostIds.push(res.data.post.id);
    });

    await recordTest('TC-ADV-10: Direct upload with omitted bypass_client_review defaults according to client autopilot setting', async () => {
      const resAuto = await httpCl.post('/creative/admin/direct-upload', {
        client_id: fixtures.users.clientAuto.id,
        creative_url: 'https://cdn.mintmore.test/direct_auto_omit.png',
        title: 'Direct Auto Omit',
      }, { token: fixtures.tokens.admin });
      assert.strictEqual(resAuto.data.post.status, 'scheduled');
      fixtures.createdPostIds.push(resAuto.data.post.id);

      const resManual = await httpCl.post('/creative/admin/direct-upload', {
        client_id: fixtures.users.clientManual.id,
        creative_url: 'https://cdn.mintmore.test/direct_manual_omit.png',
        title: 'Direct Manual Omit',
      }, { token: fixtures.tokens.admin });
      assert.strictEqual(resManual.data.post.status, 'pending_client_review');
      fixtures.createdPostIds.push(resManual.data.post.id);
    });

    await recordTest('TC-ADV-11: Direct upload with null designer notifies Client without null dereference crash', async () => {
      const res = await httpCl.post('/creative/admin/direct-upload', {
        client_id: fixtures.users.clientAuto.id,
        creative_url: 'https://cdn.mintmore.test/direct_nodesigner.png',
        title: 'Direct No Designer Post',
        bypass_client_review: true,
      }, { token: fixtures.tokens.admin });

      assert.strictEqual(res.status, 201);
      const post = res.data.post;
      assert.strictEqual(post.designer_id, null);
      fixtures.createdPostIds.push(post.id);

      // Verify notification created for client
      const notifs = await query(
        `SELECT * FROM notifications WHERE user_id = $1 AND entity_id = $2`,
        [fixtures.users.clientAuto.id, post.id]
      );
      assert.ok(notifs.rows.length > 0);
      assert.strictEqual(notifs.rows[0].type, 'creative_scheduled');
    });

    // ════════════════════════════════════════════════════════════════════════════
    // SUITE 3: Database In-App Notifications Verification (All 7 Event Types)
    // ════════════════════════════════════════════════════════════════════════════
    console.log(`\n--- 🎯 SUITE 3: In-App Notifications Database Verification (7 Event Types) ---`);

    // Event 1: calendar_completed
    await recordTest('TC-ADV-12: Event 1 - calendar_completed generates DB notification for active admin (NOT inactive)', async () => {
      const res = await httpCl.post('/creative/calendar/complete', {}, { token: fixtures.tokens.clientManual });
      assert.strictEqual(res.status, 200);

      // Active Admin received notification
      const activeAdminNotif = await query(`
        SELECT * FROM notifications 
        WHERE user_id = $1 AND type = 'calendar_completed' AND entity_id = $2
      `, [fixtures.users.admin.id, fixtures.users.clientManual.id]);
      assert.ok(activeAdminNotif.rows.length >= 1);
      assert.strictEqual(activeAdminNotif.rows[0].type, 'calendar_completed');
      assert.strictEqual(activeAdminNotif.rows[0].entity_type, 'client');

      // Inactive Admin did NOT receive notification
      const inactiveAdminNotif = await query(`
        SELECT * FROM notifications 
        WHERE user_id = $1 AND type = 'calendar_completed' AND entity_id = $2
      `, [fixtures.users.inactiveAdmin.id, fixtures.users.clientManual.id]);
      assert.strictEqual(inactiveAdminNotif.rows.length, 0);
    });

    // Event 2: designer_assigned
    await recordTest('TC-ADV-13: Event 2 - designer_assigned generates DB notification for assigned designer', async () => {
      const res = await httpCl.patch(
        `/creative/admin/clients/${fixtures.users.clientManual.id}/assign-designer`,
        { designer_id: fixtures.users.designer.id },
        { token: fixtures.tokens.admin }
      );
      assert.strictEqual(res.status, 200);

      const desNotif = await query(`
        SELECT * FROM notifications 
        WHERE user_id = $1 AND type = 'designer_assigned' AND entity_id = $2
      `, [fixtures.users.designer.id, fixtures.users.clientManual.id]);
      assert.ok(desNotif.rows.length >= 1);
      assert.strictEqual(desNotif.rows[0].type, 'designer_assigned');
      assert.strictEqual(desNotif.rows[0].entity_type, 'client');
    });

    // Event 3: creative_uploaded
    await recordTest('TC-ADV-14: Event 3 - creative_uploaded generates DB notification for active admin', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        designerId: fixtures.users.designer.id,
        status: 'draft',
      });

      const res = await httpCl.patch(
        `/creative/designer/social-queue/${post.id}/upload`,
        { creative_url: 'https://cdn.mintmore.test/uploaded_event3.png' },
        { token: fixtures.tokens.designer }
      );
      assert.strictEqual(res.status, 200);

      const notif = await query(`
        SELECT * FROM notifications 
        WHERE user_id = $1 AND type = 'creative_uploaded' AND entity_id = $2
      `, [fixtures.users.admin.id, post.id]);
      assert.ok(notif.rows.length >= 1);
      assert.strictEqual(notif.rows[0].type, 'creative_uploaded');
      assert.strictEqual(notif.rows[0].entity_type, 'social_post');
    });

    // Event 4: creative_rejected_by_admin
    await recordTest('TC-ADV-15: Event 4 - creative_rejected_by_admin generates DB notification for designer with reason', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        designerId: fixtures.users.designer.id,
        status: 'pending_admin_review',
        creativeUrl: 'https://cdn.mintmore.test/reject_event4.png',
      });

      const reason = 'Typography is illegible and logo is misplaced';
      const res = await httpCl.post(
        `/creative/admin/posts/${post.id}/reject`,
        { reason },
        { token: fixtures.tokens.admin }
      );
      assert.strictEqual(res.status, 200);

      const notif = await query(`
        SELECT * FROM notifications 
        WHERE user_id = $1 AND type = 'creative_rejected_by_admin' AND entity_id = $2
      `, [fixtures.users.designer.id, post.id]);
      assert.ok(notif.rows.length >= 1);
      assert.strictEqual(notif.rows[0].type, 'creative_rejected_by_admin');
      assert.strictEqual(notif.rows[0].entity_type, 'social_post');
      assert.ok(notif.rows[0].body.includes(reason));
      assert.strictEqual(notif.rows[0].data.reason, reason);
    });

    // Event 5: creative_ready_client_review
    await recordTest('TC-ADV-16: Event 5 - creative_ready_client_review generates DB notification for client', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        designerId: fixtures.users.designer.id,
        status: 'pending_admin_review',
        creativeUrl: 'https://cdn.mintmore.test/review_event5.png',
      });

      const res = await httpCl.post(`/creative/admin/posts/${post.id}/approve`, {}, { token: fixtures.tokens.admin });
      assert.strictEqual(res.status, 200);

      const notif = await query(`
        SELECT * FROM notifications 
        WHERE user_id = $1 AND type = 'creative_ready_client_review' AND entity_id = $2
      `, [fixtures.users.clientManual.id, post.id]);
      assert.ok(notif.rows.length >= 1);
      assert.strictEqual(notif.rows[0].type, 'creative_ready_client_review');
      assert.strictEqual(notif.rows[0].entity_type, 'social_post');
    });

    // Event 6: creative_scheduled
    await recordTest('TC-ADV-17: Event 6 - creative_scheduled generates DB notifications for client AND designer upon client approval', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        designerId: fixtures.users.designer.id,
        status: 'pending_client_review',
        creativeUrl: 'https://cdn.mintmore.test/approve_event6.png',
      });

      const res = await httpCl.post(`/creative/client/posts/${post.id}/approve`, {}, { token: fixtures.tokens.clientManual });
      assert.strictEqual(res.status, 200);

      // Client notification
      const clientNotif = await query(`
        SELECT * FROM notifications 
        WHERE user_id = $1 AND type = 'creative_scheduled' AND entity_id = $2
      `, [fixtures.users.clientManual.id, post.id]);
      assert.ok(clientNotif.rows.length >= 1);

      // Designer notification
      const desNotif = await query(`
        SELECT * FROM notifications 
        WHERE user_id = $1 AND type = 'creative_scheduled' AND entity_id = $2
      `, [fixtures.users.designer.id, post.id]);
      assert.ok(desNotif.rows.length >= 1);
    });

    // Event 7: creative_rejected_by_client
    await recordTest('TC-ADV-18: Event 7 - creative_rejected_by_client generates DB notifications for BOTH Admin and Designer with verbatim feedback', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        designerId: fixtures.users.designer.id,
        status: 'pending_client_review',
        creativeUrl: 'https://cdn.mintmore.test/client_reject_event7.png',
      });

      const feedback = 'Please change background color from dark blue to brand green.';
      const res = await httpCl.post(
        `/creative/client/posts/${post.id}/reject`,
        { reason: feedback },
        { token: fixtures.tokens.clientManual }
      );
      assert.strictEqual(res.status, 200);

      // Admin notification
      const adminNotif = await query(`
        SELECT * FROM notifications 
        WHERE user_id = $1 AND type = 'creative_rejected_by_client' AND entity_id = $2
      `, [fixtures.users.admin.id, post.id]);
      assert.ok(adminNotif.rows.length >= 1);
      assert.ok(adminNotif.rows[0].body.includes(feedback));
      assert.strictEqual(adminNotif.rows[0].data.reason, feedback);

      // Designer notification
      const desNotif = await query(`
        SELECT * FROM notifications 
        WHERE user_id = $1 AND type = 'creative_rejected_by_client' AND entity_id = $2
      `, [fixtures.users.designer.id, post.id]);
      assert.ok(desNotif.rows.length >= 1);
      assert.ok(desNotif.rows[0].body.includes(feedback));
      assert.strictEqual(desNotif.rows[0].data.reason, feedback);
    });

    // ════════════════════════════════════════════════════════════════════════════
    // SUITE 4: State Transition Guards & Multi-Cycle Loop Stress Testing
    // ════════════════════════════════════════════════════════════════════════════
    console.log(`\n--- 🎯 SUITE 4: State Transition Guards & Multi-Cycle Rejection History ---`);

    await recordTest('TC-ADV-19: Multi-round rejection loop preserves append-only rejection_history across Admin and Client cycles', async () => {
      // 1. Initial Post Creation
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        designerId: fixtures.users.designer.id,
        status: 'draft',
      });

      // 2. Designer Upload 1
      await httpCl.patch(`/creative/designer/social-queue/${post.id}/upload`, {
        creative_url: 'https://cdn.mintmore.test/v1.png',
      }, { token: fixtures.tokens.designer });

      // 3. Admin Rejection 1
      await httpCl.post(`/creative/admin/posts/${post.id}/reject`, {
        reason: 'Round 1 Admin: Bad contrast',
      }, { token: fixtures.tokens.admin });

      // 4. Designer Upload 2
      await httpCl.patch(`/creative/designer/social-queue/${post.id}/upload`, {
        creative_url: 'https://cdn.mintmore.test/v2.png',
      }, { token: fixtures.tokens.designer });

      // 5. Admin Approve -> Pending Client Review
      await httpCl.post(`/creative/admin/posts/${post.id}/approve`, {}, { token: fixtures.tokens.admin });

      // 6. Client Rejection 1
      await httpCl.post(`/creative/client/posts/${post.id}/reject`, {
        reason: 'Round 2 Client: Please use newer logo version',
      }, { token: fixtures.tokens.clientManual });

      // 7. Designer Upload 3
      await httpCl.patch(`/creative/designer/social-queue/${post.id}/upload`, {
        creative_url: 'https://cdn.mintmore.test/v3.png',
      }, { token: fixtures.tokens.designer });

      // 8. Admin Approve
      await httpCl.post(`/creative/admin/posts/${post.id}/approve`, {}, { token: fixtures.tokens.admin });

      // 9. Client Approve
      await httpCl.post(`/creative/client/posts/${post.id}/approve`, {}, { token: fixtures.tokens.clientManual });

      // Inspect DB state
      const finalPostRes = await query('SELECT * FROM social_posts WHERE id = $1', [post.id]);
      const finalPost = finalPostRes.rows[0];

      assert.strictEqual(finalPost.status, 'scheduled');
      assert.strictEqual(finalPost.creative_url, 'https://cdn.mintmore.test/v3.png');
      assert.ok(Array.isArray(finalPost.rejection_history), 'rejection_history must be an array');
      assert.strictEqual(finalPost.rejection_history.length, 2, 'Must contain exactly 2 rejection entries');
      assert.strictEqual(finalPost.rejection_history[0].by, 'admin');
      assert.strictEqual(finalPost.rejection_history[0].reason, 'Round 1 Admin: Bad contrast');
      assert.strictEqual(finalPost.rejection_history[1].by, 'client');
      assert.strictEqual(finalPost.rejection_history[1].reason, 'Round 2 Client: Please use newer logo version');
    });

    await recordTest('TC-ADV-20: Consecutive rejections append multiple entries without overwriting previous history', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        designerId: fixtures.users.designer.id,
        status: 'pending_admin_review',
        creativeUrl: 'https://cdn.mintmore.test/consec.png',
      });

      await httpCl.post(`/creative/admin/posts/${post.id}/reject`, { reason: 'First admin feedback' }, { token: fixtures.tokens.admin });
      await httpCl.post(`/creative/admin/posts/${post.id}/reject`, { reason: 'Second admin update' }, { token: fixtures.tokens.admin });

      const postRes = await query('SELECT rejection_history, admin_feedback FROM social_posts WHERE id = $1', [post.id]);
      const dbPost = postRes.rows[0];
      assert.strictEqual(dbPost.admin_feedback, 'Second admin update');
      assert.strictEqual(dbPost.rejection_history.length, 2);
      assert.strictEqual(dbPost.rejection_history[0].reason, 'First admin feedback');
      assert.strictEqual(dbPost.rejection_history[1].reason, 'Second admin update');
    });

    await recordTest('TC-ADV-21: State guard analysis: Admin/Client approvals & rejections execute idempotently on target posts', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        designerId: fixtures.users.designer.id,
        status: 'scheduled',
        creativeUrl: 'https://cdn.mintmore.test/already_sched.png',
      });

      // Calling client approve on an already scheduled post updates status cleanly to scheduled
      const res1 = await httpCl.post(`/creative/client/posts/${post.id}/approve`, {}, { token: fixtures.tokens.clientManual });
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.data.status, 'scheduled');

      // Calling admin approve on scheduled post routes according to client preferences
      const res2 = await httpCl.post(`/creative/admin/posts/${post.id}/approve`, {}, { token: fixtures.tokens.admin });
      assert.strictEqual(res2.status, 200);
    });

    await recordTest('TC-ADV-22: Non-existent post ID returns 404 cleanly across all workflow endpoints', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const r1 = await httpCl.post(`/creative/admin/posts/${fakeId}/approve`, {}, { token: fixtures.tokens.admin, expected: [404] });
      assert.strictEqual(r1.status, 404);

      const r2 = await httpCl.post(`/creative/admin/posts/${fakeId}/reject`, { reason: 'test' }, { token: fixtures.tokens.admin, expected: [404] });
      assert.strictEqual(r2.status, 404);

      const r3 = await httpCl.post(`/creative/client/posts/${fakeId}/approve`, {}, { token: fixtures.tokens.clientManual, expected: [404] });
      assert.strictEqual(r3.status, 404);

      const r4 = await httpCl.post(`/creative/client/posts/${fakeId}/reject`, { reason: 'test' }, { token: fixtures.tokens.clientManual, expected: [404] });
      assert.strictEqual(r4.status, 404);

      const r5 = await httpCl.patch(`/creative/designer/social-queue/${fakeId}/upload`, { creative_url: 'http://cdn/1.png' }, { token: fixtures.tokens.designer, expected: [404] });
      assert.strictEqual(r5.status, 404);
    });

    await recordTest('TC-ADV-23: Malformed non-UUID param is rejected by validator with 400 Bad Request', async () => {
      const r1 = await httpCl.post(`/creative/admin/posts/not-a-valid-uuid/approve`, {}, { token: fixtures.tokens.admin, expected: [400] });
      assert.strictEqual(r1.status, 400);

      const r2 = await httpCl.post(`/creative/client/posts/12345/reject`, { reason: 'test' }, { token: fixtures.tokens.clientManual, expected: [400] });
      assert.strictEqual(r2.status, 400);

      const r3 = await httpCl.patch(`/creative/designer/social-queue/abc-xyz/upload`, { creative_url: 'http://cdn/1.png' }, { token: fixtures.tokens.designer, expected: [400] });
      assert.strictEqual(r3.status, 400);
    });

    await recordTest('TC-ADV-24: Cross-tenant security: Client cannot approve or reject another client\'s post', async () => {
      const postA = await fixtures.createSocialPost({
        clientId: fixtures.users.clientAuto.id,
        status: 'pending_client_review',
        creativeUrl: 'https://cdn.mintmore.test/postA.png',
      });

      // Client C tries to approve Client A's post -> 403 Forbidden
      const res1 = await httpCl.post(`/creative/client/posts/${postA.id}/approve`, {}, { token: fixtures.tokens.clientManual, expected: [403] });
      assert.strictEqual(res1.status, 403);

      // Client C tries to reject Client A's post -> 403 Forbidden
      const res2 = await httpCl.post(`/creative/client/posts/${postA.id}/reject`, { reason: 'Attacking post' }, { token: fixtures.tokens.clientManual, expected: [403] });
      assert.strictEqual(res2.status, 403);
    });

    // ════════════════════════════════════════════════════════════════════════════
    // SUITE 5: Edge Cases, Input Validation & Adversarial Guardrails
    // ════════════════════════════════════════════════════════════════════════════
    console.log(`\n--- 🎯 SUITE 5: Input Validation, Edge Cases & Guardrails ---`);

    await recordTest('TC-ADV-25: Rejection with empty / whitespace reason returns 400 Bad Request for both Admin and Client', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        status: 'pending_admin_review',
        creativeUrl: 'https://cdn.mintmore.test/whitespace.png',
      });

      const r1 = await httpCl.post(`/creative/admin/posts/${post.id}/reject`, { reason: '   ' }, { token: fixtures.tokens.admin, expected: [400] });
      assert.strictEqual(r1.status, 400);

      const r2 = await httpCl.post(`/creative/client/posts/${post.id}/reject`, { reason: '' }, { token: fixtures.tokens.clientManual, expected: [400] });
      assert.strictEqual(r2.status, 400);
    });

    await recordTest('TC-ADV-26: Designer upload with empty / whitespace creative_url returns 400 Bad Request', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        designerId: fixtures.users.designer.id,
        status: 'draft',
      });

      const res = await httpCl.patch(`/creative/designer/social-queue/${post.id}/upload`, { creative_url: '   ' }, { token: fixtures.tokens.designer, expected: [400] });
      assert.strictEqual(res.status, 400);
    });

    await recordTest('TC-ADV-27: Admin direct upload with missing client_id or creative_url returns 400 Bad Request', async () => {
      const r1 = await httpCl.post('/creative/admin/direct-upload', { creative_url: 'https://cdn/1.png' }, { token: fixtures.tokens.admin, expected: [400] });
      assert.strictEqual(r1.status, 400);

      const r2 = await httpCl.post('/creative/admin/direct-upload', { client_id: fixtures.users.clientManual.id, creative_url: '' }, { token: fixtures.tokens.admin, expected: [400] });
      assert.strictEqual(r2.status, 400);
    });

    await recordTest('TC-ADV-28: Admin approve with invalid/malformed scheduled_at returns 400 Bad Request', async () => {
      const post = await fixtures.createSocialPost({
        clientId: fixtures.users.clientManual.id,
        status: 'pending_admin_review',
        creativeUrl: 'https://cdn.mintmore.test/badtime.png',
      });

      const res = await httpCl.post(`/creative/admin/posts/${post.id}/approve`, { scheduled_at: 'not-a-datetime' }, { token: fixtures.tokens.admin, expected: [400] });
      assert.strictEqual(res.status, 400);
    });

    await recordTest('TC-ADV-29: Designer attempting upload on post belonging to unassigned client returns 403 Forbidden', async () => {
      // Unassigned client and unassigned post
      const unassignedPost = await fixtures.createSocialPost({
        clientId: fixtures.users.clientNull.id,
        designerId: null,
        status: 'draft',
      });

      const res = await httpCl.patch(
        `/creative/designer/social-queue/${unassignedPost.id}/upload`,
        { creative_url: 'https://cdn.mintmore.test/forbidden.png' },
        { token: fixtures.tokens.designer, expected: [403] }
      );
      assert.strictEqual(res.status, 403);
    });

    await recordTest('TC-ADV-30: Rapid concurrent calendar completion triggers execute safely without database deadlocks', async () => {
      const promises = [
        httpCl.post('/creative/calendar/complete', {}, { token: fixtures.tokens.clientAuto }),
        httpCl.post('/creative/calendar/complete', {}, { token: fixtures.tokens.clientManaged }),
        httpCl.post('/creative/calendar/complete', {}, { token: fixtures.tokens.clientManual }),
      ];

      const responses = await Promise.all(promises);
      for (const res of responses) {
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.json.success, true);
      }
    });

  } finally {
    console.log(`\n🧹 Cleaning up fixtures...`);
    await fixtures.cleanup();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    console.log(`✅ Server and DB connections closed.`);
  }

  console.log(`\n================================================================================`);
  console.log(`                          ADVERSARIAL TEST SUMMARY`);
  console.log(`================================================================================`);
  console.log(`Total Tests Executed : ${results.passed + results.failed}`);
  console.log(`Tests Passed         : ${results.passed}`);
  console.log(`Tests Failed         : ${results.failed}`);
  console.log(`Result Status        : ${results.failed === 0 ? '✔ ALL ADVERSARIAL CHALLENGES PASSED' : '✖ ADVERSARIAL FAILURES DETECTED'}`);
  console.log(`================================================================================\n`);

  if (results.failed > 0) process.exit(1);
}

runAdversarialTests().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
