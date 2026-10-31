/** Build an unsigned macOS app for the architecture of the Mac running this script. */
import {spawnSync} from 'node:child_process';
import {chmodSync, cpSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

if (process.platform !== 'darwin') throw new Error('Build this app on a Mac; the bundled Node runtime and native dependencies must match macOS.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist', `creatyv-helper-mac-${process.arch}`);
const app = join(output, 'Creatyv Helper.app');
if (existsSync(output)) throw new Error(`Output already exists: ${output}. Move it aside before rebuilding.`);
const contents = join(app, 'Contents');
const resources = join(contents, 'Resources');
const runtime = join(resources, 'runtime');
mkdirSync(join(contents, 'MacOS'), {recursive: true});
mkdirSync(join(runtime, 'bin'), {recursive: true});
cpSync(process.execPath, join(runtime, 'bin', 'node'));
const npmRoot = spawnSync('npm', ['root', '-g'], {encoding: 'utf8'});
if (npmRoot.status !== 0) throw new Error('npm is required on the build Mac.');
const npm = join(npmRoot.stdout.trim(), 'npm');
if (!existsSync(npm)) throw new Error('The npm package could not be found in the global Node installation.');
cpSync(npm, join(runtime, 'lib', 'node_modules', 'npm'), {recursive: true});
for (const tool of ['npm', 'npx']) {
  const launcher = join(runtime, 'bin', tool);
  writeFileSync(launcher, `#!/bin/sh\nexec "$(dirname "$0")/node" "$(dirname "$0")/../lib/node_modules/npm/bin/${tool}-cli.js" "$@"\n`);
  chmodSync(launcher, 0o755);
}
cpSync(join(root, 'app', 'server'), join(resources, 'app', 'server'), {recursive: true});
for (const file of ['package.json', 'package-lock.json']) cpSync(join(root, 'app', file), join(resources, 'app', file));
for (const file of ['src', 'prompts', 'studio-patches', 'package.json']) cpSync(join(root, 'worker', file), join(resources, 'worker', file), {recursive: true});
const install = spawnSync(join(runtime, 'bin', 'npm'), ['ci', '--omit=dev', '--no-audit', '--no-fund'], {cwd: join(resources, 'app'), stdio: 'inherit', env: {...process.env, PATH: `${join(runtime, 'bin')}:${process.env.PATH}`}});
if (install.status !== 0) throw new Error('Installing helper dependencies failed.');
writeFileSync(join(resources, '.env'), 'CREATYV_API_URL=https://mintmore-production.up.railway.app\n');
writeFileSync(join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>CFBundleName</key><string>Creatyv Helper</string><key>CFBundleIdentifier</key><string>com.creatyv.helper</string><key>CFBundleExecutable</key><string>creatyv-helper</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>0.1.0</string><key>LSUIElement</key><true/></dict></plist>\n`);
const launcher = join(contents, 'MacOS', 'creatyv-helper');
writeFileSync(launcher, '#!/bin/sh\nHERE="$(CDPATH= cd -- "$(dirname -- "$0")/../Resources" && pwd)"\nexport PATH="$HERE/runtime/bin:/usr/bin:/bin:/usr/sbin:/sbin"\ncd "$HERE/app" || exit 1\nexec "$HERE/runtime/bin/node" server/index.mjs\n');
chmodSync(launcher, 0o755);
const zip = join(output, `CreatyvHelper-${process.arch}.zip`);
const archive = spawnSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip], {stdio: 'inherit'});
if (archive.status !== 0) throw new Error('Could not package the Mac app.');
console.log(`Built ${zip}. This app is unsigned and must be tested and signed before public release.`);
