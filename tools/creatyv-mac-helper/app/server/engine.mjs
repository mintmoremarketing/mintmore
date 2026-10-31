/**
 * The local engine: runs the plan and build passes with Claude Code against the local studio, on
 * this computer. Footage never leaves the disk; only text and small stills go to the AI.
 *
 * Same prompts, studio patches and cost report as the cloud worker (../../worker). Stage 2 swaps
 * the API key from .env for our AI proxy (ANTHROPIC_BASE_URL + a per-user token) and the licence
 * URL for our licence proxy — nothing else here changes.
 *
 * One pass at a time: the studio is shared, and a laptop renders one video at a time anyway.
 */
import {spawn, spawnSync} from 'node:child_process';
import {copyFileSync, createWriteStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmdirSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {APP_DATA, claudeBin, GROUP_IDS, IS_WIN, JOBS_ROOT, loadEnv, npmCmd, STUDIO_DIR, STUDIO_VERSION, WORKER} from './config.mjs';
import {clearLog, publish} from './events.mjs';
import {getJob, jobDir, missingBriefFields, updateJob, writeBrief} from './jobs.mjs';
import {check, studioReady} from './studio.mjs';
import {summarisePass, totals} from '../../worker/src/report.mjs';
import {assertPaid, credentials, reportState} from './access.mjs';
import {readQuestions} from './questions.mjs';
import {enterJob, findTemplate, hasBase, leaveJob, repair} from '../../worker/src/studio-guard.mjs';

let active = null; // {jobId, pass, child}
const queue = [];

const projectName = (jobId) => ('j-' + jobId).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 48);
const fwd = (p) => p.replace(/\\/g, '/');
const log = (jobId, line, level = 'info') => publish(jobId, {type: 'log', level, line});

export const engineState = () => ({active: active ? {jobId: active.jobId, pass: active.pass} : null, queued: queue.map((q) => q.jobId)});

export function startPass(jobId, pass, notes = '') {
  const job = getJob(jobId);
  if (!job) throw new Error('job not found');
  if (active?.jobId === jobId || queue.some((q) => q.jobId === jobId)) throw new Error('This video is already being worked on.');
  const c = check();
  const blocking = c.items.filter((i) => i.state === 'bad');
  if (blocking.length) throw new Error(`This computer is not ready: ${blocking.map((b) => b.label).join(', ')}. Open "Check my computer".`);
  if (pass === 'plan') {
    const missing = missingBriefFields(job);
    if (missing.length) throw new Error(`Fill in: ${missing.join(', ')}.`);
    if (!job.items.some((i) => i.status === 'done')) throw new Error('Add at least one file or link first.');
    if (job.items.some((i) => i.status === 'downloading' || i.status === 'queued')) throw new Error('Wait for the links to finish downloading.');
  }
  let cont = false;
  if (pass === 'continue') {
    if (job.status !== 'interrupted' || !job.interrupted_pass) throw new Error('Nothing to continue.');
    pass = job.interrupted_pass;
    cont = true;
  }
  if (pass !== 'plan' && !job.passes.some((p) => p.pass === 'plan' && p.session_id)) throw new Error('Make the plan first.');
  assertPaid(job); // paid mode: the video must be unlocked on Creatyv
  passBudget(loadEnv(), pass, job); // throws when the video's total budget is used up
  updateJob(jobId, (j) => {
    j.status = 'queued';
    j.error = null;
    j.interrupted_pass = null;
    if (notes) (j.notes ||= []).push({at: new Date().toISOString(), pass, text: notes});
  });
  queue.push({jobId, pass, notes, cont});
  pump();
}

/**
 * At start-up: a job still marked queued / planning / building was cut off when the app closed.
 * Record the cut-off pass's session (from its log) so "Continue" can resume the editor's own
 * conversation, and mark the job interrupted instead of leaving it stuck on "running".
 */
