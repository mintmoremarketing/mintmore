const service = require('./creative.service');
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
        ? 'Selection saved for Mint More review.'
        : 'Creative selected and queued with Mint More.',
      statusCode: 201,
    });
  } catch (error) { next(error); }
};

const createRequest = async (req, res, next) => {
  try {
    const data = await service.createCustomRequest(req.user.sub, req.body);
    return sendSuccess(res, {
      data,
      message: 'Custom request sent to Mint More for review.',
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

const updateDesignerTask = async (req, res, next) => {
  try {
    const task = await service.updateDesignerTask(req.user.sub, req.params.taskId, req.body);
    return sendSuccess(res, { data: { task }, message: 'Task updated.' });
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
  adminOverview,
  designerTasks,
  updateDesignerTask,
  suggestEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  updateTask,
  approveRequest,
  approveSelection,
  rejectSelection,
};
