/**
 * Files dropped from the desktop. In a browser the page cannot see a file's real path, so each
 * file is streamed straight into its group folder (a local copy, never to the internet).
 * The Stage 3 desktop app reads real paths and skips the copy.
 */
import Busboy from 'busboy';
import {randomUUID} from 'node:crypto';
import {createWriteStream, existsSync, renameSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {GROUP_IDS} from './config.mjs';
import {getJob, jobDir, updateJob} from './jobs.mjs';

export const safeName = (name) => {
  const base = name.split(/[\\/]/).pop() || 'file';
  return base.replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/^\.+/, '_').slice(0, 160);
};

export function uniquePath(dir, name) {
  let p = join(dir, name);
  const ext = extname(name);
  const stem = name.slice(0, name.length - ext.length);
  for (let n = 2; existsSync(p); n++) p = join(dir, `${stem} (${n})${ext}`);
  return p;
}

export function handleUpload(req, res) {
  const {id, group} = req.params;
  if (!GROUP_IDS.includes(group)) return res.status(400).json({error: 'unknown group'});
  if (!getJob(id)) return res.status(404).json({error: 'job not found'});

  const bb = Busboy({headers: req.headers, limits: {files: 1}});
  let saved = null;
  bb.on('file', (_field, file, info) => {
    // Written under a hidden temp name, so the folder scan never sees a half-written file.
    const tmp = join(jobDir(id), group, `.uploading-${randomUUID()}`);
    const out = createWriteStream(tmp);
    file.pipe(out);
    out.on('finish', () => {
      saved = {tmp, want: safeName(info.filename), size: statSync(tmp).size, mime: info.mimeType};
    });
  });
  bb.on('close', () => {
    // 'close' can beat the write stream's 'finish' by a tick.
    const done = () => {
      if (!saved) return setTimeout(done, 20);
      let item;
      updateJob(id, (job) => {
        const path = uniquePath(join(jobDir(id), group), saved.want);
        renameSync(saved.tmp, path);
        item = {id: randomUUID(), group, kind: 'file', name: path.split(/[\\/]/).pop(), size: saved.size, mime: saved.mime, status: 'done', added_at: new Date().toISOString()};
        job.items.push(item);
      });
      res.json({item});
    };
    done();
  });
  bb.on('error', (e) => res.status(500).json({error: String(e)}));
  req.pipe(bb);
}
