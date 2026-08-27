// 一键部署：本地构建 → 打包 → 上传 → 服务器安装/重启
// 用法: node deploy/deploy.mjs [host]   （默认 115.29.149.137）
// 环境变量: DEPLOY_USER(默认 root) DEPLOY_KEY(默认 ~/.ssh/qujt-deploy-key) ADMIN_PASSWORD(首次部署必填)
import { spawnSync } from 'node:child_process';
import { mkdirSync, cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.argv[2] ?? '115.29.149.137';
const user = process.env.DEPLOY_USER ?? 'root';
const key = process.env.DEPLOY_KEY ?? path.join(os.homedir(), '.ssh', 'qujt-deploy-key');
const registry = process.env.NPM_REGISTRY ?? 'https://registry.npmmirror.com';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) {
    console.error('FAILED:', cmd, args.join(' '));
    process.exit(r.status ?? 1);
  }
}
function sshScript(script, { env = {} } = {}) {
  const child = spawnSync('ssh', [
    '-i', key, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new',
    user + '@' + host, 'bash', '-s',
  ], { stdio: ['pipe', 'inherit', 'inherit'], input: script, env: { ...process.env, ...env } });
  if (child.status !== 0) process.exit(child.status ?? 1);
}

console.log('==> 1/4 构建三端');
run('pnpm', ['--filter', '@qujt/server', 'build'], { shell: true });
run('pnpm', ['--filter', '@qujt/web', 'build'], { shell: true });
run('pnpm', ['--filter', '@qujt/admin', 'build'], { shell: true });

console.log('==> 2/4 打包');
const bundle = path.join(os.tmpdir(), 'qujt-release');
rmSync(bundle, { recursive: true, force: true });
mkdirSync(path.join(bundle, 'apps', 'server', 'data'), { recursive: true });
cpSync(path.join(ROOT, 'apps', 'server', 'dist'), path.join(bundle, 'apps', 'server', 'dist'), { recursive: true });
cpSync(path.join(ROOT, 'apps', 'server', 'package.json'), path.join(bundle, 'apps', 'server', 'package.json'));
cpSync(path.join(ROOT, 'deploy', 'backup.mjs'), path.join(bundle, 'apps', 'server', 'backup.mjs'));
cpSync(path.join(ROOT, 'apps', 'web', 'dist'), path.join(bundle, 'apps', 'web', 'dist'), { recursive: true });
cpSync(path.join(ROOT, 'apps', 'admin', 'dist'), path.join(bundle, 'apps', 'admin', 'dist'), { recursive: true });
cpSync(path.join(ROOT, 'deploy', 'nginx.conf'), path.join(bundle, 'deploy', 'nginx.conf'));
cpSync(path.join(ROOT, 'deploy', 'ecosystem.config.js'), path.join(bundle, 'deploy', 'ecosystem.config.js'));
cpSync(path.join(ROOT, 'deploy', 'remote-setup.sh'), path.join(bundle, 'deploy', 'remote-setup.sh'));
cpSync(path.join(ROOT, 'deploy', 'backup.mjs'), path.join(bundle, 'deploy', 'backup.mjs'));
cpSync(path.join(ROOT, 'package.json'), path.join(bundle, 'package.json'));
cpSync(path.join(ROOT, 'pnpm-workspace.yaml'), path.join(bundle, 'pnpm-workspace.yaml'));
cpSync(path.join(ROOT, 'pnpm-lock.yaml'), path.join(bundle, 'pnpm-lock.yaml'));
cpSync(path.join(ROOT, 'packages'), path.join(bundle, 'packages'), { recursive: true });
const tarball = path.join(os.tmpdir(), 'qujt-release.tar.gz');
rmSync(tarball, { force: true });
run('tar', ['-czf', tarball, '-C', bundle, '.']);

console.log('==> 3/4 上传');
run('scp', ['-i', key, '-o', 'StrictHostKeyChecking=accept-new', tarball, user + '@' + host + ':/tmp/qujt-release.tar.gz']);

console.log('==> 4/4 服务器部署');
const script = [
  'set -e',
  'mkdir -p /opt/qujt-blog && tar -xzf /tmp/qujt-release.tar.gz -C /opt/qujt-blog',
  'cd /opt/qujt-blog',
  'if [ ! -d node_modules ]; then pnpm install --prod --filter @qujt/server --registry="' + registry + '"; fi',
  'if [ ! -f apps/server/.env ]; then',
  '  echo "NODE_ENV=production" > apps/server/.env',
  '  echo "HOST=127.0.0.1" >> apps/server/.env',
  '  echo "PORT=3000" >> apps/server/.env',
  '  echo "DATABASE_PATH=data/qujt.db" >> apps/server/.env',
  `  echo "JWT_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')" >> apps/server/.env`,
  '  echo "ADMIN_USERNAME=admin" >> apps/server/.env',
  '  echo "ADMIN_PASSWORD=' + '$' + '{ADMIN_PASSWORD:?首次部署需设置 ADMIN_PASSWORD 环境变量}' + '" >> apps/server/.env',
  'fi',
  'pm2 restart qujt-api --update-env || pm2 start deploy/ecosystem.config.js',
  'pm2 save',
  'cp deploy/nginx.conf /etc/nginx/sites-available/qujt-blog',
  'nginx -t && systemctl reload nginx',
  'echo DEPLOY_DONE',
].join('\n');
sshScript(script, { env: { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? '' } });
console.log('部署完成: http://' + host);
