/**
 * Links, fetched on THIS computer into the group folder:
 *   Google Drive file or public folder · Dropbox file or folder · YouTube / Instagram / TikTok /
 *   Vimeo / Facebook (yt-dlp) · any direct file URL · websites (saved as a link for the editor to read)
 *
 * Every link becomes an item with live progress; failures say why in plain words.
 */
import {spawn, spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {appendFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {IS_WIN, STUDIO_DIR, TOOLS_DIR} from './config.mjs';
import {getJob, jobDir, updateJob} from './jobs.mjs';
import {safeName, uniquePath} from './upload.mjs';

const VIDEO_SITES = /(^|\.)(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|vimeo\.com|facebook\.com|fb\.watch|x\.com|twitter\.com)$/i;
export const ytDlpPath = () => join(TOOLS_DIR, IS_WIN ? 'yt-dlp.exe' : 'yt-dlp');

export function classify(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return {type: 'invalid'};
  }
  if (!/^https?:$/.test(u.protocol)) return {type: 'invalid'};
  const host = u.hostname.replace(/^www\./, '');
  if (/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/.test(host)) {
    const folder = /\/folders\/([\w-]+)/.exec(u.pathname);
    if (folder) return {type: 'gdrive-folder', id: folder[1]};
    const file = /\/d\/([\w-]+)/.exec(u.pathname) || (u.searchParams.get('id') && [null, u.searchParams.get('id')]);
    if (file) return {type: 'gdrive', id: file[1]};
    return {type: 'invalid', reason: 'That Google Drive link has no file or folder id in it.'};
  }
  if (/(^|\.)dropbox\.com$/.test(host)) return {type: 'dropbox'};
  if (VIDEO_SITES.test(host)) return {type: 'video-site', site: host.split('.').slice(-2, -1)[0]};
  if (/\.(mp4|mov|m4v|webm|mkv|avi|mp3|wav|m4a|aac|png|jpe?g|webp|gif|svg|ttf|otf|woff2?|pdf|zip)$/i.test(u.pathname)) return {type: 'direct'};
  return {type: 'maybe-website'};
}

/** Move a finished temp file into the group folder and mark the item done, in one step. */
function finishFile(jobId, itemId, tmp, dir, want) {
  updateJob(jobId, (job) => {
    const path = uniquePath(dir, want);
    renameSync(tmp, path);
    const it = job.items.find((i) => i.id === itemId);
    if (it) Object.assign(it, {status: 'done', progress: 1, name: path.split(/[\\/]/).pop(), size: statSync(path).size});
  });
}

const setItem = (jobId, itemId, patch) =>
  updateJob(jobId, (job) => {
    const it = job.items.find((i) => i.id === itemId);
    if (it) Object.assign(it, patch);
  });

export function addLink(jobId, group, url) {
  const c = classify(url.trim());
  if (c.type === 'invalid') throw new Error(c.reason || 'That does not look like a web link (it must start with http:// or https://).');
  const item = {id: randomUUID(), group, kind: 'link', url: url.trim(), linkType: c.type, name: url.trim(), status: 'queued', progress: 0, added_at: new Date().toISOString()};
  updateJob(jobId, (job) => job.items.push(item));
  fetchLink(jobId, item, c).catch((e) => setItem(jobId, item.id, {status: 'error', error: String(e.message || e)}));
  return item;
}

async function fetchLink(jobId, item, c) {
  const dir = join(jobDir(jobId), item.group);
  setItem(jobId, item.id, {status: 'downloading'});
  if (c.type === 'video-site') return ytDlp(jobId, item, dir);
  if (c.type === 'gdrive') return download(jobId, item, dir, `https://drive.usercontent.google.com/download?id=${c.id}&export=download&confirm=t`, {driveId: c.id});
  if (c.type === 'gdrive-folder') return driveFolder(jobId, item, dir, c.id);
  if (c.type === 'dropbox') {
    const u = new URL(item.url);
    u.searchParams.set('dl', '1');
    return download(jobId, item, dir, u.toString(), {unzip: true});
  }
  return download(jobId, item, dir, item.url, {websiteFallback: c.type === 'maybe-website'});
}

function filenameFrom(res, url, fallback) {
  const cd = res.headers.get('content-disposition') || '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  const fromUrl = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
  return safeName((star && decodeURIComponent(star[1])) || (plain && plain[1]) || fromUrl || fallback);
}

async function download(jobId, item, dir, url, opts = {}) {
  const res = await fetch(url, {redirect: 'follow', headers: {'User-Agent': 'Mozilla/5.0 EditingOS'}});
  if (!res.ok) throw new Error(`The link answered ${res.status} ${res.statusText}. Is it shared publicly?`);
  const type = res.headers.get('content-type') || '';
  if (type.includes('text/html')) {
    await res.body?.cancel();
    if (opts.driveId) throw new Error('Google Drive did not send the file. Set sharing to "Anyone with the link".');
    if (opts.websiteFallback) return saveWebsite(jobId, item, dir);
    throw new Error('The link opened a web page, not a file.');
  }
  const name = filenameFrom(res, url, `link-${item.id.slice(0, 8)}`);
  const path = join(dir, `.dl-${item.id}`);
  const total = Number(res.headers.get('content-length') || 0);
  let got = 0;
  let last = 0;
  const body = Readable.fromWeb(res.body);
  body.on('data', (chunk) => {
    got += chunk.length;
    if (Date.now() - last > 500) {
      last = Date.now();
      setItem(jobId, item.id, {progress: total ? got / total : 0, size: got});
    }
  });
  await pipeline(body, createWriteStream(path));
  // A shared Dropbox folder arrives as a zip: unpack it; the unpacked files become their own items.
  if (opts.unzip && /\.zip$/i.test(name)) {
    const r = spawnSync('tar', ['-xf', path, '-C', dir]);
    if (r.status === 0) {
      rmSync(path);
      return setItem(jobId, item.id, {status: 'done', progress: 1, name: `${name} (unpacked)`, size: got});
    }
  }
  finishFile(jobId, item.id, path, dir, name);
}

function saveWebsite(jobId, item, dir) {
  mkdirSync(dir, {recursive: true});
  appendFileSync(join(dir, 'links.md'), `- ${item.url}\n`);
  setItem(jobId, item.id, {status: 'done', progress: 1, kind: 'website', name: new URL(item.url).hostname});
}

async function driveFolder(jobId, item, dir, folderId) {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}`);
  const html = await res.text();
  const files = [...html.matchAll(/href="https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\/[^"]*"[\s\S]*?class="flip-entry-title">([^<]+)</g)].map((m) => ({id: m[1], name: m[2]}));
  if (!files.length) throw new Error('Could not list that Drive folder. Share it as "Anyone with the link", or add the files one by one.');
  setItem(jobId, item.id, {name: `Drive folder (${files.length} files)`});
  let done = 0;
  for (const f of files) {
    const sub = {id: randomUUID(), group: item.group, kind: 'link', url: `https://drive.google.com/file/d/${f.id}/view`, linkType: 'gdrive', name: f.name, status: 'downloading', progress: 0, added_at: new Date().toISOString()};
    updateJob(jobId, (job) => job.items.push(sub));
    try {
      await download(jobId, sub, dir, `https://drive.usercontent.google.com/download?id=${f.id}&export=download&confirm=t`, {driveId: f.id});
    } catch (e) {
      setItem(jobId, sub.id, {status: 'error', error: String(e.message || e)});
    }
    setItem(jobId, item.id, {progress: ++done / files.length});
  }
  setItem(jobId, item.id, {status: 'done', progress: 1});
}

