const { sendSuccess } = require('../../utils/apiResponse');
const publicService = require('./public.service');

const ask = async (req, res, next) => {
  try {
    const answer = await publicService.answerQuestion(req.body || {});
    return sendSuccess(res, { data: answer });
  } catch (err) { next(err); }
};

const env = require('../../config/env');

const MAX_PROXY_BYTES = 200 * 1024 * 1024;
const PROXY_TIMEOUT_MS = 30000;

// Only our own storage origins may be proxied; anything else is an SSRF vector.
const allowedProxyHosts = () => {
  const hosts = new Set();
  const add = (value) => {
    try { if (value) hosts.add(new URL(value).host); } catch { /* ignore malformed config */ }
  };
  add(env.supabase?.url);
  add(env.r2?.publicBaseUrl);
  add(env.r2?.publicBaseUrls?.avatars);
  add(env.r2?.publicBaseUrls?.jobAttachments);
  return hosts;
};

const safeFileName = (name) => String(name || 'download')
  .replace(/[^\w.\- ]+/g, '_')
  .slice(0, 150) || 'download';

const proxyDownload = async (req, res, next) => {
  try {
    const { url, name } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    let target;
    try { target = new URL(url); } catch { return res.status(400).send('Invalid url'); }
    if (target.protocol !== 'https:' || !allowedProxyHosts().has(target.host)) {
      return res.status(400).send('URL not allowed');
    }

    const response = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) });
    if (!response.ok) return res.status(response.status).send('Failed to fetch from origin');

    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_PROXY_BYTES) return res.status(413).send('File too large');

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(name)}"`);

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_PROXY_BYTES) return res.status(413).send('File too large');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
};

module.exports = { ask, proxyDownload };