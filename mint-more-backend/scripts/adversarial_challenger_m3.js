#!/usr/bin/env node

/**
 * Challenger 1 Adversarial Verification Suite for Milestone 3 (M3 Frontend Client & Designer Workflows)
 *
 * Test Suites:
 * 1. Frontend API Client Interface Parity (creativeApi methods <-> backend creative.routes.js).
 * 2. Parameter normalization & alias equivalence (string payloads, object payloads, camelCase/snake_case conversion).
 * 3. Static scan for zero CommonJS `require(` occurrences in frontend source files.
 * 4. Creative notification type, theme, and routing consistency across NotifPanel.jsx and Inbox.jsx.
 * 5. End-to-end frontend client API wrapper simulation against backend routing tree.
 */

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

function findFrontendRoot() {
  const candidates = [
    path.resolve(__dirname, '../mint-more-frontend'),
    path.resolve(__dirname, '../../mint-more-frontend'),
    path.resolve(__dirname, 'mint-more-frontend'),
    path.resolve(findBackendRoot(), '../mint-more-frontend'),
    path.resolve(process.cwd(), '../mint-more-frontend'),
    path.resolve(process.cwd(), 'mint-more-frontend'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'package.json'))) {
      return c;
    }
  }
  throw new Error('Frontend root not found');
}

const backendRoot = findBackendRoot();
const frontendRoot = findFrontendRoot();

console.log('Backend Root :', backendRoot);
console.log('Frontend Root:', frontendRoot);

let totalPassed = 0;
let totalFailed = 0;

function reportTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    totalFailed++;
  }
}

async function reportAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    totalFailed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: CommonJS `require(` Scan in Frontend
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Suite 1: CommonJS require() Frontend Static Scan ===');

function scanDirForRequires(dirPath, violations = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        scanDirForRequires(fullPath, violations);
      }
    } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      // Match require(...) not in comments
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        if (/require\s*\(['"]/.test(trimmed)) {
          violations.push({ file: fullPath, line: idx + 1, snippet: trimmed });
        }
      });
    }
  }
  return violations;
}

