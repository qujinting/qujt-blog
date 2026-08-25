import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  cookieHeader,
  makeApp,
  parseCookies,
  registerPayload,
  seedAdmin,
} from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function adminSession(app: FastifyInstance) {
  const admin = await seedAdmin(app);
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { account: admin.username, password: admin.password },
  });
  expect(login.statusCode).toBe(200);
  return parseCookies(login);
}

function adminHeaders(cookies: Record<string, string>) {
  return { cookie: cookieHeader(cookies), 'x-requested-with': 'XMLHttpRequest' };
}

describe('后台邀请码管理', () => {
  it('缺少 CSRF 头 → 403', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/invite-codes',
      headers: { cookie: cookieHeader(cookies) },
      payload: { count: 1 },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('未登录 → 401', async () => {
    app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/invite-codes',
      headers: { 'x-requested-with': 'XMLHttpRequest' },
      payload: { count: 1 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('普通用户访问 → 403', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const reg = await app.inject({ method: 'POST', url: '/api/auth/register', payload: registerPayload() });
    expect(reg.statusCode).toBe(201);
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { account: 'zhangsan', password: 'password-123456' },
    });
    const cookies = parseCookies(login);
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/invite-codes',
      headers: adminHeaders(cookies),
      payload: { count: 1 },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('管理员批量生成 → 201，含前缀，可查询', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/invite-codes',
      headers: adminHeaders(cookies),
      payload: { count: 3, prefix: 'FRIEND', maxUses: 5, note: '朋友邀请' },
    });
    expect(res.statusCode).toBe(201);
    const items = res.json().items as { code: string }[];
    expect(items.length).toBe(3);
    for (const it of items) expect(it.code.startsWith('FRIEND')).toBe(true);

    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/invite-codes',
      headers: adminHeaders(cookies),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().total).toBe(3);
  });

  it('停用邀请码后注册被拒', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/invite-codes',
      headers: adminHeaders(cookies),
      payload: { count: 1, maxUses: 1 },
    });
    const code = (created.json().items as { code: string; id: number }[])[0]!.code;
    const id = (created.json().items as { code: string; id: number }[])[0]!.id;
    const disable = await app.inject({
      method: 'PATCH',
      url: `/api/admin/invite-codes/${id}/status`,
      headers: adminHeaders(cookies),
      payload: { status: 'disabled' },
    });
    expect(disable.statusCode).toBe(200);
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: registerPayload({ inviteCode: code }),
    });
    expect(reg.statusCode).toBe(422);
    expect(reg.json().error.code).toBe('INVITE_CODE_INVALID');
  });
});
