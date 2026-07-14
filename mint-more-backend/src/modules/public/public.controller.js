const { sendSuccess } = require('../../utils/apiResponse');
const publicService = require('./public.service');

const ask = async (req, res, next) => {
  try {
    const answer = await publicService.answerQuestion(req.body || {});
    return sendSuccess(res, { data: answer });
  } catch (err) { next(err); }
};

const proxyDownload = async (req, res, next) => {
  try {
    const { url, name } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');
    
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).send('Failed to fetch from origin');
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${name || 'download'}"`);
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
};

module.exports = { ask, proxyDownload };