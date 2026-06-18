const service = require('./support.service');
const { sendSuccess } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const data = await service.listTickets(req.user.sub, req.user.role, req.query);
    return sendSuccess(res, { data });
  } catch (err) { next(err); }
};

const get = async (req, res, next) => {
  try {
    const data = await service.getTicket(req.params.ticketId, req.user.sub, req.user.role);
    return sendSuccess(res, { data });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const ticket = await service.createTicket(req.user.sub, req.user.role, req.body);
    return sendSuccess(res, { data: { ticket }, message: 'Support ticket created', statusCode: 201 });
  } catch (err) { next(err); }
};

const message = async (req, res, next) => {
  try {
    const item = await service.addMessage(req.params.ticketId, req.user.sub, req.user.role, req.body.body);
    return sendSuccess(res, { data: { message: item }, message: 'Message sent' });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const ticket = await service.updateTicket(req.params.ticketId, req.user.sub, req.body);
    return sendSuccess(res, { data: { ticket }, message: 'Ticket updated' });
  } catch (err) { next(err); }
};

module.exports = { list, get, create, message, update };