export function recoverInterrupted() {
  for (const d of readdirSync(JOBS_ROOT, {withFileTypes: true})) {
    if (!d.isDirectory()) continue;
    const job = getJob(d.name);
    if (!job || !['queued', 'planning', 'building'].includes(job.status)) continue;
    const out = join(jobDir(job.id), 'output');
    const logs = existsSync(out) ? readdirSync(out).filter((f) => /^log-(plan|build|revise)-\d+\.jsonl$/.test(f)) : [];
    const newest = logs.sort((a, b) => Number(a.match(/(\d+)\.jsonl$/)[1]) - Number(b.match(/(\d+)\.jsonl$/)[1])).pop();
    const pass = newest?.match(/^log-(\w+)-/)[1];
    let sessionId = null;
    for (const line of newest ? readFileSync(join(out, newest), 'utf8').split('\n') : []) {
      if (!line.includes('"init"')) continue;
      try {
        sessionId = JSON.parse(line).session_id || null;
      } catch {}
      if (sessionId) break;
    }
    const recorded = newest && job.passes.some((p) => p.session_id === sessionId);
    updateJob(job.id, (j) => {
      if (sessionId && !recorded) j.passes.push({pass, session_id: sessionId, interrupted: true, cost_usd: 0, at: new Date().toISOString()});
      j.status = sessionId ? 'interrupted' : job.outputs?.plan || existsSync(join(out, 'plan.md')) ? 'plan_ready' : 'draft';
      j.interrupted_pass = sessionId ? pass : null;
    });
  }
}

export function stop(jobId) {
  const i = queue.findIndex((q) => q.jobId === jobId);
  if (i >= 0) queue.splice(i, 1);
  if (active?.jobId === jobId && active.child) {
    if (IS_WIN) spawnSync('taskkill', ['/PID', String(active.child.pid), '/T', '/F']);
    else active.child.kill('SIGTERM');
  }
  updateJob(jobId, (j) => {
    j.status = 'stopped';
  });
}

function pump() {
  if (active || !queue.length) return;
  const next = queue.shift();
  active = {jobId: next.jobId, pass: next.pass};
  runPass(next)
    .catch((e) => {
      log(next.jobId, `Failed: ${e.message}`, 'error');
      updateJob(next.jobId, (j) => {
        j.status = 'failed';
        j.error = e.message;
      });
    })
    .finally(() => {
      active = null;
      pump();
    });
}

/* ------------------------------------------------------------------ preparing the studio */

function prepare(job) {
  if (!studioReady()) throw new Error('The studio is not set up yet.');
  const project = projectName(job.id);
  const pdir = join(STUDIO_DIR, 'assets', 'projects', project);
  if (!existsSync(pdir)) {
    const r = spawnSync(npmCmd, ['run', 'new-video', '--', project], {cwd: STUDIO_DIR, encoding: 'utf8', shell: IS_WIN});
    if (r.status !== 0) throw new Error(`studio could not create the project: ${(r.stderr || r.stdout).slice(-300)}`);
  }
  // Link (never copy) each group folder into the studio project: a junction on Windows needs no
  // admin rights and costs no disk space. Removing a junction removes only the link.
  for (const g of GROUP_IDS) {
    const target = join(jobDir(job.id), g);
    const link = join(pdir, g);
    if (!existsSync(target) || !readdirSync(target).length) continue;
    try {
      if (lstatSync(link)) continue;
    } catch {}
    symlinkSync(target, link, IS_WIN ? 'junction' : 'dir');
  }
  writeBrief(job);
  copyFileSync(join(jobDir(job.id), 'brief.md'), join(pdir, 'BRIEF.md'));
  return project;
}

/**
 * Each job's own copy of the studio's shared code (see worker/src/studio-guard.mjs). A studio set
 * up before the guard existed is first reset to the shipped files, so no earlier job's look leaks.
 */
const overridesDir = (jobId) => join(jobDir(jobId), 'studio-overrides');

