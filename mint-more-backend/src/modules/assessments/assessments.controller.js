const service = require('./assessments.service');
const { sendSuccess } = require('../../utils/apiResponse');

const handle = (fn, statusCode = 200) => async (req, res, next) => {
  try {
    const data = await fn(req);
    return sendSuccess(res, { data, statusCode });
  } catch (err) { next(err); }
};

module.exports = {
  list: handle((req) => service.listForFreelancer(req.user.sub)),
  get: handle((req) => service.getForFreelancer(req.params.slug, req.user.sub)),
  start: handle((req) => service.startAttempt(req.params.slug, req.user.sub), 201),
  getAttempt: handle((req) => service.getAttempt(req.params.attemptId, req.user.sub, req.user.role)),
  prepareFile: handle((req) => service.prepareFileUpload(req.params.attemptId, req.user.sub, req.body), 201),
  completeFile: handle((req) => service.completeFileUpload(req.params.attemptId, req.params.itemId, req.user.sub)),
  addLink: handle((req) => service.addLink(req.params.attemptId, req.user.sub, req.user.role, req.body), 201),
  removeItem: handle((req) => service.removeItem(req.params.attemptId, req.params.itemId, req.user.sub)),
  submit: handle((req) => service.submitAttempt(req.params.attemptId, req.user.sub, req.user.role, req.body)),
  adminList: handle((req) => service.adminListAttempts({ status: req.query.status || 'submitted' })),
  adminReview: handle((req) => service.reviewAttempt(req.params.attemptId, { id: req.user.sub }, req.body)),
};
