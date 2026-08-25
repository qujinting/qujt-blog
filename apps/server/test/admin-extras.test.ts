import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { adminHeaders, adminSession, makeApp, multipartBody } from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('后台扩展接口', () => {
  it('设置：GET 默认值 + PUT 更新', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const get = await app.inject({ method: 'GET', url: '/api/admin/settings', headers: adminHeaders(cookies) });
    expect(get.statusCode).toBe(200);
    expect(get.json().settings.registrationMode).toBe('invite');
    expect(get.json().ossConfigured).toBe(false);

    const put = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: adminHeaders(cookies),
      payload: { siteName: '我的博客', registrationMode: 'open', commentModeration: false },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().settings.siteName).toBe('我的博客');
    expect(put.json().settings.registrationMode).toBe('open');
    expect(put.json().settings.commentModeration).toBe(false);

    const get2 = await app.inject({ method: 'GET', url: '/api/admin/settings', headers: adminHeaders(cookies) });
    expect(get2.json().settings.registrationMode).toBe('open');
  });

  it('用户列表与角色/状态管理；不能修改自己', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const cookies = await adminSession(app);
    // 注册一个普通用户
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', email: 'alice@test.local', password: 'password-123' },
    });
    expect(reg.statusCode).toBe(201);
    const uid = reg.json().user.id;

    const list = await app.inject({ method: 'GET', url: '/api/admin/users', headers: adminHeaders(cookies) });
    expect(list.statusCode).toBe(200);
    expect(list.json().total).toBe(2);

    const promote = await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${uid}`,
      headers: adminHeaders(cookies),
      payload: { role: 'author' },
    });
    expect(promote.statusCode).toBe(200);
    const list2 = await app.inject({ method: 'GET', url: '/api/admin/users', headers: adminHeaders(cookies) });
    const alice = list2.json().items.find((u: { username: string }) => u.username === 'alice');
    expect(alice.role).toBe('author');

    // 管理员不能降级/禁用自己
    const adminRow = list2.json().items.find((u: { role: string }) => u.role === 'admin');
    const self = await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${adminRow.id}`,
      headers: adminHeaders(cookies),
      payload: { role: 'user' },
    });
    expect(self.statusCode).toBe(400);
    expect(self.json().error.code).toBe('CANNOT_MODIFY_SELF');
  });

  it('统计接口', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats', headers: adminHeaders(cookies) });
    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(stats.posts.total).toBe(0);
    expect(stats.users).toBe(1);
    expect(stats.media).toBe(0);
  });

  it('媒体：未配置 OSS 时上传 → 503，列表为空，删除不存在 → 404', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const { body, contentType } = multipartBody({
      file: { filename: 'a.png', content: Buffer.from('fake'), type: 'image/png' },
    });
    const up = await app.inject({
      method: 'POST',
      url: '/api/admin/media/upload',
      headers: { ...adminHeaders(cookies), 'content-type': contentType },
      payload: body,
    });
    expect(up.statusCode).toBe(503);
    expect(up.json().error.code).toBe('OSS_NOT_CONFIGURED');

    const list = await app.inject({ method: 'GET', url: '/api/admin/media', headers: adminHeaders(cookies) });
    expect(list.json().total).toBe(0);

    const del = await app.inject({ method: 'DELETE', url: '/api/admin/media/1', headers: adminHeaders(cookies) });
    expect(del.statusCode).toBe(404);
  });

  it('未登录/权限不足访问管理接口 → 401/403', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const anon = await app.inject({ method: 'GET', url: '/api/admin/settings' });
    expect(anon.statusCode).toBe(401);
    // 普通用户访问 settings（admin-only）
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'bob', email: 'bob@test.local', password: 'password-123' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { account: 'bob', password: 'password-123' },
    });
    const bobCookies = parseCookiesLocal(login);
    const forbidden = await app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { cookie: cookieHeaderLocal(bobCookies), 'x-requested-with': 'XMLHttpRequest' },
    });
    expect(forbidden.statusCode).toBe(403);
  });
});

function parseCookiesLocal(res: { headers: Record<string, unknown> }): Record<string, string> {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? (raw as string[]) : raw ? [raw as string] : [];
  const out: Record<string, string> = {};
  for (const c of list) {
    const [pair] = c.split(';');
    const idx = pair!.indexOf('=');
    if (idx > 0) out[pair!.slice(0, idx)] = pair!.slice(idx + 1);
  }
  return out;
}
function cookieHeaderLocal(c: Record<string, string>): string {
  return Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; ');
}