function guardStudio(jobId) {
  if (!hasBase(STUDIO_DIR)) repair(STUDIO_DIR, findTemplate(STUDIO_VERSION, join(APP_DATA, 'tmp')));
  return enterJob(STUDIO_DIR, overridesDir(jobId), jobId);
}

function mcpConfig(server) {
  if (!server) return null;
  const path = join(APP_DATA, 'eos-mcp.json');
  writeFileSync(path, JSON.stringify({mcpServers: {'creator-editing-os': server}}, null, 2), {mode: 0o600});
  return path;
}

/* ------------------------------------------------------------------ spend caps */

/**
 * The cap for one pass: its own cap, but never more than what is left of the video's total cap,
 * so a run of revisions cannot cost more than the video was priced for.
 */
export function passBudget(env, pass, job) {
  const fallback = Number(env.MAX_BUDGET_USD || 5);
  const own = Number({plan: env.PLAN_BUDGET_USD, build: env.BUILD_BUDGET_USD, revise: env.REVISE_BUDGET_USD}[pass] || fallback);
  const left = Number(env.JOB_BUDGET_USD || Infinity) - (job.cost_usd || 0);
  if (left < 0.25) throw new Error(`This video has used its whole AI budget ($${env.JOB_BUDGET_USD}).`);
  return Math.round(Math.min(own, left) * 100) / 100;
}

/* ------------------------------------------------------------------ a pass */

