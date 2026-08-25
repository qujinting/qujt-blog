import type { FastifyInstance } from 'fastify';
import type { RegistrationMode } from '@qujt/shared';
import { buildApp } from '../src/app.js';
import { setSetting } from '../src/services/settings.js';
import { hashPassword } from '../src/services/users.js';

export const TEST_JWT_SECRET = 'test-secret-0123456789abcdef';

export async function makeApp(
  opts: { registrationMode?: RegistrationMode; logger?: boolean } = {},
): Promise<FastifyInstance> {
  const app = await buildApp({
    dbPath: ':memory:',
    logger: opts.logger ?? false,
    config: { NODE_ENV: 'test', JWT_SECRET: TEST_JWT_SECRET, REFRESH_EXPIRES_DAYS: 30 },
  });
  if (opts.registrationMode) {
    setSetting(app.db, 'registration_mode', opts.registrationMode);
  }
  return app;
}

export interface AdminSeed {
  id: number;
  username: string;
  password: string;
}

export async function seedAdmin(app: FastifyInstance): Promise<AdminSeed> {
  const username = 'admin';
  const password = 'admin-password-123';
  const hash = await hashPassword(password);
  const info = app.db
    .prepare(
      'INSERT INTO users (username, email, password_hash, nickname, role) VALUES (?,?,?,?,?)',
    )
    .run(username, 'admin@test.local', hash, '管理员', 'admin');
  return { id: Number(info.lastInsertRowid), username, password };
}

/** 解析 fastify inject 返回的 set-cookie 头 */
export function parseCookies(res: { headers: { 'set-cookie'?: string | string[] | undefined } }): Record<string, string> {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: Record<string, string> = {};
  for (const c of list) {
    const [pair] = c.split(';');
    const idx = pair!.indexOf('=');
    if (idx > 0) out[pair!.slice(0, idx)] = pair!.slice(idx + 1);
  }
  return out;
}

export function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export function registerPayload(
  over: Partial<{ username: string; email: string; password: string; inviteCode: string }> = {},
) {
  return {
    username: 'zhangsan',
    email: 'zhangsan@test.local',
    password: 'password-123456',
    ...over,
  };
}

/** 直接插入一个可作邀请码创建者的用户 */
export function seedOwner(app: FastifyInstance): number {
  const info = app.db
    .prepare(
      "INSERT INTO users (id, username, email, password_hash, nickname, role) VALUES (1, 'owner', 'owner@test.local', 'x', 'owner', 'admin')",
    )
    .run();
  return Number(info.lastInsertRowid);
}
/** 创建管理员并登录，返回 cookie */
export async function adminSession(app: FastifyInstance): Promise<Record<string, string>> {
  const admin = await seedAdmin(app);
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { account: admin.username, password: admin.password },
  });
  if (login.statusCode !== 200) throw new Error('admin login failed: ' + login.body);
  return parseCookies(login);
}

export function adminHeaders(cookies: Record<string, string>) {
  return { cookie: cookieHeader(cookies), 'x-requested-with': 'XMLHttpRequest' };
}

/** 手工构造 multipart body（避免 FormData 兼容问题） */
export function multipartBody(
  files: Record<string, { filename: string; content: string | Buffer; type?: string }>,
): { body: Buffer; contentType: string } {
  const boundary = '----qujt-test-' + Math.random().toString(36).slice(2);
  const chunks: Buffer[] = [];
  for (const [name, f] of Object.entries(files)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${f.filename}"\r\nContent-Type: ${f.type ?? 'application/octet-stream'}\r\n\r\n`,
      ),
    );
    chunks.push(Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}
