/**
 * The Creatyv helper — the editor's engine on the client's computer. http://127.0.0.1:4321
 *
 *   npm run helper   what clients run: no screens, the editor UI is on Creatyv
 *   npm run dev      plus the local screens with hot reload, for working on the engine
 *   npm start        plus the built local screens
 *
 * Listens on 127.0.0.1 only, and answers only Creatyv's pages (helper.mjs): footage, jobs and
 * renders stay on this computer.
 */
import express from 'express';
import {spawn} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {join, normalize, resolve, sep} from 'node:path';
import {APP_ROOT, GROUPS, IS_WIN, JOBS_ROOT, PORT} from './config.mjs';
import {accessFromPage, accessMode, deviceId, redeem} from './access.mjs';
import {gate, helperKey} from './helper.mjs';
import {engineState, recoverInterrupted, startPass, stop} from './engine.mjs';
import {subscribe} from './events.mjs';
import {BRIEF_FIELDS, createJob, getJob, jobDir, listJobs, publicJob, updateJob} from './jobs.mjs';
import {addLink, removeItem} from './links.mjs';
import {check, installYtDlp, probeKey, setupStudio, studioReady} from './studio.mjs';
import {answersAsNotes, clearQuestions, readQuestions} from './questions.mjs';
import {handleUpload} from './upload.mjs';

// Anything still "running" from before was cut off when the app closed.
recoverInterrupted();

const app = express();
const VERSION = JSON.parse(readFileSync(join(APP_ROOT, 'package.json'), 'utf8')).version;
const WITH_UI = process.argv.includes('--prod') || process.argv.includes('--dev-ui');

app.use('/api', gate);
app.use(express.json({limit: '2mb'}));

const wrap = (fn) => (req, res) => {
  try {
    const out = fn(req, res);
    if (out !== undefined) res.json(out);
  } catch (e) {
    res.status(e.code === 'PAYMENT_REQUIRED' ? 402 : 400).json({error: e.message, code: e.code});
  }
};

/* ---------------------------------------------------------------- meta + computer */
// How a Creatyv page finds the helper: its version, this computer's id, and the key for <video> links.
app.get('/api/hello', wrap(() => ({app: 'creatyv-helper', version: VERSION, key: helperKey(), device: deviceId(), access: accessMode(), studioReady: studioReady()})));
app.get('/api/meta', wrap(() => ({groups: GROUPS, briefFields: BRIEF_FIELDS, jobsRoot: JOBS_ROOT, access: accessMode()})));
app.get('/api/check', async (_req, res) => {
  await probeKey();
  res.json({...check(), engine: engineState()});
});
app.post('/api/setup/studio', wrap(() => (setupStudio(), {started: true})));
app.post('/api/setup/ytdlp', wrap(() => (installYtDlp(), {started: true})));
app.get('/api/system/events', (req, res) => subscribe('system', req, res));

/* ---------------------------------------------------------------- jobs */
app.get('/api/jobs', wrap((req) => {
  const jobs = listJobs();
  return req.query.ai_edit ? jobs.filter((j) => j.creatyv?.ai_edit_id === req.query.ai_edit) : jobs;
}));
app.post('/api/jobs', wrap((req) => publicJob(createJob(String(req.body?.title || 'Untitled video').slice(0, 120), req.body?.creatyv))));
app.get('/api/jobs/:id', wrap((req) => {
  const job = getJob(req.params.id);
  if (!job) throw new Error('job not found');
  const out = join(jobDir(job.id), 'output');
  const read = (f) => (existsSync(join(out, f)) ? readFileSync(join(out, f), 'utf8') : null);
  return {...publicJob(job), planMd: read('plan.md'), questions: job.outputs?.plan || existsSync(join(out, 'plan.md')) ? readQuestions(job.id) : [], deliveryMd: read('delivery.md'), engine: engineState()};
}));
app.patch('/api/jobs/:id', wrap((req) => publicJob(updateJob(req.params.id, (job) => {
  if (typeof req.body.title === 'string') job.title = req.body.title.slice(0, 120);
  if (req.body.brief && typeof req.body.brief === 'object') job.brief = {...job.brief, ...req.body.brief};
}))));
app.get('/api/jobs/:id/events', (req, res) => subscribe(req.params.id, req, res));