async function runPass({jobId, pass, notes, cont}) {
  const job = getJob(jobId);
  const env = loadEnv();
  clearLog(jobId);
  const out = join(jobDir(jobId), 'output');
  mkdirSync(out, {recursive: true});
  const project = prepare(job);
  const replayed = guardStudio(jobId);
  if (replayed.length) log(jobId, `Restored this video's own studio edits (${replayed.length} file${replayed.length > 1 ? 's' : ''}).`);
  const creds = credentials(job, env);
  const mcp = mcpConfig(creds.mcp);
  const model = env.CLAUDE_MODEL || 'claude-sonnet-5-5';
  const budget = String(passBudget(env, pass, job));
  const timeoutMin = Number(pass === 'plan' ? env.PLAN_TIMEOUT_MIN || 45 : env.BUILD_TIMEOUT_MIN || 150);

  const promptFile = pass === 'plan' ? 'plan.md' : 'build.md';
  const notesBlock = notes
    ? `\n\nThe client's notes:\n\n> ${notes.split('\n').join('\n> ')}`
    : pass === 'plan' ? '' : ' The client had no notes.';
  let prompt = readFileSync(join(WORKER, 'prompts', promptFile), 'utf8');
  for (const [k, v] of Object.entries({JOB_ID: jobId, PROJECT: project, JOB_DIR: fwd(jobDir(jobId)), NOTES: notesBlock})) prompt = prompt.split(`{{${k}}}`).join(v);
  if (pass === 'plan' && notes) prompt += `\n\nThis is a new version of the plan. The client's notes on the previous one:${notesBlock}`;
  if (pass === 'revise') prompt = `The client watched final.mp4 and asked for changes.${notesBlock}\n\nApply them to the edit (keep everything they did not mention), re-render, re-verify, and overwrite the files in ${fwd(out)}. Update delivery.md with what changed.`;
  if (cont) prompt = `You were cut off: the app on the client's computer closed in the middle of this ${pass} pass, and every command you had running (renders, encodes, waits) was killed, so files they were writing may be partial. Check what already exists, redo whatever was cut off, and finish the pass exactly as you were instructed — ${pass === 'plan' ? `plan.md and plan-stills.jpg in ${fwd(out)}` : `final.mp4, delivery.md and the stems in ${fwd(out)}, verified`}.`;

  // Build and revise continue the plan's conversation, so the editor remembers its own prep.
  // Continuing a cut-off pass resumes that pass's own conversation (recorded at start-up).
  const last = [...job.passes].reverse().find((p) => p.session_id);
  const resume = (cont || pass !== 'plan') && last ? ['--resume', last.session_id] : [];

  const args = [
    '-p',
    '--output-format', 'stream-json', '--verbose',
    '--model', model,
    '--max-budget-usd', budget,
    // Edits are auto-accepted only inside the studio and the job folder; tools are an allow-list.
    '--permission-mode', 'acceptEdits',
    '--allowedTools', 'Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'WebFetch', 'TodoWrite', 'mcp__creator-editing-os',
    '--add-dir', jobDir(jobId),
    ...(mcp ? ['--mcp-config', mcp] : []),
    ...resume,
  ];

  updateJob(jobId, (j) => (j.status = pass === 'plan' ? 'planning' : 'building'));
  reportState(job, pass === 'plan' ? 'planning' : 'building');
  log(jobId, `${cont ? 'Continuing the cut-off ' + pass + ' pass' : pass === 'plan' ? 'Planning' : pass === 'build' ? 'Building' : 'Revising'} with ${model} (budget $${budget}, limit ${timeoutMin} min)…`);

  const secrets = creds.secrets.filter((s) => s && s.length > 8);
  const redact = (s) => secrets.reduce((a, sec) => a.split(sec).join('[REDACTED]'), s);
  const childEnv = {...process.env, ...creds.childEnv, DISABLE_AUTOUPDATER: '1'};

  const started = Date.now();
  const logFile = createWriteStream(join(out, `log-${pass}-${started}.jsonl`));
  const child = spawn(claudeBin(), args, {cwd: STUDIO_DIR, env: childEnv});
  active.child = child;
  child.stdin.end(prompt);

  let buf = '';
  let result = null;
  let sessionId = null;
  let stderr = '';
  const timer = setTimeout(() => {
    log(jobId, `Stopped: took longer than ${timeoutMin} minutes.`, 'error');
    if (IS_WIN) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    else child.kill('SIGTERM');
  }, timeoutMin * 60000);

  child.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      logFile.write(redact(line) + '\n');
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.type === 'system' && ev.subtype === 'init') sessionId = ev.session_id;
      if (ev.type === 'result') result = ev;
      if (ev.type === 'assistant') {
        for (const c of ev.message?.content ?? []) {
          if (c.type === 'text' && c.text.trim()) log(jobId, redact(c.text.trim().slice(0, 400)), 'say');
          if (c.type === 'tool_use') log(jobId, redact(describeTool(c)), 'tool');
        }
      }
    }
  });
  child.stderr.on('data', (d) => (stderr += d.toString()));

  const code = await new Promise((r) => child.on('close', r));
  clearTimeout(timer);
  logFile.end();
  const edits = leaveJob(STUDIO_DIR, overridesDir(jobId));
  if (edits.locked.length) log(jobId, `Changed shared studio files (kept for this video only): ${edits.locked.join(', ')}`, 'warn');
  const summary = summarisePass(result, Date.now() - started, {pass, exit_code: code, studio_edits: edits.kept, locked_edits: edits.locked});
  if (!summary.session_id) summary.session_id = sessionId;

  const has = (f) => existsSync(join(out, f));
  const ok = pass === 'plan' ? has('plan.md') : has('final.mp4');
  updateJob(jobId, (j) => {
    j.passes.push({...summary, at: new Date().toISOString()});
    j.cost_usd = Math.round(j.passes.reduce((a, p) => a + (p.cost_usd || 0), 0) * 10000) / 10000;
    if (j.status === 'stopped') return;
    j.status = ok && !summary.is_error ? (pass === 'plan' ? 'plan_ready' : 'done') : 'failed';
    if (j.status === 'failed') {
      // The result text carries the real reason (an API error, a refusal); stderr is the fallback.
      const said = typeof result?.result === 'string' && result.result.trim();
      j.error = summary.subtype === 'error_max_budget_usd'
        ? 'Hit the spend limit for this pass.'
        : /API Error/i.test(said || '') ? explainApiError(said)
        : !ok && !summary.is_error ? `The editor finished without writing ${pass === 'plan' ? 'plan.md' : 'final.mp4'}. ${said ? said.slice(0, 300) : ''}`
        : (said || stderr.trim().split('\n').pop() || `The editor stopped (${summary.subtype}).`).slice(0, 500);
    }
    const t = totals(Object.fromEntries(j.passes.map((p, i) => [`${p.pass}-${i}`, p])), Number(env.USD_INR || 96.5));
    writeFileSync(join(out, 'report.json'), JSON.stringify({job_id: j.id, model, passes: j.passes, totals: t, final: has('final.mp4') ? probeFinal(join(out, 'final.mp4')) : null}, null, 2));
  });
  const failed = getJob(jobId).status === 'failed';
  // Creatyv tells the client when an outline waits on their answers, before they'd approve blind.
  const status = getJob(jobId).status;
  reportState(job, status, status === 'plan_ready' ? {questions: readQuestions(jobId).length} : {});
  log(jobId, failed
    ? `Stopped — ${getJob(jobId).error} ($${summary.cost_usd}, ${summary.wall_minutes} min)`
    : `${pass === 'plan' ? 'Plan' : 'Video'} ready — $${summary.cost_usd}, ${summary.turns} turns, ${summary.wall_minutes} min.`, failed ? 'error' : 'info');
}