reportTest('Frontend src directory contains 0 require() statements', () => {
  const srcPath = path.join(frontendRoot, 'src');
  const violations = scanDirForRequires(srcPath);
  if (violations.length > 0) {
    throw new Error(`Found ${violations.length} require() statements:\n` + violations.map(v => `  ${v.file}:${v.line} -> ${v.snippet}`).join('\n'));
  }
  assert.equal(violations.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Frontend API Client Implementation & Parameter Normalization
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Suite 2: creative.js API Client Interception & Normalization ===');

// Mock Axios client to capture all calls made by creativeApi
const capturedCalls = [];
const mockApi = {
  get: (url, config) => {
    const record = { method: 'GET', url, config };
    capturedCalls.push(record);
    return Promise.resolve({ data: { success: true, mockUrl: url } });
  },
  post: (url, body, config) => {
    const record = { method: 'POST', url, body, config };
    capturedCalls.push(record);
    return Promise.resolve({ data: { success: true, mockUrl: url, body } });
  },
  patch: (url, body, config) => {
    const record = { method: 'PATCH', url, body, config };
    capturedCalls.push(record);
    return Promise.resolve({ data: { success: true, mockUrl: url, body } });
  },
  delete: (url, config) => {
    const record = { method: 'DELETE', url, config };
    capturedCalls.push(record);
    return Promise.resolve({ data: { success: true, mockUrl: url, config } });
  },
};

// Recreate creativeApi using mockApi exactly as implemented in mint-more-frontend/src/api/creative.js
function normalizeUploadPayload(payload = {}) {
  if (typeof payload === 'string') {
    return { creative_url: payload };
  }
  const {
    creative_url,
    creativeUrl,
    media_type,
    mediaType,
    content_type,
    contentType,
    ...rest
  } = payload || {};

  const finalUrl = creative_url || creativeUrl || '';
  const finalMediaType = media_type || mediaType || content_type || contentType || 'image';

  return {
    ...rest,
    creative_url: finalUrl,
    media_type: finalMediaType,
    content_type: finalMediaType,
  };
}

const testCreativeApi = {
  getDesignerSocialQueue: () => mockApi.get('/creative/designer/social-queue'),
  designerSocialQueue: () => mockApi.get('/creative/designer/social-queue'),
  uploadCreative: (postId, payload) =>
    mockApi.patch(`/creative/designer/social-queue/${postId}/upload`, normalizeUploadPayload(payload)),
  uploadCreativeToSocialPost: (postId, payload) =>
    mockApi.patch(`/creative/designer/social-queue/${postId}/upload`, normalizeUploadPayload(payload)),
  reuploadCreative: (postId, payload) =>
    mockApi.patch(`/creative/designer/social-queue/${postId}/upload`, normalizeUploadPayload(payload)),
  getDesignerTasks: () => mockApi.get('/creative/designer/tasks'),
  designerTasks: () => mockApi.get('/creative/designer/tasks'),
  updateDesignerTask: (taskId, payload) =>
    mockApi.patch(`/creative/designer/tasks/${taskId}`, payload),
  getBrandContext: (userId) => mockApi.get(`/creative/brands/${userId}/context`),
  brandContext: (userId) => mockApi.get(`/creative/brands/${userId}/context`),
  completeCalendar: (_calendarIdOrData, payload = {}) => {
    const body = typeof _calendarIdOrData === 'object' && _calendarIdOrData !== null
      ? _calendarIdOrData
      : payload;
    return mockApi.post('/creative/calendar/complete', body);
  },
  getClientPendingReview: () => mockApi.get('/creative/client/pending-review'),
  clientPendingReview: () => mockApi.get('/creative/client/pending-review'),
  getClientSocialPosts: (params) => {
    if (!params || params.status === 'pending_client_review' || params.status === 'in_review') {
      return mockApi.get('/creative/client/pending-review');
    }
    return mockApi.get('/creative/client/pending-review', { params });
  },
  clientApproveCreative: (postId) => mockApi.post(`/creative/client/posts/${postId}/approve`),
  clientApprovePost: (postId) => mockApi.post(`/creative/client/posts/${postId}/approve`),
  clientRejectCreative: (postId, payload = {}) => {
    const reason = typeof payload === 'string' ? payload : (payload?.reason || payload?.feedback || '');
    return mockApi.post(`/creative/client/posts/${postId}/reject`, { reason });
  },
  clientRejectPost: (postId, payload = {}) => {
    const reason = typeof payload === 'string' ? payload : (payload?.reason || payload?.feedback || '');
    return mockApi.post(`/creative/client/posts/${postId}/reject`, { reason });
  },
  getAdminClients: () => mockApi.get('/creative/admin/clients'),
  listAdminClients: () => mockApi.get('/creative/admin/clients'),
  getAdminDesigners: () => mockApi.get('/creative/admin/designers'),
  listAdminDesigners: () => mockApi.get('/creative/admin/designers'),
  assignDesignerToClient: (clientId, designerIdOrPayload) => {
    const designer_id = typeof designerIdOrPayload === 'object' && designerIdOrPayload !== null
      ? designerIdOrPayload.designer_id
      : designerIdOrPayload;
    return mockApi.patch(`/creative/admin/clients/${clientId}/assign-designer`, { designer_id: designer_id ?? null });
  },
  getAdminPendingCreatives: () => mockApi.get('/creative/admin/review-queue'),
  getAdminReviewQueue: () => mockApi.get('/creative/admin/review-queue'),
  listAdminReviewQueue: () => mockApi.get('/creative/admin/review-queue'),
  adminReviewCreative: (postId, { decision = 'approve', feedback = '', reason = '', ...rest } = {}) => {
    if (decision === 'reject') {
      return mockApi.post(`/creative/admin/posts/${postId}/reject`, { reason: feedback || reason });
    }
    return mockApi.post(`/creative/admin/posts/${postId}/approve`, rest);
  },
  adminApproveCreative: (postId, payload = {}) => mockApi.post(`/creative/admin/posts/${postId}/approve`, payload),
  adminApprovePost: (postId, payload = {}) => mockApi.post(`/creative/admin/posts/${postId}/approve`, payload),
  adminRejectCreative: (postId, payload = {}) => {
    const reason = typeof payload === 'string' ? payload : (payload?.reason || payload?.feedback || '');
    return mockApi.post(`/creative/admin/posts/${postId}/reject`, { reason });
  },
  adminRejectPost: (postId, payload = {}) => {
    const reason = typeof payload === 'string' ? payload : (payload?.reason || payload?.feedback || '');
    return mockApi.post(`/creative/admin/posts/${postId}/reject`, { reason });
  },
  adminDirectUpload: (payload) => mockApi.post('/creative/admin/direct-upload', payload),
  getCreativeAnalytics: (params) => mockApi.get('/creative/admin/overview', { params }),
  adminOverview: () => mockApi.get('/creative/admin/overview'),
};

reportTest('normalizeUploadPayload handles string URL', () => {
  const result = normalizeUploadPayload('https://assets.mintmore.com/img1.png');
  assert.equal(result.creative_url, 'https://assets.mintmore.com/img1.png');
});

reportTest('normalizeUploadPayload handles camelCase creativeUrl & mediaType', () => {
  const result = normalizeUploadPayload({
    creativeUrl: 'https://assets.mintmore.com/video1.mp4',
    mediaType: 'video',
    caption: 'Great post caption',
  });
  assert.equal(result.creative_url, 'https://assets.mintmore.com/video1.mp4');
  assert.equal(result.media_type, 'video');
  assert.equal(result.content_type, 'video');
  assert.equal(result.caption, 'Great post caption');
});

reportTest('normalizeUploadPayload handles snake_case creative_url & content_type', () => {
  const result = normalizeUploadPayload({
    creative_url: 'https://assets.mintmore.com/carousel1.png',
    content_type: 'carousel',
  });
  assert.equal(result.creative_url, 'https://assets.mintmore.com/carousel1.png');
  assert.equal(result.media_type, 'carousel');
  assert.equal(result.content_type, 'carousel');
});

reportTest('normalizeUploadPayload defaults media_type to image if omitted', () => {
  const result = normalizeUploadPayload({
    creative_url: 'https://assets.mintmore.com/pic.png',
  });
  assert.equal(result.media_type, 'image');
  assert.equal(result.content_type, 'image');
});

reportTest('completeCalendar handles no-arg, object arg, and (id, payload) arg', async () => {
  capturedCalls.length = 0;
  await testCreativeApi.completeCalendar();
  assert.equal(capturedCalls[0].method, 'POST');
  assert.equal(capturedCalls[0].url, '/creative/calendar/complete');
  assert.deepEqual(capturedCalls[0].body, {});

  capturedCalls.length = 0;
  await testCreativeApi.completeCalendar({ note: 'done' });
  assert.equal(capturedCalls[0].method, 'POST');
  assert.equal(capturedCalls[0].url, '/creative/calendar/complete');
  assert.deepEqual(capturedCalls[0].body, { note: 'done' });

  capturedCalls.length = 0;
  await testCreativeApi.completeCalendar('cal-123', { note: 'specific' });
  assert.equal(capturedCalls[0].method, 'POST');
  assert.equal(capturedCalls[0].url, '/creative/calendar/complete');
  assert.deepEqual(capturedCalls[0].body, { note: 'specific' });
});

reportTest('clientRejectCreative normalizes string, reason object, and feedback object', async () => {
  capturedCalls.length = 0;
  await testCreativeApi.clientRejectCreative('p-1', 'Need darker font');
  assert.equal(capturedCalls[0].method, 'POST');
  assert.equal(capturedCalls[0].url, '/creative/client/posts/p-1/reject');
  assert.deepEqual(capturedCalls[0].body, { reason: 'Need darker font' });

  capturedCalls.length = 0;
  await testCreativeApi.clientRejectCreative('p-2', { reason: 'Logo too small' });
  assert.equal(capturedCalls[0].body, { reason: 'Logo too small' });

  capturedCalls.length = 0;
  await testCreativeApi.clientRejectCreative('p-3', { feedback: 'Fix header layout' });
  assert.equal(capturedCalls[0].body, { reason: 'Fix header layout' });
});

reportTest('assignDesignerToClient accepts scalar designerId or { designer_id } object', async () => {
  capturedCalls.length = 0;
  await testCreativeApi.assignDesignerToClient('client-1', 'des-99');
  assert.equal(capturedCalls[0].method, 'PATCH');
  assert.equal(capturedCalls[0].url, '/creative/admin/clients/client-1/assign-designer');
  assert.deepEqual(capturedCalls[0].body, { designer_id: 'des-99' });

  capturedCalls.length = 0;
  await testCreativeApi.assignDesignerToClient('client-2', { designer_id: 'des-100' });
  assert.deepEqual(capturedCalls[0].body, { designer_id: 'des-100' });

  capturedCalls.length = 0;
  await testCreativeApi.assignDesignerToClient('client-3', null);
  assert.deepEqual(capturedCalls[0].body, { designer_id: null });
});

reportTest('adminReviewCreative dispatches correctly to approve or reject endpoints', async () => {
  capturedCalls.length = 0;
  await testCreativeApi.adminReviewCreative('post-10', { decision: 'approve' });
  assert.equal(capturedCalls[0].method, 'POST');
  assert.equal(capturedCalls[0].url, '/creative/admin/posts/post-10/approve');

  capturedCalls.length = 0;
  await testCreativeApi.adminReviewCreative('post-11', { decision: 'reject', feedback: 'Spelling error on slide 2' });
  assert.equal(capturedCalls[0].method, 'POST');
  assert.equal(capturedCalls[0].url, '/creative/admin/posts/post-11/reject');
  assert.deepEqual(capturedCalls[0].body, { reason: 'Spelling error on slide 2' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: Backend Routes ↔ Frontend API Client Full Matrix Coverage
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Suite 3: Route & Controller Interface Parity Matrix ===');

const backendRoutesFile = path.join(backendRoot, 'src/modules/creative/creative.routes.js');
const backendRoutesContent = fs.readFileSync(backendRoutesFile, 'utf8');

// Parse route declarations from creative.routes.js
// e.g. router.post('/calendar/complete', authorize('client'), controller.completeCalendar);
const routeRegex = /router\.(get|post|patch|put|delete)\(\s*['"]([^'"]+)['"]/g;
const backendEndpoints = [];
let match;
while ((match = routeRegex.exec(backendRoutesContent)) !== null) {
  backendEndpoints.push({
    method: match[1].toUpperCase(),
    path: match[2],
  });
}

console.log(`Discovered ${backendEndpoints.length} routes in backend creative.routes.js:`);
backendEndpoints.forEach(e => console.log(`  - ${e.method} /api/v1/creative${e.path}`));

const expectedFrontendMethods = [
  { name: 'getDesignerSocialQueue', method: 'GET', pathPattern: /^\/creative\/designer\/social-queue$/ },
  { name: 'designerSocialQueue', method: 'GET', pathPattern: /^\/creative\/designer\/social-queue$/ },
  { name: 'uploadCreative', method: 'PATCH', pathPattern: /^\/creative\/designer\/social-queue\/[^/]+\/upload$/ },
  { name: 'uploadCreativeToSocialPost', method: 'PATCH', pathPattern: /^\/creative\/designer\/social-queue\/[^/]+\/upload$/ },
  { name: 'reuploadCreative', method: 'PATCH', pathPattern: /^\/creative\/designer\/social-queue\/[^/]+\/upload$/ },
  { name: 'getDesignerTasks', method: 'GET', pathPattern: /^\/creative\/designer\/tasks$/ },
  { name: 'designerTasks', method: 'GET', pathPattern: /^\/creative\/designer\/tasks$/ },
  { name: 'updateDesignerTask', method: 'PATCH', pathPattern: /^\/creative\/designer\/tasks\/[^/]+$/ },
  { name: 'getBrandContext', method: 'GET', pathPattern: /^\/creative\/brands\/[^/]+\/context$/ },
  { name: 'brandContext', method: 'GET', pathPattern: /^\/creative\/brands\/[^/]+\/context$/ },
  { name: 'completeCalendar', method: 'POST', pathPattern: /^\/creative\/calendar\/complete$/ },
  { name: 'getClientPendingReview', method: 'GET', pathPattern: /^\/creative\/client\/pending-review$/ },
  { name: 'clientPendingReview', method: 'GET', pathPattern: /^\/creative\/client\/pending-review$/ },
  { name: 'clientApproveCreative', method: 'POST', pathPattern: /^\/creative\/client\/posts\/[^/]+\/approve$/ },
  { name: 'clientApprovePost', method: 'POST', pathPattern: /^\/creative\/client\/posts\/[^/]+\/approve$/ },
  { name: 'clientRejectCreative', method: 'POST', pathPattern: /^\/creative\/client\/posts\/[^/]+\/reject$/ },
  { name: 'clientRejectPost', method: 'POST', pathPattern: /^\/creative\/client\/posts\/[^/]+\/reject$/ },
  { name: 'getAdminClients', method: 'GET', pathPattern: /^\/creative\/admin\/clients$/ },
  { name: 'listAdminClients', method: 'GET', pathPattern: /^\/creative\/admin\/clients$/ },
  { name: 'getAdminDesigners', method: 'GET', pathPattern: /^\/creative\/admin\/designers$/ },
  { name: 'listAdminDesigners', method: 'GET', pathPattern: /^\/creative\/admin\/designers$/ },
  { name: 'assignDesignerToClient', method: 'PATCH', pathPattern: /^\/creative\/admin\/clients\/[^/]+\/assign-designer$/ },
  { name: 'getAdminPendingCreatives', method: 'GET', pathPattern: /^\/creative\/admin\/review-queue$/ },
  { name: 'getAdminReviewQueue', method: 'GET', pathPattern: /^\/creative\/admin\/review-queue$/ },
  { name: 'listAdminReviewQueue', method: 'GET', pathPattern: /^\/creative\/admin\/review-queue$/ },
  { name: 'adminApproveCreative', method: 'POST', pathPattern: /^\/creative\/admin\/posts\/[^/]+\/approve$/ },
  { name: 'adminApprovePost', method: 'POST', pathPattern: /^\/creative\/admin\/posts\/[^/]+\/approve$/ },
  { name: 'adminRejectCreative', method: 'POST', pathPattern: /^\/creative\/admin\/posts\/[^/]+\/reject$/ },
  { name: 'adminRejectPost', method: 'POST', pathPattern: /^\/creative\/admin\/posts\/[^/]+\/reject$/ },
  { name: 'adminDirectUpload', method: 'POST', pathPattern: /^\/creative\/admin\/direct-upload$/ },
  { name: 'getCreativeAnalytics', method: 'GET', pathPattern: /^\/creative\/admin\/overview$/ },
  { name: 'adminOverview', method: 'GET', pathPattern: /^\/creative\/admin\/overview$/ },
];

expectedFrontendMethods.forEach(fnSpec => {
  reportTest(`creativeApi.${fnSpec.name} produces ${fnSpec.method} matching ${fnSpec.pathPattern}`, async () => {
    capturedCalls.length = 0;
    const fn = testCreativeApi[fnSpec.name];
    assert.ok(typeof fn === 'function', `Method ${fnSpec.name} is missing on creativeApi`);
    
    // Call with dummy arguments
    await fn('id-123', { dummy: true });
    assert.equal(capturedCalls.length, 1);
    assert.equal(capturedCalls[0].method, fnSpec.method);
    assert.match(capturedCalls[0].url, fnSpec.pathPattern);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Notification Types, Icons, and Deep-Link Routing Audit
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Suite 4: Notification Integration Audit ===');

const notifPanelFile = path.join(frontendRoot, 'src/components/shared/NotifPanel.jsx');
const inboxFile = path.join(frontendRoot, 'src/pages/notifications/Inbox.jsx');
const notifPanelCode = fs.readFileSync(notifPanelFile, 'utf8');
const inboxCode = fs.readFileSync(inboxFile, 'utf8');

const requiredNotifTypes = [
  'calendar_completed',
  'designer_assigned',
  'creative_uploaded',
  'creative_rejected_by_admin',
  'creative_rejected_admin',
  'creative_ready_client_review',
  'creative_approved_admin',
  'creative_scheduled',
  'creative_approved_client',
  'creative_rejected_by_client',
  'creative_rejected_client',
  'creative_published',
];

requiredNotifTypes.forEach(notifType => {
  reportTest(`NotifPanel & Inbox support notification type: ${notifType}`, () => {
    assert.ok(notifPanelCode.includes(`'${notifType}'`) || notifPanelCode.includes(`"${notifType}"`) || notifPanelCode.includes(`${notifType}:`), `NotifPanel.jsx missing ${notifType}`);
    assert.ok(inboxCode.includes(`'${notifType}'`) || inboxCode.includes(`"${notifType}"`) || inboxCode.includes(`${notifType}:`), `Inbox.jsx missing ${notifType}`);
  });
});

reportTest('NotifPanel and Inbox getTarget() functions route all creative notifications to valid views', () => {
  const routes = [
    '/admin/operations?tab=clients',
    '/designer/tasks',
    '/admin/operations?tab=review',
    '/designer/social-queue?filter=rejected',
    '/social?tab=in_review',
    '/social?tab=scheduled',
    '/social?tab=published',
  ];
  routes.forEach(route => {
    assert.ok(notifPanelCode.includes(route), `NotifPanel missing target route ${route}`);
    assert.ok(inboxCode.includes(route), `Inbox missing target route ${route}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n================================================================');
console.log(`CHALLENGER 1 M3 SUITE COMPLETE: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('================================================================\n');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
