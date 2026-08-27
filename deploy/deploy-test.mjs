// 一键部署【测试环境】：与生产共用同一台服务器，但完全隔离。
//  - 新增独立 API 进程（qujt-api-test，端口 3001），使用独立测试库 apps/server/data/test.db
//  - 测试前台 /test/、测试后台 /test/admin/（不覆盖生产 apps/web/dist、apps/admin/dist）
//  - 测试前台的 API 走 /test/api/** 反代到本机 3001
// 用法: node deploy/deploy-test.mjs [host]   （默认 115.29.149.137）
// 环境变量: DEPLOY_USER(默认 root) DEPLOY_KEY(默认 ~/.ssh/qujt-deploy-key)
//          TEST_JWT_SECRET(可选，自动生成) TEST_ADMIN_PASSWORD(可选，自动生成) TEST_ADMIN_USERNAME(默认 admin)
import { spawnSync } from 'node:child_process';
import { mkdirSync, cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.argv[2] ?? '115.29.149.137';
const user = process.env.DEPLOY_USER ?? 'root';
const key = process.env.DEPLOY_KEY ?? path.join(os.homedir(), '.ssh', 'qujt-deploy-key');
const registry = process.env.NPM_REGISTRY ?? 'https://registry.npmmirror.com';

const testJwtSecret = process.env.TEST_JWT_SECRET ?? crypto.randomBytes(32).toString('hex');
const testAdminPassword = process.env.TEST_ADMIN_PASSWORD ?? crypto.randomBytes(9).toString('base64url');
const testAdminUser = process.env.TEST_ADMIN_USERNAME ?? 'admin';
const testWebBase = '/test/';
const testAdminBase = '/test/admin/';
const testApiBase = '/test/api';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) {
    console.error('FAILED:', cmd, args.join(' '));
    process.exit(r.status ?? 1);
  }
}
function sshScript(script) {
  const child = spawnSync('ssh', [
    '-i', key, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new',
    user + '@' + host, 'bash', '-s',
  ], { stdio: ['pipe', 'inherit', 'inherit'], input: script, env: process.env });
  if (child.status !== 0) process.exit(child.status ?? 1);
}

const webDist = path.join(os.tmpdir(), 'qujt-test-web-dist');
const adminDist = path.join(os.tmpdir(), 'qujt-test-admin-dist');
rmSync(webDist, { recursive: true, force: true });
rmSync(adminDist, { recursive: true, force: true });

console.log('==> 1/4 构建 server + 测试前端');
run('pnpm', ['build'], { cwd: path.join(ROOT, 'apps', 'server'), shell: true });
run('pnpm', ['exec', 'vite', 'build', '--mode', 'test', '--base', testWebBase, '--outDir', webDist], {
  cwd: path.join(ROOT, 'apps', 'web'),
  env: { ...process.env, VITE_API_BASE: testApiBase },
  shell: true,
});
run('pnpm', ['exec', 'vite', 'build', '--base', testAdminBase, '--outDir', adminDist], {
  cwd: path.join(ROOT, 'apps', 'admin'),
  env: { ...process.env, VITE_API_BASE: testApiBase },
  shell: true,
});

console.log('==> 2/4 打包');
const bundle = path.join(os.tmpdir(), 'qujt-test-release');
rmSync(bundle, { recursive: true, force: true });
mkdirSync(path.join(bundle, 'apps', 'server', 'data'), { recursive: true });
cpSync(path.join(ROOT, 'apps', 'server', 'dist'), path.join(bundle, 'apps', 'server', 'dist'), { recursive: true });
cpSync(path.join(ROOT, 'apps', 'server', 'package.json'), path.join(bundle, 'apps', 'server', 'package.json'));
cpSync(path.join(ROOT, 'deploy', 'backup.mjs'), path.join(bundle, 'apps', 'server', 'backup.mjs'));
cpSync(webDist, path.join(bundle, 'apps', 'test-web', 'dist'), { recursive: true });
cpSync(adminDist, path.join(bundle, 'apps', 'test-admin', 'dist'), { recursive: true });
cpSync(path.join(ROOT, 'deploy', 'nginx.conf'), path.join(bundle, 'deploy', 'nginx.conf'));
cpSync(path.join(ROOT, 'deploy', 'ecosystem.test.config.js'), path.join(bundle, 'deploy', 'ecosystem.test.config.js'));
cpSync(path.join(ROOT, 'package.json'), path.join(bundle, 'package.json'));
cpSync(path.join(ROOT, 'pnpm-workspace.yaml'), path.join(bundle, 'pnpm-workspace.yaml'));
cpSync(path.join(ROOT, 'pnpm-lock.yaml'), path.join(bundle, 'pnpm-lock.yaml'));
cpSync(path.join(ROOT, 'packages'), path.join(bundle, 'packages'), { recursive: true });
const tarball = path.join(os.tmpdir(), 'qujt-test-release.tar.gz');
rmSync(tarball, { force: true });
run('tar', ['-czf', tarball, '-C', bundle, '.']);

console.log('==> 3/4 上传');
run('scp', ['-i', key, '-o', 'StrictHostKeyChecking=accept-new', tarball, user + '@' + host + ':/tmp/qujt-test-release.tar.gz']);

console.log('==> 4/4 服务器部署测试环境');
const script = `set -e
mkdir -p /opt/qujt-blog && tar -xzf /tmp/qujt-test-release.tar.gz -C /opt/qujt-blog
cd /opt/qujt-blog
if [ ! -d node_modules ]; then pnpm install --prod --filter @qujt/server --registry="${registry}"; fi
mkdir -p apps/server/data
export TEST_JWT_SECRET='${testJwtSecret}'
export TEST_ADMIN_USERNAME='${testAdminUser}'
export TEST_ADMIN_PASSWORD='${testAdminPassword}'
pm2 startOrRestart deploy/ecosystem.test.config.js
pm2 save
cp deploy/nginx.conf /etc/nginx/sites-available/qujt-blog
nginx -t && systemctl reload nginx
echo TEST_DEPLOY_DONE`;

sshScript(script);

console.log('');
console.log('测试环境部署完成:');
console.log('  前台:     http://' + host + '/test');
console.log('  后台:     http://' + host + '/test/admin');
console.log('  测试 API: http://' + host + '/test/api/health（端口 3001，独立测试库 apps/server/data/test.db）');
console.log('  测试管理员: ' + testAdminUser + ' / ' + testAdminPassword + '（请尽快修改；下次部署可用 TEST_ADMIN_PASSWORD 覆盖）');
