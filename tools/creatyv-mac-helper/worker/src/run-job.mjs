#!/usr/bin/env node
/**
 * Phase 0 job runner. One job per container run.
 *
 *   docker run --rm --env-file .env -e JOB_ID=job-001 \
 *     -v C:\editing-os-jobs\job-001:/job:ro -v C:\editing-os-jobs\job-001\output:/job/output \
 *     editing-os-worker:phase0
 *
 * 1. prepare  — link the job's inputs into the studio as a project, write the MCP config
 * 2. plan     — `claude -p` with prompts/plan.md → output/plan.md + output/plan-stills.jpg
 * 3. approve  — wait for /job/APPROVED (its text = client notes), or AUTO_APPROVE=1
 * 4. build    — `claude -p --resume <plan session>` with prompts/build.md → output/final.mp4
 * 5. report   — output/report.json: cost ($ and ₹), tokens, turns, minutes, output probe
 *
 * Secrets: ANTHROPIC_API_KEY stays in the environment of the claude process only; the MCP URL is
 * written to a private file. Both are redacted from every log line this runner writes.
 */
import {spawn, spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync, createWriteStream} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {summarisePass, totals, writeReport} from './report.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const STUDIO = env.STUDIO || '/studio';
const JOB = env.JOB_DIR || '/job';
const OUT = join(JOB, 'output');
const JOB_ID = env.JOB_ID || 'job';
const PROJECT = JOB_ID.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'job';
const MODEL = env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const BUDGET = Number(env.MAX_BUDGET_USD || 5);
const AUTO_APPROVE = env.AUTO_APPROVE === '1';
const USD_INR = Number(env.USD_INR || 96.5);
const PLAN_TIMEOUT = Number(env.PLAN_TIMEOUT_MIN || 45);
const BUILD_TIMEOUT = Number(env.BUILD_TIMEOUT_MIN || 150);
const APPROVAL_TIMEOUT = Number(env.APPROVAL_TIMEOUT_MIN || 1440);
const INPUT_DIRS = ['a-roll', 'b-roll', 'references', 'audio', 'brand'];

mkdirSync(OUT, {recursive: true});

const secrets = [env.ANTHROPIC_API_KEY, env.EOS_MCP_URL, env.EOS_MCP_URL?.split('/').pop()].filter((s) => s && s.length > 8);
const redact = (s) => secrets.reduce((acc, sec) => acc.split(sec).join('[REDACTED]'), s);
const log = (...a) => console.log(redact(`[${new Date().toISOString()}] ${a.join(' ')}`));

const report = {
  job_id: JOB_ID,
  project: PROJECT,
  model: MODEL,
  max_budget_usd_per_pass: BUDGET,
  usd_inr: USD_INR,
  started_at: new Date().toISOString(),
  status: 'starting',
  passes: {},
  errors: [],
};
const save = () => writeReport(OUT, report);

const fail = (msg) => {
  report.status = 'failed';
  report.errors.push(msg);
  report.finished_at = new Date().toISOString();
  save();
  log('FAILED:', msg);
  process.exit(1);
};

/* ------------------------------------------------------------------ 1. prepare */

function prepare() {
  if (!env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY.length < 20) fail('ANTHROPIC_API_KEY is missing — put it in .env');
  if (!existsSync(join(JOB, 'brief.md'))) fail('brief.md is missing from the job folder');

  const r = spawnSync('npm', ['run', 'new-video', '--', PROJECT], {cwd: STUDIO, encoding: 'utf8'});
  if (r.status !== 0) fail(`studio new-video failed: ${r.stderr || r.stdout}`);

  const project = join(STUDIO, 'assets', 'projects', PROJECT);
  const linked = [];
  for (const dir of INPUT_DIRS) {
    const src = join(JOB, dir);
    if (existsSync(src) && statSync(src).isDirectory() && readdirSync(src).length) {
      // A symlink, not a copy: footage can be gigabytes and the container's disk is the host's C:.
      symlinkSync(src, join(project, dir), 'dir');
      linked.push(`${dir} (${readdirSync(src).length} files)`);
    }
  }
  copyFileSync(join(JOB, 'brief.md'), join(project, 'BRIEF.md'));
  log('prepared project', PROJECT, '<-', linked.join(', ') || 'no media folders');
  report.inputs = linked;

  if (env.EOS_MCP_URL) {
    const tpl = readFileSync('/opt/worker/mcp.template.json', 'utf8');
    const path = join(env.HOME || '/home/editor', '.eos-mcp.json');
    writeFileSync(path, tpl.replace('${EOS_MCP_URL}', env.EOS_MCP_URL), {mode: 0o600});
    return path;
  }
  report.errors.push('EOS_MCP_URL not set: the editing_os_* tools (references, effects) are unavailable');
  return null;
}

/* ------------------------------------------------------------------ 2/4. a Claude pass */