app.post('/api/jobs/:id/upload/:group', handleUpload);
app.post('/api/jobs/:id/links', wrap((req) => ({item: addLink(req.params.id, req.body.group, req.body.url || '')})));
app.delete('/api/jobs/:id/items/:itemId', wrap((req) => (removeItem(req.params.id, req.params.itemId), {ok: true})));

// Paid mode: the unlock code from Creatyv's paywall, swapped for this video's token.
app.post('/api/jobs/:id/unlock', async (req, res) => {
  try {
    if (!getJob(req.params.id)) throw new Error('job not found');
    const access = await redeem(req.body?.code || '');
    res.json(publicJob(updateJob(req.params.id, (job) => (job.access = access))));
  } catch (e) {
    res.status(400).json({error: e.message});
  }
});

// Or the Creatyv page fetched this computer's token itself and hands it over: no code to copy.
app.post('/api/jobs/:id/connect', wrap((req) => {
  if (!getJob(req.params.id)) throw new Error('job not found');
  const access = accessFromPage(req.body);
  return publicJob(updateJob(req.params.id, (job) => (job.access = access)));
}));

app.post('/api/jobs/:id/plan', async (req, res) => {
  await probeKey();
  wrap(() => (startPass(req.params.id, 'plan', req.body?.notes || ''), clearQuestions(req.params.id), {ok: true}))(req, res);
});
app.post('/api/jobs/:id/approve', async (req, res) => {
  await probeKey();
  // The render waits until every question on the outline has an answer or a safe default.
  wrap(() => (startPass(req.params.id, 'build', answersAsNotes(req.params.id, req.body?.answers, req.body?.notes || '')), {ok: true}))(req, res);
});
app.post('/api/jobs/:id/continue', async (req, res) => {
  await probeKey();
  wrap(() => (startPass(req.params.id, 'continue'), {ok: true}))(req, res);
});
app.post('/api/jobs/:id/revise', wrap((req) => {
  if (!req.body?.notes?.trim()) throw new Error('Write what should change.');
  startPass(req.params.id, 'revise', req.body.notes);
  return {ok: true};
}));
app.post('/api/jobs/:id/stop', wrap((req) => (stop(req.params.id), {ok: true})));
app.post('/api/jobs/:id/open', wrap((req) => {
  const dir = jobDir(req.params.id);
  spawn(IS_WIN ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open', [join(dir, req.body?.sub === 'job' ? '' : 'output')], {detached: true, stdio: 'ignore'}).unref();
  return {ok: true};
}));

// Files inside a job folder (videos stream with range requests).
app.get('/api/jobs/:id/files/*', (req, res) => {
  const base = resolve(jobDir(req.params.id));
  const target = normalize(resolve(base, req.params[0]));
  if (!target.startsWith(base + sep) || !existsSync(target)) return res.status(404).end();
  res.sendFile(target, {headers: {'Cache-Control': 'no-cache'}});
});

/* ---------------------------------------------------------------- the local screens (engine work only) */
if (!WITH_UI) {
  app.get('/', (_req, res) => res.type('text').send('The Creatyv helper is running. Open your AI edit on Creatyv to use it.'));
} else if (process.argv.includes('--prod')) {
  const dist = join(APP_ROOT, 'ui', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
} else {
  const {createServer} = await import('vite');
  const vite = await createServer({configFile: join(APP_ROOT, 'vite.config.mjs'), root: join(APP_ROOT, 'ui'), server: {middlewareMode: true}, appType: 'spa'});
  app.use(vite.middlewares);
}

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Creatyv helper ${VERSION} is running: http://127.0.0.1:${PORT}`);
  console.log(`Jobs folder: ${JOBS_ROOT}`);
});
// Started twice (Windows startup plus a double-click): the first copy is already serving.
server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.log('The Creatyv helper is already running.');
  process.exit(0);
});
