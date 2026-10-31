#!/usr/bin/env node
/**
 * Keeps one job's edits to the studio's shared code from leaking into the next job.
 *
 * The studio's components, helpers and design files are shared by every video in it. A job may
 * restyle its video (tokens.ts, logos.json), and an editor sometimes adds a constant to motion.ts
 * or tweaks a component. Without a guard, the next client's video silently inherits all of it.
 *
 *   .studio-base/          clean copy of the guarded trees (shipped studio + our patches)
 *   <job>/studio-overrides/ the files this job changed or added, replayed before its next pass
 *
 * enterJob() resets the guarded trees to the base and lays the job's own overrides on top.
 * leaveJob() saves what the pass changed into the job, resets the studio, and reports any change
 * to a locked file (anything but the job's look) so it shows up in report.json.
 *
 *   node studio-guard.mjs capture <studio>
 *   node studio-guard.mjs repair  <studio> <shipped template dir> [<job overrides dir>]
 */
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const GUARDED = ['src/design', 'src/components', 'src/lib'];
/** The only shared files a job may change: its look. Everything else job-specific goes in src/videos/<project>/. */
export const JOB_OWNED = ['src/design/tokens.ts', 'src/design/logos.json'];

const BASE = '.studio-base';
const ACTIVE = 'ACTIVE.json';
const posix = (p) => p.split(sep).join('/');

function listFiles(root) {
  const out = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(posix(relative(root, p)));
    }
  };
  for (const g of GUARDED) walk(join(root, g));
  return out;
}

const same = (a, b) => existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));

export const hasBase = (studio) => existsSync(join(studio, BASE, 'src'));

/** Record the guarded trees as they are now as the clean base. Only call on a clean studio. */
export function captureBase(studio) {
  const base = join(studio, BASE);
  rmSync(join(base, 'src'), {recursive: true, force: true});
  for (const g of GUARDED) if (existsSync(join(studio, g))) cpSync(join(studio, g), join(base, g), {recursive: true});
}

/** Put every guarded file back to the base: changed files restored, added files removed. */
function reset(studio) {
  const base = join(studio, BASE);
  for (const f of listFiles(studio)) if (!existsSync(join(base, f))) rmSync(join(studio, f));
  for (const f of listFiles(base)) if (!same(join(base, f), join(studio, f))) cpSync(join(base, f), join(studio, f));
}

/** Files that differ from the base (changed or added). Deleted base files are not tracked. */
function changed(studio) {
  const base = join(studio, BASE);
  return listFiles(studio).filter((f) => !same(join(base, f), join(studio, f)));
}

export function enterJob(studio, overridesDir, jobId) {
  if (!hasBase(studio)) throw new Error('studio has no clean base: run studio-guard capture/repair first');
  // A previous pass that was cut off never left: save its changes to that job before resetting.
  const active = join(studio, BASE, ACTIVE);
  if (existsSync(active)) {
    const prev = JSON.parse(readFileSync(active, 'utf8'));
    if (prev.overridesDir && existsSync(dirname(prev.overridesDir))) leaveJob(studio, prev.overridesDir);
    else reset(studio);
  }
  reset(studio);
  const replayed = existsSync(overridesDir) ? listFilesIn(overridesDir) : [];
  for (const f of replayed) {
    mkdirSync(dirname(join(studio, f)), {recursive: true});
    cpSync(join(overridesDir, f), join(studio, f));
  }
  writeFileSync(active, JSON.stringify({jobId, overridesDir, at: new Date().toISOString()}));
  return replayed;
}

function listFilesIn(dir) {
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(posix(relative(dir, p)));
    }
  };
  walk(dir);
  return out;
}

