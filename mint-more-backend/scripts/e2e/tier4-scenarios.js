/**
 * Tier 4: Real-World Multi-Actor Scenarios (Acceptance Criteria A1 - A5)
 * Zero external test framework dependencies
 */

const assert = require('node:assert/strict');

async function runScenarioA1(client, fixtures, recordTest) {
  console.log('\n--- 📬 Running Scenario A1: Notifications Verification ---');
  const { admin, designer1, clientManual } = fixtures.users;
  const { tokens } = fixtures;

  await recordTest('Scenario A1: Notifications Verification (Lifecycle from Completion -> Upload -> Dual Rejections)', async () => {
    // 1. Client Completes Calendar -> Admin Notification
    await client.post('/api/v1/creative/calendar/complete', {}, {
      token: tokens.clientManual,
      expected: [200, 201],
    });
    const adminNotifs1 = await fixtures.getNotificationsForUser(admin.id);
    assert.ok(adminNotifs1.some(n => n.type === 'calendar_completed'), 'Admin must receive calendar_completed notification');

    // 2. Admin Assigns Designer -> Designer Notification
    await client.patch(`/api/v1/creative/admin/clients/${clientManual.id}/assign-designer`, {
      designer_id: designer1.id,
    }, { token: tokens.admin, expected: [200] });
    const desNotifs1 = await fixtures.getNotificationsForUser(designer1.id);
    assert.ok(desNotifs1.some(n => n.type === 'designer_assigned'), 'Designer must receive designer_assigned notification');

    // 3. Designer Uploads Creative -> Admin Notification
    const post = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'draft',
      title: 'A1 Notif Post',
    });
    await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/a1_upload.png',
    }, { token: tokens.designer1, expected: [200] });
    const adminNotifs2 = await fixtures.getNotificationsForUser(admin.id);
    assert.ok(adminNotifs2.some(n => n.type === 'creative_uploaded'), 'Admin must receive creative_uploaded notification');

    // 4. Admin Rejection -> Designer Notification
    await client.post(`/api/v1/creative/admin/posts/${post.id}/reject`, {
      reason: 'A1 Admin Rejection Notice',
    }, { token: tokens.admin, expected: [200] });
    const desNotifs2 = await fixtures.getNotificationsForUser(designer1.id);
    assert.ok(desNotifs2.some(n => n.type === 'creative_rejected_by_admin'), 'Designer must receive creative_rejected_by_admin notification');

    // 5. Designer Re-uploads & Admin Forwards -> Client Notification
    await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/a1_v2.png',
    }, { token: tokens.designer1, expected: [200] });
    await client.post(`/api/v1/creative/admin/posts/${post.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200],
    });
    const clientNotifs1 = await fixtures.getNotificationsForUser(clientManual.id);
    assert.ok(clientNotifs1.some(n => n.type === 'creative_ready_client_review'), 'Client must receive creative_ready_client_review notification');

    // 6. Client Rejection -> BOTH Admin and Designer Notifications
    await client.post(`/api/v1/creative/client/posts/${post.id}/reject`, {
      reason: 'A1 Client Feedback: Font size too small.',
    }, { token: tokens.clientManual, expected: [200] });

    const adminNotifs3 = await fixtures.getNotificationsForUser(admin.id);
    const desNotifs3 = await fixtures.getNotificationsForUser(designer1.id);
    assert.ok(adminNotifs3.some(n => n.type === 'creative_rejected_by_client'), 'Admin must receive creative_rejected_by_client notification');
    assert.ok(desNotifs3.some(n => n.type === 'creative_rejected_by_client'), 'Designer must receive creative_rejected_by_client notification');
  });
}

async function runScenarioA2(client, fixtures, recordTest) {
  console.log('\n--- 📋 Running Scenario A2: Review Queue Verification ---');
  const { admin, designer1, designer2, clientAuto, clientManual } = fixtures.users;
  const { tokens } = fixtures;

  await recordTest('Scenario A2: Review Queue Verification (Global queue multi-client and multi-designer aggregation)', async () => {
    // 1. Designer 1 uploads for Client Manual
    const post1 = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'draft',
      title: 'A2 Client 1 Post',
    });
    await client.patch(`/api/v1/creative/designer/social-queue/${post1.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/a2_post1.png',
    }, { token: tokens.designer1, expected: [200] });

    // 2. Designer 2 uploads for Client Auto
    const post2 = await fixtures.createSocialPost({
      userId: clientAuto.id,
      designerId: designer2.id,
      status: 'draft',
      title: 'A2 Client 2 Post',
    });
    await client.patch(`/api/v1/creative/designer/social-queue/${post2.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/a2_post2.png',
    }, { token: tokens.designer2, expected: [200] });

    // 3. Admin queries Review Queue
    const res = await client.get('/api/v1/creative/admin/review-queue', {
      token: tokens.admin,
      expected: [200],
    });
    const queue = res.data?.queue || res.json?.queue || [];
    assert.ok(Array.isArray(queue));

    const item1 = queue.find(q => q.id === post1.id);
    const item2 = queue.find(q => q.id === post2.id);

    assert.ok(item1, 'Post 1 must be present in Admin Review Queue');
    assert.ok(item2, 'Post 2 must be present in Admin Review Queue');
    assert.equal(item1.status, 'pending_admin_review');
    assert.equal(item2.status, 'pending_admin_review');
  });
}

async function runScenarioA3(client, fixtures, recordTest) {
  console.log('\n--- 💬 Running Scenario A3: Rejection Feedback Loops ---');
  const { admin, designer1, clientManual } = fixtures.users;
  const { tokens } = fixtures;

  await recordTest('Scenario A3: Rejection Feedback Loops (Audit Trail & Exact Text Preservation)', async () => {
    const adminFeedbackText = 'A3 Admin Feedback: Please use standard padding of 32px and darker contrast.';
    const clientFeedbackText = 'A3 Client Feedback: Change the primary product photo to the blue variation.';

    const post = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'draft',
      title: 'A3 Feedback Loop Post',
    });

    // Step 1: Designer Uploads
    await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/a3_v1.png',
    }, { token: tokens.designer1, expected: [200] });

    // Step 2: Admin Rejection with text feedback
    const adminRejectRes = await client.post(`/api/v1/creative/admin/posts/${post.id}/reject`, {
      reason: adminFeedbackText,
    }, { token: tokens.admin, expected: [200] });
    assert.equal(adminRejectRes.data?.admin_feedback || adminRejectRes.json?.admin_feedback, adminFeedbackText);

    // Designer views exact feedback in queue
    const desQueueRes1 = await client.get('/api/v1/creative/designer/social-queue', {
      token: tokens.designer1,
      expected: [200],
    });
    const queue1 = desQueueRes1.data?.queue || desQueueRes1.json?.queue || [];
    const itemAfterAdminReject = queue1.find(q => q.id === post.id);
    assert.ok(itemAfterAdminReject, 'Rejected post must appear in designer queue');
    assert.equal(itemAfterAdminReject.admin_feedback, adminFeedbackText);

    // Step 3: Designer fixes and re-uploads
    await client.patch(`/api/v1/creative/designer/social-queue/${post.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/a3_v2.png',
    }, { token: tokens.designer1, expected: [200] });

    // Step 4: Admin approves (routes to client review)
    await client.post(`/api/v1/creative/admin/posts/${post.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200],
    });

    // Step 5: Client Rejection with text feedback
    const clientRejectRes = await client.post(`/api/v1/creative/client/posts/${post.id}/reject`, {
      reason: clientFeedbackText,
    }, { token: tokens.clientManual, expected: [200] });
    assert.equal(clientRejectRes.data?.client_feedback || clientRejectRes.json?.client_feedback, clientFeedbackText);

    // Designer views exact client feedback
    const desQueueRes2 = await client.get('/api/v1/creative/designer/social-queue', {
      token: tokens.designer1,
      expected: [200],
    });
    const queue2 = desQueueRes2.data?.queue || desQueueRes2.json?.queue || [];
    const itemAfterClientReject = queue2.find(q => q.id === post.id);
    assert.ok(itemAfterClientReject);
    assert.equal(itemAfterClientReject.client_feedback, clientFeedbackText);

    // Step 6: Verify full rejection_history chronological array
    const history = itemAfterClientReject.rejection_history || [];
    assert.ok(history.length >= 2, 'Rejection history must contain at least 2 entries');
    assert.equal(history[0].by, 'admin');
    assert.equal(history[0].reason, adminFeedbackText);
    assert.equal(history[1].by, 'client');
    assert.equal(history[1].reason, clientFeedbackText);
  });
}

async function runScenarioA4(client, fixtures, recordTest) {
  console.log('\n--- 🔀 Running Scenario A4: Intelligent Routing Engine ---');
  const { admin, designer1, clientAuto, clientManual } = fixtures.users;
  const { tokens } = fixtures;

  await recordTest('Scenario A4: Intelligent Routing Engine (Autopilot vs Manual Branching)', async () => {
    // 1. Autopilot Branch
    const autoPost = await fixtures.createSocialPost({
      userId: clientAuto.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/a4_auto.png',
    });

    const autoRes = await client.post(`/api/v1/creative/admin/posts/${autoPost.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(autoRes.data?.status || autoRes.json?.status, 'scheduled', 'Autopilot post must become scheduled directly');
    assert.equal(autoRes.data?.routing_mode || autoRes.json?.routing_mode, 'autopilot');

    // 2. Manual Review Branch
    const manualPost = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/a4_manual.png',
    });

    const manualRes = await client.post(`/api/v1/creative/admin/posts/${manualPost.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(manualRes.data?.status || manualRes.json?.status, 'pending_client_review', 'Manual client post must route to pending_client_review');
    assert.equal(manualRes.data?.routing_mode || manualRes.json?.routing_mode, 'manual_review');

    // 3. Client approves Manual Post -> Transitions to scheduled
    const clientApproveRes = await client.post(`/api/v1/creative/client/posts/${manualPost.id}/approve`, {}, {
      token: tokens.clientManual,
      expected: [200],
    });
    assert.equal(clientApproveRes.data?.status || clientApproveRes.json?.status, 'scheduled');
  });
}

async function runScenarioA5(client, fixtures, recordTest) {
  console.log('\n--- ⚡ Running Scenario A5: Admin Direct Upload ---');
  const { admin, clientManual } = fixtures.users;
  const { tokens } = fixtures;

  await recordTest('Scenario A5: Admin Direct Upload (Bypasses Designer Queue Directly to Client Calendar)', async () => {
    const scheduledDate = new Date(Date.now() + 86400000).toISOString();
    const res = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientManual.id,
      creative_url: 'https://r2.cdn.mintmore.test/a5_direct.png',
      title: 'A5 Direct Post',
      caption: 'Direct upload bypassing designer queue',
      scheduled_at: scheduledDate,
      bypass_client_review: true,
      target_platforms: ['instagram', 'facebook', 'linkedin'],
    }, {
      token: tokens.admin,
      expected: [200, 201],
    });

    assert.equal(res.json?.success, true);
    const post = res.data?.post || res.json?.post || res.data;
    assert.equal(post.status, 'scheduled', 'Direct upload with bypass must create scheduled post');
    assert.equal(post.user_id, clientManual.id);
    assert.equal(post.creative_url, 'https://r2.cdn.mintmore.test/a5_direct.png');
  });
}

async function runTier4(client, fixtures, recordTest) {
  console.log('\n--- 🌟 Running Tier 4: Real-World Acceptance Scenarios (A1-A5) ---');
  await runScenarioA1(client, fixtures, recordTest);
  await runScenarioA2(client, fixtures, recordTest);
  await runScenarioA3(client, fixtures, recordTest);
  await runScenarioA4(client, fixtures, recordTest);
  await runScenarioA5(client, fixtures, recordTest);
}

module.exports = {
  runTier4,
  runScenarioA1,
  runScenarioA2,
  runScenarioA3,
  runScenarioA4,
  runScenarioA5,
};
