const service = require('./creative.service');
const brandService = require('../brand/brand.service');
const validator = require('./creative.validator');
const { sendSuccess } = require('../../utils/apiResponse');
const AppError = require('../../utils/AppError');

// ── Milestone 2 Creative Workflow Controllers ──

const completeCalendar = async (req, res, next) => {
  try {
    const data = await service.completeCalendar(req.user.sub);
    return sendSuccess(res, { data, message: 'Calendar marked as complete.' });
  } catch (error) { next(error); }
};

const listAdminClients = async (_req, res, next) => {
  try {
    const data = await service.listAdminClients();
    return sendSuccess(res, { data });
  } catch (error) { next(error); }
};

const listAdminDesigners = async (_req, res, next) => {
  try {
    const data = await service.listAdminDesigners();
    return sendSuccess(res, { data });
  } catch (error) { next(error); }
};

const assignDesignerToClient = async (req, res, next) => {
  try {
    validator.validateAssignDesigner(req.params, req.body);
    const data = await service.assignDesignerToClient(req.user.sub, req.params.clientId, req.body?.designer_id);
    return sendSuccess(res, { data, message: 'Designer assigned successfully.' });
  } catch (error) { next(error); }
};

const designerSocialQueue = async (req, res, next) => {
  try {
    const data = await service.listDesignerSocialQueue(req.user.sub);
    return sendSuccess(res, { data });
  } catch (error) { next(error); }
};

const uploadCreativeToSocialPost = async (req, res, next) => {
  try {
    validator.validateUploadCreative(req.params, req.body);
    const data = await service.uploadCreativeToSocialPost(req.user.sub, req.user.role, req.params.postId, req.body);
    return sendSuccess(res, { data, message: 'Creative uploaded successfully.' });
  } catch (error) { next(error); }
};

const listAdminReviewQueue = async (_req, res, next) => {
  try {
    const data = await service.listAdminReviewQueue();
    return sendSuccess(res, { data });
  } catch (error) { next(error); }
};

const adminApprovePost = async (req, res, next) => {
  try {
    validator.validateAdminApprove(req.params, req.body);
    const data = await service.adminApprovePost(req.user.sub, req.params.postId, req.body);
    return sendSuccess(res, { data, message: 'Post approved.' });
  } catch (error) { next(error); }
};

const adminRejectPost = async (req, res, next) => {
  try {
    validator.validateRejection(req.params, req.body);
    const data = await service.adminRejectPost(req.user.sub, req.params.postId, req.body);
    return sendSuccess(res, { data, message: 'Post rejected with feedback.' });
  } catch (error) { next(error); }
};

const listClientPendingReview = async (req, res, next) => {
  try {
    const data = await service.listClientPendingReview(req.user.sub);
    return sendSuccess(res, { data });
  } catch (error) { next(error); }
};

const clientApprovePost = async (req, res, next) => {
  try {
    validator.validateClientApprove(req.params);
    const data = await service.clientApprovePost(req.user.sub, req.params.postId);
    return sendSuccess(res, { data, message: 'Post approved and scheduled.' });
  } catch (error) { next(error); }
};

const clientRejectPost = async (req, res, next) => {
  try {
    validator.validateRejection(req.params, req.body);
    const data = await service.clientRejectPost(req.user.sub, req.params.postId, req.body);
    return sendSuccess(res, { data, message: 'Post rejected with feedback.' });
  } catch (error) { next(error); }
};

const adminDirectUpload = async (req, res, next) => {
  try {
    validator.validateDirectUpload(req.body);
    const data = await service.adminDirectUpload(req.user.sub, req.body);
    return sendSuccess(res, { data, message: 'Direct post created.', statusCode: 201 });
  } catch (error) { next(error); }
};

// ── Legacy & Existing Calendar / Tasks Handlers ──

const calendar = async (req, res, next) => {
  try {
    const data = await service.listCalendar(req.user.sub, { month: req.query.month });
    return sendSuccess(res, { data });
  } catch (error) { next(error); }
};

const selectEvent = async (req, res, next) => {
  try {
    const data = await service.selectEvent(req.user.sub, req.params.eventId, req.body);
    return sendSuccess(res, {
      data,
      message: data.selection?.status === 'pending_review'
        ? 'Selection saved for CREATYV review.'
        : 'Creative selected and queued with CREATYV.',
      statusCode: 201,
    });
  } catch (error) { next(error); }
};

const createRequest = async (req, res, next) => {
  try {
    const data = await service.createCustomRequest(req.user.sub, req.body);
    return sendSuccess(res, {
      data,
      message: 'Custom request sent to CREATYV for review.',
      statusCode: 201,
    });
  } catch (error) { next(error); }
};

const myWork = async (req, res, next) => {
  try {
    const data = await service.listClientWork(req.user.sub);
    return sendSuccess(res, { data });
  } catch (error) { next(error); }
};

const cancelRequest = async (req, res, next) => {
  try {
    const data = await service.cancelClientWorkItem(
      req.user.sub,
      'custom_request',
      req.params.requestId,
      req.body?.reason || 'Cancelled by client'
    );
    return sendSuccess(res, { data, message: 'Creative request cancelled.' });
  } catch (error) { next(error); }
};

