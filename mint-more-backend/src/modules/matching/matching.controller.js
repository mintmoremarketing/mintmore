const matchingService = require('./matching.service');
const { sendSuccess } = require('../../utils/apiResponse');
const AppError = require('../../utils/AppError');
const { getSetting } = require('../commerce/settings.service');

const assertMatchingEnabled = async () => {
  const flags = await getSetting('feature_flags', { freelancer_matching: false });
  if (flags?.freelancer_matching === false) {
    throw new AppError('Freelancer matching is disabled by feature flag', 403);
  }
};

/**
 * POST /api/v1/matching/jobs/:jobId/run
 * Runs the AI matching engine. Changes job status to 'matching'.
 * Admin only.
 */
const runMatching = async (req, res, next) => {
  try {
    await assertMatchingEnabled();
    const result = await matchingService.runMatchingForJob(req.params.jobId);
    return sendSuccess(res, {
      data: result,
      message: result.match_count > 0
        ? `Matching complete. ${result.match_count} candidates ranked.`
        : 'Matching ran but no eligible candidates found.',
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/matching/jobs/:jobId/preview
 * Preview match rankings without changing job status.
 * Admin only.
 */
const previewMatching = async (req, res, next) => {
  try {
    await assertMatchingEnabled();
    const result = await matchingService.previewMatchingForJob(req.params.jobId);
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/matching/jobs/:jobId/pool
 * Get full freelancer pool scored against this job.
 * Includes freelancers who haven't proposed yet.
 * Admin only.
 */
const getFreelancerPool = async (req, res, next) => {
  try {
    await assertMatchingEnabled();
    const { page, limit } = req.query;
    const result = await matchingService.getFreelancerPool(req.params.jobId, {
      page:  parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

module.exports = { runMatching, previewMatching, getFreelancerPool };
