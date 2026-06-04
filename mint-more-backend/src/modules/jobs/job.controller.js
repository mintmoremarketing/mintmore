const jobService = require('./job.service');
const { sendSuccess } = require('../../utils/apiResponse');
const AppError = require('../../utils/AppError');

// ── Client ────────────────────────────────────────────────────────────────────

const createJob = async (req, res, next) => {
  try {
    const job = await jobService.createJob(req.user.sub, req.body);
    return sendSuccess(res, {
      data:       job,
      message:    'Job created. Matching is running in the background.',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const createJobAsDraft = async (req, res, next) => {
  try {
    const job = await jobService.createJobAsDraft(req.user.sub, req.body);
    return sendSuccess(res, {
      data:       job,
      message:    'Draft job created. Matching will run when you publish.',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const publishJob = async (req, res, next) => {
  try {
    const job = await jobService.publishJob(req.user.sub, req.params.id);
    return sendSuccess(res, {
      data:    job,
      message: 'Job published. Matching is running in the background.',
    });
  } catch (err) { next(err); }
};

const updateJob = async (req, res, next) => {
  try {
    const job = await jobService.updateJob(
      req.user.sub,
      req.params.id,
      req.body
    );
    return sendSuccess(res, { data: job, message: 'Job updated.' });
  } catch (err) { next(err); }
};

const pauseMatching = async (req, res, next) => {
  try {
    const job = await jobService.pauseMatching(req.user.sub, req.params.id);
    return sendSuccess(res, {
      data: job,
      message: 'Matching paused. You can edit the brief now.',
    });
  } catch (err) { next(err); }
};

const cancelJob = async (req, res, next) => {
  try {
    const job = await jobService.cancelJob(
      req.user.sub,
      req.user.role,
      req.params.id
    );
    return sendSuccess(res, { data: job, message: 'Job cancelled.' });
  } catch (err) { next(err); }
};

const getClientJobSummary = async (req, res, next) => {
  try {
    const summary = await jobService.getClientJobSummary(req.user.sub);
    return sendSuccess(res, { data: summary });
  } catch (err) { next(err); }
};

// ── Shared ────────────────────────────────────────────────────────────────────

const listJobs = async (req, res, next) => {
  try {
    const { page, limit, status, category_id } = req.query;
    const result = await jobService.listJobs(
      req.user.sub,
      req.user.role,
      {
        page:        parseInt(page, 10)  || 1,
        limit:       parseInt(limit, 10) || 20,
        status,
        category_id,
      }
    );
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const getJobById = async (req, res, next) => {
  try {
    const job = await jobService.getJobById(
      req.user.sub,
      req.user.role,
      req.params.id
    );
    return sendSuccess(res, { data: job });
  } catch (err) { next(err); }
};

// ── Admin ─────────────────────────────────────────────────────────────────────

const adminListAllJobs = async (req, res, next) => {
  try {
    const { page, limit, status, category_id } = req.query;
    const result = await jobService.adminListAllJobs({
      page:        parseInt(page, 10)  || 1,
      limit:       parseInt(limit, 10) || 20,
      status,
      category_id,
    });
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const adminUpdateJobStatus = async (req, res, next) => {
  try {
    const { status, admin_note } = req.body;
    if (!status) throw new AppError('status is required', 400);

    const job = await jobService.adminUpdateJobStatus(
      req.user.sub,
      req.params.id,
      { status, admin_note }
    );
    return sendSuccess(res, { data: job, message: 'Job status updated.' });
  } catch (err) { next(err); }
};

module.exports = {
  createJob,
  createJobAsDraft,
  publishJob,
  updateJob,
  pauseMatching,
  cancelJob,
  getClientJobSummary,
  listJobs,
  getJobById,
  adminListAllJobs,
  adminUpdateJobStatus,
};
