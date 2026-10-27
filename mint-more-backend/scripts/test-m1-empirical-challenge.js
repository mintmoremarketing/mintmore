/**
 * Empirical Challenge & Stress Test Suite — Milestone 1 (M1: Database Schema & Foundations)
 *
 * Challenger: Empirical Challenger 2 (critic, specialist)
 * Tests:
 *  1. Query Planner Inspection (EXPLAIN / Index Utilization on idx_users_assigned_designer_id,
 *     idx_social_posts_designer_id, idx_social_posts_status_publish_at,
 *     idx_social_posts_designer_status, idx_social_posts_user_status).
 *  2. High-Concurrency Stress & Status Transition Lifecycle.
 *  3. Concurrent JSONB Rejection History Appending & Atomic Mutation.
 *  4. Transaction Safety (Rollback & Commit Atomicity).
 *  5. Boundary Conditions & Negative Integrity (Enum violations, FK violations, edge-case payloads).
 *  6. Guaranteed Clean Teardown with 0 residual test data leakage.
 */

require('dotenv').config();
const assert = require('assert');
const { pool, query, getClient } = require('../src/config/database');

const RUN_ID = `challenger2_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
console.log(`\n================================================================================`);
console.log(`  M1 EMPIRICAL CHALLENGE & STRESS HARNESS — RUN ID: ${RUN_ID}`);
console.log(`================================================================================\n`);

const createdUsers = new Set();
const createdPosts = new Set();
const createdNotifications = new Set();

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  details: [],
};

async function test(name, fn) {
  stats.total++;
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    stats.passed++;
    stats.details.push({ name, passed: true, duration });
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${name} \x1b[90m(${duration}ms)\x1b[0m`);
  } catch (err) {
    const duration = Date.now() - start;
    stats.failed++;
    stats.details.push({ name, passed: false, duration, error: err.message });
    console.log(`  \x1b[31m✖ FAIL\x1b[0m ${name} \x1b[90m(${duration}ms)\x1b[0m`);
    console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
  }
}

async function createTestUser(role, assignedDesignerId = null, nameSuffix = '') {
  const email = `test_${RUN_ID}_${role}_${nameSuffix}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await query(`
    INSERT INTO users (email, password_hash, role, full_name, assigned_designer_id)
    VALUES ($1, 'hash_pwd_test', $2, $3, $4)
    RETURNING id, email, role, assigned_designer_id
  `, [email, role, `Test ${role} ${nameSuffix}`, assignedDesignerId]);
  const user = res.rows[0];
  createdUsers.add(user.id);
  return user;
}

async function createTestPost(userId, designerId, status = 'draft', extra = {}) {
  const publishAt = extra.publishAt || new Date(Date.now() + 3600000).toISOString();
  const creativeUrl = extra.creativeUrl || null;
  const adminFeedback = extra.adminFeedback || null;
  const clientFeedback = extra.clientFeedback || null;
  const rejectionReason = extra.rejectionReason || null;
  const rejectionHistory = extra.rejectionHistory || [];

  const res = await query(`
    INSERT INTO social_posts (
      user_id, designer_id, status, publish_at, creative_url,
      admin_feedback, client_feedback, rejection_reason, rejection_history,
      title, caption
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11
    ) RETURNING *
  `, [
    userId,
    designerId,
    status,
    publishAt,
    creativeUrl,
    adminFeedback,
    clientFeedback,
    rejectionReason,
    JSON.stringify(rejectionHistory),
    extra.title || `Test Post ${RUN_ID}`,
    extra.caption || 'Test Caption for Empirical Challenge'
  ]);
  const post = res.rows[0];
  createdPosts.add(post.id);
  return post;
}

async function createTestNotification(userId, type, title = 'Test Notif', body = 'Test Body') {
  const res = await query(`
    INSERT INTO notifications (user_id, type, title, body)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [userId, type, title, body]);
  const notif = res.rows[0];
  createdNotifications.add(notif.id);
  return notif;
}

