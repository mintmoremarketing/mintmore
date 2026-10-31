/**
 * report.json — what a job cost and how long it took, per pass and in total.
 *
 * Claude Code's stream-json output ends each run with one `{"type":"result", ...}` event carrying
 * total_cost_usd, token usage, turns and timings. That event is the source of truth for cost.
 */
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';

export const summarisePass = (result, wallMs, extra = {}) => {
  const u = result?.usage ?? {};
  return {
    subtype: result?.subtype ?? 'no_result',
    is_error: result?.is_error ?? true,
    session_id: result?.session_id ?? null,
    cost_usd: round(result?.total_cost_usd ?? 0, 4),
    turns: result?.num_turns ?? 0,
    tokens: {
      input: u.input_tokens ?? 0,
      output: u.output_tokens ?? 0,
      cache_read: u.cache_read_input_tokens ?? 0,
      cache_write: u.cache_creation_input_tokens ?? 0,
    },
    claude_api_minutes: round((result?.duration_api_ms ?? 0) / 60000, 2),
    wall_minutes: round(wallMs / 60000, 2),
    ...extra,
  };
};

export const totals = (passes, usdInr) => {
  const list = Object.values(passes);
  const sum = (f) => list.reduce((a, p) => a + f(p), 0);
  const usd = round(sum((p) => p.cost_usd), 4);
  return {
    cost_usd: usd,
    cost_inr: round(usd * usdInr, 0),
    tokens: {
      input: sum((p) => p.tokens.input),
      output: sum((p) => p.tokens.output),
      cache_read: sum((p) => p.tokens.cache_read),
      cache_write: sum((p) => p.tokens.cache_write),
    },
    turns: sum((p) => p.turns),
    wall_minutes: round(sum((p) => p.wall_minutes), 2),
  };
};

export const writeReport = (outDir, report) => {
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(outDir, 'status.json'), JSON.stringify({state: report.status, updated: new Date().toISOString()}) + '\n');
};

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
