import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseId = process.argv[2];
const output = path.resolve(process.argv[3] ?? path.join(ROOT, 'release.tar.gz'));
if (!releaseId || !/^[A-Za-z0-9._-]{7,80}$/.test(releaseId)) {
  throw new Error('Usage: node deploy/package-release.mjs <release-id> [output.tar.gz]');
}

const required = [
  'apps/server/dist/index.js',
  'apps/server/package.json',
  'apps/web/dist/index.html',
  'apps/admin/dist/index.html',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'packages/shared/package.json',
  'deploy/activate-release.sh',
  'deploy/ecosystem.config.js',
  'deploy/nginx.conf',
];
for (const relative of required) {
  if (!existsSync(path.join(ROOT, relative))) throw new Error('Missing release input: ' + relative);
}

const stage = path.join(os.tmpdir(), 'qujt-release-' + releaseId);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

function copy(relative) {
  const source = path.join(ROOT, relative);
  const target = path.join(stage, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

for (const relative of [
  'apps/server/dist',
  'apps/server/package.json',
  'apps/web/dist',
  'apps/admin/dist',
  'packages/shared/package.json',
  'packages/shared/src',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'deploy',
]) copy(relative);

const serverRuntime = process.env.SERVER_RUNTIME_DIR;
if (serverRuntime) {
  const runtimePath = path.resolve(serverRuntime);
  if (!existsSync(path.join(runtimePath, 'node_modules'))) throw new Error('SERVER_RUNTIME_DIR has no node_modules: ' + runtimePath);
  cpSync(path.join(runtimePath, 'node_modules'), path.join(stage, 'apps', 'server', 'node_modules'), { recursive: true });
}

writeFileSync(path.join(stage, 'release.json'), JSON.stringify({
  releaseId,
  commit: process.env.GITHUB_SHA ?? releaseId.replace(/-dirty.*$/, ''),
  builtAt: new Date().toISOString(),
  node: process.version,
  packageManager: JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).packageManager,
}, null, 2) + '\n');

rmSync(output, { force: true });
const tar = spawnSync('tar', ['-czf', output, '-C', stage, '.'], { stdio: 'inherit' });
if (tar.status !== 0) process.exit(tar.status ?? 1);
console.log(output);
