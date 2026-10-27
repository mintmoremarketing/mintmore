/**
 * Tier 2: Boundary & Corner Cases E2E Test Suite (45 Test Cases across F1-F9)
 * Zero external test framework dependencies
 */

const assert = require('node:assert/strict');

async function runTier2(client, fixtures, recordTest) {
  console.log('\n--- 🛡️ Running Tier 2: Boundary & Corner Cases (45 Tests) ---');

  const { admin, designer1, designer2, clientAuto, clientManual } = fixtures.users;
  const { tokens } = fixtures;
  const dummyUUID = 'a0000000-0000-0000-0000-000000000000';

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 1 BOUNDARIES (F1)
  // ══════════════════════════════════════════════════════════════════════

  await recordTest('TC-T2-F1-01: Unauthenticated request to calendar complete returns 401', async () => {
    const res = await client.post('/api/v1/creative/calendar/complete', {}, {
      expected: [401],
    });
    assert.equal(res.status, 401);
  });

  await recordTest('TC-T2-F1-02: Designer calling calendar complete returns 403 Forbidden', async () => {
    const res = await client.post('/api/v1/creative/calendar/complete', {}, {
      token: tokens.designer1,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F1-03: Admin calling calendar complete returns 403 Forbidden', async () => {
    const res = await client.post('/api/v1/creative/calendar/complete', {}, {
      token: tokens.admin,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F1-04: Idempotent double invocation of calendar complete succeeds', async () => {
    await client.post('/api/v1/creative/calendar/complete', {}, {
      token: tokens.clientAuto,
      expected: [200, 201],
    });
    const res2 = await client.post('/api/v1/creative/calendar/complete', {}, {
      token: tokens.clientAuto,
      expected: [200, 201],
    });
    assert.ok([200, 201].includes(res2.status));
  });

  await recordTest('TC-T2-F1-05: Malformed body payload on calendar complete does not crash server', async () => {
    const res = await client.post('/api/v1/creative/calendar/complete', { garbage_key: 12345 }, {
      token: tokens.clientAuto,
      expected: [200, 201, 400],
    });
    assert.ok([200, 201, 400].includes(res.status));
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 2/3 BOUNDARIES (F2 / F3)
  // ══════════════════════════════════════════════════════════════════════

  await recordTest('TC-T2-F2-01: Designer calling assign-designer returns 403 Forbidden', async () => {
    const res = await client.patch(`/api/v1/creative/admin/clients/${clientManual.id}/assign-designer`, {
      designer_id: designer1.id,
    }, {
      token: tokens.designer1,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F2-02: Client calling assign-designer returns 403 Forbidden', async () => {
    const res = await client.patch(`/api/v1/creative/admin/clients/${clientManual.id}/assign-designer`, {
      designer_id: designer1.id,
    }, {
      token: tokens.clientManual,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F2-03: Invalid non-UUID format in client assign URL returns 400 or 404', async () => {
    const res = await client.patch('/api/v1/creative/admin/clients/invalid-not-a-uuid/assign-designer', {
      designer_id: designer1.id,
    }, {
      token: tokens.admin,
      expected: [400, 404, 422],
    });
    assert.ok([400, 404, 422].includes(res.status));
  });

  await recordTest('TC-T2-F2-04: Non-existent Client UUID on assign returns 404 Not Found', async () => {
    const res = await client.patch(`/api/v1/creative/admin/clients/${dummyUUID}/assign-designer`, {
      designer_id: designer1.id,
    }, {
      token: tokens.admin,
      expected: [400, 404],
    });
    assert.ok([400, 404].includes(res.status));
  });

  await recordTest('TC-T2-F2-05: Non-existent Designer UUID on assign returns error (400/404/422)', async () => {
    const res = await client.patch(`/api/v1/creative/admin/clients/${clientManual.id}/assign-designer`, {
      designer_id: dummyUUID,
    }, {
      token: tokens.admin,
      expected: [400, 404, 422],
    });
    assert.ok([400, 404, 422].includes(res.status));
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 4 BOUNDARIES (F4)
  // ══════════════════════════════════════════════════════════════════════

  const boundaryPost = await fixtures.createSocialPost({
    userId: clientManual.id,
    designerId: designer1.id,
    status: 'draft',
    title: 'Boundary Upload Post',
  });

  await recordTest('TC-T2-F4-01: Client calling designer upload returns 403 Forbidden', async () => {
    const res = await client.patch(`/api/v1/creative/designer/social-queue/${boundaryPost.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/unauthorized.png',
    }, {
      token: tokens.clientManual,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F4-02: Missing creative_url in upload payload returns 400 Bad Request', async () => {
    const res = await client.patch(`/api/v1/creative/designer/social-queue/${boundaryPost.id}/upload`, {
      caption: 'Missing url',
    }, {
      token: tokens.designer1,
      expected: [400],
    });
    assert.equal(res.status, 400);
  });

  await recordTest('TC-T2-F4-03: Whitespace-only creative_url returns 400 Bad Request', async () => {
    const res = await client.patch(`/api/v1/creative/designer/social-queue/${boundaryPost.id}/upload`, {
      creative_url: '     ',
    }, {
      token: tokens.designer1,
      expected: [400],
    });
    assert.equal(res.status, 400);
  });

  await recordTest('TC-T2-F4-04: Upload to non-existent post UUID returns 404 Not Found', async () => {
    const res = await client.patch(`/api/v1/creative/designer/social-queue/${dummyUUID}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/missing.png',
    }, {
      token: tokens.designer1,
      expected: [404],
    });
    assert.equal(res.status, 404);
  });

  await recordTest('TC-T2-F4-05: Designer uploads to post of unassigned client returns 403 Forbidden', async () => {
    // Post belongs to clientManual who is assigned to Designer 1, Designer 2 attempts upload
    const res = await client.patch(`/api/v1/creative/designer/social-queue/${boundaryPost.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/idor_test.png',
    }, {
      token: tokens.designer2,
      expected: [403, 404],
    });
    assert.ok([403, 404].includes(res.status));
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 5 BOUNDARIES (F5)
  // ══════════════════════════════════════════════════════════════════════

  await recordTest('TC-T2-F5-01: Designer accessing admin review queue returns 403 Forbidden', async () => {
    const res = await client.get('/api/v1/creative/admin/review-queue', {
      token: tokens.designer1,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F5-02: Client accessing admin review queue returns 403 Forbidden', async () => {
    const res = await client.get('/api/v1/creative/admin/review-queue', {
      token: tokens.clientManual,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F5-03: Unauthenticated request to review queue returns 401 Unauthorized', async () => {
    const res = await client.get('/api/v1/creative/admin/review-queue', {
      expected: [401],
    });
    assert.equal(res.status, 401);
  });

  await recordTest('TC-T2-F5-04: Review queue handles empty queue gracefully without error', async () => {
    const res = await client.get('/api/v1/creative/admin/review-queue', {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const queue = res.data?.queue || res.json?.queue || [];
    assert.ok(Array.isArray(queue));
  });

  await recordTest('TC-T2-F5-05: Review queue endpoint handles malicious SQL injection query params safely', async () => {
    const res = await client.get('/api/v1/creative/admin/review-queue?status=\' OR \'1\'=\'1', {
      token: tokens.admin,
      expected: [200, 400],
    });
    assert.ok([200, 400].includes(res.status));
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 6 BOUNDARIES (F6)
  // ══════════════════════════════════════════════════════════════════════

  const postForAdminRejectBoundaries = await fixtures.createSocialPost({
    userId: clientManual.id,
    designerId: designer1.id,
    status: 'pending_admin_review',
    creative_url: 'https://r2.cdn.mintmore.test/admin_reject_boundary.png',
  });

  await recordTest('TC-T2-F6-01: Admin rejection with empty string reason returns 400 Bad Request', async () => {
    const res = await client.post(`/api/v1/creative/admin/posts/${postForAdminRejectBoundaries.id}/reject`, {
      reason: '',
    }, {
      token: tokens.admin,
      expected: [400],
    });
    assert.equal(res.status, 400);
  });

  await recordTest('TC-T2-F6-02: Admin rejection with whitespace-only reason returns 400 Bad Request', async () => {
    const res = await client.post(`/api/v1/creative/admin/posts/${postForAdminRejectBoundaries.id}/reject`, {
      reason: '   \n\t   ',
    }, {
      token: tokens.admin,
      expected: [400],
    });
    assert.equal(res.status, 400);
  });

  await recordTest('TC-T2-F6-03: Designer calling admin reject returns 403 Forbidden', async () => {
    const res = await client.post(`/api/v1/creative/admin/posts/${postForAdminRejectBoundaries.id}/reject`, {
      reason: 'Unauthorized rejection attempt',
    }, {
      token: tokens.designer1,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F6-04: Admin reject on non-existent post UUID returns 404 Not Found', async () => {
    const res = await client.post(`/api/v1/creative/admin/posts/${dummyUUID}/reject`, {
      reason: 'Missing post test',
    }, {
      token: tokens.admin,
      expected: [404],
    });
    assert.equal(res.status, 404);
  });

  await recordTest('TC-T2-F6-05: Admin rejection preserves Unicode, emojis, and multiline characters verbatim', async () => {
    const unicodeReason = '🎨 Need bright colors: 🚀✨ \nMultilingual: 简体中文, 日本語, العربية, हिन्दी.\nParagraph 2.';
    const res = await client.post(`/api/v1/creative/admin/posts/${postForAdminRejectBoundaries.id}/reject`, {
      reason: unicodeReason,
    }, {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const feedback = res.data?.admin_feedback || res.json?.admin_feedback;
    assert.equal(feedback, unicodeReason, 'Unicode and emoji feedback must be preserved exactly');
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 7 BOUNDARIES (F7)
  // ══════════════════════════════════════════════════════════════════════

  const postForAdminApproveBoundaries = await fixtures.createSocialPost({
    userId: clientAuto.id,
    designerId: designer1.id,
    status: 'pending_admin_review',
    creative_url: 'https://r2.cdn.mintmore.test/approve_boundary.png',
  });

  await recordTest('TC-T2-F7-01: Designer calling admin approve returns 403 Forbidden', async () => {
    const res = await client.post(`/api/v1/creative/admin/posts/${postForAdminApproveBoundaries.id}/approve`, {}, {
      token: tokens.designer1,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F7-02: Client calling admin approve returns 403 Forbidden', async () => {
    const res = await client.post(`/api/v1/creative/admin/posts/${postForAdminApproveBoundaries.id}/approve`, {}, {
      token: tokens.clientAuto,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F7-03: Admin approve on non-existent post UUID returns 404 Not Found', async () => {
    const res = await client.post(`/api/v1/creative/admin/posts/${dummyUUID}/approve`, {}, {
      token: tokens.admin,
      expected: [404],
    });
    assert.equal(res.status, 404);
  });

  await recordTest('TC-T2-F7-04: Unauthenticated request to admin approve returns 401 Unauthorized', async () => {
    const res = await client.post(`/api/v1/creative/admin/posts/${postForAdminApproveBoundaries.id}/approve`, {}, {
      expected: [401],
    });
    assert.equal(res.status, 401);
  });

  await recordTest('TC-T2-F7-05: Approving already scheduled post handles idempotency/conflict safely', async () => {
    // First approval
    await client.post(`/api/v1/creative/admin/posts/${postForAdminApproveBoundaries.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200],
    });
    // Second approval (already scheduled)
    const res2 = await client.post(`/api/v1/creative/admin/posts/${postForAdminApproveBoundaries.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200, 400, 409],
    });
    assert.ok([200, 400, 409].includes(res2.status));
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 8 BOUNDARIES (F8)
  // ══════════════════════════════════════════════════════════════════════

  const postBelongingToManual = await fixtures.createSocialPost({
    userId: clientManual.id,
    designerId: designer1.id,
    status: 'pending_client_review',
    creative_url: 'https://r2.cdn.mintmore.test/idor_test_post.png',
  });

  await recordTest('TC-T2-F8-01: IDOR Check: Client Auto attempting to approve Client Manual post returns 403 or 404', async () => {
    const res = await client.post(`/api/v1/creative/client/posts/${postBelongingToManual.id}/approve`, {}, {
      token: tokens.clientAuto,
      expected: [403, 404],
    });
    assert.ok([403, 404].includes(res.status));
  });

  await recordTest('TC-T2-F8-02: IDOR Check: Client Auto attempting to reject Client Manual post returns 403 or 404', async () => {
    const res = await client.post(`/api/v1/creative/client/posts/${postBelongingToManual.id}/reject`, {
      reason: 'Malicious rejection attempt across tenants',
    }, {
      token: tokens.clientAuto,
      expected: [403, 404],
    });
    assert.ok([403, 404].includes(res.status));
  });

  await recordTest('TC-T2-F8-03: Client rejection with empty reason returns 400 Bad Request', async () => {
    const res = await client.post(`/api/v1/creative/client/posts/${postBelongingToManual.id}/reject`, {
      reason: '',
    }, {
      token: tokens.clientManual,
      expected: [400],
    });
    assert.equal(res.status, 400);
  });

  await recordTest('TC-T2-F8-04: Client rejection with whitespace-only reason returns 400 Bad Request', async () => {
    const res = await client.post(`/api/v1/creative/client/posts/${postBelongingToManual.id}/reject`, {
      reason: '       ',
    }, {
      token: tokens.clientManual,
      expected: [400],
    });
    assert.equal(res.status, 400);
  });

  await recordTest('TC-T2-F8-05: Designer calling client approve returns 403 Forbidden', async () => {
    const res = await client.post(`/api/v1/creative/client/posts/${postBelongingToManual.id}/approve`, {}, {
      token: tokens.designer1,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 9 BOUNDARIES (F9)
  // ══════════════════════════════════════════════════════════════════════

  await recordTest('TC-T2-F9-01: Designer calling admin direct-upload returns 403 Forbidden', async () => {
    const res = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientAuto.id,
      creative_url: 'https://r2.cdn.mintmore.test/designer_direct.png',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    }, {
      token: tokens.designer1,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F9-02: Client calling admin direct-upload returns 403 Forbidden', async () => {
    const res = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientAuto.id,
      creative_url: 'https://r2.cdn.mintmore.test/client_direct.png',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    }, {
      token: tokens.clientAuto,
      expected: [403],
    });
    assert.equal(res.status, 403);
  });

  await recordTest('TC-T2-F9-03: Direct upload missing client_id returns 400 Bad Request', async () => {
    const res = await client.post('/api/v1/creative/admin/direct-upload', {
      creative_url: 'https://r2.cdn.mintmore.test/missing_client.png',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    }, {
      token: tokens.admin,
      expected: [400],
    });
    assert.equal(res.status, 400);
  });

  await recordTest('TC-T2-F9-04: Direct upload missing creative_url returns 400 Bad Request', async () => {
    const res = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientAuto.id,
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    }, {
      token: tokens.admin,
      expected: [400],
    });
    assert.equal(res.status, 400);
  });

  await recordTest('TC-T2-F9-05: Direct upload with non-existent client UUID returns 404 Not Found', async () => {
    const res = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: dummyUUID,
      creative_url: 'https://r2.cdn.mintmore.test/direct_missing_client.png',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    }, {
      token: tokens.admin,
      expected: [400, 404],
    });
    assert.ok([400, 404].includes(res.status));
  });
}

module.exports = { runTier2 };
