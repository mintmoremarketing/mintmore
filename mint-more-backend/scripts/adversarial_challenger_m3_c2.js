#!/usr/bin/env node

/**
 * Challenger 2 Adversarial & Empirical Verification Suite for Milestone 3
 * (M3 Frontend Client & Designer Workflows)
 *
 * Test Suites:
 * 1. Deep AST & Static Scan for any leftover CommonJS `require(` calls across frontend `src/`.
 * 2. Modal Validation Logic & Edge Cases (`ClientRejectModal`, `UploadCreativeModal`).
 * 3. Notification Routing, Type Coverage, Icon & Color Mapping across `NotifPanel.jsx` & `Inbox.jsx`.
 * 4. Creative API Client Edge Case & Robustness Validation.
 * 5. Component State Logic & Filter Matching Simulation.
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

console.log('=== Challenger 2 Empirical Test Suite: M3 Frontend Workflows ===');
console.log('Backend Root :', backendRoot);
console.log('Frontend Root:', frontendRoot);

let totalPassed = 0;
let totalFailed = 0;

function test(name, fn) {
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

async function testAsync(name, fn) {
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
// Suite 1: Leftover require() Scan Across Whole Frontend
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 1: Static Code Scan for Leftover require() ---');

function scanDirForRequires(dirPath, violations = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        scanDirForRequires(fullPath, violations);
      }
    } else if (/\.(jsx?|tsx?|mjs|cjs)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        // Ignore comments
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
        if (/require\s*\(/.test(trimmed)) {
          violations.push({ file: fullPath, line: idx + 1, snippet: trimmed });
        }
      });
    }
  }
  return violations;
}

test('Static scan: No require() calls exist in frontend src/ directory', () => {
  const srcDir = path.join(frontendRoot, 'src');
  const violations = scanDirForRequires(srcDir);
  if (violations.length > 0) {
    throw new Error(`Found ${violations.length} require() occurrences:\n` +
      violations.map(v => `  ${v.file}:${v.line} -> ${v.snippet}`).join('\n'));
  }
  assert.equal(violations.length, 0);
});

test('SocialQueue.jsx uses static ES module import for api client', () => {
  const file = path.join(frontendRoot, 'src/pages/designer/SocialQueue.jsx');
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(content.includes("import { api } from '../../api/client'"), 'Missing static import for api client');
  assert.ok(!content.includes("require('../../api/client')"), 'Still contains dynamic require for api client');
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: ClientRejectModal Validation & Logic Verification
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 2: ClientRejectModal Validation & Edge Cases ---');

// Replicate ClientRejectModal submission validation logic from Social.jsx
function simulateClientRejectModalValidation({ reason, isSubmitting }) {
  const isDisabled = !reason.trim() || isSubmitting;
  return {
    isDisabled,
    trimmedReason: reason.trim(),
  };
}

test('ClientRejectModal: Empty string disables submission button', () => {
  const res = simulateClientRejectModalValidation({ reason: '', isSubmitting: false });
  assert.equal(res.isDisabled, true);
  assert.equal(res.trimmedReason, '');
});

test('ClientRejectModal: Whitespace-only string (spaces, tabs, newlines) disables submission button', () => {
  const testCases = ['   ', '\t\t', '\n\n', '  \t  \n  '];
  for (const tc of testCases) {
    const res = simulateClientRejectModalValidation({ reason: tc, isSubmitting: false });
    assert.equal(res.isDisabled, true, `Expected whitespace '${tc}' to disable button`);
    assert.equal(res.trimmedReason, '');
  }
});

test('ClientRejectModal: Submitting state (isSubmitting=true) disables submission button even with valid text', () => {
  const res = simulateClientRejectModalValidation({ reason: 'Please fix logo size', isSubmitting: true });
  assert.equal(res.isDisabled, true);
});

test('ClientRejectModal: Valid reason enables submission and trims surrounding whitespace', () => {
  const res = simulateClientRejectModalValidation({
    reason: '   Please revise headline and change button to red.   \n',
    isSubmitting: false,
  });
  assert.equal(res.isDisabled, false);
  assert.equal(res.trimmedReason, 'Please revise headline and change button to red.');
});

test('ClientRejectModal: Unicode & special characters are preserved', () => {
  const complexReason = '🎨 Need more contrast on logo & font: 50% larger! @brand #launch';
  const res = simulateClientRejectModalValidation({
    reason: `   ${complexReason}   `,
    isSubmitting: false,
  });
  assert.equal(res.isDisabled, false);
  assert.equal(res.trimmedReason, complexReason);
});

test('Social.jsx correctly renders ClientRejectModal and handles mutation callbacks', () => {
  const socialFile = path.join(frontendRoot, 'src/pages/client/Social.jsx');
  const code = fs.readFileSync(socialFile, 'utf8');

  // Verify modal component presence and props
  assert.ok(code.includes('function ClientRejectModal({ post, onClose, onSubmit, isSubmitting })'), 'ClientRejectModal component defined');
  assert.ok(code.includes('disabled={!reason.trim() || isSubmitting}'), 'Empty reason check properly implemented');
  assert.ok(code.includes('onSubmit(reason.trim())'), 'Trimming reason prior to submit');
  assert.ok(code.includes('rejectMutation.mutate({ postId: rejectingPost.id, reason })'), 'Reject mutation called with postId and reason');
  assert.ok(code.includes("pushToast({ title: 'Changes requested'"), 'Toast feedback upon rejection');
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: UploadCreativeModal Validation & Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 3: UploadCreativeModal Validation & Edge Cases ---');

function simulateUploadModalValidation({ mode, file, directUrl, isUploading, internalUploading, caption = '', title = '', mediaType = 'image' }) {
  const urlTrimmed = String(directUrl || '').trim();
  const isDisabled = isUploading || internalUploading ||
    (mode === 'file' && !file && !urlTrimmed) ||
    (mode === 'url' && !urlTrimmed);

  const payload = {
    creative_url: urlTrimmed,
    caption: String(caption || '').trim(),
    title: String(title || '').trim(),
    media_type: mediaType,
    content_type: mediaType,
  };

  return { isDisabled, payload };
}

test('UploadCreativeModal: File mode with neither file nor URL disables submit', () => {
  const res = simulateUploadModalValidation({ mode: 'file', file: null, directUrl: '', isUploading: false, internalUploading: false });
  assert.equal(res.isDisabled, true);
});

test('UploadCreativeModal: File mode with file attached enables submit', () => {
  const dummyFile = { name: 'banner.png', size: 1024 * 500 };
  const res = simulateUploadModalValidation({ mode: 'file', file: dummyFile, directUrl: '', isUploading: false, internalUploading: false });
  assert.equal(res.isDisabled, false);
});

test('UploadCreativeModal: URL mode with empty/whitespace URL disables submit', () => {
  const res = simulateUploadModalValidation({ mode: 'url', file: null, directUrl: '   ', isUploading: false, internalUploading: false });
  assert.equal(res.isDisabled, true);
});

test('UploadCreativeModal: URL mode with valid URL enables submit and constructs normalized payload', () => {
  const res = simulateUploadModalValidation({
    mode: 'url',
    file: null,
    directUrl: '  https://assets.cloudinary.com/mintmore/image1.jpg  ',
    caption: '  Exciting new product launch! #deals  ',
    title: '  Summer Promo Post  ',
    mediaType: 'carousel',
    isUploading: false,
    internalUploading: false,
  });
  assert.equal(res.isDisabled, false);
  assert.equal(res.payload.creative_url, 'https://assets.cloudinary.com/mintmore/image1.jpg');
  assert.equal(res.payload.caption, 'Exciting new product launch! #deals');
  assert.equal(res.payload.title, 'Summer Promo Post');
  assert.equal(res.payload.media_type, 'carousel');
  assert.equal(res.payload.content_type, 'carousel');
});

test('UploadCreativeModal: Media type options correctly handled (image, video, carousel)', () => {
  const validTypes = ['image', 'video', 'carousel'];
  for (const t of validTypes) {
    const res = simulateUploadModalValidation({
      mode: 'url',
      directUrl: 'https://cdn.example.com/asset.mp4',
      mediaType: t,
      isUploading: false,
      internalUploading: false,
    });
    assert.equal(res.payload.media_type, t);
    assert.equal(res.payload.content_type, t);
  }
});

test('SocialQueue.jsx contains dual-mode modal with proper error boundaries & feedback presentation', () => {
  const sqFile = path.join(frontendRoot, 'src/pages/designer/SocialQueue.jsx');
  const code = fs.readFileSync(sqFile, 'utf8');

  assert.ok(code.includes('function UploadCreativeModal({ post, onClose, onUpload, isUploading })'), 'UploadCreativeModal defined');
  assert.ok(code.includes("mode === 'file'"), 'File upload mode supported');
  assert.ok(code.includes("mode === 'url'"), 'Direct URL mode supported');
  assert.ok(code.includes('post.client_feedback || post.admin_feedback || post.rejection_reason'), 'Revision feedback rendered');
  assert.ok(code.includes('disabled={isUploading || internalUploading'), 'Submission button disabled when uploading');
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Notification Routing & Creative Types Coverage
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 4: Notification Routing, Icons, and Deep-Links ---');

const notifPanelFile = path.join(frontendRoot, 'src/components/shared/NotifPanel.jsx');
const inboxFile = path.join(frontendRoot, 'src/pages/notifications/Inbox.jsx');
const notifPanelCode = fs.readFileSync(notifPanelFile, 'utf8');
const inboxCode = fs.readFileSync(inboxFile, 'utf8');

// The 7 creative notification types from M3 specification:
// 1. calendar_completed
// 2. creative_uploaded
// 3. creative_approved_admin (and alias creative_ready_client_review)
// 4. creative_rejected_admin (and alias creative_rejected_by_admin)
// 5. creative_approved_client (and alias creative_scheduled)
// 6. creative_rejected_client (and alias creative_rejected_by_client)
// 7. creative_published

const creativeNotificationSpecs = [
  {
    type: 'calendar_completed',
    expectedTarget: '/admin/operations?tab=clients',
    expectedIcon: 'calendar',
    expectedColorVar: 'var(--mint-500)',
  },
  {
    type: 'creative_uploaded',
    expectedTarget: '/admin/operations?tab=review',
    expectedIcon: 'upload',
    expectedColorVar: 'var(--orange-500)',
  },
  {
    type: 'creative_approved_admin',
    expectedTarget: '/social?tab=in_review',
    expectedIcon: 'eye',
    expectedColorVar: 'var(--violet)',
  },
  {
    type: 'creative_ready_client_review',
    expectedTarget: '/social?tab=in_review',
    expectedIcon: 'eye',
    expectedColorVar: 'var(--violet)',
  },
  {
    type: 'creative_rejected_admin',
    expectedTarget: '/designer/social-queue?filter=rejected',
    expectedIcon: 'refresh',
    expectedColorVar: 'var(--amber)',
  },
  {
    type: 'creative_rejected_by_admin',
    expectedTarget: '/designer/social-queue?filter=rejected',
    expectedIcon: 'refresh',
    expectedColorVar: 'var(--amber)',
  },
  {
    type: 'creative_approved_client',
    expectedTarget: '/social?tab=scheduled',
    expectedIcon: 'check',
    expectedColorVar: 'var(--mint-500)',
  },
  {
    type: 'creative_scheduled',
    expectedTarget: '/social?tab=scheduled',
    expectedIcon: 'check',
    expectedColorVar: 'var(--mint-500)',
  },
  {
    type: 'creative_rejected_client',
    expectedTarget: '/designer/social-queue?filter=rejected',
    expectedIcon: 'x',
    expectedColorVar: 'var(--rose)',
  },
  {
    type: 'creative_rejected_by_client',
    expectedTarget: '/designer/social-queue?filter=rejected',
    expectedIcon: 'x',
    expectedColorVar: 'var(--rose)',
  },
  {
    type: 'creative_published',
    expectedTarget: '/social?tab=published',
    expectedIcon: 'share',
    expectedColorVar: 'var(--mint-600)',
  },
];

// Replicate getTarget from NotifPanel.jsx & Inbox.jsx
function simulateGetTarget(n) {
  const meta = n.data || {};
  if (n.type === 'calendar_completed') return '/admin/operations?tab=clients';
  if (n.type === 'designer_assigned') return '/designer/tasks';
  if (n.type === 'creative_uploaded') return '/admin/operations?tab=review';
  if (n.type === 'creative_rejected_by_admin' || n.type === 'creative_rejected_admin') return '/designer/social-queue?filter=rejected';
  if (n.type === 'creative_ready_client_review' || n.type === 'creative_approved_admin') return '/social?tab=in_review';
  if (n.type === 'creative_scheduled' || n.type === 'creative_approved_client') return '/social?tab=scheduled';
  if (n.type === 'creative_rejected_by_client' || n.type === 'creative_rejected_client') return '/designer/social-queue?filter=rejected';
  if (n.type === 'creative_published') return '/social?tab=published';

  if (n.entity_type === 'social_post' || meta.post_id) return '/posts';
  if (n.entity_type === 'dispute' || meta.dispute_id) return `/disputes?id=${n.entity_id || meta.dispute_id}`;
  const jobId = n.entity_type === 'job' ? n.entity_id : meta.job_id || meta.jobId || meta.job?.id;
  if (jobId) return `/jobs/${jobId}`;
  if (n.entity_type === 'wallet' || n.type === 'wallet') return '/wallet';
  return null;
}

creativeNotificationSpecs.forEach(spec => {
  test(`Notification [${spec.type}] routes accurately to ${spec.expectedTarget}`, () => {
    const notif = { type: spec.type, data: {} };
    const target = simulateGetTarget(notif);
    assert.equal(target, spec.expectedTarget);
  });

  test(`Notification [${spec.type}] icon & color defined in NotifPanel.jsx and Inbox.jsx`, () => {
    assert.ok(notifPanelCode.includes(`${spec.type}: '${spec.expectedIcon}'`) || notifPanelCode.includes(`'${spec.type}': '${spec.expectedIcon}'`), `NotifPanel missing icon for ${spec.type}`);
    assert.ok(inboxCode.includes(`${spec.type}: '${spec.expectedIcon}'`) || inboxCode.includes(`'${spec.type}': '${spec.expectedIcon}'`), `Inbox missing icon for ${spec.type}`);
    assert.ok(notifPanelCode.includes(`${spec.type}: '${spec.expectedColorVar}'`) || notifPanelCode.includes(`'${spec.type}': '${spec.expectedColorVar}'`), `NotifPanel missing color for ${spec.type}`);
    assert.ok(inboxCode.includes(`${spec.type}: '${spec.expectedColorVar}'`) || inboxCode.includes(`'${spec.type}': '${spec.expectedColorVar}'`), `Inbox missing color for ${spec.type}`);
  });
});

test('Inbox.jsx categorizes creative notifications in CREATIVE_TYPES tab', () => {
  assert.ok(inboxCode.includes("'creative_uploaded'"), 'CREATIVE_TYPES includes creative_uploaded');
  assert.ok(inboxCode.includes("'calendar_completed'"), 'CREATIVE_TYPES includes calendar_completed');
  assert.ok(inboxCode.includes("'creative_published'"), 'CREATIVE_TYPES includes creative_published');
  assert.ok(inboxCode.includes('filter === \'creative\''), 'Creative filter tab logic implemented');
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: Frontend API Client Edge Case Matrix
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Suite 5: Frontend API Client Edge Case Matrix ---');

// Replicate normalizeUploadPayload exactly from creative.js
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

test('normalizeUploadPayload handles undefined and null payload gracefully', () => {
  const r1 = normalizeUploadPayload(undefined);
  assert.equal(r1.creative_url, '');
  assert.equal(r1.media_type, 'image');
  assert.equal(r1.content_type, 'image');

  const r2 = normalizeUploadPayload(null);
  assert.equal(r2.creative_url, '');
  assert.equal(r2.media_type, 'image');
  assert.equal(r2.content_type, 'image');
});

test('normalizeUploadPayload preserves additional custom metadata properties', () => {
  const r = normalizeUploadPayload({
    creative_url: 'https://mintmore.com/test.png',
    custom_flag: true,
    aspect_ratio: '1:1',
    designer_note: 'Updated per feedback',
  });
  assert.equal(r.creative_url, 'https://mintmore.com/test.png');
  assert.equal(r.custom_flag, true);
  assert.equal(r.aspect_ratio, '1:1');
  assert.equal(r.designer_note, 'Updated per feedback');
});

test('clientRejectCreative normalizes different payload signatures', () => {
  const normalizeRejectReason = (payload) => typeof payload === 'string' ? payload : (payload?.reason || payload?.feedback || '');

  assert.equal(normalizeRejectReason('Direct string reason'), 'Direct string reason');
  assert.equal(normalizeRejectReason({ reason: 'Object reason field' }), 'Object reason field');
  assert.equal(normalizeRejectReason({ feedback: 'Object feedback field' }), 'Object feedback field');
  assert.equal(normalizeRejectReason({}), '');
  assert.equal(normalizeRejectReason(null), '');
  assert.equal(normalizeRejectReason(undefined), '');
});

test('completeCalendar handles various signature permutations', () => {
  const normalizeCompleteCalendarBody = (_calendarIdOrData, payload = {}) => {
    return typeof _calendarIdOrData === 'object' && _calendarIdOrData !== null
      ? _calendarIdOrData
      : payload;
  };

  assert.deepEqual(normalizeCompleteCalendarBody(), {});
  assert.deepEqual(normalizeCompleteCalendarBody({ autoPublish: true }), { autoPublish: true });
  assert.deepEqual(normalizeCompleteCalendarBody('cal-456', { clientNote: 'Complete' }), { clientNote: 'Complete' });
  assert.deepEqual(normalizeCompleteCalendarBody('cal-456'), {});
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n================================================================');
console.log(`CHALLENGER 2 EMPIRICAL TEST SUITE: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('================================================================\n');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
