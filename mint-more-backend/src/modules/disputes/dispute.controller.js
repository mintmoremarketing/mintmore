const service = require('./dispute.service');
const { sendSuccess } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const disputes = await service.listDisputes(req.user.sub, req.user.role, req.query);
    return sendSuccess(res, { data: { disputes } });
  } catch (err) { next(err); }
};

const get = async (req, res, next) => {
  try {
    const result = await service.getDispute(req.params.disputeId, req.user.sub, req.user.role);
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const open = async (req, res, next) => {
  try {
    const dispute = await service.openDispute(req.params.jobId, req.user.sub, req.user.role, req.body);
    return sendSuccess(res, { data: { dispute }, message: 'Dispute opened. Escrow remains locked.', statusCode: 201 });
  } catch (err) { next(err); }
};

const addMessage = async (req, res, next) => {
  try {
    const message = await service.addMessage(req.params.disputeId, req.user.sub, req.user.role, req.body.body);
    return sendSuccess(res, { data: { message }, message: 'Message added' });
  } catch (err) { next(err); }
};

const resolve = async (req, res, next) => {
  try {
    const dispute = await service.resolveDispute(req.params.disputeId, req.user.sub, req.body);
    return sendSuccess(res, { data: { dispute }, message: 'Dispute resolved' });
  } catch (err) { next(err); }
};

module.exports = { list, get, open, addMessage, resolve };
