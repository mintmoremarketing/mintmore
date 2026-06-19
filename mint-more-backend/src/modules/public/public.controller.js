const { sendSuccess } = require('../../utils/apiResponse');
const publicService = require('./public.service');

const ask = async (req, res, next) => {
  try {
    const answer = await publicService.answerQuestion(req.body || {});
    return sendSuccess(res, { data: answer });
  } catch (err) { next(err); }
};

module.exports = { ask };