const cancelSelection = async (req, res, next) => {
  try {
    const data = await service.cancelClientWorkItem(
      req.user.sub,
      'calendar_event',
      req.params.selectionId,
      req.body?.reason || 'Cancelled by client'
    );
    return sendSuccess(res, { data, message: 'Calendar creative cancelled.' });
  } catch (error) { next(error); }
};

const adminOverview = async (_req, res, next) => {
  try {
    const data = await service.adminOverview();
    return sendSuccess(res, { data });
  } catch (error) { next(error); }
};

const designerTasks = async (req, res, next) => {
  try {
    const data = await service.listDesignerTasks(req.user.sub);
    return sendSuccess(res, { data });
  } catch (error) { next(error); }
};

const getBrandContext = async (req, res, next) => {
  try {
    const data = await brandService.getBrandWorkspace(req.params.userId);
    return sendSuccess(res, { data });
  } catch (error) {
    next(error);
  }
};

const updateDesignerTask = async (req, res, next) => {
  try {
    const task = await service.updateDesignerTask(req.user.sub, req.params.taskId, req.body);
    return sendSuccess(res, { data: { task }, message: 'Task updated.' });
  } catch (error) { next(error); }
};

const syncTaskSheet = async (req, res, next) => {
  try {
    const data = await service.syncTaskSheet(req.user.sub);
    return sendSuccess(res, { data, message: data.configured ? 'Task sheet synced.' : data.message });
  } catch (error) { next(error); }
};

const createEvent = async (req, res, next) => {
  try {
    const event = await service.upsertEvent(req.user.sub, req.body);
    return sendSuccess(res, {
      data: { event },
      message: event.duplicate ? 'Calendar event already exists for this month.' : 'Calendar event created.',
      statusCode: event.duplicate ? 200 : 201,
    });
  } catch (error) { next(error); }
};

const suggestEvents = async (req, res, next) => {
  try {
    const data = await service.suggestCalendarEvents({ month: req.query.month });
    return sendSuccess(res, { data });
  } catch (error) { next(error); }
};

const updateEvent = async (req, res, next) => {
  try {
    const event = await service.upsertEvent(req.user.sub, req.body, req.params.eventId);
    return sendSuccess(res, { data: { event }, message: 'Calendar event updated.' });
  } catch (error) { next(error); }
};

const deleteEvent = async (req, res, next) => {
  try {
    const event = await service.archiveEvent(req.user.sub, req.params.eventId);
    return sendSuccess(res, { data: { event }, message: 'Calendar event removed.' });
  } catch (error) { next(error); }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await service.updateTask(req.user.sub, req.params.taskId, req.body);
    return sendSuccess(res, { data: { task }, message: 'Task updated.' });
  } catch (error) { next(error); }
};

const approveRequest = async (req, res, next) => {
  try {
    const data = await service.approveCustomRequest(req.user.sub, req.params.requestId, req.body);
    return sendSuccess(res, {
      data,
      message: data.insufficient_balance
        ? 'Request still needs MintCoin review.'
        : 'Request approved and queued for production.',
    });
  } catch (error) { next(error); }
};

const rejectRequest = async (req, res, next) => {
  try {
    const data = await service.rejectCustomRequest(req.user.sub, req.params.requestId, req.body);
    return sendSuccess(res, { data, message: 'Request rejected.' });
  } catch (error) { next(error); }
};

const approveSelection = async (req, res, next) => {
  try {
    const data = await service.approveCalendarSelection(req.user.sub, req.params.selectionId, req.body);
    return sendSuccess(res, {
      data,
      message: data.insufficient_balance
        ? 'Selection still needs MintCoin review.'
        : 'Selection approved and queued for production.',
    });
  } catch (error) { next(error); }
};

const rejectSelection = async (req, res, next) => {
  try {
    const data = await service.rejectCalendarSelection(req.user.sub, req.params.selectionId, req.body);
    return sendSuccess(res, { data, message: 'Selection rejected.' });
  } catch (error) { next(error); }
};

const { uploadFile } = require('../storage/app-storage.provider');

const uploadAsset = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file provided', 400);
    }
    const url = await uploadFile('creatives', req.file.originalname, req.file.buffer, req.file.mimetype);
    return sendSuccess(res, { data: { url } });
  } catch (error) { next(error); }
};

module.exports = {
  completeCalendar,
  listAdminClients,
  listAdminDesigners,
  assignDesignerToClient,
  designerSocialQueue,
  uploadCreativeToSocialPost,
  listAdminReviewQueue,
  adminApprovePost,
  adminRejectPost,
  listClientPendingReview,
  clientApprovePost,
  clientRejectPost,
  adminDirectUpload,
  calendar,
  selectEvent,
  createRequest,
  myWork,
  cancelRequest,
  cancelSelection,
  adminOverview,
  designerTasks,
  getBrandContext,
  updateDesignerTask,
  syncTaskSheet,
  suggestEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  updateTask,
  approveRequest,
  rejectRequest,
  approveSelection,
  rejectSelection,
  uploadAsset,
};
