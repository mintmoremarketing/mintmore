const { Router } = require('express');
const controller = require('./kyc.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { upload, handleUploadError } = require('../../middleware/upload');
const { requirePermission } = require('../../middleware/permissions');

const router = Router();

// All KYC routes require authentication
router.use(authenticate);

// ── User KYC routes ───────────────────────────────────
// GET  /api/v1/kyc/status
router.get('/status', controller.getMyKycStatus);

// POST /api/v1/kyc/basic
router.post('/basic', controller.submitBasic);

// POST /api/v1/kyc/identity  (multipart: document_front, document_back, selfie)
router.post(
  '/identity',
  handleUploadError(
    upload.fields([
      { name: 'document_front', maxCount: 1 },
      { name: 'document_back',  maxCount: 1 },
      { name: 'selfie',         maxCount: 1 },
    ])
  ),
  controller.submitIdentity
);

// POST /api/v1/kyc/address   (multipart: address_proof)
router.post(
  '/address',
  handleUploadError(upload.fields([{ name: 'address_proof', maxCount: 1 }])),
  controller.submitAddress
);

// ── Admin KYC routes ──────────────────────────────────
// GET  /api/v1/kyc/admin/pending
router.get(
  '/admin/pending',
  authorize('admin'),
  requirePermission('users.manage'),
  controller.getPendingSubmissions
);

// PATCH /api/v1/kyc/admin/review/:submissionId
router.patch(
  '/admin/review/:submissionId',
  authorize('admin'),
  requirePermission('users.manage'),
  controller.reviewSubmission
);

module.exports = router;
