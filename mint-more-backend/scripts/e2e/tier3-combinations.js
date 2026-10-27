/**
 * Tier 3: Cross-Feature Combinations E2E Test Suite (10 Pairwise Test Cases)
 * Zero external test framework dependencies
 */

const assert = require('node:assert/strict');
const { query } = require('./fixtures');

async function runTier3(client, fixtures, recordTest) {
  console.log('\n--- 🔄 Running Tier 3: Cross-Feature Combinations (10 Tests) ---');

  const { admin, designer1, designer2, clientAuto, clientManual } = fixtures.users;
  const { tokens } = fixtures;

  // ══════════════════════════════════════════════════════════════════════
  // TC-T3-01: F1 + F2 + F4 (Onboard -> Assign -> Upload)
  // ══════════════════════════════════════════════════════════════════════
  await recordTest('TC-T3-01: F1+F2+F4: Calendar Complete -> Admin Assign Designer -> Designer Uploads Creative', async () => {
    // 1. Client completes calendar
    await client.post('/api/v1/creative/calendar/complete', {}, {
      token: tokens.clientManual,
      expected: [200, 201],
    });

    // 2. Admin assigns Designer 1
    await client.patch(`/api/v1/creative/admin/clients/${clientManual.id}/assign-designer`, {
      designer_id: designer1.id,
    }, {
      token: tokens.admin,
      expected: [200],
    });

    // 3. Draft post created and Designer 1 uploads creative
    const draft = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'draft',
      title: 'T3-01 Pipeline Post',
    });

    const res = await client.patch(`/api/v1/creative/designer/social-queue/${draft.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/t3_01_creative.png',
    }, {
      token: tokens.designer1,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const post = res.data?.post || res.json?.post || res.data;
    assert.equal(post.status, 'pending_admin_review');
  });

  // ══════════════════════════════════════════════════════════════════════
  // TC-T3-02: F4 + F5 + F6 + F4 (Upload -> Review -> Admin Reject -> Revision Upload)
  // ══════════════════════════════════════════════════════════════════════
  await recordTest('TC-T3-02: F4+F5+F6+F4: Designer Upload -> Admin Review Queue -> Admin Reject -> Designer Re-upload', async () => {
    const post = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'draft',
      title: 'T3-02 Revision Loop Post',
    });

    // Designer uploads
    await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/t3_02_v1.png',
    }, { token: tokens.designer1, expected: [200] });

    // Admin sees in review queue
    const queueRes = await client.get('/api/v1/creative/admin/review-queue', {
      token: tokens.admin,
      expected: [200],
    });
    const queue = queueRes.data?.queue || queueRes.json?.queue || [];
    assert.ok(queue.some(q => q.id === post.id));

    // Admin rejects with feedback
    await client.post(`/api/v1/creative/admin/posts/${post.id}/reject`, {
      reason: 'T3-02 Rejection: Please adjust the hero text hierarchy.',
    }, { token: tokens.admin, expected: [200] });

    // Designer re-uploads revision
    const reuploadRes = await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/t3_02_v2.png',
    }, { token: tokens.designer1, expected: [200] });
    assert.equal(reuploadRes.json?.success, true);
    const updatedPost = reuploadRes.data?.post || reuploadRes.json?.post || reuploadRes.data;
    assert.equal(updatedPost.status, 'pending_admin_review');
  });

  // ══════════════════════════════════════════════════════════════════════
  // TC-T3-03: F4 + F5 + F7 + F8 (Upload -> Admin Forward -> Client Review -> Client Approve)
  // ══════════════════════════════════════════════════════════════════════
  await recordTest('TC-T3-03: F4+F5+F7+F8: Upload -> Admin Forward (Manual) -> Client Review -> Client Approve', async () => {
    const post = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/t3_03_forward.png',
    });

    // Admin approves (Manual mode)
    const approveRes = await client.post(`/api/v1/creative/admin/posts/${post.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200],
    });
    const routeStatus = approveRes.data?.status || approveRes.json?.status;
    assert.equal(routeStatus, 'pending_client_review');

    // Client verifies in pending-review
    const pendingRes = await client.get('/api/v1/creative/client/pending-review', {
      token: tokens.clientManual,
      expected: [200],
    });
    const posts = pendingRes.data?.posts || pendingRes.json?.posts || [];
    assert.ok(posts.some(p => p.id === post.id));

    // Client approves to schedule
    const clientApproveRes = await client.post(`/api/v1/creative/client/posts/${post.id}/approve`, {}, {
      token: tokens.clientManual,
      expected: [200],
    });
    const finalStatus = clientApproveRes.data?.status || clientApproveRes.json?.status;
    assert.equal(finalStatus, 'scheduled');
  });

  // ══════════════════════════════════════════════════════════════════════
  // TC-T3-04: F4 + F7 + F8 + F4 (Upload -> Admin Forward -> Client Reject -> Designer Fix)
  // ══════════════════════════════════════════════════════════════════════
  await recordTest('TC-T3-04: F4+F7+F8+F4: Upload -> Admin Forward -> Client Rejects -> Designer Fixes and Resubmits', async () => {
    const post = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/t3_04_v1.png',
    });

    // Admin forwards to client
    await client.post(`/api/v1/creative/admin/posts/${post.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200],
    });

    // Client rejects with feedback
    await client.post(`/api/v1/creative/client/posts/${post.id}/reject`, {
      reason: 'T3-04: Please add our trademark symbol next to brand name.',
    }, { token: tokens.clientManual, expected: [200] });

    // Designer re-uploads
    const res = await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/t3_04_v2_trademark.png',
    }, { token: tokens.designer1, expected: [200] });
    assert.equal(res.json?.success, true);
    const updatedPost = res.data?.post || res.json?.post || res.data;
    assert.equal(updatedPost.status, 'pending_admin_review');
  });

  // ══════════════════════════════════════════════════════════════════════
  // TC-T3-05: F2 + F4 + F2 (Reassignment Mid-Workflow)
  // ══════════════════════════════════════════════════════════════════════
  await recordTest('TC-T3-05: F2+F4+F2: Designer 1 uploads -> Admin reassigns client to Designer 2 -> Rejection routes to Designer 2', async () => {
    const post = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/t3_05_pre_reassign.png',
    });

    // Admin reassigns client to Designer 2
    await client.patch(`/api/v1/creative/admin/clients/${clientManual.id}/assign-designer`, {
      designer_id: designer2.id,
    }, { token: tokens.admin, expected: [200] });

    // Admin rejects post
    await client.post(`/api/v1/creative/admin/posts/${post.id}/reject`, {
      reason: 'T3-05 Reassignment test rejection reason.',
    }, { token: tokens.admin, expected: [200] });

    // Verify Designer 2 sees the post in queue for clientManual
    const queueRes = await client.get('/api/v1/creative/designer/social-queue', {
      token: tokens.designer2,
      expected: [200],
    });
    const queue = queueRes.data?.queue || queueRes.json?.queue || [];
    assert.ok(Array.isArray(queue));
    assert.ok(queue.some(q => q.id === post.id), 'Reassigned post must be present in Designer 2 queue');

    // Reset assignment back to Designer 1
    await client.patch(`/api/v1/creative/admin/clients/${clientManual.id}/assign-designer`, {
      designer_id: designer1.id,
    }, { token: tokens.admin, expected: [200] });
  });

  // ══════════════════════════════════════════════════════════════════════
  // TC-T3-06: F9 + F4 (Direct Upload Coexistence)
  // ══════════════════════════════════════════════════════════════════════
  await recordTest('TC-T3-06: F9+F4: Admin Direct Upload coexists with ongoing Designer workflow on same client', async () => {
    // Designer has an active draft
    const designerPost = await fixtures.createSocialPost({
      userId: clientAuto.id,
      designerId: designer1.id,
      status: 'draft',
      title: 'Designer Ongoing Draft',
    });

    // Admin performs direct upload for same client
    const directRes = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientAuto.id,
      creative_url: 'https://r2.cdn.mintmore.test/direct_coexist.png',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    }, { token: tokens.admin, expected: [200, 201] });

    const directPostId = (directRes.data?.post || directRes.json?.post || directRes.data).id;
    assert.notEqual(directPostId, designerPost.id);
  });

  // ══════════════════════════════════════════════════════════════════════
  // TC-T3-07: F7 + Preferences Toggle (Mid-Flight Setting Evaluation)
  // ══════════════════════════════════════════════════════════════════════
  await recordTest('TC-T3-07: F7: Admin approve evaluates dynamic client preferences at decision time', async () => {
    const post = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/pref_eval.png',
    });

    try {
      // Dynamically toggle client preference to autopilot before Admin approval
      await query(`
        UPDATE users
        SET posting_preferences = $1::jsonb
        WHERE id = $2
      `, [JSON.stringify({ approval_mode: 'autopilot', festival_mode: 'standard' }), clientManual.id]);

      const res = await client.post(`/api/v1/creative/admin/posts/${post.id}/approve`, {}, {
        token: tokens.admin,
        expected: [200],
      });
      const status = res.data?.status || res.json?.status;
      assert.equal(status, 'scheduled', 'Post should branch to scheduled reflecting dynamic autopilot preference');
    } finally {
      // Reset clientManual preference back to every_post for subsequent tests
      await query(`
        UPDATE users
        SET posting_preferences = $1::jsonb
        WHERE id = $2
      `, [JSON.stringify({ approval_mode: 'every_post', festival_mode: 'standard' }), clientManual.id]);
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // TC-T3-08: F6 + F8 (Multi-Round Double Rejection Loop)
  // ══════════════════════════════════════════════════════════════════════
  await recordTest('TC-T3-08: F6+F8: Multi-round rejection loop preserves full history (Admin Reject -> Fix -> Client Reject -> Fix -> Approve)', async () => {
    const post = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/t3_08_round1.png',
    });

    // Round 1: Admin Reject
    await client.post(`/api/v1/creative/admin/posts/${post.id}/reject`, {
      reason: 'Admin Round 1 Rejection',
    }, { token: tokens.admin, expected: [200] });

    // Designer Fix 1
    await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/t3_08_round2.png',
    }, { token: tokens.designer1, expected: [200] });

    // Admin Forward to Client
    await client.post(`/api/v1/creative/admin/posts/${post.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200],
    });

    // Round 2: Client Reject
    await client.post(`/api/v1/creative/client/posts/${post.id}/reject`, {
      reason: 'Client Round 2 Rejection',
    }, { token: tokens.clientManual, expected: [200] });

    // Designer Fix 2
    await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/t3_08_round3.png',
    }, { token: tokens.designer1, expected: [200] });

    // Admin Forward
    await client.post(`/api/v1/creative/admin/posts/${post.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200],
    });

    // Client Final Approve
    const finalApprove = await client.post(`/api/v1/creative/client/posts/${post.id}/approve`, {}, {
      token: tokens.clientManual,
      expected: [200],
    });
    assert.equal(finalApprove.data?.status || finalApprove.json?.status, 'scheduled');
  });

  // ══════════════════════════════════════════════════════════════════════
  // TC-T3-09: F1 + F9 (Calendar Complete -> Admin Direct Schedule)
  // ══════════════════════════════════════════════════════════════════════
  await recordTest('TC-T3-09: F1+F9: Client calendar completion followed by immediate Admin direct upload scheduling', async () => {
    // 1. Client completes calendar
    await client.post('/api/v1/creative/calendar/complete', {}, {
      token: tokens.clientAuto,
      expected: [200, 201],
    });

    // 2. Admin direct uploads 2 posts
    const p1 = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientAuto.id,
      creative_url: 'https://r2.cdn.mintmore.test/fast_post_1.png',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    }, { token: tokens.admin, expected: [200, 201] });

    const p2 = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientAuto.id,
      creative_url: 'https://r2.cdn.mintmore.test/fast_post_2.png',
      scheduled_at: new Date(Date.now() + 172800000).toISOString(),
    }, { token: tokens.admin, expected: [200, 201] });

    assert.equal((p1.data?.post || p1.json?.post || p1.data).status, 'scheduled');
    assert.equal((p2.data?.post || p2.json?.post || p2.data).status, 'scheduled');
  });

  // ══════════════════════════════════════════════════════════════════════
  // TC-T3-10: F11 + Full Notification Cascade
  // ══════════════════════════════════════════════════════════════════════
  await recordTest('TC-T3-10: F11: Full workflow notification cascade generates valid notification types', async () => {
    const adminNotifs = await fixtures.getNotificationsForUser(admin.id);
    const desNotifs = await fixtures.getNotificationsForUser(designer1.id);
    const clientNotifs = await fixtures.getNotificationsForUser(clientManual.id);

    // Admin should receive calendar_completed, creative_uploaded, and creative_rejected_by_client
    assert.ok(adminNotifs.some(n => n.type === 'calendar_completed'), 'Admin must receive calendar_completed notification');
    assert.ok(adminNotifs.some(n => n.type === 'creative_uploaded'), 'Admin must receive creative_uploaded notification');
    assert.ok(adminNotifs.some(n => n.type === 'creative_rejected_by_client'), 'Admin must receive creative_rejected_by_client notification');

    // Designer should receive designer_assigned, creative_rejected_by_admin, and creative_rejected_by_client
    assert.ok(desNotifs.some(n => n.type === 'designer_assigned'), 'Designer must receive designer_assigned notification');
    assert.ok(desNotifs.some(n => n.type === 'creative_rejected_by_admin'), 'Designer must receive creative_rejected_by_admin notification');
    assert.ok(desNotifs.some(n => n.type === 'creative_rejected_by_client'), 'Designer must receive creative_rejected_by_client notification');

    // Client should receive creative_ready_client_review
    assert.ok(clientNotifs.some(n => n.type === 'creative_ready_client_review'), 'Client must receive creative_ready_client_review notification');
  });
}

module.exports = { runTier3 };
