/**
 * Jobs are plain folders on the user's disk — no database in Stage 1:
 *
 *   JOBS_ROOT/<id>/
 *     job.json                    title, status, brief fields, input items, passes, cost
 *     brief.md                    written from the brief fields before every pass
 *     a-roll/ b-roll/ references/ audio/ brand/
 *     output/                     plan.md, plan-stills.jpg, final.mp4, report.json, logs
 *
 * A folder that has a brief.md but no job.json (made by hand) is imported as a draft.
 */
import {randomUUID} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {publish} from './events.mjs';
import {GROUP_IDS, GROUPS, JOBS_ROOT} from './config.mjs';
import {publicAccess} from './access.mjs';


mkdirSync(JOBS_ROOT, {recursive: true});

export const jobDir = (id) => join(JOBS_ROOT, id);
const jsonPath = (id) => join(jobDir(id), 'job.json');

export const BRIEF_FIELDS = [
  {id: 'brand', label: 'Brand / client', placeholder: 'e.g. Sher Bengal — hotel in Darjeeling', required: true},
  {id: 'job', label: 'What is this video?', placeholder: 'e.g. A 30 s brand reel from the raw footage; or: recut the attached reel to match the reference', type: 'long', required: true},
  {id: 'format', label: 'Format', type: 'select', options: ['9:16 (Reels, Shorts)', '16:9 (YouTube)', '1:1 (Feed)', '4:5 (Feed)'], default: '9:16 (Reels, Shorts)'},
  {id: 'length', label: 'Length', placeholder: 'e.g. 20–30 s', default: '20–30 s'},
  {id: 'oneThing', label: 'The one thing viewers must remember', placeholder: 'e.g. A cosy, misty stay 100 m from Mall Road'},
  {id: 'script', label: 'Script / voiceover', placeholder: 'Paste the script exactly as spoken, or name the voice file you added to Audio. No voice file = no voiceover.', type: 'long'},
  {id: 'mustHaves', label: 'Must-have moments', placeholder: 'e.g. Open on the misty window. When I say "book a repair", show the logo.', type: 'long'},
  {id: 'references', label: 'What you like in the references', placeholder: 'For each reference: timecode + what you like. "0:14 — text snaps in on the beat" helps; "it\'s clean" does not.', type: 'long'},
  {id: 'look', label: 'Look and text', placeholder: 'Colour feel, captions yes/no, text style, pace (calm / punchy)', type: 'long'},
  {id: 'music', label: 'Music', type: 'select', options: ['Original score (composed for this video)', 'Use the music I added to Audio', "None — I'll add a trending sound"], default: 'Original score (composed for this video)'},
  {id: 'cameraSound', label: "Keep the camera's own sound?", type: 'select', options: ['Yes, where it is clean', 'No'], default: 'Yes, where it is clean'},
  {id: 'brandNotes', label: 'Brand details', placeholder: 'Colours (hex), fonts, website. Facts allowed on screen: phone, address, offer — nothing else will be invented.', type: 'long'},
  {id: 'cta', label: 'Ending / call to action', placeholder: 'e.g. End card with logo and "Book your stay · +91 …"'},
  {id: 'dontWant', label: "Don't want", placeholder: 'e.g. subtitles on every shot, robotic voice, everything in slow motion', type: 'long'},
];

const now = () => new Date().toISOString();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);

export function createJob(title = 'Untitled video', creatyv = null) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  let id = `${stamp}-${slug(title) || 'video'}`;
  for (let n = 2; existsSync(jobDir(id)); n++) id = `${stamp}-${slug(title) || 'video'}-${n}`;
  const dir = jobDir(id);
  for (const g of [...GROUP_IDS, 'output']) mkdirSync(join(dir, g), {recursive: true});
  const job = {
    id,
    title,
    status: 'draft',
    created_at: now(),
    updated_at: now(),
    brief: Object.fromEntries(BRIEF_FIELDS.filter((f) => f.default).map((f) => [f.id, f.default])),
    items: [],
    passes: [],
    error: null,
  };
  // Which paid Creatyv video this is, so the Creatyv page finds the job again.
  if (creatyv?.ai_edit_id) job.creatyv = {ai_edit_id: String(creatyv.ai_edit_id).slice(0, 64), video_number: Number(creatyv.video_number) || 1};
  saveJob(job);
  return job;
}

export function saveJob(job) {
  job.updated_at = now();
  const tmp = jsonPath(job.id) + '.tmp';
  writeFileSync(tmp, JSON.stringify(job, null, 2));
  renameSync(tmp, jsonPath(job.id));
  publish(job.id, {type: 'job', job: publicJob(job)});
  return job;
}

