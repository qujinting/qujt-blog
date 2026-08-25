import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { cookieHeader, makeApp, parseCookies, registerPayload } from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function loginAs(app: FastifyInstance, account: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { account, password } });
  expect(res.statusCode).toBe(200);
  return parseCookies(res);
}

describe('个人资料接口', () => {
  it('未登录访问 /me 修改 → 401', async () => {
    app = await makeApp({ registrationMode: 'open' });
    const res = await app.inject({ method: 'PUT', url: '/api/auth/me', payload: { nickname: 'x' } });
    expect(res.statusCode).toBe(401);
  });

  it('更新昵称/头像', async () => {
    app = await makeApp({ registrationMode: 'open' });
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: registerPayload() });
    const cookies = await loginAs(app, 'zhangsan', 'password-123456');
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/me',
      headers: { cookie: cookieHeader(cookies) },
      payload: { nickname: '张三', avatar: 'https://cdn.example.com/avatar.png' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.nickname).toBe('张三');
    expect(res.json().user.avatar).toBe('https://cdn.example.com/avatar.png');
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieHeader(cookies) } });
    expect(me.json().user.nickname).toBe('张三');
  });

  it('修改密码：原密码错误 → 400；正确后旧密码失效、新密码可登录', async () => {
    app = await makeApp({ registrationMode: 'open' });
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: registerPayload() });
    const cookies = await loginAs(app, 'zhangsan', 'password-123456');

    const wrong = await app.inject({
      method: 'POST',
      url: '/api/auth/me/password',
      headers: { cookie: cookieHeader(cookies) },
      payload: { oldPassword: 'wrong-pass', newPassword: 'new-password-123' },
    });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error.code).toBe('WRONG_OLD_PASSWORD');

    const ok = await app.inject({
      method: 'POST',
      url: '/api/auth/me/password',
      headers: { cookie: cookieHeader(cookies) },
      payload: { oldPassword: 'password-123456', newPassword: 'new-password-123' },
    });
    expect(ok.statusCode).toBe(200);

    const oldLogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { account: 'zhangsan', password: 'password-123456' } });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { account: 'zhangsan', password: 'new-password-123' } });
    expect(newLogin.statusCode).toBe(200);
  });
});
