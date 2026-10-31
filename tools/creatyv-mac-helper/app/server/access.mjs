/**
 * Who pays for the AI: our own key on this laptop, or the client's paid video on Creatyv.
 *
 *   dev   — no CREATYV_API_URL: the API key and licence URL come from editing-os-saas/.env.
 *   paid  — CREATYV_API_URL is set (the downloadable app ships with it): nothing secret is on
 *           the client's computer. Each video is unlocked by a code from Creatyv after payment;
 *           the code is swapped for a token that only works through Creatyv's AI and licence
 *           proxies, for that one video, up to the budget it was paid for.
 *
 * Creatyv's side of the contract (backend, not built yet):
 *   POST {api}/api/v1/ai-edits/redeem  {code, device}  -> {token, ai_edit_id, budget_usd, expires_at}
 *   or the Creatyv page asks {api}/api/v1/ai-edits/:id/connect itself and hands the token over
 *   {api}/api/v1/ai-edits/proxy/anthropic/*            Anthropic API, x-api-key = token
 *   {api}/api/v1/ai-edits/proxy/eos-mcp                Editing OS MCP, Authorization: Bearer token
 *   POST {api}/api/v1/ai-edits/app/state  {state}      the video's status, shown on Creatyv
 */
import {randomUUID} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {APP_DATA, loadEnv} from './config.mjs';

export const apiUrl = (env = loadEnv()) => (env.CREATYV_API_URL || process.env.CREATYV_API_URL || '').replace(/\/+$/, '');
export const accessMode = (env = loadEnv()) => (apiUrl(env) ? 'paid' : 'dev');

/** A random id for this install, so Creatyv can tie an unlock to one computer. */
export function deviceId() {
  const path = join(APP_DATA, 'device.json');
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')).id;
  const id = randomUUID();
  writeFileSync(path, JSON.stringify({id}));
  return id;
}

export class PaymentRequired extends Error {
  code = 'PAYMENT_REQUIRED';
}

/** Throws PaymentRequired when this video cannot use the AI yet. */
export function assertPaid(job, env = loadEnv()) {
  if (accessMode(env) === 'dev') return;
  if (!job.access?.token) throw new PaymentRequired('This video is not unlocked yet. Pay for it on Creatyv, then paste the unlock code here.');
  if (job.access.expires_at && Date.parse(job.access.expires_at) < Date.now()) throw new PaymentRequired('This video\'s unlock has expired. Open it on Creatyv to renew it.');
}

/** Swap an unlock code from Creatyv for this video's token. */
export async function redeem(code, env = loadEnv()) {
  const api = apiUrl(env);
  if (!api) throw new Error('This copy of the app is not connected to Creatyv.');
  const res = await fetch(`${api}/api/v1/ai-edits/redeem`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({code: String(code).trim(), device: deviceId()}),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Creatyv did not accept the code (${res.status}).`);
  const d = body.data || body;
  if (!d.token) throw new Error('Creatyv did not send an unlock token.');
  return {token: d.token, ai_edit_id: d.ai_edit_id || null, budget_usd: d.budget_usd ?? null, expires_at: d.expires_at || null, redeemed_at: new Date().toISOString()};
}

/**
 * What the claude process gets: the environment additions, the MCP server entry, and every value
 * that must be redacted from logs.
 */
export function credentials(job, env = loadEnv()) {
  if (accessMode(env) === 'dev') {
    const childEnv = {ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY};
    // An organisation key that is not scoped to a workspace must name the workspace on every request.
    if (env.ANTHROPIC_WORKSPACE_ID) childEnv.ANTHROPIC_CUSTOM_HEADERS = `anthropic-workspace-id: ${env.ANTHROPIC_WORKSPACE_ID}`;
    return {
      childEnv,
      mcp: env.EOS_MCP_URL ? {type: 'http', url: env.EOS_MCP_URL} : null,
      secrets: [env.ANTHROPIC_API_KEY, env.EOS_MCP_URL],
    };
  }
  assertPaid(job, env);
  const api = apiUrl(env);
  const token = job.access.token;
  return {
    childEnv: {ANTHROPIC_BASE_URL: `${api}/api/v1/ai-edits/proxy/anthropic`, ANTHROPIC_API_KEY: token},
    mcp: {type: 'http', url: `${api}/api/v1/ai-edits/proxy/eos-mcp`, headers: {Authorization: `Bearer ${token}`}},
    secrets: [token],
  };
}

/** A token the Creatyv page fetched for this computer and handed straight to the helper. */
export function accessFromPage(body = {}) {
  const token = String(body.token || '');
  if (!/^cak_[\w-]{20,}$/.test(token)) throw new Error('Creatyv did not send a valid unlock.');
  return {token, ai_edit_id: body.ai_edit_id || null, budget_usd: body.budget_usd ?? null, expires_at: body.expires_at || null, redeemed_at: new Date().toISOString()};
}

/** Tell Creatyv how a paid video is doing. Best effort: a failed report never stops the edit. */
export function reportState(job, state, extra = {}, env = loadEnv()) {
  if (accessMode(env) !== 'paid' || !job.access?.token) return;
  fetch(`${apiUrl(env)}/api/v1/ai-edits/app/state`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-api-key': job.access.token},
    body: JSON.stringify({state, ...extra}),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

/** The job as the UI sees it: whether it is unlocked, never the token itself. */
export const publicAccess = (job) => (job.access?.token ? {unlocked: true, budget_usd: job.access.budget_usd, expires_at: job.access.expires_at} : {unlocked: false});