/** Save this job's changes into overridesDir, reset the studio, and say which locked files it touched. */
export function leaveJob(studio, overridesDir) {
  const files = changed(studio);
  rmSync(overridesDir, {recursive: true, force: true});
  for (const f of files) {
    mkdirSync(dirname(join(overridesDir, f)), {recursive: true});
    cpSync(join(studio, f), join(overridesDir, f));
  }
  reset(studio);
  rmSync(join(studio, BASE, ACTIVE), {force: true});
  return {kept: files, locked: files.filter((f) => !JOB_OWNED.includes(f))};
}

/**
 * A studio that ran jobs before the guard existed: save what differs from the shipped studio to
 * one job's overrides (optional), put the shipped files back, re-apply our patches, capture.
 */
export function repair(studio, templateDir, overridesDir) {
  rmSync(join(studio, BASE), {recursive: true, force: true});
  // Capture the shipped files as a provisional base, re-apply our patches to it, then diff.
  for (const g of GUARDED) if (existsSync(join(templateDir, g))) cpSync(join(templateDir, g), join(studio, BASE, g), {recursive: true});
  const patchBase = join(studio, BASE, '.patch-root');
  mkdirSync(patchBase, {recursive: true});
  cpSync(join(studio, BASE, 'src'), join(patchBase, 'src'), {recursive: true});
  writeFileSync(join(patchBase, 'CLAUDE.md'), '## Running unattended (worker mode)\n');
  const here = dirname(fileURLToPath(import.meta.url));
  const r = spawnSync(process.execPath, [join(here, '..', 'studio-patches', 'apply.mjs'), patchBase], {encoding: 'utf8'});
  if (r.status !== 0) throw new Error(`patches did not apply to the shipped files: ${r.stderr || r.stdout}`);
  rmSync(join(studio, BASE, 'src'), {recursive: true, force: true});
  cpSync(join(patchBase, 'src'), join(studio, BASE, 'src'), {recursive: true});
  rmSync(patchBase, {recursive: true, force: true});
  return overridesDir ? leaveJob(studio, overridesDir) : (reset(studio), {kept: [], locked: []});
}

/** The shipped studio's template folder for this version: from npm's cache, else fetched with npm pack. */
export function findTemplate(version, scratch) {
  const isWin = process.platform === 'win32';
  const npm = isWin ? 'npm.cmd' : 'npm';
  const cache = spawnSync(npm, ['config', 'get', 'cache'], {encoding: 'utf8', shell: isWin}).stdout?.trim();
  const npx = cache && join(cache, '_npx');
  for (const d of npx && existsSync(npx) ? readdirSync(npx) : []) {
    const pkg = join(npx, d, 'node_modules', 'creator-editing-studio');
    try {
      if (JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version === version) return join(pkg, 'template');
    } catch {}
  }
  mkdirSync(scratch, {recursive: true});
  const r = spawnSync(npm, ['pack', `creator-editing-studio@${version}`, '--silent'], {cwd: scratch, encoding: 'utf8', shell: isWin});
  const tgz = r.stdout?.trim().split(/\r?\n/).pop();
  if (r.status !== 0 || !tgz) throw new Error(`could not fetch creator-editing-studio@${version}: ${r.stderr}`);
  const x = spawnSync('tar', ['-xzf', tgz], {cwd: scratch, encoding: 'utf8'});
  if (x.status !== 0) throw new Error(`could not unpack ${tgz}: ${x.stderr}`);
  return join(scratch, 'package', 'template');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, studio, a, b] = process.argv.slice(2);
  if (cmd === 'capture' && studio) {
    captureBase(studio);
    console.log(`captured ${listFiles(join(studio, BASE)).length} files`);
  } else if (cmd === 'repair' && studio && a) {
    const res = repair(studio, a, b);
    console.log(`studio reset to the shipped files + patches; saved ${res.kept.length} job file(s)${res.kept.length ? ': ' + res.kept.join(', ') : ''}`);
  } else {
    console.error('usage: studio-guard.mjs capture <studio> | repair <studio> <template dir> [<job overrides dir>]');
    process.exit(2);
  }
}