function runPass(name, prompt, extraArgs, timeoutMin, mcpPath) {
  return new Promise((resolve) => {
    const args = [
      '-p', prompt,
      '--output-format', 'stream-json', '--verbose',
      '--model', MODEL,
      '--max-budget-usd', String(BUDGET),
      // Bypassing permissions is safe only because this is a throwaway container whose only
      // writable places are the studio and /job/output.
      '--permission-mode', 'bypassPermissions',
      '--add-dir', JOB,
      ...(mcpPath ? ['--mcp-config', mcpPath] : []),
      ...extraArgs,
    ];
    // The licence URL is in the MCP file; the claude process does not need it in its environment.
    const childEnv = {...env};
    delete childEnv.EOS_MCP_URL;

    const started = Date.now();
    const logFile = createWriteStream(join(OUT, `log-${name}.jsonl`));
    const errFile = createWriteStream(join(OUT, `stderr-${name}.log`));
    let sessionId = null;
    let result = null;
    let buf = '';
    let timedOut = false;

    log(`pass ${name}: model ${MODEL}, budget $${BUDGET}, timeout ${timeoutMin} min`);
    const child = spawn('claude', args, {cwd: STUDIO, env: childEnv});
    const timer = setTimeout(() => {
      timedOut = true;
      log(`pass ${name}: timeout after ${timeoutMin} min — stopping`);
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 10000);
    }, timeoutMin * 60000);

    child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        logFile.write(redact(line) + '\n');
        try {
          const ev = JSON.parse(line);
          if (ev.type === 'system' && ev.subtype === 'init') sessionId = ev.session_id;
          if (ev.type === 'result') result = ev;
          if (ev.type === 'assistant') {
            for (const c of ev.message?.content ?? []) {
              if (c.type === 'tool_use') log(`  ${name} · ${c.name}${c.input?.command ? ': ' + String(c.input.command).slice(0, 90) : ''}`);
            }
          }
        } catch {
          // Not JSON (rare): already written to the log.
        }
      }
    });
    child.stderr.on('data', (chunk) => errFile.write(redact(chunk.toString())));
    child.on('close', (code) => {
      clearTimeout(timer);
      logFile.end();
      errFile.end();
      const wall = Date.now() - started;
      const summary = summarisePass(result, wall, {exit_code: code, timed_out: timedOut});
      if (!summary.session_id) summary.session_id = sessionId;
      log(`pass ${name}: ${summary.subtype}, $${summary.cost_usd}, ${summary.turns} turns, ${summary.wall_minutes} min`);
      resolve({summary, resultText: result?.result ?? ''});
    });
  });
}

/* ------------------------------------------------------------------ 3. approval */

async function approval() {
  if (AUTO_APPROVE) return '';
  report.status = 'awaiting_approval';
  save();
  log('waiting for the client: create APPROVED in the job folder (its text, if any, becomes notes)');
  const deadline = Date.now() + APPROVAL_TIMEOUT * 60000;
  while (Date.now() < deadline) {
    const f = join(JOB, 'APPROVED');
    if (existsSync(f)) return readFileSync(f, 'utf8').trim();
    await new Promise((r) => setTimeout(r, 10000));
  }
  fail(`no approval within ${APPROVAL_TIMEOUT} min`);
  return '';
}

/* ------------------------------------------------------------------ 5. output */

function probe(file) {
  const ffprobe = join(STUDIO, 'node_modules', 'ffprobe-static', 'bin', 'linux', 'x64', 'ffprobe');
  const r = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,sample_rate,channels:format=duration,size', '-of', 'json', file], {encoding: 'utf8'});
  if (r.status !== 0) return {error: r.stderr.trim()};
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  return {
    duration_s: Number(j.format.duration),
    size_mb: Math.round(Number(j.format.size) / 1e5) / 10,
    video: v ? `${v.codec_name} ${v.width}x${v.height}` : null,
    audio: a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels}ch` : null,
  };
}

function collectFinal() {
  const final = join(OUT, 'final.mp4');
  if (existsSync(final)) return final;
  // Fall back to the newest render in the studio's out/ folder.
  const outRoot = join(STUDIO, 'out');
  const found = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (f.endsWith('.mp4')) found.push({p, t: s.mtimeMs});
    }
  };
  walk(outRoot);
  found.sort((a, b) => b.t - a.t);
  if (!found.length) return null;
  copyFileSync(found[0].p, final);
  report.errors.push(`final.mp4 was not written by the build pass; copied newest render ${found[0].p}`);
  return final;
}

/* ------------------------------------------------------------------ main */

const fill = (tpl, vars) => Object.entries({JOB_DIR: JOB, ...vars}).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(v), tpl);

const mcpPath = prepare();
report.status = 'planning';
save();

const planPrompt = fill(readFileSync(join(here, '..', 'prompts', 'plan.md'), 'utf8'), {JOB_ID, PROJECT});
const plan = await runPass('plan', planPrompt, [], PLAN_TIMEOUT, mcpPath);
report.passes.plan = plan.summary;
report.passes.plan.has_plan_md = existsSync(join(OUT, 'plan.md'));
report.passes.plan.has_plan_stills = existsSync(join(OUT, 'plan-stills.jpg'));
save();
if (plan.summary.is_error || !report.passes.plan.has_plan_md) fail(`plan pass did not produce plan.md (${plan.summary.subtype})`);

const notes = await approval();
report.client_notes = notes || null;
report.status = 'building';
save();

const buildPrompt = fill(readFileSync(join(here, '..', 'prompts', 'build.md'), 'utf8'), {
  JOB_ID,
  PROJECT,
  NOTES: notes ? `\n\nThe client's notes on the plan:\n\n> ${notes.split('\n').join('\n> ')}` : ' The client had no notes.',
});
const resume = plan.summary.session_id ? ['--resume', plan.summary.session_id] : [];
const build = await runPass('build', buildPrompt, resume, BUILD_TIMEOUT, mcpPath);
report.passes.build = build.summary;

const final = collectFinal();
report.output = final ? {file: 'output/final.mp4', ...probe(final)} : null;
report.totals = totals(report.passes, USD_INR);
report.status = final && !build.summary.is_error ? 'done' : 'failed';
if (!final) report.errors.push('no final video was produced');
report.finished_at = new Date().toISOString();
save();
log(`job ${report.status}: $${report.totals.cost_usd} (₹${report.totals.cost_inr}), ${report.totals.wall_minutes} min of Claude time`);
process.exit(report.status === 'done' ? 0 : 1);
