// 从线上测试服拉取测试库一致性快照到本地沙箱（用于本地调试真实数据）
// 用法: node deploy/fetch-test-db.mjs [host]   （默认 115.29.149.137）
// 环境变量: DEPLOY_USER(默认 root) DEPLOY_KEY(默认 ~/.ssh/qujt-deploy-key)
//          LOCAL_DB_PATH(默认 apps/server/data/qujt.db，即本地 .env 中 DATABASE_PATH 指向的文件)
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.argv[2] ?? '115.29.149.137';
const user = process.env.DEPLOY_USER ?? 'root';
const key = process.env.DEPLOY_KEY ?? path.join(os.homedir(), '.ssh', 'qujt-deploy-key');
const localDbPath = process.env.LOCAL_DB_PATH ?? path.join(ROOT, 'apps', 'server', 'data', 'qujt.db');
const remoteDbPath = '/opt/qujt-blog/apps/server/data/test.db';
const remoteBak = '/tmp/qujt-test.db.bak';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('==> 1/2 在服务器上做一致性备份（better-sqlite3 online backup）');
run('ssh', ['-i', key, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', user + '@' + host, 'bash', '-s'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  input: `set -e
cd /opt/qujt-blog/apps/server
test -f ${remoteDbPath} || { echo "测试库不存在，请先执行: node deploy/deploy-test.mjs"; exit 1; }
node -e "const D=require('better-sqlite3');const db=new D('${remoteDbPath}');db.backup('${remoteBak}').then(()=>{console.log('BACKUP_OK');process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})"`,
});

console.log('==> 2/2 拷贝到本地沙箱库（旧库备份为 .bak）');
mkdirSync(path.dirname(localDbPath), { recursive: true });
if (existsSync(localDbPath)) {
  const bak = localDbPath + '.bak';
  if (existsSync(bak)) rmSync(bak);
  renameSync(localDbPath, bak);
  console.log('已备份旧库 -> ' + bak);
}
rmSync(localDbPath + '-wal', { force: true });
rmSync(localDbPath + '-shm', { force: true });
run('scp', ['-i', key, '-o', 'StrictHostKeyChecking=accept-new', user + '@' + host + ':' + remoteBak, localDbPath]);

console.log('');
console.log('测试库快照已写入: ' + localDbPath);
console.log('提示: 请先停止本地后台(如果正在运行)，再重新 pnpm dev 启动，即可用测试数据调试');
