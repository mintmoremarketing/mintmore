/**
 * "Check my computer", and setting up the local studio the engine edits with.
 *
 * The studio is a clean, pinned Creator Editing OS install in the app-data folder (never the
 * hands-on editing-pro folder), with the same patches the cloud worker uses.
 */
import {spawn, spawnSync} from 'node:child_process';
import {createWriteStream, existsSync, mkdirSync, readFileSync, statfsSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import {join, parse} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {APP_DATA, CLAUDE_DIR, CLAUDE_VERSION, claudeBin, IS_WIN, JOBS_ROOT, loadEnv, npmCmd, npxCmd, STUDIO_DIR, STUDIO_VERSION, TOOLS_DIR, WORKER, resetClaudeBin} from './config.mjs';
import {publish} from './events.mjs';
import {ytDlpPath} from './links.mjs';
import {captureBase} from '../../worker/src/studio-guard.mjs';
import {accessMode} from './access.mjs';

const GB = 1024 ** 3;
const MARK = join(STUDIO_DIR, '.editing-os-setup.json');
let setupRunning = null;
let keyProbe = null; // {sig, at, ok, fix}

/**
 * Test the API key for real, using the free model-list endpoint (no tokens spent). Cached per
 * key + workspace for 5 minutes, so the check page stays fast.
 */
export async function probeKey() {
  const env = loadEnv();
  if (accessMode(env) === 'paid') return (keyProbe = null);
  const key = env.ANTHROPIC_API_KEY || '';
  if (key.length <= 20) return (keyProbe = null);
  const sig = `${key.slice(-6)}|${env.ANTHROPIC_WORKSPACE_ID || ''}`;
  if (keyProbe?.sig === sig && Date.now() - keyProbe.at < 5 * 60000) return keyProbe;
  const headers = {'x-api-key': key, 'anthropic-version': '2023-06-01'};
  if (env.ANTHROPIC_WORKSPACE_ID) headers['anthropic-workspace-id'] = env.ANTHROPIC_WORKSPACE_ID;
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=1', {headers, signal: AbortSignal.timeout(10000)});
    const body = await res.text();
    const {explainApiError} = await import('./engine.mjs');
    keyProbe = {sig, at: Date.now(), ok: res.ok, fix: res.ok ? null : explainApiError(`API Error: ${res.status} ${body}`)};
  } catch (e) {
    keyProbe = {sig, at: Date.now() - 4 * 60000, ok: false, fix: `Could not reach the AI service: ${e.message}. Check the internet connection.`};
  }
  return keyProbe;
}
let versionCache = null;

export function studioReady() {
  return existsSync(MARK) && existsSync(join(STUDIO_DIR, 'node_modules', 'remotion'));
}

