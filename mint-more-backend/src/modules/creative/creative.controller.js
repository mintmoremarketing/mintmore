const service = require('./creative.service');
const brandService = require('../brand/brand.service');
const { sendSuccess } = require('../../utils/apiResponse');

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

module.exports = {
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
};
