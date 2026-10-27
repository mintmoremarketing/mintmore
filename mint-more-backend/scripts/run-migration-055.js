/**
 * Migration 055 Runner & Schema Integrity Assertion Script
 * Executes 055_creative_workflow_pipeline.sql against PostgreSQL database,
 * verifies idempotency (consecutive re-run), and validates all schema objects.
 */

const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

function parseSqlStatements(sqlContent) {
  return sqlContent
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => {
      if (!stmt) return false;
      // Strip comments to check if there is actual SQL command
      const stripped = stmt.replace(/--.*$/gm, '').trim();
      return stripped.length > 0;
    });
}

async function runMigrationPass(passName, statements) {
  console.log(`\n==================== [Pass: ${passName}] ====================`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
    console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);
    await query(stmt);
  }
  console.log(`✅ ${passName} completed successfully.`);
}

async function verifySchemaAndConstraints() {
  console.log('\n==================== [Schema & Constraint Assertions] ====================');

  // 1. Check users table columns
  console.log('1. Checking users table columns...');
  const userCols = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'assigned_designer_id'
  `);
  if (userCols.rows.length === 0) {
    throw new Error('Assertion failed: users.assigned_designer_id column does not exist.');
  }
  console.log('   users.assigned_designer_id:', userCols.rows[0]);
  if (userCols.rows[0].data_type !== 'uuid') {
    throw new Error(`Assertion failed: expected users.assigned_designer_id to be uuid, found ${userCols.rows[0].data_type}`);
  }

  // 2. Check social_posts table columns
  console.log('2. Checking social_posts table columns...');
  const postCols = await query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'social_posts'
      AND column_name IN ('creative_url', 'designer_id', 'admin_feedback', 'client_feedback', 'rejection_reason', 'rejection_history')
    ORDER BY column_name
  `);

  const expectedCols = {
    admin_feedback: { type: 'text' },
    client_feedback: { type: 'text' },
    creative_url: { type: 'text' },
    designer_id: { type: 'uuid' },
    rejection_history: { type: 'jsonb' },
    rejection_reason: { type: 'text' },
  };

  const foundColNames = postCols.rows.map((r) => r.column_name);
  for (const [colName, spec] of Object.entries(expectedCols)) {
    if (!foundColNames.includes(colName)) {
      throw new Error(`Assertion failed: social_posts.${colName} column does not exist.`);
    }
    const row = postCols.rows.find((r) => r.column_name === colName);
    if (row.data_type !== spec.type) {
      throw new Error(`Assertion failed: social_posts.${colName} data_type is ${row.data_type}, expected ${spec.type}`);
    }
    console.log(`   social_posts.${colName}:`, { data_type: row.data_type, nullable: row.is_nullable, default: row.column_default });
  }

  // 3. Check social_post_status enum
  console.log('3. Checking social_post_status enum values...');
  const postStatusRes = await query(`
    SELECT enumlabel 
    FROM pg_enum e 
    JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'social_post_status'
    ORDER BY e.enumsortorder
  `);
  const postStatusVals = postStatusRes.rows.map((r) => r.enumlabel);
  console.log('   social_post_status values:', postStatusVals);
  const requiredPostStatuses = ['pending_admin_review', 'pending_client_review', 'in_review', 'rejected'];
  for (const reqStatus of requiredPostStatuses) {
    if (!postStatusVals.includes(reqStatus)) {
      throw new Error(`Assertion failed: social_post_status enum missing value "${reqStatus}"`);
    }
  }

  // 4. Check notification_type enum
  console.log('4. Checking notification_type enum values...');
  const notifTypeRes = await query(`
    SELECT enumlabel 
    FROM pg_enum e 
    JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'notification_type'
    ORDER BY e.enumsortorder
  `);
  const notifTypeVals = notifTypeRes.rows.map((r) => r.enumlabel);
  console.log('   notification_type values:', notifTypeVals);
  const requiredNotifTypes = [
    'calendar_completed',
    'designer_assigned',
    'creative_uploaded',
    'creative_rejected_by_admin',
    'creative_ready_client_review',
    'creative_rejected_by_client',
    'creative_scheduled',
  ];
  for (const reqType of requiredNotifTypes) {
    if (!notifTypeVals.includes(reqType)) {
      throw new Error(`Assertion failed: notification_type enum missing value "${reqType}"`);
    }
  }

  // 5. Check indexes
  console.log('5. Checking performance and foreign key indexes...');
  const indexesRes = await query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('users', 'social_posts')
      AND indexname IN (
        'idx_users_assigned_designer_id',
        'idx_social_posts_designer_id',
        'idx_social_posts_status_publish_at',
        'idx_social_posts_designer_status',
        'idx_social_posts_user_status'
      )
    ORDER BY tablename, indexname
  `);
  const foundIndexNames = indexesRes.rows.map((r) => r.indexname);
  console.log('   Found indexes:', foundIndexNames);
  const requiredIndexes = [
    'idx_users_assigned_designer_id',
    'idx_social_posts_designer_id',
    'idx_social_posts_status_publish_at',
    'idx_social_posts_designer_status',
    'idx_social_posts_user_status',
  ];
  for (const reqIdx of requiredIndexes) {
    if (!foundIndexNames.includes(reqIdx)) {
      throw new Error(`Assertion failed: index "${reqIdx}" does not exist.`);
    }
  }

  // 6. Test Foreign Key ON DELETE SET NULL and Data Operations
  console.log('6. Testing Foreign Key ON DELETE SET NULL and Data Operations...');
  const testDesignerEmail = `test.designer.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
  const testClientEmail = `test.client.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;

  // Insert Designer
  const designerRes = await query(`
    INSERT INTO users (email, password_hash, role, full_name)
    VALUES ($1, 'dummy_hash', 'designer', 'Test M1 Designer')
    RETURNING id
  `, [testDesignerEmail]);
  const designerId = designerRes.rows[0].id;
  console.log('   Created test designer:', designerId);

  // Insert Client assigned to Designer
  const clientRes = await query(`
    INSERT INTO users (email, password_hash, role, full_name, assigned_designer_id)
    VALUES ($1, 'dummy_hash', 'client', 'Test M1 Client', $2)
    RETURNING id, assigned_designer_id
  `, [testClientEmail, designerId]);
  const clientId = clientRes.rows[0].id;
  console.log('   Created test client:', clientId, 'with assigned_designer_id:', clientRes.rows[0].assigned_designer_id);
  if (clientRes.rows[0].assigned_designer_id !== designerId) {
    throw new Error('Assertion failed: Client assigned_designer_id does not match designerId.');
  }

  // Insert Social Post with all new fields and statuses
  const initialHistory = [{ by: 'admin', reason: 'Initial review request', timestamp: new Date().toISOString() }];
  const postRes = await query(`
    INSERT INTO social_posts (
      user_id, designer_id, status, creative_url, admin_feedback, client_feedback, rejection_reason, rejection_history
    ) VALUES (
      $1, $2, 'pending_admin_review', 'https://example.com/asset.png', 'Admin note', 'Client note', 'Needs revision', $3::jsonb
    ) RETURNING id, designer_id, status, creative_url, rejection_history
  `, [clientId, designerId, JSON.stringify(initialHistory)]);
  const postId = postRes.rows[0].id;
  console.log('   Created test social post:', postId, 'status:', postRes.rows[0].status);

  // Insert Notification with new enum type
  const notifRes = await query(`
    INSERT INTO notifications (user_id, type, title, body)
    VALUES ($1, 'creative_uploaded', 'New Creative', 'Designer uploaded creative asset')
    RETURNING id, type
  `, [clientId]);
  const notifId = notifRes.rows[0].id;
  console.log('   Created test notification:', notifId, 'type:', notifRes.rows[0].type);

  // Verify Foreign Key ON DELETE SET NULL when deleting Designer
  console.log('   Testing ON DELETE SET NULL on users and social_posts when designer is deleted...');
  await query('DELETE FROM users WHERE id = $1', [designerId]);

  const clientAfterDelete = await query('SELECT assigned_designer_id FROM users WHERE id = $1', [clientId]);
  const postAfterDelete = await query('SELECT designer_id FROM social_posts WHERE id = $1', [postId]);

  if (clientAfterDelete.rows[0].assigned_designer_id !== null) {
    throw new Error('Assertion failed: users.assigned_designer_id was not set to NULL upon designer deletion.');
  }
  if (postAfterDelete.rows[0].designer_id !== null) {
    throw new Error('Assertion failed: social_posts.designer_id was not set to NULL upon designer deletion.');
  }
  console.log('   ON DELETE SET NULL verified successfully: client.assigned_designer_id = null, post.designer_id = null');

  // Clean up test records
  await query('DELETE FROM notifications WHERE id = $1', [notifId]);
  await query('DELETE FROM social_posts WHERE id = $1', [postId]);
  await query('DELETE FROM users WHERE id = $1', [clientId]);
  console.log('   Cleaned up test records.');

  console.log('✅ ALL SCHEMA ASSERTIONS, CONSTRAINTS & OPERATIONS PASSED PERFECTLY!');
}

async function main() {
  const possiblePaths = [
    path.join(process.cwd(), 'src/db/migrations/055_creative_workflow_pipeline.sql'),
    path.join(process.cwd(), 'mint-more-backend/src/db/migrations/055_creative_workflow_pipeline.sql'),
  ];
  const sqlPath = possiblePaths.find((p) => fs.existsSync(p));
  if (!sqlPath) {
    throw new Error(`Migration file not found in searched locations: ${possiblePaths.join(', ')}`);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  const statements = parseSqlStatements(sqlContent);
  console.log(`Loaded migration 055 from ${sqlPath}: ${statements.length} SQL statements parsed.`);

  // Pass 1: Apply migration
  await runMigrationPass('Pass 1 - Application', statements);

  // Pass 2: Verify idempotency (re-run identical statements)
  await runMigrationPass('Pass 2 - Idempotency Re-run', statements);

  // Pass 3: Comprehensive assertions
  await verifySchemaAndConstraints();

  console.log('\n🎉 [MIGRATION 055 COMPLETE & VERIFIED]\n');
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n❌ [MIGRATION 055 RUNNER FAILED]:', err);
    try {
      await pool.end();
    } catch (poolErr) {
      console.error('Failed to close pool on error:', poolErr.message);
    }
    process.exit(1);
  });