export function check() {
  const env = loadEnv();
  const items = [];
  const add = (id, label, state, detail, fix, action) => items.push({id, label, state, detail, fix, action});

  const cores = os.cpus().length;
  add('cpu', 'Processor', cores >= 8 ? 'ok' : cores >= 4 ? 'warn' : 'bad', `${cores} threads — ${os.cpus()[0]?.model.trim()}`,
    cores >= 8 ? null : cores >= 4 ? 'Works, but renders are slow. Close other apps while rendering.' : 'Below the minimum (4). Editing will be very slow.');
  const ram = os.totalmem() / GB;
  add('ram', 'Memory', ram >= 16 ? 'ok' : ram >= 8 ? 'warn' : 'bad', `${ram.toFixed(1)} GB`,
    ram >= 16 ? null : ram >= 8 ? 'Enough for short videos. Close browsers with many tabs while rendering.' : 'Below the minimum (8 GB).');
  try {
    mkdirSync(JOBS_ROOT, {recursive: true});
    const s = statfsSync(JOBS_ROOT);
    const free = (s.bavail * s.bsize) / GB;
    add('disk', 'Free space', free >= 25 ? 'ok' : free >= 5 ? 'warn' : 'bad', `${free.toFixed(1)} GB free on ${parse(JOBS_ROOT).root || JOBS_ROOT}`,
      free >= 25 ? null : free >= 10 ? 'Enough for a few videos. Delete old jobs when done.' : free >= 5 ? 'Tight: enough for one short test video. Aim for 10 GB or more.' : 'Below 5 GB: free some space before you start (the studio alone needs about 1 GB).');
  } catch (e) {
    add('disk', 'Free space', 'warn', 'Could not read free space', String(e.message));
  }
  const major = Number(process.versions.node.split('.')[0]);
  add('node', 'Node.js', major >= 20 ? 'ok' : 'bad', `v${process.versions.node}`, major >= 20 ? null : 'Install Node 20 or newer from nodejs.org.');

  const ready = studioReady();
  let ver = null;
  try {
    ver = JSON.parse(readFileSync(join(STUDIO_DIR, '.studio.json'), 'utf8')).version;
  } catch {}
  add('studio', 'Editing studio', ready ? 'ok' : 'bad', ready ? `Creator Editing OS studio ${ver} in ${STUDIO_DIR}` : 'Not set up yet',
    ready ? null : 'One-time setup: downloads the studio and its video engine (~1 GB, 10–15 min).', ready ? null : 'setup-studio');
  const ff = join(STUDIO_DIR, 'node_modules', 'ffmpeg-static');
  add('ffmpeg', 'Video converter (ffmpeg)', existsSync(ff) ? 'ok' : 'bad', existsSync(ff) ? 'Bundled with the studio' : 'Arrives with the studio setup', null);
  const browser = join(STUDIO_DIR, 'node_modules', '.remotion', 'chrome-headless-shell');
  add('browser', 'Render browser', existsSync(browser) ? 'ok' : 'bad', existsSync(browser) ? 'Installed' : 'Arrives with the studio setup', null);

  // Asking the engine and Python for their versions is slow and blocks the server: cache them.
  if (!versionCache || Date.now() - versionCache.at > 5 * 60000) {
    versionCache = {
      at: Date.now(),
      claude: spawnSync(claudeBin(), ['--version'], {encoding: 'utf8', timeout: 20000}),
      py: spawnSync(IS_WIN ? 'py' : 'python3', IS_WIN ? ['-3.12', '--version'] : ['--version'], {encoding: 'utf8'}),
    };
  }
  const v = versionCache.claude;
  add('claude', 'AI editor (Claude Code)', v.status === 0 ? 'ok' : 'bad', v.status === 0 ? v.stdout.trim() : 'Not found',
    v.status === 0 ? null : 'Arrives with the studio setup.', v.status === 0 ? null : 'setup-studio');
  const key = env.ANTHROPIC_API_KEY || '';
  if (accessMode(env) === 'paid') {
    add('key', 'AI access', 'ok', 'Through Creatyv', 'Each video unlocks after you pay for it on Creatyv. Nothing secret is stored on this computer.');
  } else if (key.length <= 20) {
    add('key', 'AI access', 'bad', 'No API key', 'Open editing-os-saas\\.env and paste your Claude API key after ANTHROPIC_API_KEY= (Stage 2 replaces this with your login).');
  } else if (!keyProbe || keyProbe.ok === null) {
    add('key', 'AI access', 'warn', 'API key found — not tested yet', 'Refresh this page in a moment.');
  } else {
    add('key', 'AI access', keyProbe.ok ? 'ok' : 'bad', keyProbe.ok ? `API key works${env.ANTHROPIC_WORKSPACE_ID ? ' (workspace set)' : ''}` : 'API key does not work yet', keyProbe.ok ? null : keyProbe.fix);
  }
  if (accessMode(env) === 'dev') add('licence', 'Creator Editing OS licence', env.EOS_MCP_URL ? 'ok' : 'warn', env.EOS_MCP_URL ? 'Connected (key kept private)' : 'Not connected',
    env.EOS_MCP_URL ? null : 'Run node scripts/setup-env.mjs in editing-os-saas, or paste the MCP URL into .env.');
  add('ytdlp', 'Link downloader (YouTube, Instagram)', existsSync(ytDlpPath()) ? 'ok' : 'warn', existsSync(ytDlpPath()) ? 'Installed' : 'Not installed',
    existsSync(ytDlpPath()) ? null : 'Needed only for YouTube / Instagram / TikTok links. Drive, Dropbox and direct links work without it.', existsSync(ytDlpPath()) ? null : 'install-ytdlp');
  const py = versionCache.py;
  add('python', 'Python (optional)', py.status === 0 ? 'ok' : 'warn', py.status === 0 ? (py.stdout || py.stderr).trim() : 'Not found',
    py.status === 0 ? null : 'Only for grading helpers and captions. Install Python 3.12 if you need them.');

  const blocking = items.filter((i) => i.state === 'bad');
  return {ok: blocking.length === 0, canEdit: !blocking.length, items, studio: STUDIO_DIR, jobsRoot: JOBS_ROOT, appData: APP_DATA};
}

/* ------------------------------------------------------------------ setup */