export function getJob(id) {
  if (!/^[\w.-]+$/.test(id)) return null;
  if (existsSync(jsonPath(id))) return syncItems(JSON.parse(readFileSync(jsonPath(id), 'utf8')));
  if (existsSync(join(jobDir(id), 'brief.md'))) return importFolder(id);
  return null;
}

export function updateJob(id, fn) {
  const job = getJob(id);
  if (!job) throw new Error('job not found');
  fn(job);
  return saveJob(job);
}

export function listJobs() {
  return readdirSync(JOBS_ROOT, {withFileTypes: true})
    .filter((d) => d.isDirectory())
    .map((d) => getJob(d.name))
    .filter(Boolean)
    .map(publicJob)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/** What the UI sees: everything except bulky logs, plus which output files exist. */
export function publicJob(job) {
  const out = join(jobDir(job.id), 'output');
  const has = (f) => existsSync(join(out, f));
  return {
    ...job,
    access: publicAccess(job),
    outputs: {
      plan: has('plan.md'),
      planStills: has('plan-stills.jpg'),
      final: has('final.mp4'),
      delivery: has('delivery.md'),
      verifyStills: has('verify-stills.jpg'),
      report: has('report.json'),
    },
  };
}

/** Files that appeared in a group folder some other way (Explorer, an older job) become items. */
function syncItems(job) {
  let changed = false;
  for (const g of GROUP_IDS) {
    const dir = join(jobDir(job.id), g);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.') || name === 'links.md') continue;
      const p = join(dir, name);
      if (!statSync(p).isFile()) continue;
      if (job.items.some((i) => i.group === g && i.name === name)) continue;
      job.items.push({id: randomUUID(), group: g, kind: 'file', name, size: statSync(p).size, status: 'done', added_at: now()});
      changed = true;
    }
  }
  if (changed) saveJob(job);
  return job;
}

function importFolder(id) {
  const dir = jobDir(id);
  for (const g of [...GROUP_IDS, 'output']) mkdirSync(join(dir, g), {recursive: true});
  const job = {
    id,
    title: id,
    status: 'draft',
    created_at: statSync(dir).birthtime.toISOString(),
    updated_at: now(),
    // A hand-written brief is kept verbatim until someone edits the fields.
    brief: {},
    briefRaw: readFileSync(join(dir, 'brief.md'), 'utf8'),
    items: [],
    passes: [],
    error: null,
  };
  saveJob(job);
  return syncItems(job);
}

/** brief.md is what the editor reads. Written from the form fields before every pass. */
export function writeBrief(job) {
  const path = join(jobDir(job.id), 'brief.md');
  const filled = BRIEF_FIELDS.some((f) => job.brief?.[f.id] && job.brief[f.id] !== f.default);
  if (job.briefRaw && !filled) {
    writeFileSync(path, job.briefRaw);
    return;
  }
  const v = (id) => (job.brief?.[id] || '').trim();
  const inputs = GROUPS.map((g) => {
    const items = job.items.filter((i) => i.group === g.id && i.status === 'done');
    if (!items.length) return null;
    return `- **${g.label}** (\`${g.id}/\`): ${items.map((i) => (i.kind === 'website' ? `website ${i.url}` : i.name)).join(', ')}`;
  }).filter(Boolean);
  const md = `# Brief — ${job.title}

## Basics
- Brand / client: ${v('brand')}
- Format: ${v('format')}
- Length: ${v('length')}

## The job
${v('job')}

## The one thing viewers must remember
${v('oneThing')}

## Script / voiceover
${v('script') || 'No voiceover unless a voice file is in audio/.'}

## Must-have moments
${v('mustHaves')}

## References
${v('references')}

## Look
${v('look')}

## Sound
- Music: ${v('music')}
- Keep the camera's own sound: ${v('cameraSound')}

## Brand
${v('brandNotes')}

## CTA / ending
${v('cta')}

## Don't want
${v('dontWant')}

## Inputs in this job folder
${inputs.join('\n') || '- (none)'}
`;
  writeFileSync(path, md);
}

export function missingBriefFields(job) {
  if (job.briefRaw && !BRIEF_FIELDS.some((f) => job.brief?.[f.id] && job.brief[f.id] !== f.default)) return [];
  return BRIEF_FIELDS.filter((f) => f.required && !(job.brief?.[f.id] || '').trim()).map((f) => f.label);
}
