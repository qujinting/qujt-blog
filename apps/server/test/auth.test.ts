import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createInviteCodes } from '../src/services/invites.js';
import {
  cookieHeader,
  makeApp,
  parseCookies,
  registerPayload,
  seedOwner,
} from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('健康检查', () => {
  it('GET /api/health 返回 ok', async () => {
    app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});

describe('注册模式与邀请码', () => {
  it('invite 模式：缺少邀请码 → 422', async () => {
    app = await makeApp({ registrationMode: 'invite' });
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: registerPayload() });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('INVITE_CODE_REQUIRED');
  });

  it('invite 模式：无效邀请码 → 422', async () => {
    app = await makeApp({ registrationMode: 'invite' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: registerPayload({ inviteCode: 'INVALID1234' }),
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('INVITE_CODE_INVALID');
  });

  it('invite 模式：过期邀请码 → 422', async () => {
    app = await makeApp({ registrationMode: 'invite' });
    seedOwner(app);
    const codes = createInviteCodes(app.db, {
      count: 1,
      maxUses: 1,
      createdBy: 1,
      expiresAt: '2020-01-01T00:00:00.000Z',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: registerPayload({ inviteCode: codes[0]!.code }),
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('INVITE_CODE_INVALID');
  });

  it('invite 模式：有效邀请码注册成功，来源链正确', async () => {
    app = await makeApp({ registrationMode: 'invite' });
    seedOwner(app);
    const codes = createInviteCodes(app.db, { count: 1, maxUses: 1, createdBy: 1 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: registerPayload({ inviteCode: codes[0]!.code }),
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.inviteCodeUsed).toBe(true);
    expect(body.user.invitedBy).toBe(1);
    expect(body.user.inviteCodeId).toBe(codes[0]!.id);
    const row = app.db.prepare('SELECT used_count FROM invite_codes WHERE id = ?').get(codes[0]!.id) as {
      used_count: number;
    };
    expect(row.used_count).toBe(1);
  });

  it('invite 模式：max_uses=1 的码只能注册一次', async () => {
    app = await makeApp({ registrationMode: 'invite' });
    seedOwner(app);
    const codes = createInviteCodes(app.db, { count: 1, maxUses: 1, createdBy: 1 });
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: registerPayload({ inviteCode: codes[0]!.code }),
    });
    expect(r1.statusCode).toBe(201);
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: registerPayload({ username: 'lisi', email: 'lisi@test.local', inviteCode: codes[0]!.code }),
    });
    expect(r2.statusCode).toBe(422);
    expect(r2.json().error.code).toBe('INVITE_CODE_INVALID');
  });

  it('closed 模式：拒绝注册', async () => {
    app = await makeApp({ registrationMode: 'closed' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: registerPayload({ inviteCode: 'ABC1234567' }),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('REGISTRATION_CLOSED');
  });

  it('open 模式：免码注册成功', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: registerPayload() });
    expect(res.statusCode).toBe(201);
    expect(res.json().inviteCodeUsed).toBe(false);
    expect(res.json().user.invitedBy).toBeNull();
  });

  it('用户名或邮箱重复 → 409', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const r1 = await app.inject({ method: 'POST', url: '/api/auth/register', payload: registerPayload() });
    expect(r1.statusCode).toBe(201);
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: registerPayload({ email: 'other@test.local' }),
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.json().error.code).toBe('USER_EXISTS');
    const r3 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: registerPayload({ username: 'lisi' }),
    });
    expect(r3.statusCode).toBe(409);
  });

  it('参数校验：非法用户名/邮箱/短密码 → 400', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'bad name!', email: 'not-an-email', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('登录与会话', () => {
  it('登录成功（用户名）并下发 httpOnly+SameSite=Strict cookie', async () => {
    app = await makeApp({ registrationMode: 'open' });
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: registerPayload() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { account: 'zhangsan', password: 'password-123456' },
    });
    expect(res.statusCode).toBe(200);
    const cookies = parseCookies(res);
    expect(cookies['access_token']).toBeTruthy();
    expect(cookies['refresh_token']).toBeTruthy();
    const raw = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']];
    expect(raw.join(';')).toContain('HttpOnly');
    expect(raw.join(';')).toContain('SameSite=Strict');
  });

  it('密码错误 → 401 统一文案', async () => {
    app = await makeApp({ registrationMode: 'open' });
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: registerPayload() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { account: 'zhangsan', password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('me：未登录 → 401；带 cookie → 200', async () => {
    app = await makeApp({ registrationMode: 'open' });
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: registerPayload() });
    const res0 = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res0.statusCode).toBe(401);
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { account: 'zhangsan', password: 'password-123456' },
    });
    const cookies = parseCookies(login);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieHeader(cookies) } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.username).toBe('zhangsan');
  });

  it('refresh 轮换：旧 refresh 失效，新 refresh 可用', async () => {
    app = await makeApp({ registrationMode: 'open' });
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: registerPayload() });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { account: 'zhangsan', password: 'password-123456' },
    });
    const c1 = parseCookies(login);
    const refresh1 = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: cookieHeader(c1) } });
    expect(refresh1.statusCode).toBe(200);
    const c2 = parseCookies(refresh1);
    expect(c2['access_token']).toBeTruthy();
    expect(c2['refresh_token']).not.toBe(c1['refresh_token']);
    const reuseOld = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: cookieHeader(c1) } });
    expect(reuseOld.statusCode).toBe(401);
    const reuseNew = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: cookieHeader(c2) } });
    expect(reuseNew.statusCode).toBe(200);
  });

  it('logout 后 refresh 失效', async () => {
    app = await makeApp({ registrationMode: 'open' });
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: registerPayload() });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { account: 'zhangsan', password: 'password-123456' },
    });
    const c = parseCookies(login);
    const out = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: cookieHeader(c) } });
    expect(out.statusCode).toBe(200);
    const refresh = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: cookieHeader(c) } });
    expect(refresh.statusCode).toBe(401);
  });

  it('登录限流：第 6 次尝试返回 429', async () => {
    app = await makeApp({ registrationMode: 'open' });
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { account: 'nobody', password: 'x' },
      });
      last = res.statusCode;
    }
    expect(last).toBe(429);
  });
});
