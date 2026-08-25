import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { adminHeaders, adminSession, cookieHeader, makeApp, parseCookies, registerPayload } from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** 创建已发布文章并返回 slug；带 cookies 可登录用户 */
async function seedPublished(app: FastifyInstance, adminCookies: Record<string, string>) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/posts',
    headers: adminHeaders(adminCookies),
    payload: { title: '评论测试文章', contentMd: '正文', visibility: 'public', status: 'published' },
  });
  expect(res.statusCode).toBe(201);
  return res.json().post.slug;
}

async function registerAndLogin(app: FastifyInstance, username: string) {
  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: registerPayload({ username, email: username + '@test.local' }),
  });
  expect(reg.statusCode).toBe(201);
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { account: username, password: 'password-123456' },
  });
  return parseCookies(login);
}

describe('评论', () => {
  it('未登录发表 → 401', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const cookies = await adminSession(app);
    const slug = await seedPublished(app, cookies);
    const res = await app.inject({ method: 'POST', url: '/api/posts/' + slug + '/comments', payload: { content: 'x' } });
    expect(res.statusCode).toBe(401);
  });

  it('默认审核模式：pending 不入列表；后台通过后可见；comment_count 同步', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const adminCookies = await adminSession(app);
    const slug = await seedPublished(app, adminCookies);
    const userCookies = await registerAndLogin(app, 'cmt1');

    const post = await app.inject({ method: 'POST', url: '/api/posts/' + slug + '/comments', headers: { cookie: cookieHeader(userCookies) }, payload: { content: '第一条评论' } });
    expect(post.statusCode).toBe(201);
    expect(post.json().comment.status ?? null).toBeNull(); // 公开 DTO 不含 status
    const cid = post.json().comment.id;

    const list = await app.inject({ method: 'GET', url: '/api/posts/' + slug + '/comments' });
    expect(list.json().total).toBe(0); // pending 不显示

    const detail = await app.inject({ method: 'GET', url: '/api/posts/' + slug });
    expect(detail.json().post.commentCount).toBe(0);

    const approve = await app.inject({ method: 'POST', url: '/api/admin/comments/' + cid + '/status', headers: adminHeaders(adminCookies), payload: { status: 'approved' } });
    expect(approve.statusCode).toBe(200);

    const list2 = await app.inject({ method: 'GET', url: '/api/posts/' + slug + '/comments' });
    expect(list2.json().total).toBe(1);
    expect(list2.json().items[0].content).toBe('第一条评论');
    expect(list2.json().items[0].user.nickname).toBeTruthy();

    const detail2 = await app.inject({ method: 'GET', url: '/api/posts/' + slug });
    expect(detail2.json().post.commentCount).toBe(1);

    // 后台审核列表
    const adminList = await app.inject({ method: 'GET', url: '/api/admin/comments?status=approved', headers: adminHeaders(adminCookies) });
    expect(adminList.json().total).toBe(1);
    expect(adminList.json().items[0].postTitle).toBe('评论测试文章');
  });

  it('关闭审核模式：直接 approved', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const adminCookies = await adminSession(app);
    const slug = await seedPublished(app, adminCookies);
    await app.inject({ method: 'PUT', url: '/api/admin/settings', headers: adminHeaders(adminCookies), payload: { commentModeration: false } });
    const userCookies = await registerAndLogin(app, 'cmt2');
    const post = await app.inject({ method: 'POST', url: '/api/posts/' + slug + '/comments', headers: { cookie: cookieHeader(userCookies) }, payload: { content: '直接可见' } });
    expect(post.statusCode).toBe(201);
    const list = await app.inject({ method: 'GET', url: '/api/posts/' + slug + '/comments' });
    expect(list.json().total).toBe(1);
  });

  it('回复：回复已通过的评论；回复未通过/不存在 → 422', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const adminCookies = await adminSession(app);
    const slug = await seedPublished(app, adminCookies);
    const userCookies = await registerAndLogin(app, 'cmt3');
    const c1 = await app.inject({ method: 'POST', url: '/api/posts/' + slug + '/comments', headers: { cookie: cookieHeader(userCookies) }, payload: { content: '根评论' } });
    const c1id = c1.json().comment.id;
    await app.inject({ method: 'POST', url: '/api/admin/comments/' + c1id + '/status', headers: adminHeaders(adminCookies), payload: { status: 'approved' } });

    // 回复 pending 的（新发一条不通过）→ 422
    const pending = await app.inject({ method: 'POST', url: '/api/posts/' + slug + '/comments', headers: { cookie: cookieHeader(userCookies) }, payload: { content: '待审核' } });
    const pendingId = pending.json().comment.id;
    const bad = await app.inject({ method: 'POST', url: '/api/posts/' + slug + '/comments', headers: { cookie: cookieHeader(userCookies) }, payload: { content: '回复', parentId: pendingId } });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.code).toBe('PARENT_INVALID');

    // 正常回复
    const reply = await app.inject({ method: 'POST', url: '/api/posts/' + slug + '/comments', headers: { cookie: cookieHeader(userCookies) }, payload: { content: '回复你', parentId: c1id } });
    expect(reply.statusCode).toBe(201);
    const r = reply.json().comment;
    expect(r.parentId).toBe(c1id);
    expect(r.rootId).toBe(c1id);
    expect(r.replyToNickname).toBeTruthy();
  });

  it('垃圾启发式：≥3 个链接自动判 spam', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const adminCookies = await adminSession(app);
    const slug = await seedPublished(app, adminCookies);
    const userCookies = await registerAndLogin(app, 'cmt4');
    const res = await app.inject({
      method: 'POST',
      url: '/api/posts/' + slug + '/comments',
      headers: { cookie: cookieHeader(userCookies) },
      payload: { content: '看这里 https://a.com 和 https://b.com 还有 https://c.com' },
    });
    expect(res.statusCode).toBe(201);
    const list = await app.inject({ method: 'GET', url: '/api/admin/comments?status=spam', headers: adminHeaders(adminCookies) });
    expect(list.json().total).toBe(1);
    const pub = await app.inject({ method: 'GET', url: '/api/posts/' + slug + '/comments' });
    expect(pub.json().total).toBe(0);
  });

  it('删除：只能删自己的（或管理员）；删除后列表隐藏', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const adminCookies = await adminSession(app);
    const slug = await seedPublished(app, adminCookies);
    const ua = await registerAndLogin(app, 'cmt5a');
    const ub = await registerAndLogin(app, 'cmt5b');
    const c = await app.inject({ method: 'POST', url: '/api/posts/' + slug + '/comments', headers: { cookie: cookieHeader(ua) }, payload: { content: '我来删' } });
    const cid = c.json().comment.id;
    await app.inject({ method: 'POST', url: '/api/admin/comments/' + cid + '/status', headers: adminHeaders(adminCookies), payload: { status: 'approved' } });

    const byOther = await app.inject({ method: 'DELETE', url: '/api/comments/' + cid, headers: { cookie: cookieHeader(ub) } });
    expect(byOther.statusCode).toBe(403);

    const byOwner = await app.inject({ method: 'DELETE', url: '/api/comments/' + cid, headers: { cookie: cookieHeader(ua) } });
    expect(byOwner.statusCode).toBe(200);

    const list = await app.inject({ method: 'GET', url: '/api/posts/' + slug + '/comments' });
    expect(list.json().total).toBe(0);
    const detail = await app.inject({ method: 'GET', url: '/api/posts/' + slug });
    expect(detail.json().post.commentCount).toBe(0);
  });
});