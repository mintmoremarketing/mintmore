const { sendSuccess } = require('../../utils/apiResponse');
const { getEntitlements } = require('./entitlement.service');
const { getCredits } = require('./credits.service');
const membershipService = require('./membership.service');
const settingsService = require('./settings.service');
const { listAuditLogs } = require('../audit/audit.service');

const requestMeta = (req) => ({
  ipAddress: req.ip || null,
  userAgent: req.headers['user-agent'] || null,
});

const entitlements = async (req, res, next) => {
  try { return sendSuccess(res, { data: await getEntitlements(req.user.sub) }); } catch (err) { next(err); }
};
const credits = async (req, res, next) => {
  try { return sendSuccess(res, { data: await getCredits(req.user.sub) }); } catch (err) { next(err); }
};
const membership = async (req, res, next) => {
  try { return sendSuccess(res, { data: { membership: await membershipService.getMembership(req.user.sub) } }); } catch (err) { next(err); }
};
const createCheckout = async (req, res, next) => {
  try { return sendSuccess(res, { statusCode: 201, data: await membershipService.createCheckout(req.user.sub, req.body) }); } catch (err) { next(err); }
};
const verifyCheckout = async (req, res, next) => {
  try { return sendSuccess(res, { data: await membershipService.verifyCheckout(req.user.sub, req.body) }); } catch (err) { next(err); }
};
const pause = async (req, res, next) => {
  try { return sendSuccess(res, { data: { membership: await membershipService.pauseMembership(req.user.sub) } }); } catch (err) { next(err); }
};
const settings = async (req, res, next) => {
  try { return sendSuccess(res, { data: { settings: await settingsService.listSettings() } }); } catch (err) { next(err); }
};
const updateSetting = async (req, res, next) => {
  try {
    const setting = await settingsService.setSetting(req.params.key, req.body.value, req.user, requestMeta(req));
    return sendSuccess(res, { data: { setting }, message: 'Setting updated' });
  } catch (err) { next(err); }
};
const audit = async (req, res, next) => {
  try { return sendSuccess(res, { data: { logs: await listAuditLogs(req.query) } }); } catch (err) { next(err); }
};

module.exports = {
  entitlements, credits, membership, createCheckout, verifyCheckout, pause,
  settings, updateSetting, audit,
};
