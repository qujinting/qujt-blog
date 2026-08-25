import type { FastifyInstance } from 'fastify';
import { err } from './lib/errors.js';
import { randomToken } from './lib/crypto.js';
import { hashPassword } from './services/users.js';

/** 首次启动：无管理员时按环境变量创建 admin */
export async function bootstrapAdmin(app: FastifyInstance): Promise<void> {
  const cfg = app.cfg;
  const existing = app.db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existing) return;

  if (!cfg.ADMIN_PASSWORD && cfg.NODE_ENV === 'production') {
    throw err(500, 'BOOTSTRAP_REQUIRED', '首次启动需设置 ADMIN_PASSWORD 环境变量以创建管理员账号');
  }
  const generated = !cfg.ADMIN_PASSWORD;
  const password = cfg.ADMIN_PASSWORD ?? randomToken(12);
  const email = cfg.ADMIN_EMAIL ?? `${cfg.ADMIN_USERNAME}@localhost`;
  const hash = await hashPassword(password);
  app.db
    .prepare('INSERT INTO users (username, email, password_hash, nickname, role) VALUES (?,?,?,?,?)')
    .run(cfg.ADMIN_USERNAME, email, hash, cfg.ADMIN_USERNAME, 'admin');
  console.log(
    `[bootstrap] 已创建管理员账号: ${cfg.ADMIN_USERNAME}` +
      (generated ? `，初始密码: ${password}（请尽快修改并删除该行输出）` : ''),
  );
}
