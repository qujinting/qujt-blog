// 每日 SQLite 备份（cron 调用；放在 apps/server 下以复用 better-sqlite3）
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(serverDir, 'data', 'qujt.db');
const backupDir = path.resolve(serverDir, '..', '..', 'backups');

mkdirSync(backupDir, { recursive: true });
const ts = new Date().toISOString().slice(0, 10);
const dest = path.join(backupDir, `qujt-${ts}.db`);

const db = new Database(dbPath, { readonly: true });
await db.backup(dest);
db.close();

// 保留 14 天
const keep = 14;
readdirSync(backupDir)
  .filter((f) => f.startsWith('qujt-') && f.endsWith('.db'))
  .sort()
  .slice(0, -keep)
  .forEach((f) => unlinkSync(path.join(backupDir, f)));

console.log('backup ok:', dest);
