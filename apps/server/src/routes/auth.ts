import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { err } from '../lib/errors.js';
import { register as doRegister, login as doLogin } from '../services/auth.js';
import {
  accessCookieOptions,
  issueSessionCookies,
  refreshCookieOptions,
  revokeRefreshByRaw,
  rotateRefresh,
} from '../services/session.js';
import { authenticate } from '../plugins/auth.js';
import { toUserDTO } from '../services/users.js';

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, '用户名至少 3 位')
    .max(20, '用户名最多 20 位')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名仅允许字母、数字、下划线、连字符'),
  email: z.email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少 8 位').max(72, '密码过长'),
  inviteCode: z.string().trim().max(64).optional(),
});

const loginSchema = z.object({
  account: z.string().trim().min(1, '请输入用户名或邮箱'),
  password: z.string().min(1, '请输入密码'),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/register',
    { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const input = registerSchema.parse(req.body);
      const result = await doRegister(app.db, input);
      return reply.code(201).send({ user: result.user, inviteCodeUsed: result.inviteCodeUsed });
    },
  );

  app.post(
    '/login',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { account, password } = loginSchema.parse(req.body);
      const user = await doLogin(app.db, account, password);
      await issueSessionCookies(app, reply, user);
      return { user: toUserDTO(user) };
    },
  );

  app.post('/refresh', async (req, reply) => {
    const raw = req.cookies.refresh_token;
    if (!raw) throw err(401, 'NO_REFRESH_TOKEN', '未登录');
    const session = await rotateRefresh(app, raw);
    reply.setCookie('access_token', session.accessToken, accessCookieOptions(app));
    reply.setCookie('refresh_token', session.refreshToken, refreshCookieOptions(app));
    return { user: toUserDTO(session.user) };
  });

  app.post('/logout', async (req, reply) => {
    const raw = req.cookies.refresh_token;
    if (raw) revokeRefreshByRaw(app.db, raw);
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/' });
    return { ok: true };
  });

  app.get('/me', async (req, reply) => {
    const user = await authenticate(app, req);
    return { user: toUserDTO(user) };
  });
}
