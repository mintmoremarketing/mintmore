/**
 * The helper's front door. The editor's screens live on Creatyv; this server only answers
 * Creatyv's own pages, so no other website the client visits can drive it.
 *
 *   - A browser always sends Origin on cross-site fetch and EventSource: it must be a Creatyv origin.
 *   - <video> and <img> send no Origin, so those carry ?k=<key>, which only a Creatyv page can read
 *     (from /api/hello, itself behind the Origin check).
 *   - Host must be this computer, which stops DNS-rebinding pages that pose as 127.0.0.1.
 */
import {randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {APP_DATA, loadEnv, PORT} from './config.mjs';

const DEFAULT_ORIGINS = ['https://mintmore.vercel.app', 'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'];

export const allowedOrigins = (env = loadEnv()) =>
  (env.CREATYV_ORIGINS || process.env.CREATYV_ORIGINS || DEFAULT_ORIGINS.join(',')).split(',').map((o) => o.trim()).filter(Boolean);

/** A random key for this install, made once. */
export function helperKey() {
  mkdirSync(APP_DATA, {recursive: true});
  const path = join(APP_DATA, 'helper.json');
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')).key;
  const key = randomBytes(24).toString('base64url');
  writeFileSync(path, JSON.stringify({key}));
  return key;
}

const LOCAL_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]);

export function gate(req, res, next) {
  if (!LOCAL_HOSTS.has(String(req.headers.host || '').toLowerCase())) return res.status(403).end();
  const origin = req.headers.origin;
  if (origin) {
    if (!allowedOrigins().includes(origin)) return res.status(403).json({error: 'This helper only works with Creatyv.'});
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'content-type');
      // Chrome's Private/Local Network Access: a public page may reach this computer only if we say so.
      if (req.headers['access-control-request-private-network']) res.setHeader('Access-Control-Allow-Private-Network', 'true');
      res.setHeader('Access-Control-Max-Age', '600');
      return res.status(204).end();
    }
    return next();
  }
  // The local screens (npm run dev / --ui) are served from this same server.
  if (req.headers['sec-fetch-site'] === 'same-origin') return next();
  if (req.query.k && req.query.k === helperKey()) return next();
  return res.status(403).json({error: 'This helper only works with Creatyv.'});
}
