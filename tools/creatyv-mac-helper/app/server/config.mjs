/**
 * Where everything lives on this computer, and the settings from editing-os-saas/.env.
 *
 * Footage and renders stay on the user's own disk: jobs in JOBS_ROOT, the studio and tools in the
 * app-data folder (outside OneDrive and outside the repo).
 */
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import os from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const IS_WIN = process.platform === 'win32';
export const APP_ROOT = resolve(here, '..');
export const REPO = resolve(APP_ROOT, '..');
export const WORKER = join(REPO, 'worker');
export const PORT = Number(process.env.PORT || 4321);

// In the home folder, not AppData: Windows silently redirects AppData writes from Store-packaged
// apps into a private folder, so the same studio would look missing to a normal terminal.
export const APP_DATA = process.env.EOS_APP_DATA || join(os.homedir(), '.editing-os');
export const STUDIO_DIR = join(APP_DATA, 'studio');
export const TOOLS_DIR = join(APP_DATA, 'tools');
export const CLAUDE_DIR = join(TOOLS_DIR, 'claude');
export const CLAUDE_VERSION = '2.1.281';
export const JOBS_ROOT = process.env.JOBS_ROOT || (IS_WIN ? 'C:\\editing-os-jobs' : join(os.homedir(), 'editing-os-jobs'));
export const STUDIO_VERSION = '1.3.6';

/** The five input groups, in the order they appear on the page. */
export const GROUPS = [
  {id: 'a-roll', label: 'A-roll', hint: 'Main footage — the talking head or the hero shots'},
  {id: 'b-roll', label: 'B-roll', hint: 'Cutaways, details, product, places'},
  {id: 'references', label: 'References', hint: 'Edits you want it to feel like — files or links'},
  {id: 'audio', label: 'Audio', hint: 'Voiceover, music you own, sound effects'},
  {id: 'brand', label: 'Brand', hint: 'Logo, fonts, colours, your website'},
];
export const GROUP_IDS = GROUPS.map((g) => g.id);

/** Read .env fresh on every call, so a key pasted into the file works without a restart. */
export function loadEnv() {
  const path = join(REPO, '.env');
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/** The Claude Code engine. npm installs a native claude.exe on Windows; launch it directly. */
let claudePath = null;
export function claudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (claudePath) return claudePath;
  // The copy the helper installs for itself, so the client never installs Claude Code by hand.
  const own = join(CLAUDE_DIR, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', IS_WIN ? 'claude.exe' : 'claude');
  if (existsSync(own)) return (claudePath = own);
  // `npm start --prefix <dir>` exports npm_config_prefix, which would make `npm root -g` answer
  // with the app's own folder — ask npm without the npm_config_* it set for this run.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_/i.test(k)));
  const roots = [spawnSync(IS_WIN ? 'npm.cmd' : 'npm', ['root', '-g'], {encoding: 'utf8', shell: IS_WIN, env}).stdout?.trim()];
  // Next to the `claude` launcher on PATH (npm puts global packages beside it on Windows).
  const found = spawnSync(IS_WIN ? 'where' : 'which', [IS_WIN ? 'claude.cmd' : 'claude'], {encoding: 'utf8', env}).stdout?.split(/\r?\n/)[0]?.trim();
  if (found) roots.push(join(dirname(found), 'node_modules'), join(dirname(found), '..', 'lib', 'node_modules'));
  for (const root of roots.filter(Boolean)) {
    const p = join(root, '@anthropic-ai', 'claude-code', 'bin', IS_WIN ? 'claude.exe' : 'claude');
    if (existsSync(p)) return (claudePath = p);
  }
  return 'claude';
}

/** Forget a cached engine path, after the helper installs its own copy. */
export const resetClaudeBin = () => (claudePath = null);

export const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';
export const npxCmd = IS_WIN ? 'npx.cmd' : 'npx';
