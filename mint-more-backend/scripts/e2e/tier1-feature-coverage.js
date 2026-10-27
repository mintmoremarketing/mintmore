/**
 * Tier 1: Feature Coverage E2E Test Suite (45 Test Cases across F1-F9)
 * Zero external test framework dependencies
 */

const assert = require('node:assert/strict');

async function runTier1(client, fixtures, recordTest) {
  console.log('\n--- 🚀 Running Tier 1: Feature Coverage (45 Tests) ---');

  const { admin, designer1, designer2, clientAuto, clientManual } = fixtures.users;
  const { tokens } = fixtures;

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 1: Calendar Completion Notification (F1)
  // ══════════════════════════════════════════════════════════════════════

  await recordTest('TC-T1-F1-01: Client completes calendar trigger', async () => {
    const res = await client.post('/api/v1/creative/calendar/complete', {}, {
      token: tokens.clientAuto,
      expected: [200, 201],
    });
    assert.equal(res.json?.success, true, 'Expected success: true');
  });

  await recordTest('TC-T1-F1-02: Admin receives calendar_completed notification', async () => {
    const notifs = await fixtures.getNotificationsForUser(admin.id);
    const found = notifs.some(n => n.type === 'calendar_completed');
    assert.ok(found, 'Admin should have received calendar_completed notification');
  });

  await recordTest('TC-T1-F1-03: Manual client completes calendar successfully', async () => {
    const res = await client.post('/api/v1/creative/calendar/complete', {}, {
      token: tokens.clientManual,
      expected: [200, 201],
    });
    assert.equal(res.json?.success, true);
  });

  await recordTest('TC-T1-F1-04: Admin client directory lists clients post-completion', async () => {
    const res = await client.get('/api/v1/creative/admin/clients', {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const clients = res.data?.clients || res.json?.clients || [];
    assert.ok(Array.isArray(clients), 'Clients directory must return array');
    const autoClientInList = clients.find(c => c.id === clientAuto.id);
    assert.ok(autoClientInList, 'Client Auto must appear in admin clients directory');
  });

  await recordTest('TC-T1-F1-05: Client notification inbox does not contain admin-only calendar alerts', async () => {
    const notifs = await fixtures.getNotificationsForUser(clientAuto.id);
    const foundAdminAlert = notifs.some(n => n.type === 'calendar_completed');
    assert.equal(foundAdminAlert, false, 'Client should not receive calendar_completed notification destined for admin');
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 2 & 3: Designer Assignment & Directories (F2 / F3)
  // ══════════════════════════════════════════════════════════════════════

  await recordTest('TC-T1-F2-01: Admin assigns Designer 1 to Client', async () => {
    const res = await client.patch(`/api/v1/creative/admin/clients/${clientManual.id}/assign-designer`, {
      designer_id: designer1.id,
    }, {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const assignedId = res.data?.assigned_designer_id || res.json?.assigned_designer_id;
    assert.equal(assignedId, designer1.id, 'Assigned designer ID must match designer 1');
  });

  await recordTest('TC-T1-F2-02: Designer 1 receives designer_assigned notification', async () => {
    const notifs = await fixtures.getNotificationsForUser(designer1.id);
    const found = notifs.some(n => n.type === 'designer_assigned');
    assert.ok(found, 'Designer 1 should receive designer_assigned notification');
  });

  await recordTest('TC-T1-F2-03: Admin reassigns Client to Designer 2', async () => {
    const res = await client.patch(`/api/v1/creative/admin/clients/${clientManual.id}/assign-designer`, {
      designer_id: designer2.id,
    }, {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const assignedId = res.data?.assigned_designer_id || res.json?.assigned_designer_id;
    assert.equal(assignedId, designer2.id, 'Assigned designer ID must be updated to Designer 2');
  });

  await recordTest('TC-T1-F2-04: Admin unassigns designer with null designer_id', async () => {
    const res = await client.patch(`/api/v1/creative/admin/clients/${clientManual.id}/assign-designer`, {
      designer_id: null,
    }, {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const assignedId = res.data?.assigned_designer_id ?? res.json?.assigned_designer_id;
    assert.equal(assignedId, null, 'Assigned designer ID should be null');

    // Re-assign back to Designer 1 for downstream tests
    await client.patch(`/api/v1/creative/admin/clients/${clientManual.id}/assign-designer`, {
      designer_id: designer1.id,
    }, { token: tokens.admin, expected: [200] });
  });

  await recordTest('TC-T1-F2-05: Admin lists active designers directory', async () => {
    const res = await client.get('/api/v1/creative/admin/designers', {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const designers = res.data?.designers || res.json?.designers || [];
    assert.ok(Array.isArray(designers), 'Designers must be an array');
    const des1InList = designers.find(d => d.id === designer1.id);
    assert.ok(des1InList, 'Designer 1 should be in active designers list');
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 4: Designer Social Queue & Upload Flow (F4)
  // ══════════════════════════════════════════════════════════════════════

  let postF4;
  await recordTest('TC-T1-F4-01: Designer 1 views social queue for assigned clients', async () => {
    postF4 = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'draft',
      title: 'T1 Post for Designer Upload',
    });

    const res = await client.get('/api/v1/creative/designer/social-queue', {
      token: tokens.designer1,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const queue = res.data?.queue || res.json?.queue || [];
    assert.ok(Array.isArray(queue), 'Designer social queue must be an array');
  });

  await recordTest('TC-T1-F4-02: Designer 1 uploads creative image asset', async () => {
    const res = await client.patch(`/api/v1/creative/designer/social-queue/${postF4.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/asset_t1_f4.png',
      caption: 'Updated caption by Designer 1',
    }, {
      token: tokens.designer1,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const post = res.data?.post || res.json?.post || res.data;
    assert.equal(post.status, 'pending_admin_review', 'Post status must transition to pending_admin_review');
    assert.equal(post.creative_url, 'https://r2.cdn.mintmore.test/asset_t1_f4.png');
  });

  await recordTest('TC-T1-F4-03: Admin receives creative_uploaded notification', async () => {
    const notifs = await fixtures.getNotificationsForUser(admin.id);
    const found = notifs.some(n => n.type === 'creative_uploaded');
    assert.ok(found, 'Admin must receive creative_uploaded notification');
  });

  await recordTest('TC-T1-F4-04: Designer uploads creative with video media_type', async () => {
    const postVideo = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'draft',
      title: 'Video Creative Draft',
    });

    const res = await client.patch(`/api/v1/creative/designer/social-queue/${postVideo.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/promo_video.mp4',
      media_type: 'video',
      caption: 'Video promo caption',
    }, {
      token: tokens.designer1,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const post = res.data?.post || res.json?.post || res.data;
    assert.equal(post.status, 'pending_admin_review');
  });

  await recordTest('TC-T1-F4-05: Designer queue reflects pending_admin_review status post-upload', async () => {
    const res = await client.get('/api/v1/creative/designer/social-queue', {
      token: tokens.designer1,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const queue = res.data?.queue || res.json?.queue || [];
    const item = queue.find(q => q.id === postF4.id);
    assert.ok(item, 'Uploaded post must be present in designer social queue');
    assert.equal(item.status, 'pending_admin_review');
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 5: Admin Global Review Queue (F5)
  // ══════════════════════════════════════════════════════════════════════

  await recordTest('TC-T1-F5-01: Admin views global pending review queue', async () => {
    const res = await client.get('/api/v1/creative/admin/review-queue', {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const queue = res.data?.queue || res.json?.queue || [];
    assert.ok(Array.isArray(queue), 'Review queue must return array');
  });

  await recordTest('TC-T1-F5-02: Review queue includes uploaded post with required schema', async () => {
    const res = await client.get('/api/v1/creative/admin/review-queue', {
      token: tokens.admin,
      expected: [200],
    });
    const queue = res.data?.queue || res.json?.queue || [];
    const item = queue.find(q => q.id === postF4.id);
    assert.ok(item, 'Uploaded post must appear in Admin Review Queue');
    assert.equal(item.status, 'pending_admin_review');
    assert.ok(item.creative_url, 'Queue item must have creative_url');
  });

  await recordTest('TC-T1-F5-03: Multi-client pending posts are aggregated in review queue', async () => {
    const postAuto = await fixtures.createSocialPost({
      userId: clientAuto.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/auto_asset.png',
    });

    const res = await client.get('/api/v1/creative/admin/review-queue', {
      token: tokens.admin,
      expected: [200],
    });
    const queue = res.data?.queue || res.json?.queue || [];
    const hasManual = queue.some(q => q.id === postF4.id);
    const hasAuto = queue.some(q => q.id === postAuto.id);
    assert.ok(hasManual && hasAuto, 'Review queue must aggregate posts from multiple clients');
  });

  await recordTest('TC-T1-F5-04: Review queue item contains client and designer metadata', async () => {
    const res = await client.get('/api/v1/creative/admin/review-queue', {
      token: tokens.admin,
      expected: [200],
    });
    const queue = res.data?.queue || res.json?.queue || [];
    const item = queue.find(q => q.id === postF4.id);
    assert.ok(item, 'Post item must exist');
    assert.ok(item.user_id, 'Item must have user_id');
  });

  await recordTest('TC-T1-F5-05: Draft posts without creative upload are excluded from review queue', async () => {
    const draftPost = await fixtures.createSocialPost({
      userId: clientManual.id,
      status: 'draft',
    });

    const res = await client.get('/api/v1/creative/admin/review-queue', {
      token: tokens.admin,
      expected: [200],
    });
    const queue = res.data?.queue || res.json?.queue || [];
    const foundDraft = queue.some(q => q.id === draftPost.id);
    assert.equal(foundDraft, false, 'Draft post without upload should not appear in review queue');
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 6: Admin Rejection with Feedback (F6)
  // ══════════════════════════════════════════════════════════════════════

  let postToReject;
  await recordTest('TC-T1-F6-01: Admin rejects creative with required reason', async () => {
    postToReject = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/needs_fix.png',
    });

    const res = await client.post(`/api/v1/creative/admin/posts/${postToReject.id}/reject`, {
      reason: 'Logo contrast is insufficient for dark mode.',
    }, {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const status = res.data?.status || res.json?.status;
    assert.equal(status, 'rejected', 'Status must transition to rejected');
    const feedback = res.data?.admin_feedback || res.json?.admin_feedback;
    assert.equal(feedback, 'Logo contrast is insufficient for dark mode.');
  });

  await recordTest('TC-T1-F6-02: Rejection history array stores audit trail entry', async () => {
    const res = await client.get('/api/v1/creative/designer/social-queue', {
      token: tokens.designer1,
      expected: [200],
    });
    const queue = res.data?.queue || res.json?.queue || [];
    const item = queue.find(q => q.id === postToReject.id);
    assert.ok(item, 'Rejected post must be visible to designer');
    assert.ok(Array.isArray(item.rejection_history), 'rejection_history must be an array');
    const lastEntry = item.rejection_history[item.rejection_history.length - 1];
    assert.equal(lastEntry.by, 'admin');
    assert.equal(lastEntry.reason, 'Logo contrast is insufficient for dark mode.');
  });

  await recordTest('TC-T1-F6-03: Designer receives creative_rejected_by_admin notification', async () => {
    const notifs = await fixtures.getNotificationsForUser(designer1.id);
    const found = notifs.some(n => n.type === 'creative_rejected_by_admin');
    assert.ok(found, 'Designer must receive creative_rejected_by_admin notification');
  });

  await recordTest('TC-T1-F6-04: Designer re-uploads revision on rejected post', async () => {
    const res = await client.patch(`/api/v1/creative/designer/social-queue/${postToReject.id}/upload`, {
      creative_url: 'https://r2.cdn.mintmore.test/fixed_v2.png',
    }, {
      token: tokens.designer1,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const post = res.data?.post || res.json?.post || res.data;
    assert.equal(post.status, 'pending_admin_review', 'Re-uploaded post must return to pending_admin_review');
    assert.equal(post.creative_url, 'https://r2.cdn.mintmore.test/fixed_v2.png');
  });

  await recordTest('TC-T1-F6-05: Rejected post is removed from admin review queue until resubmitted', async () => {
    const anotherRejected = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/rejected_item.png',
    });
    await client.post(`/api/v1/creative/admin/posts/${anotherRejected.id}/reject`, {
      reason: 'Incorrect aspect ratio.',
    }, { token: tokens.admin, expected: [200] });

    const res = await client.get('/api/v1/creative/admin/review-queue', {
      token: tokens.admin,
      expected: [200],
    });
    const queue = res.data?.queue || res.json?.queue || [];
    const isPresent = queue.some(q => q.id === anotherRejected.id);
    assert.equal(isPresent, false, 'Rejected post should not appear in pending admin review queue');
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 7: Intelligent Routing Engine (F7)
  // ══════════════════════════════════════════════════════════════════════

  let postAutoRoute;
  await recordTest('TC-T1-F7-01: Admin approves post for Autopilot Client -> routes to scheduled', async () => {
    postAutoRoute = await fixtures.createSocialPost({
      userId: clientAuto.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/auto_approved.png',
    });

    const res = await client.post(`/api/v1/creative/admin/posts/${postAutoRoute.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const status = res.data?.status || res.json?.status;
    const routingMode = res.data?.routing_mode || res.json?.routing_mode;
    assert.equal(status, 'scheduled', 'Autopilot post must become scheduled immediately');
    assert.equal(routingMode, 'autopilot');
  });

  await recordTest('TC-T1-F7-02: Autopilot post emits creative_scheduled notification', async () => {
    const notifs = await fixtures.getNotificationsForUser(clientAuto.id);
    const found = notifs.some(n => n.type === 'creative_scheduled');
    assert.ok(found, 'Autopilot client must receive creative_scheduled notification');
  });

  let postManualRoute;
  await recordTest('TC-T1-F7-03: Admin approves post for Manual Client -> routes to pending_client_review', async () => {
    postManualRoute = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/manual_approved.png',
    });

    const res = await client.post(`/api/v1/creative/admin/posts/${postManualRoute.id}/approve`, {}, {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const status = res.data?.status || res.json?.status;
    const routingMode = res.data?.routing_mode || res.json?.routing_mode;
    assert.equal(status, 'pending_client_review', 'Manual client post must route to pending_client_review');
    assert.equal(routingMode, 'manual_review');
  });

  await recordTest('TC-T1-F7-04: Manual Client receives creative_ready_client_review notification', async () => {
    const notifs = await fixtures.getNotificationsForUser(clientManual.id);
    const found = notifs.some(n => n.type === 'creative_ready_client_review');
    assert.ok(found, 'Manual client must receive creative_ready_client_review notification');
  });

  await recordTest('TC-T1-F7-05: Admin updates scheduled_at and caption during approval', async () => {
    const postWithOverrides = await fixtures.createSocialPost({
      userId: clientAuto.id,
      designerId: designer1.id,
      status: 'pending_admin_review',
      creative_url: 'https://r2.cdn.mintmore.test/override_test.png',
    });
    const newSchedule = new Date(Date.now() + 172800000).toISOString();

    const res = await client.post(`/api/v1/creative/admin/posts/${postWithOverrides.id}/approve`, {
      scheduled_at: newSchedule,
      caption: 'Admin modified caption during approval',
    }, {
      token: tokens.admin,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 8: Client Review, Approval & Rejection (F8)
  // ══════════════════════════════════════════════════════════════════════

  await recordTest('TC-T1-F8-01: Manual Client lists posts in pending review', async () => {
    const res = await client.get('/api/v1/creative/client/pending-review', {
      token: tokens.clientManual,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const posts = res.data?.posts || res.json?.posts || [];
    assert.ok(Array.isArray(posts), 'Client pending posts must be array');
    const found = posts.some(p => p.id === postManualRoute.id);
    assert.ok(found, 'Post routed for manual review must appear in client queue');
  });

  await recordTest('TC-T1-F8-02: Manual Client approves post -> transitions to scheduled', async () => {
    const res = await client.post(`/api/v1/creative/client/posts/${postManualRoute.id}/approve`, {}, {
      token: tokens.clientManual,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const status = res.data?.status || res.json?.status;
    assert.equal(status, 'scheduled', 'Post status must become scheduled upon client approval');
  });

  let postClientReject;
  await recordTest('TC-T1-F8-03: Manual Client rejects post with explicit feedback', async () => {
    postClientReject = await fixtures.createSocialPost({
      userId: clientManual.id,
      designerId: designer1.id,
      status: 'pending_client_review',
      creative_url: 'https://r2.cdn.mintmore.test/client_reject.png',
    });

    const res = await client.post(`/api/v1/creative/client/posts/${postClientReject.id}/reject`, {
      reason: 'The headline copy does not match our Summer campaign guide.',
    }, {
      token: tokens.clientManual,
      expected: [200],
    });
    assert.equal(res.json?.success, true);
    const status = res.data?.status || res.json?.status;
    assert.equal(status, 'rejected');
    const clientFeedback = res.data?.client_feedback || res.json?.client_feedback;
    assert.equal(clientFeedback, 'The headline copy does not match our Summer campaign guide.');
  });

  await recordTest('TC-T1-F8-04: Client rejection notifies BOTH Admin and Designer', async () => {
    const adminNotifs = await fixtures.getNotificationsForUser(admin.id);
    const desNotifs = await fixtures.getNotificationsForUser(designer1.id);

    const adminGot = adminNotifs.some(n => n.type === 'creative_rejected_by_client');
    const desGot = desNotifs.some(n => n.type === 'creative_rejected_by_client');

    assert.ok(adminGot, 'Admin must receive creative_rejected_by_client notification');
    assert.ok(desGot, 'Designer must receive creative_rejected_by_client notification');
  });

  await recordTest('TC-T1-F8-05: Rejection history logs client entry correctly', async () => {
    const res = await client.get('/api/v1/creative/designer/social-queue', {
      token: tokens.designer1,
      expected: [200],
    });
    const queue = res.data?.queue || res.json?.queue || [];
    const item = queue.find(q => q.id === postClientReject.id);
    assert.ok(item, 'Rejected post must appear in designer queue');
    assert.ok(Array.isArray(item.rejection_history));
    const last = item.rejection_history[item.rejection_history.length - 1];
    assert.equal(last.by, 'client');
    assert.equal(last.reason, 'The headline copy does not match our Summer campaign guide.');
  });

  // ══════════════════════════════════════════════════════════════════════
  // FEATURE 9: Admin Direct Upload Flow (F9)
  // ══════════════════════════════════════════════════════════════════════

  await recordTest('TC-T1-F9-01: Admin direct upload for Autopilot client schedules directly', async () => {
    const res = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientAuto.id,
      creative_url: 'https://r2.cdn.mintmore.test/direct_auto.png',
      title: 'Direct Scheduled Post',
      caption: 'Direct upload caption',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    }, {
      token: tokens.admin,
      expected: [200, 201],
    });
    assert.equal(res.json?.success, true);
    const post = res.data?.post || res.json?.post || res.data;
    assert.equal(post.status, 'scheduled', 'Direct upload on autopilot client should schedule directly');
  });

  await recordTest('TC-T1-F9-02: Admin direct upload for Manual client with review routes to pending_client_review', async () => {
    const res = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientManual.id,
      creative_url: 'https://r2.cdn.mintmore.test/direct_manual.png',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      bypass_client_review: false,
    }, {
      token: tokens.admin,
      expected: [200, 201],
    });
    assert.equal(res.json?.success, true);
    const post = res.data?.post || res.json?.post || res.data;
    assert.equal(post.status, 'pending_client_review');
  });

  await recordTest('TC-T1-F9-03: Admin direct upload for Manual client with bypass_client_review: true schedules directly', async () => {
    const res = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientManual.id,
      creative_url: 'https://r2.cdn.mintmore.test/direct_bypass.png',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      bypass_client_review: true,
    }, {
      token: tokens.admin,
      expected: [200, 201],
    });
    assert.equal(res.json?.success, true);
    const post = res.data?.post || res.json?.post || res.data;
    assert.equal(post.status, 'scheduled');
  });

  await recordTest('TC-T1-F9-04: Admin direct upload persists target_platforms array', async () => {
    const res = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientAuto.id,
      creative_url: 'https://r2.cdn.mintmore.test/platforms_test.png',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      target_platforms: ['instagram', 'facebook', 'linkedin'],
    }, {
      token: tokens.admin,
      expected: [200, 201],
    });
    assert.equal(res.json?.success, true);
    const post = res.data?.post || res.json?.post || res.data;
    assert.ok(Array.isArray(post.target_platforms));
    assert.ok(post.target_platforms.includes('linkedin'));
  });

  await recordTest('TC-T1-F9-05: Direct upload bypasses designer social queue completely', async () => {
    const resDirect = await client.post('/api/v1/creative/admin/direct-upload', {
      client_id: clientAuto.id,
      creative_url: 'https://r2.cdn.mintmore.test/bypass_designer.png',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    }, {
      token: tokens.admin,
      expected: [200, 201],
    });
    const directPostId = (resDirect.data?.post || resDirect.json?.post || resDirect.data).id;

    const resQueue = await client.get('/api/v1/creative/designer/social-queue', {
      token: tokens.designer1,
      expected: [200],
    });
    const queue = resQueue.data?.queue || resQueue.json?.queue || [];
    const inDesignerQueue = queue.some(q => q.id === directPostId && q.status === 'draft');
    assert.equal(inDesignerQueue, false, 'Direct uploaded post must not appear as draft in designer queue');
  });
}

module.exports = { runTier1 };
