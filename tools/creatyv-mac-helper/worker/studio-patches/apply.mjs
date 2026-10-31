#!/usr/bin/env node
/**
 * Apply our fixes on top of the shipped studio, at image build time.
 *
 *   node apply.mjs /studio
 *
 * Each patch is an exact find-and-replace that fails the build if the shipped code has changed
 * shape — so a studio upgrade can never silently drop a fix. A patch whose fix is already present
 * (the vendor shipped it) is skipped.
 */
import {appendFileSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const studio = process.argv[2];
if (!studio) throw new Error('usage: apply.mjs <studio dir>');
const here = dirname(fileURLToPath(import.meta.url));

const PATCHES = [
  {
    // Push/whip-pan scenes rendered as blank frames while blurred: the VelocityBlur wrapper had no
    // size, and its SVG filter region is a percentage of that box, so it clipped the whole scene.
    // Found by motion-check on a real job (CUT at every transition boundary).
    file: 'src/components/Transition.tsx',
    find: "      <VelocityBlur vx={axis === 'x' ? speed : 0} vy={axis === 'y' ? speed : 0}>",
    replace:
      "      // Full-frame and bleed 0: the filter region is a percentage of this box, so an unsized\n" +
      "      // wrapper clips the whole scene to nothing for every frame the blur is on.\n" +
      "      <VelocityBlur vx={axis === 'x' ? speed : 0} vy={axis === 'y' ? speed : 0} bleed={0} style={{position: 'absolute', inset: 0}}>",
    already: "bleed={0} style={{position: 'absolute', inset: 0}}",
  },
];

for (const p of PATCHES) {
  const path = join(studio, p.file);
  const src = readFileSync(path, 'utf8');
  if (src.includes(p.already)) {
    console.log(`skip  ${p.file} (already fixed upstream)`);
    continue;
  }
  if (!src.includes(p.find)) throw new Error(`patch target not found in ${p.file} — the studio changed; re-check this fix`);
  writeFileSync(path, src.replace(p.find, p.replace));
  console.log(`patch ${p.file}`);
}

// Rules for running with nobody at the keyboard, appended to the studio's own rulebook. They are
// its last section, so a re-run replaces them in place and rule updates reach existing studios.
const rulebook = join(studio, 'CLAUDE.md');
const rules = readFileSync(join(here, 'UNATTENDED.md'), 'utf8');
const book = readFileSync(rulebook, 'utf8');
const at = book.indexOf('## Running unattended (worker mode)');
if (at < 0) {
  appendFileSync(rulebook, '\n\n' + rules);
  console.log('append CLAUDE.md <- UNATTENDED.md');
} else {
  // UNATTENDED.md opens with a "---" rule just above its heading.
  const start = book.lastIndexOf('---', at);
  const next = book.slice(0, start >= 0 ? start : at).trimEnd() + '\n\n' + rules;
  if (next === book) console.log('skip  CLAUDE.md (unattended rules up to date)');
  else {
    writeFileSync(rulebook, next);
    console.log('update CLAUDE.md <- UNATTENDED.md');
  }
}
