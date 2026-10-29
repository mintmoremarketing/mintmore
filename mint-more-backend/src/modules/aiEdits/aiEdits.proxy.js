const express = require('express');
const { Readable } = require('stream');
const logger = require('../../utils/logger');
const service = require('./aiEdits.service');

/**
 * The only way the desktop app reaches the AI and the Creator Editing OS. The app sends its
 * per-video token, and we forward the request with our own key or licence, which never leave
 * this server. Mounted before express.json(): bodies pass through untouched, and responses stream
 * back as they arrive (the editor streams every reply).
 *
 *   /api/v1/ai-edits/proxy/anthropic/v1/messages[...]   Anthropic API, token in x-api-key
 *   /api/v1/ai-edits/proxy/eos-mcp                      Editing OS MCP, token as a Bearer
 *
 * Env (Railway): AI_EDITS_ANTHROPIC_API_KEY, AI_EDITS_EOS_MCP_URL. AI_EDITS_ANTHROPIC_BASE_URL
 * only for tests against a stub.
 */
const router = express.Router();
const rawBody = express.raw({ type: () => true, limit: '50mb' });

// Only what Claude Code needs: messages (and their token counting) and the model list.
const ANTHROPIC_PATHS = /^v1\/(messages(\/count_tokens)?|models(\/[\w.-]+)?)$/;
const FORWARD_REQUEST_HEADERS = ['content-type', 'accept', 'anthropic-version', 'anthropic-beta'];
const MCP_REQUEST_HEADERS = ['content-type', 'accept', 'mcp-session-id', 'mcp-protocol-version', 'last-event-id'];
const RESPONSE_HEADERS = ['content-type', 'request-id', 'retry-after', 'mcp-session-id', 'anthropic-ratelimit-tokens-remaining'];

const anthropicError = (res, status, message, type = 'authentication_error') => res.status(status).json({ type: 'error', error: { type, message } });

const tokenFrom = (req) => req.headers['x-api-key'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;

const pick = (headers, names) => Object.fromEntries(names.filter((n) => headers[n] !== undefined).map((n) => [n, headers[n]]));

/** Copy status and safe headers, then stream the upstream body to the client, calling onChunk per piece. */
const relay = async (upstream, res, onChunk) => {
  res.status(upstream.status);
  RESPONSE_HEADERS.forEach((name) => {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  });
  if (!upstream.body) return res.end();
  res.flushHeaders();
  await new Promise((resolve, reject) => {
    const body = Readable.fromWeb(upstream.body);
    body.on('data', (chunk) => {
      onChunk?.(chunk);
      res.write(chunk);
    });
    body.on('end', resolve);
    body.on('error', reject);
    res.on('close', () => body.destroy());
  });
  return res.end();
};

/**
 * Reads usage out of a Messages response as it streams past: `message_start` carries the model
 * and the input side, `message_delta` the final output count. A plain JSON reply has both.
 */
const usageReader = (contentType) => {
  const usage = {};
  let model = null;
  let buffer = '';
  const take = (event) => {
    if (event?.type === 'message_start') {
      model = event.message?.model || model;
      Object.assign(usage, event.message?.usage || {});
    } else if (event?.type === 'message_delta' && event.usage) {
      Object.assign(usage, event.usage);
    } else if (event?.type === 'message') {
      model = event.model || model;
      Object.assign(usage, event.usage || {});
    }
  };
  const isStream = String(contentType || '').includes('text/event-stream');
  return {
    push(chunk) {
      buffer += chunk.toString('utf8');
      if (!isStream) return;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        try { take(JSON.parse(line.slice(5))); } catch { /* keep-alive or partial line */ }
      }
    },
    result() {
      if (!isStream) {
        try { take(JSON.parse(buffer)); } catch { /* not a message */ }
      }
      return Object.keys(usage).length ? { model, usage } : null;
    },
  };
};

const withUnlock = async (req, res, onError) => {
  try {
    return await service.unlockForToken(tokenFrom(req));
  } catch (err) {
    onError(err.statusCode || 401, err.message);
    return null;
  }
};

router.all('/anthropic/*', rawBody, async (req, res) => {
  const path = req.params[0];
  if (!ANTHROPIC_PATHS.test(path)) return anthropicError(res, 404, 'Not available through Creatyv.', 'not_found_error');
  const key = process.env.AI_EDITS_ANTHROPIC_API_KEY;
  if (!key) return anthropicError(res, 503, 'Creatyv AI is not switched on yet.', 'api_error');
  const unlock = await withUnlock(req, res, (status, message) => anthropicError(res, status, message, status === 402 ? 'billing_error' : 'authentication_error'));
  if (!unlock) return undefined;

  const base = (process.env.AI_EDITS_ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
  const search = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  try {
    const upstream = await fetch(`${base}/${path}${search}`, {
      method: req.method,
      headers: { ...pick(req.headers, FORWARD_REQUEST_HEADERS), 'x-api-key': key },
      body: ['GET', 'HEAD'].includes(req.method) || !req.body?.length ? undefined : req.body,
    });
    const reader = path === 'v1/messages' ? usageReader(upstream.headers.get('content-type')) : null;
    await relay(upstream, res, reader && ((chunk) => reader.push(chunk)));
    const seen = reader?.result();
    if (seen) await service.recordUsage(unlock.id, seen.model, seen.usage);
  } catch (err) {
    logger.error('AI edit proxy failed', { unlockId: unlock.id, error: err.message });
    if (!res.headersSent) anthropicError(res, 502, 'Creatyv could not reach the AI. Try again in a minute.', 'api_error');
    else res.end();
  }
  return undefined;
});

router.all('/eos-mcp', rawBody, async (req, res) => {
  const licenceUrl = process.env.AI_EDITS_EOS_MCP_URL;
  const fail = (status, message) => res.status(status).json({ jsonrpc: '2.0', id: null, error: { code: -32001, message } });
  if (!licenceUrl) return fail(503, 'The Creator Editing OS is not switched on yet.');
  const unlock = await withUnlock(req, res, fail);
  if (!unlock) return undefined;
  try {
    const upstream = await fetch(licenceUrl, {
      method: req.method,
      headers: pick(req.headers, MCP_REQUEST_HEADERS),
      body: ['GET', 'HEAD', 'DELETE'].includes(req.method) || !req.body?.length ? undefined : req.body,
    });
    await relay(upstream, res);
  } catch (err) {
    // Never log the licence URL itself.
    logger.error('Editing OS proxy failed', { unlockId: unlock.id, error: err.message.replace(licenceUrl, '[licence]') });
    if (!res.headersSent) fail(502, 'Creatyv could not reach the Creator Editing OS. Try again in a minute.');
    else res.end();
  }
  return undefined;
});

module.exports = router;
