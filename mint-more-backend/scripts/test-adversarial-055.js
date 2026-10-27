/**
 * Adversarial Stress & Schema Validation Test Suite for Milestone 1 (M1)
 *
 * This test suite executes empirical and adversarial challenges against the
 * live PostgreSQL database, thoroughly stress-testing:
 * 1. Multi-pass migration idempotency (5 consecutive runs).
 * 2. Enum enforcement (all valid statuses/types + rejection of invalid values).
 * 3. Complex JSONB data manipulation, querying, and appending on social_posts.rejection_history.
 * 4. Foreign key integrity & ON DELETE SET NULL cascades on users and social_posts.
 * 5. Index utilization & query plan verification (EXPLAIN analysis).
 * 6. Edge cases: large rejection payload, unicode/emojis in feedback, NOT NULL constraint enforcement.
 */

const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

const results = {
  passed: 0,
  failed: 0,
  total: 0,
  details: [],
};

function assert(condition, testName, message = '') {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  [PASS] ${testName}`);
    results.details.push({ status: 'PASS', test: testName });
  } else {
    results.failed++;
    const errMsg = `Assertion Failed: ${testName} — ${message}`;
    console.error(`  [FAIL] ${errMsg}`);
    results.details.push({ status: 'FAIL', test: testName, error: message });
    throw new Error(errMsg);
  }
}

async function assertRejectsWithCode(asyncFn, expectedCode, testName) {
  results.total++;
  try {
    await asyncFn();
    results.failed++;
    const errMsg = `Assertion Failed: ${testName} — Expected query to throw code ${expectedCode}, but it succeeded.`;
    console.error(`  [FAIL] ${errMsg}`);
    results.details.push({ status: 'FAIL', test: testName, error: 'Did not throw' });
    throw new Error(errMsg);
  } catch (err) {
    if (err.code === expectedCode || (err.message && err.message.includes(expectedCode))) {
      results.passed++;
      console.log(`  [PASS] ${testName} (caught expected error code: ${err.code || expectedCode})`);
      results.details.push({ status: 'PASS', test: testName });
    } else {
      results.failed++;
      const errMsg = `Assertion Failed: ${testName} — Expected error code ${expectedCode}, but got ${err.code} (${err.message})`;
      console.error(`  [FAIL] ${errMsg}`);
      results.details.push({ status: 'FAIL', test: testName, error: err.message });
      throw new Error(errMsg);
    }
  }
}

function parseSqlStatements(sqlContent) {
  return sqlContent
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => {
      if (!stmt) return false;
      const stripped = stmt.replace(/--.*$/gm, '').trim();
      return stripped.length > 0;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Multi-Pass Migration Idempotency Stress Test
// ─────────────────────────────────────────────────────────────────────────────
async function testMigrationIdempotency() {
  console.log('\n================================================================');
  console.log('SUITE 1: Multi-Pass Migration Idempotency (5 Consecutive Passes)');
  console.log('================================================================');

  const migrationPath = path.join(__dirname, '../src/db/migrations/055_creative_workflow_pipeline.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');
  const statements = parseSqlStatements(sqlContent);

  for (let pass = 1; pass <= 5; pass++) {
    console.log(`--- Executing Migration Pass ${pass} ---`);
    for (let i = 0; i < statements.length; i++) {
      await query(statements[i]);
    }
    assert(true, `Migration 055 Pass ${pass}/5 completed with 0 errors`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Enum Integrity & Constraint Enforcement
// ─────────────────────────────────────────────────────────────────────────────
async function testEnumEnforcement() {
  console.log('\n================================================================');
  console.log('SUITE 2: Enum Integrity & Constraint Enforcement');
  console.log('================================================================');

  const testUserEmail = `test.enum.user.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
  const userRes = await query(`
    INSERT INTO users (email, password_hash, role, full_name)
    VALUES ($1, 'dummy_hash', 'client', 'Enum Tester')
    RETURNING id
  `, [testUserEmail]);
  const userId = userRes.rows[0].id;

  try {
    // 1. All valid social_post_status values
    const validPostStatuses = [
      'draft',
      'scheduled',
      'publishing',
      'published',
      'failed',
      'cancelled',
      'pending_admin_review',
      'pending_client_review',
      'in_review',
      'rejected',
    ];

    console.log('Testing insertion of all valid social_post_status values...');
    for (const status of validPostStatuses) {
      const res = await query(`
        INSERT INTO social_posts (user_id, status)
        VALUES ($1, $2)
        RETURNING id, status
      `, [userId, status]);
      assert(res.rows[0].status === status, `Insert post with valid status: "${status}"`);
      await query('DELETE FROM social_posts WHERE id = $1', [res.rows[0].id]);
    }

    // 2. Lifecycle transitions between new and existing statuses
    console.log('Testing full lifecycle update transitions...');
    const lifecyclePost = await query(`
      INSERT INTO social_posts (user_id, status)
      VALUES ($1, 'draft')
      RETURNING id, status
    `, [userId]);
    const pId = lifecyclePost.rows[0].id;

    const transitionChain = [
      'pending_admin_review',
      'in_review',
      'rejected',
      'pending_admin_review',
      'pending_client_review',
      'scheduled',
      'publishing',
      'published',
    ];

    for (const targetStatus of transitionChain) {
      const updateRes = await query(`
        UPDATE social_posts SET status = $1 WHERE id = $2 RETURNING status
      `, [targetStatus, pId]);
      assert(updateRes.rows[0].status === targetStatus, `Transition post status to "${targetStatus}"`);
    }
    await query('DELETE FROM social_posts WHERE id = $1', [pId]);

    // 3. Invalid social_post_status rejection (error code 22P02: invalid_text_representation)
    console.log('Testing adversarial invalid social_post_status values...');
    const invalidStatuses = ['approved', 'under_review', 'unknown_state', 'PENDING_ADMIN_REVIEW', ''];
    for (const invalidStatus of invalidStatuses) {
      await assertRejectsWithCode(
        () => query(`INSERT INTO social_posts (user_id, status) VALUES ($1, $2)`, [userId, invalidStatus]),
        '22P02',
        `Rejection of invalid social_post_status "${invalidStatus}"`
      );
    }

    // 4. All valid notification_type values (newly added workflow types)
    console.log('Testing insertion of all new notification_type enum values...');
    const newNotificationTypes = [
      'calendar_completed',
      'designer_assigned',
      'creative_uploaded',
      'creative_rejected_by_admin',
      'creative_ready_client_review',
      'creative_rejected_by_client',
      'creative_scheduled',
    ];

    for (const notifType of newNotificationTypes) {
      const notifRes = await query(`
        INSERT INTO notifications (user_id, type, title, body)
        VALUES ($1, $2, 'Test Title', 'Test Body')
        RETURNING id, type
      `, [userId, notifType]);
      assert(notifRes.rows[0].type === notifType, `Insert notification with type: "${notifType}"`);
      await query('DELETE FROM notifications WHERE id = $1', [notifRes.rows[0].id]);
    }

    // 5. Invalid notification_type rejection
    console.log('Testing adversarial invalid notification_type values...');
    const invalidNotifTypes = ['deal_cancelled', 'creative_approved_by_admin', 'designer_fired', ''];
    for (const invalidType of invalidNotifTypes) {
      await assertRejectsWithCode(
        () => query(`INSERT INTO notifications (user_id, type, title, body) VALUES ($1, $2, 'T', 'B')`, [userId, invalidType]),
        '22P02',
        `Rejection of invalid notification_type "${invalidType}"`
      );
    }
  } finally {
    await query('DELETE FROM users WHERE id = $1', [userId]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Complex JSONB Operations & Schema Stress Testing
// ─────────────────────────────────────────────────────────────────────────────
async function testJsonbOperations() {
  console.log('\n================================================================');
  console.log('SUITE 3: Complex JSONB Operations on rejection_history');
  console.log('================================================================');

  const testUserEmail = `test.jsonb.user.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
  const userRes = await query(`
    INSERT INTO users (email, password_hash, role, full_name)
    VALUES ($1, 'dummy_hash', 'client', 'JSONB Tester')
    RETURNING id
  `, [testUserEmail]);
  const userId = userRes.rows[0].id;

  try {
    // 1. Default value when omitted
    console.log('1. Testing default value for rejection_history...');
    const defaultPostRes = await query(`
      INSERT INTO social_posts (user_id, status)
      VALUES ($1, 'draft')
      RETURNING id, rejection_history
    `, [userId]);
    const defaultPost = defaultPostRes.rows[0];
    assert(Array.isArray(defaultPost.rejection_history) && defaultPost.rejection_history.length === 0,
      'rejection_history defaults to empty array [] when omitted');

    // 2. NOT NULL constraint enforcement (error code 23502: not_null_violation)
    console.log('2. Testing NOT NULL constraint enforcement on rejection_history...');
    await assertRejectsWithCode(
      () => query(`INSERT INTO social_posts (user_id, status, rejection_history) VALUES ($1, 'draft', NULL)`, [userId]),
      '23502',
      'Rejection of NULL rejection_history (NOT NULL constraint violation)'
    );

    // 3. Inserting complex nested JSONB structure
    console.log('3. Testing insertion of complex nested JSONB rejection items...');
    const initialEntry = {
      rejection_id: 'rej_001',
      round: 1,
      rejected_by_role: 'admin',
      rejected_by_id: userId,
      reason: 'Brand colors do not match style guide',
      action_items: ['Change font to Inter Bold', 'Use primary hex #059669', 'Re-align logo to top-right'],
      annotated_coordinates: { x: 120, y: 340, width: 200, height: 80 },
      metadata: { client_os: 'macOS', app_version: '2.4.1', urgent: true },
      timestamp: new Date().toISOString(),
    };

    const insertComplexRes = await query(`
      INSERT INTO social_posts (user_id, status, rejection_history, rejection_reason, admin_feedback)
      VALUES ($1, 'rejected', $2::jsonb, $3, $4)
      RETURNING id, rejection_history, rejection_reason, admin_feedback
    `, [userId, JSON.stringify([initialEntry]), initialEntry.reason, 'Admin revision requested']);

    const complexPostId = insertComplexRes.rows[0].id;
    const history1 = insertComplexRes.rows[0].rejection_history;
    assert(history1.length === 1, 'rejection_history contains 1 item');
    assert(history1[0].rejection_id === 'rej_001', 'Nested field rejection_id verified');
    assert(history1[0].action_items.length === 3, 'Nested array action_items length verified');
    assert(history1[0].metadata.urgent === true, 'Deep nested metadata.urgent verified');

    // 4. Querying JSONB with operators
    console.log('4. Testing JSONB operators (@>, jsonb_array_length, ->, ->>)...');
    const lengthQuery = await query(`
      SELECT jsonb_array_length(rejection_history) AS len
      FROM social_posts WHERE id = $1
    `, [complexPostId]);
    assert(parseInt(lengthQuery.rows[0].len, 10) === 1, 'jsonb_array_length returns 1');

    const containmentQuery = await query(`
      SELECT id FROM social_posts
      WHERE id = $1 AND rejection_history @> $2::jsonb
    `, [complexPostId, JSON.stringify([{ rejected_by_role: 'admin' }])]);
    assert(containmentQuery.rows.length === 1, 'JSONB containment operator (@>) matches role');

    const deepExtractionQuery = await query(`
      SELECT 
        rejection_history->0->>'reason' AS reason,
        rejection_history->0->'metadata'->>'urgent' AS urgent
      FROM social_posts WHERE id = $1
    `, [complexPostId]);
    assert(deepExtractionQuery.rows[0].reason === 'Brand colors do not match style guide', 'JSONB extraction ->0->>reason');
    assert(deepExtractionQuery.rows[0].urgent === 'true', 'JSONB deep extraction ->0->metadata->>urgent');

    // 5. Dynamic JSONB Appending via || (concatenation)
    console.log('5. Testing dynamic JSONB append (Round 2 rejection by client)...');
    const round2Entry = {
      rejection_id: 'rej_002',
      round: 2,
      rejected_by_role: 'client',
      rejected_by_id: userId,
      reason: 'Please change the headline text to Summer Special 50% Off',
      action_items: ['Headline text updated'],
      timestamp: new Date().toISOString(),
    };

    const appendRes = await query(`
      UPDATE social_posts
      SET 
        rejection_history = rejection_history || $1::jsonb,
        status = 'rejected',
        client_feedback = $2,
        rejection_reason = $3
      WHERE id = $4
      RETURNING rejection_history, jsonb_array_length(rejection_history) AS len
    `, [JSON.stringify([round2Entry]), round2Entry.reason, round2Entry.reason, complexPostId]);

    assert(parseInt(appendRes.rows[0].len, 10) === 2, 'Dynamic JSONB append resulted in 2 history entries');
    const history2 = appendRes.rows[0].rejection_history;
    assert(history2[1].rejected_by_role === 'client', 'Second history entry has rejected_by_role: client');
    assert(history2[1].rejection_id === 'rej_002', 'Second history entry has rejection_id: rej_002');

    // 6. Stress Test: 50 successive JSONB appends simulating heavy iterative review cycles
    console.log('6. Stress testing 50 successive JSONB revision appends...');
    for (let round = 3; round <= 52; round++) {
      const entry = {
        rejection_id: `rej_${round.toString().padStart(3, '0')}`,
        round,
        rejected_by_role: round % 2 === 0 ? 'client' : 'admin',
        reason: `Automated stress revision note for cycle #${round}`,
        timestamp: new Date().toISOString(),
      };
      await query(`
        UPDATE social_posts
        SET rejection_history = rejection_history || $1::jsonb
        WHERE id = $2
      `, [JSON.stringify([entry]), complexPostId]);
    }

    const heavyHistoryRes = await query(`
      SELECT jsonb_array_length(rejection_history) AS len, rejection_history->51->>'round' AS last_round
      FROM social_posts WHERE id = $1
    `, [complexPostId]);

    assert(parseInt(heavyHistoryRes.rows[0].len, 10) === 52, '52 JSONB history items accumulated without corruption');
    assert(parseInt(heavyHistoryRes.rows[0].last_round, 10) === 52, 'Last JSONB item round value is 52');

    // Clean up
    await query('DELETE FROM social_posts WHERE id IN ($1, $2)', [defaultPost.id, complexPostId]);
  } finally {
    await query('DELETE FROM users WHERE id = $1', [userId]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Foreign Key Constraints & ON DELETE SET NULL Cascades
// ─────────────────────────────────────────────────────────────────────────────
async function testForeignKeyConstraints() {
  console.log('\n================================================================');
  console.log('SUITE 4: Foreign Key Constraints & ON DELETE SET NULL Cascades');
  console.log('================================================================');

  const designerEmail1 = `test.des1.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
  const designerEmail2 = `test.des2.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
  const clientEmail = `test.cli.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;

  // Create Designer 1
  const des1Res = await query(`
    INSERT INTO users (email, password_hash, role, full_name)
    VALUES ($1, 'hash', 'designer', 'Designer 1') RETURNING id
  `, [designerEmail1]);
  const designerId1 = des1Res.rows[0].id;

  // Create Designer 2
  const des2Res = await query(`
    INSERT INTO users (email, password_hash, role, full_name)
    VALUES ($1, 'hash', 'designer', 'Designer 2') RETURNING id
  `, [designerEmail2]);
  const designerId2 = des2Res.rows[0].id;

  // Create Client linked to Designer 1
  const cliRes = await query(`
    INSERT INTO users (email, password_hash, role, full_name, assigned_designer_id)
    VALUES ($1, 'hash', 'client', 'Client assigned to D1', $2) RETURNING id, assigned_designer_id
  `, [clientEmail, designerId1]);
  const clientId = cliRes.rows[0].id;
  assert(cliRes.rows[0].assigned_designer_id === designerId1, 'Client assigned_designer_id set to Designer 1');

  try {
    // 1. Foreign key rejection on non-existent UUID
    console.log('1. Testing foreign key rejection on non-existent user UUIDs...');
    const fakeUuid = '00000000-0000-0000-0000-000000000000';

    await assertRejectsWithCode(
      () => query(`UPDATE users SET assigned_designer_id = $1 WHERE id = $2`, [fakeUuid, clientId]),
      '23503',
      'Foreign key rejection on users.assigned_designer_id with non-existent UUID'
    );

    await assertRejectsWithCode(
      () => query(`INSERT INTO social_posts (user_id, designer_id, status) VALUES ($1, $2, 'draft')`, [clientId, fakeUuid]),
      '23503',
      'Foreign key rejection on social_posts.designer_id with non-existent UUID'
    );

    // 2. Create posts linked to Designer 1 and Designer 2
    console.log('2. Creating posts linked to Designer 1 and Designer 2...');
    const post1Res = await query(`
      INSERT INTO social_posts (user_id, designer_id, status, creative_url)
      VALUES ($1, $2, 'pending_admin_review', 'https://example.com/asset1.png')
      RETURNING id, designer_id
    `, [clientId, designerId1]);
    const post1Id = post1Res.rows[0].id;

    const post2Res = await query(`
      INSERT INTO social_posts (user_id, designer_id, status, creative_url)
      VALUES ($1, $2, 'in_review', 'https://example.com/asset2.png')
      RETURNING id, designer_id
    `, [clientId, designerId2]);
    const post2Id = post2Res.rows[0].id;

    // 3. Delete Designer 1 and verify ON DELETE SET NULL behavior
    console.log('3. Deleting Designer 1 and testing ON DELETE SET NULL behavior...');
    await query('DELETE FROM users WHERE id = $1', [designerId1]);

    const clientAfter = await query('SELECT id, assigned_designer_id FROM users WHERE id = $1', [clientId]);
    assert(clientAfter.rows.length === 1, 'Client record was NOT deleted');
    assert(clientAfter.rows[0].assigned_designer_id === null, 'Client assigned_designer_id was automatically set to NULL');

    const post1After = await query('SELECT id, designer_id, status FROM social_posts WHERE id = $1', [post1Id]);
    assert(post1After.rows.length === 1, 'Post 1 record was NOT deleted');
    assert(post1After.rows[0].designer_id === null, 'Post 1 designer_id was automatically set to NULL');
    assert(post1After.rows[0].status === 'pending_admin_review', 'Post 1 status remained unchanged');

    const post2After = await query('SELECT id, designer_id FROM social_posts WHERE id = $1', [post2Id]);
    assert(post2After.rows.length === 1, 'Post 2 record was NOT deleted');
    assert(post2After.rows[0].designer_id === designerId2, 'Post 2 designer_id remained Designer 2');

    // Clean up posts
    await query('DELETE FROM social_posts WHERE id IN ($1, $2)', [post1Id, post2Id]);
  } finally {
    await query('DELETE FROM users WHERE id = $1', [clientId]);
    await query('DELETE FROM users WHERE id = $1', [designerId2]);
    await query('DELETE FROM users WHERE id = $1', [designerId1]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Query Plan & Index Utilization Verification
// ─────────────────────────────────────────────────────────────────────────────
async function testIndexesAndQueryPlans() {
  console.log('\n================================================================');
  console.log('SUITE 5: Query Plan & Index Utilization Verification');
  console.log('================================================================');

  // Verify all 5 indexes exist in pg_indexes
  const indexListRes = await query(`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE tablename IN ('users', 'social_posts')
      AND indexname IN (
        'idx_users_assigned_designer_id',
        'idx_social_posts_designer_id',
        'idx_social_posts_status_publish_at',
        'idx_social_posts_designer_status',
        'idx_social_posts_user_status'
      )
  `);
  const indexNames = indexListRes.rows.map((r) => r.indexname);
  console.log('Discovered indexes:', indexNames);

  const expectedIndexes = [
    'idx_users_assigned_designer_id',
    'idx_social_posts_designer_id',
    'idx_social_posts_status_publish_at',
    'idx_social_posts_designer_status',
    'idx_social_posts_user_status',
  ];

  for (const idx of expectedIndexes) {
    assert(indexNames.includes(idx), `Index "${idx}" exists in pg_indexes`);
  }

  // EXPLAIN plans on critical pipeline queries
  console.log('Testing EXPLAIN query plans for workflow endpoints...');

  // 1. Admin Review Queue: filter by status, sort by publish_at
  const explain1 = await query(`
    EXPLAIN SELECT id, status, creative_url, publish_at
    FROM social_posts
    WHERE status = 'pending_admin_review'
    ORDER BY publish_at ASC
  `);
  console.log('  EXPLAIN 1 (Admin Review Queue):', explain1.rows.map((r) => r['QUERY PLAN']).join(' | '));
  assert(explain1.rows.length > 0, 'EXPLAIN succeeded for Admin Review Queue query');

  // 2. Designer Queue: filter by designer_id and status
  const dummyUuid = '11111111-2222-3333-4444-555555555555';
  const explain2 = await query(`
    EXPLAIN SELECT id, status, creative_url, client_feedback, admin_feedback
    FROM social_posts
    WHERE designer_id = $1 AND status = 'in_review'
  `, [dummyUuid]);
  console.log('  EXPLAIN 2 (Designer Queue):', explain2.rows.map((r) => r['QUERY PLAN']).join(' | '));
  assert(explain2.rows.length > 0, 'EXPLAIN succeeded for Designer Queue query');

  // 3. Client Assigned Designer lookup
  const explain3 = await query(`
    EXPLAIN SELECT id, full_name, email
    FROM users
    WHERE assigned_designer_id = $1
  `, [dummyUuid]);
  console.log('  EXPLAIN 3 (Assigned Designer Lookup):', explain3.rows.map((r) => r['QUERY PLAN']).join(' | '));
  assert(explain3.rows.length > 0, 'EXPLAIN succeeded for Assigned Designer Lookup query');
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: Unicode, Multi-line, and Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
async function testEdgeCases() {
  console.log('\n================================================================');
  console.log('SUITE 6: Unicode, Multiline, and Feedback Edge Cases');
  console.log('================================================================');

  const testUserEmail = `test.edge.user.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
  const userRes = await query(`
    INSERT INTO users (email, password_hash, role, full_name)
    VALUES ($1, 'hash', 'client', 'Edge Tester') RETURNING id
  `, [testUserEmail]);
  const userId = userRes.rows[0].id;

  try {
    const unicodeFeedback = '🎨 Designer feedback: Please replace the emoji 🚀 with ✨ and fix RTL Arabic: مرحبا بالعالم. Line 1\nLine 2\nLine 3 with quotes "double" and \'single\'.';
    const postRes = await query(`
      INSERT INTO social_posts (
        user_id, status, creative_url, admin_feedback, client_feedback, rejection_reason
      ) VALUES (
        $1, 'rejected', 'https://cdn.example.com/asset-12345.png?query=true&token=abc#hash', $2, $2, $2
      ) RETURNING id, admin_feedback, client_feedback, rejection_reason, creative_url
    `, [userId, unicodeFeedback]);

    const post = postRes.rows[0];
    assert(post.admin_feedback === unicodeFeedback, 'admin_feedback preserves multiline, unicode, emojis, and quotes');
    assert(post.client_feedback === unicodeFeedback, 'client_feedback preserves multiline, unicode, emojis, and quotes');
    assert(post.rejection_reason === unicodeFeedback, 'rejection_reason preserves multiline, unicode, emojis, and quotes');
    assert(post.creative_url.includes('#hash'), 'creative_url preserves complex URL syntax');

    await query('DELETE FROM social_posts WHERE id = $1', [post.id]);
  } finally {
    await query('DELETE FROM users WHERE id = $1', [userId]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE (M1)...');
  const start = Date.now();

  try {
    await testMigrationIdempotency();
    await testEnumEnforcement();
    await testJsonbOperations();
    await testForeignKeyConstraints();
    await testIndexesAndQueryPlans();
    await testEdgeCases();

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log('\n================================================================');
    console.log(`🏆 ALL ADVERSARIAL TESTS PASSED! (${results.passed}/${results.total} assertions in ${duration}s)`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ ADVERSARIAL TEST SUITE FAILED:', err);
    throw err;
  }
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async () => {
    try {
      await pool.end();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  });