/** Turn the API errors people actually hit into a fix they can do. */
export function explainApiError(text) {
  if (/workspace/i.test(text)) return 'Your API key is not tied to a workspace. Either create a key inside a workspace (console.anthropic.com → Settings → Workspaces → open one → API keys) and paste it into .env, or add ANTHROPIC_WORKSPACE_ID=<workspace id> to .env.';
  if (/401|invalid x-api-key|authentication/i.test(text)) return 'The API key was rejected. Check ANTHROPIC_API_KEY in .env (no spaces or quotes).';
  if (/credit balance|billing/i.test(text)) return 'The API account has no credit. Add credit in console.anthropic.com → Billing.';
  if (/rate limit|429/i.test(text)) return 'The API rate limit was hit. Wait a minute and try again.';
  if (/model/i.test(text) && /not.?found|404/i.test(text)) return 'That model is not available on this key. Change CLAUDE_MODEL in .env.';
  return text.slice(0, 400);
}

function describeTool(c) {
  const i = c.input || {};
  if (c.name === 'Bash') return `▸ ${String(i.description || i.command || '').slice(0, 140)}`;
  if (c.name === 'Write' || c.name === 'Edit' || c.name === 'MultiEdit') return `✎ ${String(i.file_path || '').split(/[\\/]/).slice(-2).join('/')}`;
  if (c.name === 'Read') return `👁 ${String(i.file_path || '').split(/[\\/]/).slice(-2).join('/')}`;
  if (c.name.startsWith('mcp__')) return `◆ ${c.name.replace('mcp__creator-editing-os__', 'Editing OS: ')}`;
  return `• ${c.name}`;
}

function probeFinal(file) {
  const platform = IS_WIN ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const bin = join(STUDIO_DIR, 'node_modules', 'ffprobe-static', 'bin', platform, arch, IS_WIN ? 'ffprobe.exe' : 'ffprobe');
  const r = spawnSync(bin, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,sample_rate:format=duration,size', '-of', 'json', file], {encoding: 'utf8'});
  if (r.status !== 0) return {size_mb: Math.round(statSync(file).size / 1e5) / 10};
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  return {duration_s: Number(j.format.duration), size_mb: Math.round(Number(j.format.size) / 1e5) / 10, video: v && `${v.width}x${v.height}`, audio: a ? `${a.codec_name} ${a.sample_rate} Hz` : null};
}