const log = (line, level = 'info') => publish('system', {type: 'log', level, line});

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    log(`$ ${[cmd, ...args].join(' ')}`);
    // Only .cmd launchers need a shell on Windows. Running node.exe through one splits any path
    // with a space in it ("Demo projects") into two arguments.
    const child = spawn(cmd, args, {cwd, shell: IS_WIN && /\.cmd$/i.test(cmd), env: {...process.env, npm_config_fund: 'false', npm_config_audit: 'false'}});
    const out = (d) => d.toString().split(/\r?\n/).filter((l) => l.trim()).forEach((l) => log(l.slice(0, 300)));
    child.stdout.on('data', out);
    child.stderr.on('data', out);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args[0]} exited with ${code}`))));
  });
}

async function fetchTo(url, path) {
  const res = await fetch(url, {redirect: 'follow'});
  if (!res.ok) throw new Error(`download failed: ${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
}

export function setupStudio() {
  if (setupRunning) return setupRunning;
  setupRunning = (async () => {
    publish('system', {type: 'setup', state: 'running', step: 'studio'});
    mkdirSync(STUDIO_DIR, {recursive: true});
    const fresh = !existsSync(join(STUDIO_DIR, 'package.json'));
    if (fresh) await run(npxCmd, ['-y', `creator-editing-studio@${STUDIO_VERSION}`, 'init', '.'], STUDIO_DIR);
    log('Installing the video engine — the long step (5–15 min).');
    await run(npmCmd, ['install', '--no-audit', '--no-fund'], STUDIO_DIR);
    await run(npxCmd, ['remotion', 'browser', 'ensure'], STUDIO_DIR);
    const fonts = join(STUDIO_DIR, 'assets', 'fonts');
    mkdirSync(fonts, {recursive: true});
    if (!existsSync(join(fonts, 'Inter-Variable.ttf'))) {
      log('Downloading the Inter font');
      await fetchTo('https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf', join(fonts, 'Inter-Variable.ttf'));
    }
    await run(process.execPath, [join(WORKER, 'studio-patches', 'apply.mjs'), STUDIO_DIR], STUDIO_DIR);
    // A studio this setup just made is clean: record it as the base every job starts from.
    if (fresh) captureBase(STUDIO_DIR);
    if (IS_WIN && spawnSync('py', ['-3.12', '--version']).status === 0 && !existsSync(join(STUDIO_DIR, '.venv'))) {
      await run('py', ['-3.12', '-m', 'venv', '.venv'], STUDIO_DIR).catch((e) => log(String(e), 'warn'));
      await run(join(STUDIO_DIR, '.venv', 'Scripts', 'python.exe'), ['-m', 'pip', 'install', '--quiet', 'numpy', 'pillow'], STUDIO_DIR).catch((e) => log(String(e), 'warn'));
    }
    if (spawnSync(claudeBin(), ['--version'], {timeout: 20000}).status !== 0) {
      log('Installing the AI editor');
      mkdirSync(CLAUDE_DIR, {recursive: true});
      await run(npmCmd, ['install', '--prefix', CLAUDE_DIR, '--no-audit', '--no-fund', `@anthropic-ai/claude-code@${CLAUDE_VERSION}`], CLAUDE_DIR);
      resetClaudeBin();
      versionCache = null;
    }
    writeFileSync(MARK, JSON.stringify({version: STUDIO_VERSION, at: new Date().toISOString()}));
    log('Studio ready.');
    publish('system', {type: 'setup', state: 'done', step: 'studio'});
  })()
    .catch((e) => {
      log(`Setup failed: ${e.message}`, 'error');
      publish('system', {type: 'setup', state: 'failed', step: 'studio', error: e.message});
    })
    .finally(() => (setupRunning = null));
  return setupRunning;
}

export async function installYtDlp() {
  mkdirSync(TOOLS_DIR, {recursive: true});
  publish('system', {type: 'setup', state: 'running', step: 'ytdlp'});
  const asset = IS_WIN ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp';
  log(`Downloading yt-dlp from its official GitHub release (${asset})`);
  try {
    await fetchTo(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`, ytDlpPath());
    if (!IS_WIN) spawnSync('chmod', ['+x', ytDlpPath()]);
    log('Link downloader ready.');
    publish('system', {type: 'setup', state: 'done', step: 'ytdlp'});
  } catch (e) {
    log(`Could not install the link downloader: ${e.message}`, 'error');
    publish('system', {type: 'setup', state: 'failed', step: 'ytdlp', error: e.message});
  }
}
