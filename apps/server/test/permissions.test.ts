import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { adminHeaders, adminSession, cookieHeader, makeApp } from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function createPublished(
  app: FastifyInstance,
  cookies: Record<string, string>,
  over: { title: string; contentMd?: string; visibility?: string; password?: string },
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/posts',
    headers: adminHeaders(cookies),
    payload: { title: over.title, contentMd: over.contentMd ?? '正文 ' + over.title, visibility: over.visibility ?? 'public', password: over.password, status: 'published' },
  });
  expect(res.statusCode).toBe(201);
  return res.json().post;
}

describe('阅读权限矩阵', () => {
  it('public：匿名可读全文', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const post = await createPublished(app, cookies, { title: '公开文章' });
    const res = await app.inject({ method: 'GET', url: `/api/posts/${post.slug}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().post.contentHtml).toContain('正文');
  });

  it('login：匿名 401，登录后可见', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const post = await createPublished(app, cookies, { title: '登录可见', visibility: 'login' });
    const anon = await app.inject({ method: 'GET', url: `/api/posts/${post.slug}` });
    expect(anon.statusCode).toBe(401);
    expect(anon.json().error.code).toBe('LOGIN_REQUIRED');
    const authed = await app.inject({ method: 'GET', url: `/api/posts/${post.slug}`, headers: { cookie: cookieHeader(cookies) } });
    expect(authed.statusCode).toBe(200);
    expect(authed.json().post.contentHtml).toBeTruthy();
  });

  it('password：未解锁返回 locked，密码错误被拒，正确后解锁可见', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const post = await createPublished(app, cookies, { title: '密码文章', visibility: 'password', password: 'secret123' });

    const locked = await app.inject({ method: 'GET', url: `/api/posts/${post.slug}` });
    expect(locked.statusCode).toBe(200);
    expect(locked.json().post.locked).toBe(true);
    expect(locked.json().post.contentHtml).toBeUndefined();

    const wrong = await app.inject({
      method: 'POST',
      url: `/api/posts/${post.slug}/unlock`,
      payload: { password: 'wrong' },
    });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().error.code).toBe('WRONG_PASSWORD');

    const ok = await app.inject({
      method: 'POST',
      url: `/api/posts/${post.slug}/unlock`,
      payload: { password: 'secret123' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().unlocked).toBe(true);
    const unlockCookies = parseCookiesFrom(ok);

    const opened = await app.inject({
      method: 'GET',
      url: `/api/posts/${post.slug}`,
      headers: { cookie: cookieHeader(unlockCookies) },
    });
    expect(opened.statusCode).toBe(200);
    expect(opened.json().post.contentHtml).toBeTruthy();
  });

  it('private：前台一律 404，后台可见', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const post = await createPublished(app, cookies, { title: '私密文章', visibility: 'private' });
    const anon = await app.inject({ method: 'GET', url: `/api/posts/${post.slug}` });
    expect(anon.statusCode).toBe(404);
    const admin = await app.inject({ method: 'GET', url: `/api/admin/posts/${post.id}`, headers: adminHeaders(cookies) });
    expect(admin.statusCode).toBe(200);
    expect(admin.json().post.visibility).toBe('private');
  });

  it('列表按矩阵过滤：匿名只见 public；登录见 public+login；password/private 不入列表', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    await createPublished(app, cookies, { title: '公开' });
    await createPublished(app, cookies, { title: '登录可见', visibility: 'login' });
    await createPublished(app, cookies, { title: '密码可见', visibility: 'password', password: 'x123' });
    await createPublished(app, cookies, { title: '私密', visibility: 'private' });

    const anon = await app.inject({ method: 'GET', url: '/api/posts' });
    expect(anon.json().total).toBe(1);

    const authed = await app.inject({ method: 'GET', url: '/api/posts', headers: { cookie: cookieHeader(cookies) } });
    expect(authed.json().total).toBe(2);
  });
});

function parseCookiesFrom(res: { headers: Record<string, unknown> }): Record<string, string> {
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
