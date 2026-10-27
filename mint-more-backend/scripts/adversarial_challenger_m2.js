#!/usr/bin/env node

/**
 * Challenger 1 Adversarial Verification Suite for Milestone 2 (M2 Backend Workflow Engine & API)
 *
 * Test Suites:
 * 1. Multi-round rejection cycles (admin reject -> designer upload -> client reject -> designer upload -> admin approve -> client approve) & JSONB history validation.
 * 2. Extended 5-round rejection stress cycle.
 * 3. IDOR cross-tenant access attempts (Client A approving/rejecting Client B's post, data leakage checks).
 * 4. Unauthorized designer upload attempts (Designer 2 uploading to Designer 1's client/post).
 * 5. Empty/whitespace/invalid rejection reason validations.
 * 6. Invalid UUID format & SQL injection handling across all endpoints.
 * 7. Boundary security & state machine edge cases (non-client direct upload, role escalation, XSS/long string payloads).
 */

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

function findBackendRoot() {
  const candidates = [
    path.resolve(__dirname, '../mint-more-backend'),
    path.resolve(__dirname, '../../mint-more-backend'),
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
  return process.cwd();
}

const backendRoot = findBackendRoot();

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

const { HttpClient } = require('./e2e/http-client');
const { FixtureManager, query, pool } = require('./e2e/fixtures');

async function main() {
  const startTime = Date.now();
  const results = {
    passed: 0,
    failed: 0,
    tests: [],
    errors: [],
  };

  const recordTest = async (name, fn) => {
    const testStart = Date.now();
    try {
      await fn();
      const duration = Date.now() - testStart;
      results.passed++;
      results.tests.push({ name, passed: true, duration });
      console.log(`  \x1b[32m✔ PASS\x1b[0m ${name} \x1b[90m(${duration}ms)\x1b[0m`);
    } catch (err) {
      const duration = Date.now() - testStart;
      results.failed++;
      results.tests.push({ name, passed: false, duration, error: err.message });
      results.errors.push({ name, error: err.message, stack: err.stack });
      console.log(`  \x1b[31m✖ FAIL\x1b[0m ${name} \x1b[90m(${duration}ms)\x1b[0m`);
      console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
    }
  };

  let server = null;
  let baseUrl = process.env.API_BASE_URL || null;
  let fixtures = null;

  try {
    console.log(`\n================================================================================`);
    console.log(`  CHALLENGER 1: M2 ADVERSARIAL STRESS TEST & INTEGRITY VERIFICATION SUITE`);
    console.log(`================================================================================`);

    if (baseUrl) {
      console.log(`Server Mode  : Pre-Running Server (${baseUrl})`);
    } else {
      const app = require(path.join(backendRoot, 'src/app.js'));
      server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      console.log(`Server Mode  : Ephemeral In-Process Server on port ${port} (${baseUrl})`);
    }

    const client = new HttpClient(baseUrl);

    console.log(`\n📦 Seeding dynamic test fixtures...`);
    fixtures = new FixtureManager();
    await fixtures.setup();

    // Create a second isolated client for cross-tenant IDOR checks
    const clientBEmail = `qa_challenger_client_b_${fixtures.runId}@mintmore.test`;
    const clientBRes = await query(`
      INSERT INTO users (
        email, password_hash, role, full_name, is_active,
        posting_preferences, brand_assets, assigned_designer_id
      ) VALUES (
        $1, 'dummy_hash_for_e2e', 'client', 'QA Challenger Client B', true,
        $2::jsonb, $3::jsonb, $4
      ) RETURNING id, email, role, full_name, posting_preferences, assigned_designer_id
    `, [
      clientBEmail,
      JSON.stringify({ approval_mode: 'every_post', festival_mode: 'standard' }),
      JSON.stringify({ brand_name: 'Client B Enterprise', company_name: 'Client B Enterprise' }),
      fixtures.users.designer2.id,
    ]);
    fixtures.users.clientB = clientBRes.rows[0];
    const { signAccessToken } = require(path.join(backendRoot, 'src/utils/jwt'));
    fixtures.tokens.clientB = signAccessToken({
      sub: fixtures.users.clientB.id,
      email: fixtures.users.clientB.email,
      role: 'client',
    });
    fixtures.createdUserIds.push(fixtures.users.clientB.id);

    console.log(`✅ Fixtures ready. Run ID: ${fixtures.runId}`);

    const { admin, designer1, designer2, clientManual, clientAuto, clientB } = fixtures.users;
    const { tokens } = fixtures;
    const dummyUUID = 'b0000000-0000-0000-0000-000000000000';

    // ══════════════════════════════════════════════════════════════════════════════
    // SUITE 1: MULTI-ROUND REJECTION CYCLES & JSONB HISTORY INTEGRITY
    // ══════════════════════════════════════════════════════════════════════════════
    console.log('\n--- 🔄 Suite 1: Multi-Round Rejection Cycles & JSONB History Integrity ---');

    await recordTest('ADV-01: Full Multi-Round Rejection Cycle (Admin Reject -> Re-Upload -> Client Reject -> Re-Upload -> Approve)', async () => {
      // 1. Create initial draft post for clientManual assigned to designer1
      const post = await fixtures.createSocialPost({
        userId: clientManual.id,
        designerId: designer1.id,
        status: 'draft',
        title: 'Multi-Round Campaign Post',
      });

      // 2. Designer 1 uploads creative
      const upload1 = await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
        creative_url: 'https://cdn.mintmore.test/creatives/round1.png',
        caption: 'Draft version 1',
      }, { token: tokens.designer1 });
      assert.equal(upload1.status, 200);
      assert.equal(upload1.data.post.status, 'pending_admin_review');

      // 3. Admin rejects with specific feedback
      const adminReject = await client.post(`/api/v1/creative/admin/posts/${post.id}/reject`, {
        reason: 'Admin Round 1: Contrast ratio is too low for text overlays.',
      }, { token: tokens.admin });
      assert.equal(adminReject.status, 200);
      assert.equal(adminReject.data.status, 'rejected');
      assert.equal(adminReject.data.admin_feedback, 'Admin Round 1: Contrast ratio is too low for text overlays.');

      // 4. Verify intermediate DB state: 1 rejection entry
      let dbCheck = await query('SELECT status, admin_feedback, client_feedback, rejection_history FROM social_posts WHERE id = $1', [post.id]);
      let row = dbCheck.rows[0];
      assert.equal(row.status, 'rejected');
      assert.equal(row.admin_feedback, 'Admin Round 1: Contrast ratio is too low for text overlays.');
      assert.equal(row.rejection_history.length, 1);
      assert.equal(row.rejection_history[0].by, 'admin');
      assert.equal(row.rejection_history[0].actor_id, admin.id);
      assert.equal(row.rejection_history[0].reason, 'Admin Round 1: Contrast ratio is too low for text overlays.');

      // 5. Designer 1 uploads round 2 revision
      const upload2 = await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
        creative_url: 'https://cdn.mintmore.test/creatives/round2.png',
        caption: 'Draft version 2 (fixed contrast)',
      }, { token: tokens.designer1 });
      assert.equal(upload2.status, 200);
      assert.equal(upload2.data.post.status, 'pending_admin_review');

      // 6. Admin approves -> routes to pending_client_review
      const adminApprove = await client.post(`/api/v1/creative/admin/posts/${post.id}/approve`, {}, { token: tokens.admin });
      assert.equal(adminApprove.status, 200);
      assert.equal(adminApprove.data.status, 'pending_client_review');

      // 7. Client Manual rejects with feedback
      const clientReject = await client.post(`/api/v1/creative/client/posts/${post.id}/reject`, {
        reason: 'Client Round 2: Please position the brand watermark at bottom right corner.',
      }, { token: tokens.clientManual });
      assert.equal(clientReject.status, 200);
      assert.equal(clientReject.data.status, 'rejected');
      assert.equal(clientReject.data.client_feedback, 'Client Round 2: Please position the brand watermark at bottom right corner.');

      // 8. Verify DB state: exactly 2 rejection entries preserving round 1 AND round 2
      dbCheck = await query('SELECT status, admin_feedback, client_feedback, rejection_history FROM social_posts WHERE id = $1', [post.id]);
      row = dbCheck.rows[0];
      assert.equal(row.status, 'rejected');
      assert.equal(row.rejection_history.length, 2);
      assert.equal(row.rejection_history[0].by, 'admin');
      assert.equal(row.rejection_history[0].reason, 'Admin Round 1: Contrast ratio is too low for text overlays.');
      assert.equal(row.rejection_history[1].by, 'client');
      assert.equal(row.rejection_history[1].actor_id, clientManual.id);
      assert.equal(row.rejection_history[1].reason, 'Client Round 2: Please position the brand watermark at bottom right corner.');

      // 9. Designer 1 uploads round 3 final revision
      const upload3 = await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
        creative_url: 'https://cdn.mintmore.test/creatives/round3_final.png',
        caption: 'Draft version 3 (fixed watermark)',
      }, { token: tokens.designer1 });
      assert.equal(upload3.status, 200);

      // 10. Admin approves -> pending_client_review
      const adminApprove2 = await client.post(`/api/v1/creative/admin/posts/${post.id}/approve`, {}, { token: tokens.admin });
      assert.equal(adminApprove2.status, 200);
      assert.equal(adminApprove2.data.status, 'pending_client_review');

      // 11. Client approves -> scheduled
      const clientApprove = await client.post(`/api/v1/creative/client/posts/${post.id}/approve`, {}, { token: tokens.clientManual });
      assert.equal(clientApprove.status, 200);
      assert.equal(clientApprove.data.status, 'scheduled');

      // 12. Final Database Audit Verification
      const finalDb = await query('SELECT status, rejection_history, creative_url FROM social_posts WHERE id = $1', [post.id]);
      const finalPost = finalDb.rows[0];
      assert.equal(finalPost.status, 'scheduled');
      assert.equal(finalPost.creative_url, 'https://cdn.mintmore.test/creatives/round3_final.png');
      assert.equal(Array.isArray(finalPost.rejection_history), true);
      assert.equal(finalPost.rejection_history.length, 2);
      assert.ok(new Date(finalPost.rejection_history[0].timestamp).getTime() <= new Date(finalPost.rejection_history[1].timestamp).getTime());
    });

    await recordTest('ADV-02: Stress Rejection Loop (5 Total Rounds: 3 Admin Rejects, 2 Client Rejects)', async () => {
      const post = await fixtures.createSocialPost({
        userId: clientManual.id,
        designerId: designer1.id,
        status: 'draft',
      });

      const rounds = [
        { type: 'admin', reason: 'Admin Reject #1: Bad font choice' },
        { type: 'admin', reason: 'Admin Reject #2: Alignment issues on mobile viewport' },
        { type: 'admin', reason: 'Admin Reject #3: Resolution too low (<1080p)' },
        { type: 'client', reason: 'Client Reject #4: Brand colors do not match seasonal palette' },
        { type: 'client', reason: 'Client Reject #5: Incorrect offer discount percentage in caption' },
      ];

      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        // Designer uploads
        await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
          creative_url: `https://cdn.mintmore.test/creatives/stress_round_${i + 1}.png`,
        }, { token: tokens.designer1 });

        if (round.type === 'admin') {
          // Admin rejects
          const rejRes = await client.post(`/api/v1/creative/admin/posts/${post.id}/reject`, {
            reason: round.reason,
          }, { token: tokens.admin });
          assert.equal(rejRes.status, 200);
        } else {
          // Admin approves first to pass to client
          await client.post(`/api/v1/creative/admin/posts/${post.id}/approve`, {}, { token: tokens.admin });
          // Client rejects
          const rejRes = await client.post(`/api/v1/creative/client/posts/${post.id}/reject`, {
            reason: round.reason,
          }, { token: tokens.clientManual });
          assert.equal(rejRes.status, 200);
        }
      }

      // Check DB: exactly 5 history records
      const check = await query('SELECT rejection_history FROM social_posts WHERE id = $1', [post.id]);
      const history = check.rows[0].rejection_history;
      assert.equal(history.length, 5);
      rounds.forEach((r, idx) => {
        assert.equal(history[idx].by, r.type);
        assert.equal(history[idx].reason, r.reason);
        assert.ok(history[idx].timestamp);
      });
    });

    // ══════════════════════════════════════════════════════════════════════════════
    // SUITE 2: IDOR CROSS-TENANT ACCESS ATTEMPTS
    // ══════════════════════════════════════════════════════════════════════════════
    console.log('\n--- 🔒 Suite 2: IDOR Cross-Tenant Access Protection ---');

    await recordTest('ADV-03: IDOR - Client A cannot approve Client B\'s pending post', async () => {
      // Create post for Client B in pending_client_review
      const postB = await fixtures.createSocialPost({
        userId: clientB.id,
        designerId: designer2.id,
        status: 'pending_client_review',
        title: 'Client B Private Campaign',
      });

      // Client A attempts to approve Client B's post
      const res = await client.post(`/api/v1/creative/client/posts/${postB.id}/approve`, {}, {
        token: tokens.clientManual,
        expected: [403],
      });
      assert.equal(res.status, 403);
      assert.match(res.data?.message || res.text || '', /Forbidden: not your post/i);

      // Verify post status in DB did not change to scheduled
      const check = await query('SELECT status FROM social_posts WHERE id = $1', [postB.id]);
      assert.equal(check.rows[0].status, 'pending_client_review');
    });

    await recordTest('ADV-04: IDOR - Client A cannot reject Client B\'s pending post', async () => {
      // Create post for Client B in pending_client_review
      const postB = await fixtures.createSocialPost({
        userId: clientB.id,
        designerId: designer2.id,
        status: 'pending_client_review',
        title: 'Client B Private Campaign',
      });

      // Client A attempts to reject Client B's post
      const res = await client.post(`/api/v1/creative/client/posts/${postB.id}/reject`, {
        reason: 'Malicious attempt by unauthorized tenant',
      }, {
        token: tokens.clientManual,
        expected: [403],
      });
      assert.equal(res.status, 403);
      assert.match(res.data?.message || res.text || '', /Forbidden: not your post/i);

      // Verify DB state was NOT modified
      const check = await query('SELECT status, rejection_history FROM social_posts WHERE id = $1', [postB.id]);
      assert.equal(check.rows[0].status, 'pending_client_review');
      assert.equal(check.rows[0].rejection_history.length, 0);
    });

    await recordTest('ADV-05: IDOR - Client A pending review list does not leak Client B posts', async () => {
      const listA = await client.get('/api/v1/creative/client/pending-review', {
        token: tokens.clientManual,
      });
      assert.equal(listA.status, 200);
      const posts = listA.data.posts || [];
      const leaked = posts.some(p => p.user_id === clientB.id);
      assert.equal(leaked, false, 'Client A must never see Client B posts');
    });

    // ══════════════════════════════════════════════════════════════════════════════
    // SUITE 3: UNAUTHORIZED DESIGNER UPLOADS & ASSIGNMENT VIOLATIONS
    // ══════════════════════════════════════════════════════════════════════════════
    console.log('\n--- 🎨 Suite 3: Unauthorized Designer Access Violations ---');

    await recordTest('ADV-06: Designer 2 cannot upload creative to Client A post (assigned to Designer 1)', async () => {
      const postA = await fixtures.createSocialPost({
        userId: clientManual.id,
        designerId: designer1.id,
        status: 'draft',
      });

      const res = await client.patch(`/api/v1/creative/designer/social-queue/${postA.id}/upload`, {
        creative_url: 'https://cdn.mintmore.test/creatives/unauthorized.png',
      }, {
        token: tokens.designer2,
        expected: [403],
      });
      assert.equal(res.status, 403);
      assert.match(res.data?.message || res.text || '', /Forbidden: post not assigned to designer/i);

      // Verify DB was untouched
      const check = await query('SELECT status, creative_url FROM social_posts WHERE id = $1', [postA.id]);
      assert.equal(check.rows[0].status, 'draft');
      assert.equal(check.rows[0].creative_url, null);
    });

    await recordTest('ADV-07: Designer 1 cannot view or access Client B posts in social queue', async () => {
      const queue1 = await client.get('/api/v1/creative/designer/social-queue', {
        token: tokens.designer1,
      });
      assert.equal(queue1.status, 200);
      const posts = queue1.data.queue || [];
      const leaked = posts.some(p => p.user_id === clientB.id);
      assert.equal(leaked, false, 'Designer 1 queue must not contain Client B posts');
    });

    await recordTest('ADV-08: Client cannot upload creative using designer upload endpoint', async () => {
      const postA = await fixtures.createSocialPost({
        userId: clientManual.id,
        designerId: designer1.id,
        status: 'draft',
      });

      const res = await client.patch(`/api/v1/creative/designer/social-queue/${postA.id}/upload`, {
        creative_url: 'https://cdn.mintmore.test/creatives/client_hijack.png',
      }, {
        token: tokens.clientManual,
        expected: [403],
      });
      assert.equal(res.status, 403);
    });

    // ══════════════════════════════════════════════════════════════════════════════
    // SUITE 4: EMPTY REJECTION REASON VALIDATION & BOUNDARY PAYLOADS
    // ══════════════════════════════════════════════════════════════════════════════
    console.log('\n--- ✍️ Suite 4: Empty Rejection Reason Validation ---');

    await recordTest('ADV-09: Admin reject with empty string reason fails (status 400 or 422)', async () => {
      const post = await fixtures.createSocialPost({
        userId: clientManual.id,
        designerId: designer1.id,
        status: 'pending_admin_review',
      });

      const res = await client.post(`/api/v1/creative/admin/posts/${post.id}/reject`, {
        reason: '',
      }, {
        token: tokens.admin,
        expected: [400, 422],
      });
      assert.ok([400, 422].includes(res.status));
      assert.match(res.data?.message || res.text || '', /Rejection reason is required/i);

      // Verify status did not change
      const check = await query('SELECT status FROM social_posts WHERE id = $1', [post.id]);
      assert.equal(check.rows[0].status, 'pending_admin_review');
    });

    await recordTest('ADV-10: Admin reject with whitespace-only reason fails (status 400 or 422)', async () => {
      const post = await fixtures.createSocialPost({
        userId: clientManual.id,
        designerId: designer1.id,
        status: 'pending_admin_review',
      });

      const res = await client.post(`/api/v1/creative/admin/posts/${post.id}/reject`, {
        reason: '     \n\t   ',
      }, {
        token: tokens.admin,
        expected: [400, 422],
      });
      assert.ok([400, 422].includes(res.status));
      assert.match(res.data?.message || res.text || '', /Rejection reason is required/i);
    });

    await recordTest('ADV-11: Admin reject with missing reason payload fails (status 400 or 422)', async () => {
      const post = await fixtures.createSocialPost({
        userId: clientManual.id,
        designerId: designer1.id,
        status: 'pending_admin_review',
      });

      const res = await client.post(`/api/v1/creative/admin/posts/${post.id}/reject`, {}, {
        token: tokens.admin,
        expected: [400, 422],
      });
      assert.ok([400, 422].includes(res.status));
    });

    await recordTest('ADV-12: Client reject with empty string reason fails (status 400 or 422)', async () => {
      const post = await fixtures.createSocialPost({
        userId: clientManual.id,
        designerId: designer1.id,
        status: 'pending_client_review',
      });

      const res = await client.post(`/api/v1/creative/client/posts/${post.id}/reject`, {
        reason: '',
      }, {
        token: tokens.clientManual,
        expected: [400, 422],
      });
      assert.ok([400, 422].includes(res.status));
      assert.match(res.data?.message || res.text || '', /Rejection reason is required/i);
    });

    await recordTest('ADV-13: Client reject with whitespace-only reason fails (status 400 or 422)', async () => {
      const post = await fixtures.createSocialPost({
        userId: clientManual.id,
        designerId: designer1.id,
        status: 'pending_client_review',
      });

      const res = await client.post(`/api/v1/creative/client/posts/${post.id}/reject`, {
        reason: '          ',
      }, {
        token: tokens.clientManual,
        expected: [400, 422],
      });
      assert.ok([400, 422].includes(res.status));
      assert.match(res.data?.message || res.text || '', /Rejection reason is required/i);
    });

    // ══════════════════════════════════════════════════════════════════════════════
    // SUITE 5: INVALID UUID FORMAT & INJECTION DEFENSE
    // ══════════════════════════════════════════════════════════════════════════════
    console.log('\n--- 🆔 Suite 5: Invalid UUID Format & Injection Defense ---');

    const invalidUuidPayloads = [
      'not-a-valid-uuid',
      '12345',
      'a0000000-0000-0000-0000-00000000000z', // non-hex
      'a0000000-0000-0000-0000',               // truncated
      "550e8400-e29b-41d4-a716-446655440000' OR '1'='1", // SQL injection
    ];

    for (const badId of invalidUuidPayloads) {
      await recordTest(`ADV-14: Admin assign designer with invalid clientId "${badId}" returns 400/422/404`, async () => {
        const res = await client.patch(`/api/v1/creative/admin/clients/${encodeURIComponent(badId)}/assign-designer`, {
          designer_id: designer1.id,
        }, {
          token: tokens.admin,
          expected: [400, 422, 404],
        });
        assert.ok([400, 422, 404].includes(res.status));
      });

      await recordTest(`ADV-15: Designer upload with invalid postId "${badId}" returns 400/422/404`, async () => {
        const res = await client.patch(`/api/v1/creative/designer/social-queue/${encodeURIComponent(badId)}/upload`, {
          creative_url: 'https://cdn.mintmore.test/image.png',
        }, {
          token: tokens.designer1,
          expected: [400, 422, 404],
        });
        assert.ok([400, 422, 404].includes(res.status));
      });

      await recordTest(`ADV-16: Admin approve with invalid postId "${badId}" returns 400/422/404`, async () => {
        const res = await client.post(`/api/v1/creative/admin/posts/${encodeURIComponent(badId)}/approve`, {}, {
          token: tokens.admin,
          expected: [400, 422, 404],
        });
        assert.ok([400, 422, 404].includes(res.status));
      });

      await recordTest(`ADV-17: Client reject with invalid postId "${badId}" returns 400/422/404`, async () => {
        const res = await client.post(`/api/v1/creative/client/posts/${encodeURIComponent(badId)}/reject`, {
          reason: 'Valid reason with invalid ID',
        }, {
          token: tokens.clientManual,
          expected: [400, 422, 404],
        });
        assert.ok([400, 422, 404].includes(res.status));
      });
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // SUITE 6: ADVERSARIAL BOUNDARY & SECURITY TEST CASES
    // ══════════════════════════════════════════════════════════════════════════════
    console.log('\n--- 🛡️ Suite 6: Boundary Security & State Machine Robustness ---');

    await recordTest('ADV-18: Admin Direct Upload with non-existent client ID returns 404 Not Found', async () => {
      const res = await client.post('/api/v1/creative/admin/direct-upload', {
        client_id: dummyUUID,
        creative_url: 'https://cdn.mintmore.test/creatives/direct.png',
      }, {
        token: tokens.admin,
        expected: [404],
      });
      assert.equal(res.status, 404);
      assert.match(res.data?.message || res.text || '', /Client not found/i);
    });

    await recordTest('ADV-19: Admin Direct Upload with designer user ID as client_id returns 404 Not Found', async () => {
      const res = await client.post('/api/v1/creative/admin/direct-upload', {
        client_id: designer1.id, // Designer, not a client
        creative_url: 'https://cdn.mintmore.test/creatives/direct.png',
      }, {
        token: tokens.admin,
        expected: [404],
      });
      assert.equal(res.status, 404);
    });

    await recordTest('ADV-20: Admin Direct Upload with missing creative_url returns 400/422', async () => {
      const res = await client.post('/api/v1/creative/admin/direct-upload', {
        client_id: clientManual.id,
      }, {
        token: tokens.admin,
        expected: [400, 422],
      });
      assert.ok([400, 422].includes(res.status));
    });

    await recordTest('ADV-21: XSS / HTML / Unicode / 5,000 char stress payload in rejection reason', async () => {
      const post = await fixtures.createSocialPost({
        userId: clientManual.id,
        designerId: designer1.id,
        status: 'pending_admin_review',
      });

      const complexPayload = `<script>alert('xss')</script> "quote" 'single' &amp; 🚀 🎉 \n\r\t ${'A'.repeat(2000)}`;
      const res = await client.post(`/api/v1/creative/admin/posts/${post.id}/reject`, {
        reason: complexPayload,
      }, { token: tokens.admin });
      assert.equal(res.status, 200);

      const check = await query('SELECT rejection_history, admin_feedback FROM social_posts WHERE id = $1', [post.id]);
      assert.equal(check.rows[0].admin_feedback, complexPayload);
      assert.equal(check.rows[0].rejection_history[0].reason, complexPayload);
    });

    await recordTest('ADV-22: Client privilege escalation - Client cannot call Admin Review Queue', async () => {
      const res = await client.get('/api/v1/creative/admin/review-queue', {
        token: tokens.clientManual,
        expected: [403],
      });
      assert.equal(res.status, 403);
    });

    await recordTest('ADV-23: Designer privilege escalation - Designer cannot call Admin Direct Upload', async () => {
      const res = await client.post('/api/v1/creative/admin/direct-upload', {
        client_id: clientManual.id,
        creative_url: 'https://cdn.mintmore.test/test.png',
      }, {
        token: tokens.designer1,
        expected: [403],
      });
      assert.equal(res.status, 403);
    });

    await recordTest('ADV-24: Unauthenticated access to all 13 workflow endpoints returns 401', async () => {
      const endpoints = [
        { method: 'post', path: '/api/v1/creative/calendar/complete', body: {} },
        { method: 'get', path: '/api/v1/creative/admin/clients' },
        { method: 'get', path: '/api/v1/creative/admin/designers' },
        { method: 'patch', path: `/api/v1/creative/admin/clients/${dummyUUID}/assign-designer`, body: {} },
        { method: 'get', path: '/api/v1/creative/designer/social-queue' },
        { method: 'patch', path: `/api/v1/creative/designer/social-queue/${dummyUUID}/upload`, body: {} },
        { method: 'get', path: '/api/v1/creative/admin/review-queue' },
        { method: 'post', path: `/api/v1/creative/admin/posts/${dummyUUID}/approve`, body: {} },
        { method: 'post', path: `/api/v1/creative/admin/posts/${dummyUUID}/reject`, body: {} },
        { method: 'get', path: '/api/v1/creative/client/pending-review' },
        { method: 'post', path: `/api/v1/creative/client/posts/${dummyUUID}/approve`, body: {} },
        { method: 'post', path: `/api/v1/creative/client/posts/${dummyUUID}/reject`, body: {} },
        { method: 'post', path: '/api/v1/creative/admin/direct-upload', body: {} },
      ];

      for (const ep of endpoints) {
        let res;
        if (ep.method === 'get') {
          res = await client.get(ep.path, { expected: [401] });
        } else if (ep.method === 'post') {
          res = await client.post(ep.path, ep.body || {}, { expected: [401] });
        } else if (ep.method === 'patch') {
          res = await client.patch(ep.path, ep.body || {}, { expected: [401] });
        }
        assert.equal(res.status, 401, `Endpoint ${ep.method.toUpperCase()} ${ep.path} must reject unauthenticated requests with 401`);
      }
    });

  } catch (fatalErr) {
    results.failed++;
    results.errors.push({ name: 'Fatal Test Harness Execution', error: fatalErr.message, stack: fatalErr.stack });
    console.error(`\n\x1b[31m💥 FATAL ERROR:\x1b[0m ${fatalErr.message}`);
  } finally {
    console.log(`\n🧹 Cleaning up test fixtures & closing connections...`);
    if (fixtures) {
      await fixtures.teardown();
      console.log(`✅ Test fixtures sanitized.`);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log(`✅ Ephemeral HTTP server closed.`);
    }

    try {
      await pool.end();
      console.log(`✅ Database pool closed.`);
    } catch (_) {}

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalTests = results.passed + results.failed;

    console.log(`\n================================================================================`);
    console.log(`                 ADVERSARIAL STRESS TEST SUMMARY`);
    console.log(`================================================================================`);
    console.log(`Total Adversarial Tests : ${totalTests}`);
    console.log(`Tests Passed            : \x1b[32m${results.passed}\x1b[0m`);
    console.log(`Tests Failed            : \x1b[${results.failed > 0 ? '31' : '32'}m${results.failed}\x1b[0m`);
    console.log(`Total Duration          : ${totalDuration}s`);
    console.log(`Verdict                 : ${results.failed === 0 ? '\x1b[32m✔ ALL ADVERSARIAL TESTS PASSED (APPROVE)\x1b[0m' : '\x1b[31m✖ DEFECTS FOUND (REQUEST_CHANGES)\x1b[0m'}`);
    console.log(`================================================================================\n`);

    if (results.failed > 0) {
      results.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.name}: ${err.error}\n`);
      });
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  }
}

main();