async function runEmpiricalSuite() {
  console.log(`--- [SECTION 1: Query Planner & Index Verification (EXPLAIN)] ---`);

  const explainDesigner = await createTestUser('designer', null, 'ExplainHost');
  const explainClients = [];
  for (let i = 0; i < 5; i++) {
    const cl = await createTestUser('client', explainDesigner.id, `ExplainClient${i}`);
    explainClients.push(cl);
  }

  const explainPosts = [];
  const statuses = ['draft', 'pending_admin_review', 'pending_client_review', 'in_review', 'rejected', 'scheduled'];
  for (let i = 0; i < 20; i++) {
    const cl = explainClients[i % explainClients.length];
    const st = statuses[i % statuses.length];
    const p = await createTestPost(cl.id, explainDesigner.id, st, {
      creativeUrl: `https://storage.mintmore.com/assets/${RUN_ID}/item_${i}.png`,
      publishAt: new Date(Date.now() + (i * 3600000)).toISOString(),
    });
    explainPosts.push(p);
  }

  await test('EXPLAIN query on users(assigned_designer_id) uses idx_users_assigned_designer_id', async () => {
    const sql = `EXPLAIN (FORMAT JSON) SELECT id, email FROM users WHERE assigned_designer_id = $1`;
    const client = await getClient();
    try {
      await client.query('SET LOCAL enable_seqscan = OFF');
      const forcedRes = await client.query(sql, [explainDesigner.id]);
      const forcedPlan = JSON.stringify(forcedRes.rows[0]['QUERY PLAN']);
      assert(forcedPlan.includes('idx_users_assigned_designer_id'), `Expected plan to use idx_users_assigned_designer_id, got: ${forcedPlan}`);
    } finally {
      client.release();
    }
  });

  await test('EXPLAIN query on social_posts(designer_id) uses idx_social_posts_designer_id or designer_status index', async () => {
    const sql = `EXPLAIN (FORMAT JSON) SELECT id, status, creative_url FROM social_posts WHERE designer_id = $1`;
    const client = await getClient();
    try {
      await client.query('SET LOCAL enable_seqscan = OFF');
      const res = await client.query(sql, [explainDesigner.id]);
      const plan = JSON.stringify(res.rows[0]['QUERY PLAN']);
      const usesExpectedIndex = plan.includes('idx_social_posts_designer_id') || plan.includes('idx_social_posts_designer_status');
      assert(usesExpectedIndex, `Expected plan to use designer index, got: ${plan}`);
    } finally {
      client.release();
    }
  });

  await test('EXPLAIN query on social_posts(designer_id, status) uses idx_social_posts_designer_status', async () => {
    const sql = `EXPLAIN (FORMAT JSON) SELECT id, creative_url FROM social_posts WHERE designer_id = $1 AND status = 'pending_admin_review'`;
    const client = await getClient();
    try {
      await client.query('SET LOCAL enable_seqscan = OFF');
      const res = await client.query(sql, [explainDesigner.id]);
      const plan = JSON.stringify(res.rows[0]['QUERY PLAN']);
      assert(plan.includes('idx_social_posts_designer_status'), `Expected plan to use idx_social_posts_designer_status, got: ${plan}`);
    } finally {
      client.release();
    }
  });

  await test('EXPLAIN query on social_posts(user_id, status) uses idx_social_posts_user_status', async () => {
    const sql = `EXPLAIN (FORMAT JSON) SELECT id, status FROM social_posts WHERE user_id = $1 AND status = 'pending_client_review'`;
    const client = await getClient();
    try {
      await client.query('SET LOCAL enable_seqscan = OFF');
      const res = await client.query(sql, [explainClients[0].id]);
      const plan = JSON.stringify(res.rows[0]['QUERY PLAN']);
      assert(plan.includes('idx_social_posts_user_status'), `Expected plan to use idx_social_posts_user_status, got: ${plan}`);
    } finally {
      client.release();
    }
  });

  await test('EXPLAIN query on social_posts(status, publish_at) queue uses idx_social_posts_status_publish_at', async () => {
    const sql = `EXPLAIN (FORMAT JSON) SELECT id, status, publish_at FROM social_posts WHERE status = 'pending_admin_review' AND publish_at <= NOW() ORDER BY publish_at ASC`;
    const client = await getClient();
    try {
      await client.query('SET LOCAL enable_seqscan = OFF');
      const res = await client.query(sql);
      const plan = JSON.stringify(res.rows[0]['QUERY PLAN']);
      assert(plan.includes('idx_social_posts_status_publish_at'), `Expected plan to use idx_social_posts_status_publish_at, got: ${plan}`);
    } finally {
      client.release();
    }
  });

  await test('EXPLAIN query on scheduled publish queue uses idx_social_posts_status_publish_at or partial index idx_social_posts_publish_at', async () => {
    const sql = `EXPLAIN (FORMAT JSON) SELECT id, status, publish_at FROM social_posts WHERE status = 'scheduled' AND publish_at <= NOW() ORDER BY publish_at ASC`;
    const client = await getClient();
    try {
      await client.query('SET LOCAL enable_seqscan = OFF');
      const res = await client.query(sql);
      const plan = JSON.stringify(res.rows[0]['QUERY PLAN']);
      const usesExpected = plan.includes('idx_social_posts_status_publish_at') || plan.includes('idx_social_posts_publish_at');
      assert(usesExpected, `Expected plan to use status/publish_at index, got: ${plan}`);
    } finally {
      client.release();
    }
  });

  await test('EXPLAIN Global Admin Review Queue query (status = pending_admin_review)', async () => {
    const sql = `EXPLAIN (FORMAT JSON) SELECT id, user_id, designer_id, creative_url, status, publish_at FROM social_posts WHERE status = 'pending_admin_review' ORDER BY publish_at ASC`;
    const client = await getClient();
    try {
      await client.query('SET LOCAL enable_seqscan = OFF');
      const res = await client.query(sql);
      const plan = JSON.stringify(res.rows[0]['QUERY PLAN']);
      assert(plan.includes('idx_social_posts_status_publish_at'), `Expected plan to use idx_social_posts_status_publish_at for pending_admin_review queue, got: ${plan}`);
    } finally {
      client.release();
    }
  });

  console.log(`\n--- [SECTION 2: Concurrency & Status Transitions] ---`);

  await test('Concurrent multi-worker status transitions (10 parallel workers)', async () => {
    const designer = await createTestUser('designer', null, 'ConcDes');
    const client = await createTestUser('client', designer.id, 'ConcCli');

    const postPromises = Array.from({ length: 10 }).map((_, i) =>
      createTestPost(client.id, designer.id, 'draft', { title: `Concurrent Post ${i}` })
    );
    const concurrentPosts = await Promise.all(postPromises);

    const transitionWorkers = concurrentPosts.map(async (post, idx) => {
      const uploadRes = await query(`
        UPDATE social_posts
        SET status = 'pending_admin_review', creative_url = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING status, creative_url
      `, [`https://assets.mintmore.com/upload_${idx}.png`, post.id]);
      assert.strictEqual(uploadRes.rows[0].status, 'pending_admin_review');

      if (idx % 2 === 0) {
        const rejectHistory = [{ by: 'admin', reason: `Feedback ${idx}`, timestamp: new Date().toISOString() }];
        const rejectRes = await query(`
          UPDATE social_posts
          SET status = 'rejected',
              rejection_reason = $1,
              admin_feedback = $1,
              rejection_history = rejection_history || $2::jsonb,
              updated_at = NOW()
          WHERE id = $3
          RETURNING status, rejection_reason, rejection_history
        `, [`Needs color fix ${idx}`, JSON.stringify(rejectHistory), post.id]);
        assert.strictEqual(rejectRes.rows[0].status, 'rejected');
        assert.strictEqual(rejectRes.rows[0].rejection_reason, `Needs color fix ${idx}`);
        assert(rejectRes.rows[0].rejection_history.length >= 1);
      } else {
        const approveRes = await query(`
          UPDATE social_posts
          SET status = 'pending_client_review', updated_at = NOW()
          WHERE id = $1
          RETURNING status
        `, [post.id]);
        assert.strictEqual(approveRes.rows[0].status, 'pending_client_review');

        const schedRes = await query(`
          UPDATE social_posts
          SET status = 'scheduled', updated_at = NOW()
          WHERE id = $1
          RETURNING status
        `, [post.id]);
        assert.strictEqual(schedRes.rows[0].status, 'scheduled');
      }
    });

    await Promise.all(transitionWorkers);
  });

  console.log(`\n--- [SECTION 3: Atomic JSONB Append Stress] ---`);

  await test('Concurrent JSONB rejection_history atomic array appends (15 concurrent appends)', async () => {
    const designer = await createTestUser('designer', null, 'JsonDes');
    const client = await createTestUser('client', designer.id, 'JsonCli');
    const post = await createTestPost(client.id, designer.id, 'pending_admin_review');

    const appendPromises = Array.from({ length: 15 }).map(async (_, idx) => {
      const entry = [{
        round: idx + 1,
        actor: idx % 2 === 0 ? 'admin' : 'client',
        comment: `Revision note #${idx + 1} from ${idx % 2 === 0 ? 'admin' : 'client'}`,
        timestamp: new Date().toISOString(),
      }];

      return query(`
        UPDATE social_posts
        SET rejection_history = rejection_history || $1::jsonb
        WHERE id = $2
        RETURNING rejection_history
      `, [JSON.stringify(entry), post.id]);
    });

    await Promise.all(appendPromises);

    const finalPost = await query(`SELECT rejection_history FROM social_posts WHERE id = $1`, [post.id]);
    const history = finalPost.rows[0].rejection_history;
    assert(Array.isArray(history), 'Expected rejection_history to be a JSON array');
    assert.strictEqual(history.length, 15, `Expected 15 rejection history items, found ${history.length}`);
  });

  console.log(`\n--- [SECTION 4: Transaction Atomicity & Rollback Safety] ---`);

  await test('Atomic Multi-Table Transaction: Commit persists post status and notification', async () => {
    const designer = await createTestUser('designer', null, 'TxCommitDes');
    const client = await createTestUser('client', designer.id, 'TxCommitCli');
    const post = await createTestPost(client.id, designer.id, 'pending_admin_review');

    const dbClient = await getClient();
    try {
      await dbClient.query('BEGIN');

      const updateRes = await dbClient.query(`
        UPDATE social_posts
        SET status = 'pending_client_review', updated_at = NOW()
        WHERE id = $1
        RETURNING id, status
      `, [post.id]);
      assert.strictEqual(updateRes.rows[0].status, 'pending_client_review');

      const notifRes = await dbClient.query(`
        INSERT INTO notifications (user_id, type, title, body)
        VALUES ($1, 'creative_ready_client_review', 'Review Creative', 'Your creative is ready for review')
        RETURNING id, type
      `, [client.id]);
      createdNotifications.add(notifRes.rows[0].id);

      await dbClient.query('COMMIT');
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally {
      dbClient.release();
    }

    const checkPost = await query('SELECT status FROM social_posts WHERE id = $1', [post.id]);
    assert.strictEqual(checkPost.rows[0].status, 'pending_client_review');
  });

  await test('Atomic Multi-Table Transaction: Rollback leaves database untainted on failure', async () => {
    const designer = await createTestUser('designer', null, 'TxRbDes');
    const client = await createTestUser('client', designer.id, 'TxRbCli');
    const post = await createTestPost(client.id, designer.id, 'pending_admin_review');

    const dbClient = await getClient();
    let aborted = false;
    try {
      await dbClient.query('BEGIN');

      await dbClient.query(`
        UPDATE social_posts
        SET status = 'pending_client_review'
        WHERE id = $1
      `, [post.id]);

      await dbClient.query(`
        INSERT INTO notifications (user_id, type, title, body)
        VALUES ($1, 'creative_ready_client_review', 'Review Creative', 'Ready')
      `, [client.id]);

      throw new Error('Simulated transaction failure');
    } catch (err) {
      aborted = true;
      await dbClient.query('ROLLBACK');
    } finally {
      dbClient.release();
    }

    assert(aborted, 'Expected transaction to abort');

    const postCheck = await query('SELECT status FROM social_posts WHERE id = $1', [post.id]);
    assert.strictEqual(postCheck.rows[0].status, 'pending_admin_review', 'Post status must not have updated');

    const notifCheck = await query(`
      SELECT id FROM notifications
      WHERE user_id = $1 AND type = 'creative_ready_client_review'
    `, [client.id]);
    assert.strictEqual(notifCheck.rows.length, 0, 'No notification should exist after rollback');
  });

  console.log(`\n--- [SECTION 5: Boundary Conditions & Negative Integrity] ---`);

  await test('Invalid social_post_status enum value rejected by PostgreSQL (22P02)', async () => {
    const designer = await createTestUser('designer', null, 'EnumDes');
    const client = await createTestUser('client', designer.id, 'EnumCli');

    let threw = false;
    try {
      await query(`
        INSERT INTO social_posts (user_id, designer_id, status)
        VALUES ($1, $2, 'invalid_status_value')
      `, [client.id, designer.id]);
    } catch (err) {
      threw = true;
      assert(err.code === '22P02' || err.message.includes('invalid input value for enum'), `Expected 22P02 enum error, got: ${err.message}`);
    }
    assert(threw, 'Postgres should have thrown an enum error');
  });

  await test('Invalid notification_type enum value rejected by PostgreSQL (22P02)', async () => {
    const client = await createTestUser('client', null, 'NotifEnumCli');

    let threw = false;
    try {
      await query(`
        INSERT INTO notifications (user_id, type, title, body)
        VALUES ($1, 'non_existent_notification_type', 'Title', 'Body')
      `, [client.id]);
    } catch (err) {
      threw = true;
      assert(err.code === '22P02' || err.message.includes('invalid input value for enum'), `Expected 22P02 enum error, got: ${err.message}`);
    }
    assert(threw, 'Postgres should have thrown an enum error');
  });

  await test('Non-existent foreign key users.assigned_designer_id rejected (23503)', async () => {
    const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
    let threw = false;
    try {
      await query(`
        INSERT INTO users (email, password_hash, role, full_name, assigned_designer_id)
        VALUES ($1, 'pwd_test', 'client', 'Bad FK Client', $2)
      `, [`bad_fk_${RUN_ID}@example.com`, nonExistentUuid]);
    } catch (err) {
      threw = true;
      assert(err.code === '23503' || err.message.includes('violates foreign key constraint'), `Expected 23503 FK error, got: ${err.message}`);
    }
    assert(threw, 'Postgres should have thrown FK violation error');
  });

  await test('Non-existent foreign key social_posts.designer_id rejected (23503)', async () => {
    const client = await createTestUser('client', null, 'PostBadFkCli');
    const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
    let threw = false;
    try {
      await query(`
        INSERT INTO social_posts (user_id, designer_id, status)
        VALUES ($1, $2, 'draft')
      `, [client.id, nonExistentUuid]);
    } catch (err) {
      threw = true;
      assert(err.code === '23503' || err.message.includes('violates foreign key constraint'), `Expected 23503 FK error, got: ${err.message}`);
    }
    assert(threw, 'Postgres should have thrown FK violation error');
  });

  await test('Edge-case text payloads (Unicode, Emojis, SQL injection attempt, 10KB feedback text)', async () => {
    const designer = await createTestUser('designer', null, 'EdgeDes');
    const client = await createTestUser('client', designer.id, 'EdgeCli');

    const complexPayload = {
      creativeUrl: 'https://cdn.mintmore.com/creatives/2026/08/file%20with%20spaces%20&%20symbols.png?token=xyz#hash',
      adminFeedback: "Designer note: ' OR 1=1; DROP TABLE users; -- 🎨🚀 Check color grading & saturation: ✨ \n\nLine 2 with special symbols: <script>alert('xss')</script> & ñ, é, ü",
      clientFeedback: 'Client note: ' + 'A'.repeat(5000) + ' 🌟 ' + 'B'.repeat(5000),
      rejectionReason: 'Complex rejection: "Double Quotes", \'Single Quotes\', \\Backslashes\\ and emojis: 🔥🎯',
      rejectionHistory: [
        {
          round: 1,
          note: 'Nested JSON with Unicode: 日本語 / 한국어 / العربية / עברית',
          metadata: { depth: 3, flag: true, tags: ['urgent', 'brand-guideline-v2'] }
        }
      ]
    };

    const post = await createTestPost(client.id, designer.id, 'in_review', complexPayload);
    
    const fetched = await query('SELECT * FROM social_posts WHERE id = $1', [post.id]);
    const row = fetched.rows[0];
    assert.strictEqual(row.creative_url, complexPayload.creativeUrl);
    assert.strictEqual(row.admin_feedback, complexPayload.adminFeedback);
    assert.strictEqual(row.client_feedback, complexPayload.clientFeedback);
    assert.strictEqual(row.rejection_reason, complexPayload.rejectionReason);
    assert.strictEqual(row.rejection_history[0].note, complexPayload.rejectionHistory[0].note);
  });

  await test('All 7 new notification_type enum values insertable and readable', async () => {
    const client = await createTestUser('client', null, 'AllNotifCli');
    const newTypes = [
      'calendar_completed',
      'designer_assigned',
      'creative_uploaded',
      'creative_rejected_by_admin',
      'creative_ready_client_review',
      'creative_rejected_by_client',
      'creative_scheduled'
    ];

    for (const nType of newTypes) {
      const notif = await createTestNotification(client.id, nType, `Title for ${nType}`, `Body for ${nType}`);
      assert.strictEqual(notif.type, nType);
    }
  });

  await test('All 4 new social_post_status enum values insertable and readable', async () => {
    const designer = await createTestUser('designer', null, 'AllStatusDes');
    const client = await createTestUser('client', designer.id, 'AllStatusCli');
    const newStatuses = [
      'pending_admin_review',
      'pending_client_review',
      'in_review',
      'rejected'
    ];

    for (const nStatus of newStatuses) {
      const p = await createTestPost(client.id, designer.id, nStatus, { title: `Post with ${nStatus}` });
      assert.strictEqual(p.status, nStatus);
    }
  });

  await test('ON DELETE SET NULL behaves safely during concurrent client/post references', async () => {
    const targetDesigner = await createTestUser('designer', null, 'DelDes');
    const cl1 = await createTestUser('client', targetDesigner.id, 'DelCli1');
    const cl2 = await createTestUser('client', targetDesigner.id, 'DelCli2');
    const p1 = await createTestPost(cl1.id, targetDesigner.id, 'pending_admin_review');
    const p2 = await createTestPost(cl2.id, targetDesigner.id, 'in_review');

    await query('DELETE FROM users WHERE id = $1', [targetDesigner.id]);
    createdUsers.delete(targetDesigner.id);

    const cl1Row = (await query('SELECT assigned_designer_id FROM users WHERE id = $1', [cl1.id])).rows[0];
    const cl2Row = (await query('SELECT assigned_designer_id FROM users WHERE id = $1', [cl2.id])).rows[0];
    const p1Row = (await query('SELECT designer_id FROM social_posts WHERE id = $1', [p1.id])).rows[0];
    const p2Row = (await query('SELECT designer_id FROM social_posts WHERE id = $1', [p2.id])).rows[0];

    assert.strictEqual(cl1Row.assigned_designer_id, null, 'cl1.assigned_designer_id must be NULL');
    assert.strictEqual(cl2Row.assigned_designer_id, null, 'cl2.assigned_designer_id must be NULL');
    assert.strictEqual(p1Row.designer_id, null, 'p1.designer_id must be NULL');
    assert.strictEqual(p2Row.designer_id, null, 'p2.designer_id must be NULL');
  });
}

async function teardown() {
  console.log(`\n--- [SECTION 6: Guaranteed Clean Teardown & Leakage Verification] ---`);
  const notifIds = Array.from(createdNotifications);
  const postIds = Array.from(createdPosts);
  const userIds = Array.from(createdUsers);

  console.log(`Sanitizing test artifacts: ${notifIds.length} notifications, ${postIds.length} posts, ${userIds.length} users...`);

  if (notifIds.length > 0) {
    await query(`DELETE FROM notifications WHERE id = ANY($1::uuid[])`, [notifIds]);
  }
  if (postIds.length > 0) {
    await query(`DELETE FROM social_posts WHERE id = ANY($1::uuid[])`, [postIds]);
  }
  if (userIds.length > 0) {
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]);
  }

  const leakUsers = await query(`SELECT COUNT(*)::int AS count FROM users WHERE id = ANY($1::uuid[])`, [userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']]);
  const leakPosts = await query(`SELECT COUNT(*)::int AS count FROM social_posts WHERE id = ANY($1::uuid[])`, [postIds.length ? postIds : ['00000000-0000-0000-0000-000000000000']]);
  const leakNotifs = await query(`SELECT COUNT(*)::int AS count FROM notifications WHERE id = ANY($1::uuid[])`, [notifIds.length ? notifIds : ['00000000-0000-0000-0000-000000000000']]);

  assert.strictEqual(leakUsers.rows[0].count, 0, `Residual users leaked: ${leakUsers.rows[0].count}`);
  assert.strictEqual(leakPosts.rows[0].count, 0, `Residual posts leaked: ${leakPosts.rows[0].count}`);
  assert.strictEqual(leakNotifs.rows[0].count, 0, `Residual notifications leaked: ${leakNotifs.rows[0].count}`);

  console.log(`✅ Zero residual test records leaked. Database state perfectly sanitized.`);
}

async function main() {
  try {
    await runEmpiricalSuite();
  } catch (err) {
    console.error(`\n❌ Unhandled error in empirical challenge suite:`, err);
    stats.failed++;
  } finally {
    try {
      await teardown();
    } catch (cleanupErr) {
      console.error(`\n❌ Cleanup failed:`, cleanupErr);
    }
    await pool.end();

    console.log(`\n================================================================================`);
    console.log(`                       CHALLENGE TEST RUN SUMMARY`);
    console.log(`================================================================================`);
    console.log(`Total Tests Executed : ${stats.total}`);
    console.log(`Tests Passed         : \x1b[32m${stats.passed}\x1b[0m`);
    console.log(`Tests Failed         : \x1b[${stats.failed > 0 ? '31' : '32'}m${stats.failed}\x1b[0m`);
    console.log(`Verdict              : ${stats.failed === 0 ? '\x1b[32mGATE VERDICT: APPROVE\x1b[0m' : '\x1b[31mGATE VERDICT: REJECT / REQUEST_CHANGES\x1b[0m'}`);
    console.log(`================================================================================\n`);

    if (stats.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

main();