function ytDlp(jobId, item, dir) {
  return new Promise((resolve, reject) => {
    if (!existsSync(ytDlpPath())) return reject(new Error('The link downloader is not installed yet — open "Check my computer" and install it.'));
    const ffmpegDir = join(STUDIO_DIR, 'node_modules', 'ffmpeg-static');
    // Downloads land in a hidden folder first, so a half-merged file never shows up as an item.
    const tmpDir = join(dir, `.ytdlp-${item.id}`);
    mkdirSync(tmpDir, {recursive: true});
    const args = [
      '--no-playlist', '--newline', '--restrict-filenames',
      '-f', 'bv*[height<=1920]+ba/b',
      '--merge-output-format', 'mp4',
      ...(existsSync(ffmpegDir) ? ['--ffmpeg-location', ffmpegDir] : []),
      '-o', join(tmpDir, '%(uploader).40s - %(title).60s [%(id)s].%(ext)s'),
      item.url,
    ];
    const child = spawn(ytDlpPath(), args);
    let err = '';
    child.stdout.on('data', (d) => {
      const m = /\[download\]\s+([\d.]+)%/.exec(d.toString());
      if (m) setItem(jobId, item.id, {progress: Number(m[1]) / 100});
    });
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('close', (code) => {
      const added = readdirSync(tmpDir).filter((f) => !/\.(part|ytdl)$/.test(f));
      if (code !== 0 || !added.length) {
        rmSync(tmpDir, {recursive: true, force: true});
        const why = /login|sign in|cookies|private/i.test(err)
          ? 'That post needs a logged-in account to download. Save the video and drop the file instead.'
          : (err.split('\n').find((l) => l.includes('ERROR')) || 'The downloader could not fetch this link.').replace(/^ERROR:\s*/, '');
        return reject(new Error(why));
      }
      const name = added.sort((a, b) => statSync(join(tmpDir, b)).size - statSync(join(tmpDir, a)).size)[0];
      finishFile(jobId, item.id, join(tmpDir, name), dir, name);
      rmSync(tmpDir, {recursive: true, force: true});
      resolve();
    });
  });
}

export function removeItem(jobId, itemId) {
  const job = getJob(jobId);
  const it = job?.items.find((i) => i.id === itemId);
  if (!it) return;
  if (it.kind !== 'website' && it.name && it.status === 'done') {
    const p = join(jobDir(jobId), it.group, it.name);
    if (existsSync(p) && statSync(p).isFile()) rmSync(p);
  }
  updateJob(jobId, (j) => (j.items = j.items.filter((i) => i.id !== itemId)));
}
