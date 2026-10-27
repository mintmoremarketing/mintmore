/**
 * Independent Forensic Audit Verification Script for Milestone 1
 * Conducted by Forensic Auditor 1
 * Independently verifies PostgreSQL system catalogs, schema constraints,
 * enum definitions, foreign key rules, JSONB semantics, and negative security tests.
 */

const { query, pool } = require('../src/config/database');

async function runIndependentAudit() {
  const auditResults = {
    checks: [],
    passed: 0,
    failed: 0,
  };

  function recordCheck(name, success, details) {
    auditResults.checks.push({ name, success, details });
    if (success) {
      auditResults.passed++;
      console.log(`[PASS] ${name}`);
      if (details) console.log(`       Details: ${JSON.stringify(details)}`);
    } else {
      auditResults.failed++;
      console.error(`[FAIL] ${name}`);
      if (details) console.error(`       Details: ${JSON.stringify(details)}`);
    }
  }

  console.log('================================================================');
  console.log('🔍 COMMENCING INDEPENDENT FORENSIC AUDIT — MILESTONE 1 (M1)');
  console.log('================================================================\n');

  // 1. Live Database Connectivity & Instance Verification
  try {
    const dbInfo = await query(`
      SELECT current_database() AS db, current_user AS usr, version() AS ver, NOW() AS server_time
    `);
    const row = dbInfo.rows[0];
    recordCheck('DB_CONNECTIVITY', true, {
      database: row.db,
      user: row.usr,
      version: row.ver.slice(0, 50) + '...',
      server_time: row.server_time,
    });
  } catch (err) {
    recordCheck('DB_CONNECTIVITY', false, { error: err.message });
  }

  // 2. Users Table Schema Verification (assigned_designer_id)
  try {
    const userCol = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'assigned_designer_id'
    `);
    const exists = userCol.rows.length === 1;
    const isUuid = exists && userCol.rows[0].data_type === 'uuid';
    const isNullable = exists && userCol.rows[0].is_nullable === 'YES';
    recordCheck('USERS_ASSIGNED_DESIGNER_ID_SCHEMA', exists && isUuid && isNullable, userCol.rows[0]);
  } catch (err) {
    recordCheck('USERS_ASSIGNED_DESIGNER_ID_SCHEMA', false, { error: err.message });
  }

  // 3. Social Posts Table Schema Verification (All 6 M1 Columns)
  try {
    const postCols = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'social_posts'
        AND column_name IN ('creative_url', 'designer_id', 'admin_feedback', 'client_feedback', 'rejection_reason', 'rejection_history')
      ORDER BY column_name
    `);
    const expected = {
      admin_feedback: { type: 'text', nullable: 'YES' },
      client_feedback: { type: 'text', nullable: 'YES' },
      creative_url: { type: 'text', nullable: 'YES' },
      designer_id: { type: 'uuid', nullable: 'YES' },
      rejection_history: { type: 'jsonb', nullable: 'NO' },
      rejection_reason: { type: 'text', nullable: 'YES' },
    };

    let allMatch = postCols.rows.length === 6;
    const colMap = {};
    for (const r of postCols.rows) {
      colMap[r.column_name] = r;
      const exp = expected[r.column_name];
      if (!exp || r.data_type !== exp.type || r.is_nullable !== exp.nullable) {
        allMatch = false;
      }
    }
    recordCheck('SOCIAL_POSTS_COLUMNS_SCHEMA', allMatch, colMap);
  } catch (err) {
    recordCheck('SOCIAL_POSTS_COLUMNS_SCHEMA', false, { error: err.message });
  }

  // 4. Enum Values Verification: social_post_status
  try {
    const statusRes = await query(`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'social_post_status'
      ORDER BY e.enumsortorder
    `);
    const actualValues = statusRes.rows.map((r) => r.enumlabel);
    const requiredValues = ['pending_admin_review', 'pending_client_review', 'in_review', 'rejected'];
    const hasAllRequired = requiredValues.every((val) => actualValues.includes(val));
    recordCheck('ENUM_SOCIAL_POST_STATUS', hasAllRequired, {
      required: requiredValues,
      actual: actualValues,
    });
  } catch (err) {
    recordCheck('ENUM_SOCIAL_POST_STATUS', false, { error: err.message });
  }

  // 5. Enum Values Verification: notification_type
  try {
    const notifRes = await query(`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'notification_type'
      ORDER BY e.enumsortorder
    `);
    const actualValues = notifRes.rows.map((r) => r.enumlabel);
    const requiredValues = [
      'calendar_completed',
      'designer_assigned',
      'creative_uploaded',
      'creative_rejected_by_admin',
      'creative_ready_client_review',
      'creative_rejected_by_client',
      'creative_scheduled',
    ];
    const hasAllRequired = requiredValues.every((val) => actualValues.includes(val));
    recordCheck('ENUM_NOTIFICATION_TYPE', hasAllRequired, {
      required: requiredValues,
      actual: actualValues,
    });
  } catch (err) {
    recordCheck('ENUM_NOTIFICATION_TYPE', false, { error: err.message });
  }

  // 6. Index Catalog Verification
  try {
    const idxRes = await query(`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE tablename IN ('users', 'social_posts')
        AND indexname IN (
          'idx_users_assigned_designer_id',
          'idx_social_posts_designer_id',
          'idx_social_posts_status_publish_at',
          'idx_social_posts_designer_status',
          'idx_social_posts_user_status'
        )
      ORDER BY indexname
    `);
    const foundIndexes = idxRes.rows.map((r) => r.indexname);
    const requiredIndexes = [
      'idx_social_posts_designer_id',
      'idx_social_posts_designer_status',
      'idx_social_posts_status_publish_at',
      'idx_social_posts_user_status',
      'idx_users_assigned_designer_id',
    ];
    const allIndexesFound = requiredIndexes.every((i) => foundIndexes.includes(i));
    recordCheck('INDEXES_CATALOG', allIndexesFound, {
      required: requiredIndexes,
      found: foundIndexes,
      definitions: idxRes.rows.map((r) => ({ name: r.indexname, def: r.indexdef })),
    });
  } catch (err) {
    recordCheck('INDEXES_CATALOG', false, { error: err.message });
  }

  // 7. Foreign Key Referential Action Verification (information_schema)
  try {
    const fkRes = await query(`
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('users', 'social_posts')
        AND kcu.column_name IN ('assigned_designer_id', 'designer_id')
    `);
    const usersFk = fkRes.rows.find((r) => r.table_name === 'users' && r.column_name === 'assigned_designer_id');
    const postsFk = fkRes.rows.find((r) => r.table_name === 'social_posts' && r.column_name === 'designer_id');

    const usersFkValid = usersFk && usersFk.foreign_table_name === 'users' && usersFk.delete_rule === 'SET NULL';
    const postsFkValid = postsFk && postsFk.foreign_table_name === 'users' && postsFk.delete_rule === 'SET NULL';

    recordCheck('FOREIGN_KEY_CONSTRAINTS_AND_RULES', Boolean(usersFkValid && postsFkValid), {
      usersFk: usersFk || 'NOT_FOUND',
      postsFk: postsFk || 'NOT_FOUND',
    });
  } catch (err) {
    recordCheck('FOREIGN_KEY_CONSTRAINTS_AND_RULES', false, { error: err.message });
  }

  // 8. Negative Forensic Test 1: Reject Invalid Enum Status Value
  try {
    let rejectedAsExpected = false;
    let thrownError = null;
    try {
      await query(`
        INSERT INTO social_posts (user_id, status)
        VALUES ('00000000-0000-0000-0000-000000000000', 'INVALID_STATUS_VALUE_FORENSIC_TEST'::social_post_status)
      `);
    } catch (err) {
      thrownError = err.message;
      if (err.message.includes('invalid input value for enum social_post_status')) {
        rejectedAsExpected = true;
      }
    }
    recordCheck('NEGATIVE_TEST_INVALID_ENUM_STATUS', rejectedAsExpected, { thrownError });
  } catch (err) {
    recordCheck('NEGATIVE_TEST_INVALID_ENUM_STATUS', false, { error: err.message });
  }

  // 9. Negative Forensic Test 2: Reject Invalid Foreign Key Reference
  try {
    let rejectedFk = false;
    let thrownError = null;
    const nonExistentUuid = 'a0000000-0000-0000-0000-000000000001';
    try {
      await query(`
        INSERT INTO users (email, password_hash, role, full_name, assigned_designer_id)
        VALUES ('invalid.fk.test@example.com', 'dummy', 'client', 'Invalid FK Test', $1)
      `, [nonExistentUuid]);
    } catch (err) {
      thrownError = err.message;
      if (err.message.includes('violates foreign key constraint') || err.code === '23503') {
        rejectedFk = true;
      }
    }
    recordCheck('NEGATIVE_TEST_INVALID_FOREIGN_KEY', rejectedFk, { thrownError });
  } catch (err) {
    recordCheck('NEGATIVE_TEST_INVALID_FOREIGN_KEY', false, { error: err.message });
  }

  // 10. Negative Forensic Test 3: Reject NULL in rejection_history (NOT NULL check)
  try {
    let rejectedNull = false;
    let thrownError = null;
    try {
      await query(`
        INSERT INTO social_posts (user_id, status, rejection_history)
        VALUES ('00000000-0000-0000-0000-000000000000', 'draft', NULL)
      `);
    } catch (err) {
      thrownError = err.message;
      if (err.message.includes('null value in column "rejection_history"') || err.code === '23502') {
        rejectedNull = true;
      }
    }
    recordCheck('NEGATIVE_TEST_NULL_REJECTION_HISTORY', rejectedNull, { thrownError });
  } catch (err) {
    recordCheck('NEGATIVE_TEST_NULL_REJECTION_HISTORY', false, { error: err.message });
  }

  // 11. Positive Behavioral Test: End-to-End Relational Operations & JSONB Operators
  let testDesignerId = null;
  let testClientId = null;
  let testPostId = null;
  let testNotifId = null;

  try {
    const timestamp = Date.now();
    const designerEmail = `auditor.designer.${timestamp}@forensic.mintmore.internal`;
    const clientEmail = `auditor.client.${timestamp}@forensic.mintmore.internal`;

    // 11a. Insert Designer
    const dRes = await query(`
      INSERT INTO users (email, password_hash, role, full_name)
      VALUES ($1, 'hash_auditor_123', 'designer', 'Forensic Auditor Designer')
      RETURNING id
    `, [designerEmail]);
    testDesignerId = dRes.rows[0].id;

    // 11b. Insert Client referencing Designer
    const cRes = await query(`
      INSERT INTO users (email, password_hash, role, full_name, assigned_designer_id)
      VALUES ($1, 'hash_auditor_123', 'client', 'Forensic Auditor Client', $2)
      RETURNING id, assigned_designer_id
    `, [clientEmail, testDesignerId]);
    testClientId = cRes.rows[0].id;

    // 11c. Insert Social Post with new statuses and JSONB history
    const sampleHistory = [
      { action: 'uploaded', by: 'designer', timestamp: new Date().toISOString(), notes: 'V1 Draft' },
      { action: 'rejected', by: 'admin', timestamp: new Date().toISOString(), reason: 'Color palette contrast too low' },
      { action: 'uploaded', by: 'designer', timestamp: new Date().toISOString(), notes: 'V2 Revised Palette' }
    ];

    const pRes = await query(`
      INSERT INTO social_posts (
        user_id, designer_id, status, creative_url, admin_feedback, client_feedback, rejection_reason, rejection_history
      ) VALUES (
        $1, $2, 'pending_admin_review', 'https://cdn.mintmore.internal/creatives/test1.png',
        'Please verify logo margin', 'Client pending review', 'Color palette contrast too low', $3::jsonb
      ) RETURNING id, designer_id, status, creative_url, rejection_history
    `, [testClientId, testDesignerId, JSON.stringify(sampleHistory)]);
    testPostId = pRes.rows[0].id;

    // 11d. Query JSONB field using Postgres operators
    const jsonbQueryRes = await query(`
      SELECT 
        rejection_history->0->>'action' AS first_action,
        rejection_history->1->>'reason' AS rejection_reason,
        jsonb_array_length(rejection_history) AS history_count
      FROM social_posts
      WHERE id = $1
    `, [testPostId]);

    const jsonbRow = jsonbQueryRes.rows[0];
    const jsonbValid = jsonbRow.first_action === 'uploaded' &&
                       jsonbRow.rejection_reason === 'Color palette contrast too low' &&
                       Number(jsonbRow.history_count) === 3;

    recordCheck('JSONB_OPERATORS_AND_PAYLOAD_INTEGRITY', jsonbValid, jsonbRow);

    // 11e. Insert notification with new enum types
    const notifRes = await query(`
      INSERT INTO notifications (user_id, type, title, body)
      VALUES ($1, 'creative_ready_client_review', 'Creative Ready', 'Your creative is ready for review')
      RETURNING id, type
    `, [testClientId]);
    testNotifId = notifRes.rows[0].id;
    recordCheck('NOTIFICATION_ENUM_PERSISTENCE', notifRes.rows[0].type === 'creative_ready_client_review', notifRes.rows[0]);

    // 11f. Test Cascading ON DELETE SET NULL
    await query('DELETE FROM users WHERE id = $1', [testDesignerId]);

    const clientAfter = await query('SELECT assigned_designer_id FROM users WHERE id = $1', [testClientId]);
    const postAfter = await query('SELECT designer_id FROM social_posts WHERE id = $1', [testPostId]);

    const cascadeValid = clientAfter.rows[0].assigned_designer_id === null && postAfter.rows[0].designer_id === null;
    recordCheck('ON_DELETE_SET_NULL_EMPIRICAL_BEHAVIOR', cascadeValid, {
      clientAssignedDesignerId: clientAfter.rows[0].assigned_designer_id,
      postDesignerId: postAfter.rows[0].designer_id,
    });

  } catch (err) {
    recordCheck('POSITIVE_BEHAVIORAL_TESTS', false, { error: err.message });
  } finally {
    // Cleanup test artifacts
    if (testNotifId) await query('DELETE FROM notifications WHERE id = $1', [testNotifId]).catch(() => {});
    if (testPostId) await query('DELETE FROM social_posts WHERE id = $1', [testPostId]).catch(() => {});
    if (testClientId) await query('DELETE FROM users WHERE id = $1', [testClientId]).catch(() => {});
    if (testDesignerId) await query('DELETE FROM users WHERE id = $1', [testDesignerId]).catch(() => {});
    console.log('   Cleaned up all forensic test records.');
  }

  console.log('\n================================================================');
  console.log(`📊 FORENSIC AUDIT SUMMARY: ${auditResults.passed} PASSED, ${auditResults.failed} FAILED`);
  console.log('================================================================\n');

  if (auditResults.failed > 0) {
    throw new Error(`Forensic Audit FAILED with ${auditResults.failed} failing checks!`);
  }
}

runIndependentAudit()
  .then(async () => {
    await pool.end();
    console.log('🎉 VERDICT: CLEAN — ALL FORENSIC CHECKS PASSED');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('💥 VERDICT: INTEGRITY VIOLATION / AUDIT FAILURE:', err.message);
    try {
      await pool.end();
    } catch (_) {}
    process.exit(1);
  });
