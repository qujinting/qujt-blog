// 手动生产发布：要求干净 Git 工作区，构建当前 HEAD 并复用服务器原子发布流程。
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.argv[2] ?? '115.29.149.137';
const user = process.env.DEPLOY_USER ?? 'root';
const key = process.env.DEPLOY_KEY ?? path.join(os.homedir(), '.ssh', 'qujt-deploy-key');
function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function output(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout.trim();
}
if (process.platform !== 'linux') {
  console.error('Manual production releases must run on Linux so native runtime dependencies match ECS. Use GitHub Actions from Windows.');
  process.exit(2);
}
const dirty = output('git', ['status', '--porcelain']);
if (dirty && process.env.ALLOW_DIRTY_DEPLOY !== '1') {
  console.error('Refusing to deploy a dirty working tree. Commit changes first, or set ALLOW_DIRTY_DEPLOY=1 for an explicit emergency release.');
  process.exit(2);
}
const sha = output('git', ['rev-parse', 'HEAD']);
const releaseId = dirty ? sha + '-dirty-' + Date.now() : sha;
const archive = path.join(os.tmpdir(), 'qujt-release-' + releaseId + '.tar.gz');
run('pnpm', ['test'], { shell: process.platform === 'win32' });
run('pnpm', ['typecheck'], { shell: process.platform === 'win32' });
for (const script of ['build:server', 'build:web', 'build:admin']) run('pnpm', [script]);
const runtime = path.join(os.tmpdir(), 'qujt-server-runtime-' + releaseId);
run('pnpm', ['--filter', '@qujt/server', 'deploy', '--prod', '--legacy', runtime]);
run('node', ['deploy/package-release.mjs', releaseId, archive], { env: { ...process.env, SERVER_RUNTIME_DIR: runtime } });
run('scp', ['-i', key, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', archive, user + '@' + host + ':/tmp/qujt-release-' + releaseId + '.tar.gz']);
const remoteArchive = '/tmp/qujt-release-' + releaseId + '.tar.gz';
const remoteActivate = '/tmp/qujt-activate-' + releaseId;
run('ssh', ['-i', key, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', user + '@' + host,
  'rm -rf ' + remoteActivate + ' && mkdir -p ' + remoteActivate
    + ' && tar -xzf ' + remoteArchive + ' -C ' + remoteActivate + ' ./deploy/activate-release.sh'
    + ' && bash ' + remoteActivate + '/deploy/activate-release.sh ' + releaseId + ' ' + remoteArchive]);
console.log('Deployed release:', releaseId);
