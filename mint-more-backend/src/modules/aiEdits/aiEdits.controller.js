const service = require('./aiEdits.service');
const { sendSuccess } = require('../../utils/apiResponse');

const handle = (fn) => async (req, res, next) => {
  try {
    const { data, message, statusCode } = await fn(req);
    return sendSuccess(res, { data, message, statusCode });
  } catch (err) { next(err); }
};

const appToken = (req) => req.headers['x-api-key'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');

// ── Client ────────────────────────────────────────────────────────────────────
const list = handle(async (req) => ({ data: await service.listAiEdits(req.user.sub) }));
const create = handle(async (req) => ({ data: await service.createAiEdit(req.user.sub, req.body || {}), statusCode: 201 }));
const get = handle(async (req) => ({ data: await service.getAiEdit(req.user.sub, req.params.id) }));
const pay = handle(async (req) => ({ data: await service.payAiEdit(req.user.sub, req.params.id) }));
const verify = handle(async (req) => ({ data: await service.verifyAiEdit(req.user.sub, req.params.id, req.body || {}), message: 'Payment confirmed' }));
const connect = handle(async (req) => ({ data: await service.connectVideo(req.user.sub, req.params.id, req.body || {}) }));

// ── Desktop app ───────────────────────────────────────────────────────────────
const redeem = handle(async (req) => ({ data: await service.redeem(req.body || {}) }));
const appState = handle(async (req) => ({ data: await service.setAppState(appToken(req), req.body || {}) }));

module.exports = { list, create, get, pay, verify, connect, redeem, appState };
