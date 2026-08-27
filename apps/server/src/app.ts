import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { openDb } from './db/connection.js';
import { AppError } from './lib/errors.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { publicPostsRoutes } from './routes/public-posts.js';
import { adminPostsRoutes } from './routes/admin-posts.js';
import { adminTaxonomyRoutes } from './routes/admin-taxonomy.js';
import { adminSettingsRoutes } from './routes/admin-settings.js';
import { adminUsersRoutes } from './routes/admin-users.js';
import { adminMediaRoutes } from './routes/admin-media.js';
import { adminStatsRoutes } from './routes/admin-stats.js';
import { commentsRoutes } from './routes/comments.js';
import { adminCommentsRoutes } from './routes/admin-comments.js';
import type { AppConfig } from './config.js';

export interface AppOptions {
  dbPath?: string;
  logger?: boolean;
  config?: Partial<AppConfig>;
}

const DEFAULT_CFG: AppConfig = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 0,
  DATABASE_PATH: ':memory:',
  JWT_SECRET: 'test-secret-0123456789abcdef',
  JWT_EXPIRES_IN: '2h',
  REFRESH_EXPIRES_DAYS: 30,
  ADMIN_USERNAME: 'admin',
  COOKIE_PATH: '/',
};

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const dbPath = opts.dbPath ?? ':memory:';
  const db = openDb(dbPath);
  const app = Fastify({ logger: opts.logger ?? false });

  app.decorate('db', db);
  app.decorate('cfg', { ...DEFAULT_CFG, ...opts.config, DATABASE_PATH: dbPath });

  await app.register(cookie);
  await app.register(jwt, {
    secret: app.cfg.JWT_SECRET,
    cookie: { cookieName: 'access_token', signed: false },
  });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  app.setErrorHandler(async (error, req, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }
    if (error instanceof ZodError) {
      const first = error.issues[0];
      const path = first?.path?.join('.') || 'body';
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: `${path}: ${first?.message ?? '参数错误'}` },
      });
    }
    if ((error as { code?: string }).code === 'FST_ERR_VALIDATION') {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: (error as Error).message } });
    }
    // 兼容带 statusCode 的 Fastify 插件错误（如 rate-limit 429）
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({
        error: { code: (error as { code?: string }).code ?? 'REQUEST_ERROR', message: (error as Error).message },
      });
    }
    req.log.error(error);
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } });
  });

  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(publicPostsRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(adminPostsRoutes, { prefix: '/api/admin' });
  await app.register(adminTaxonomyRoutes, { prefix: '/api/admin' });
  await app.register(adminSettingsRoutes, { prefix: '/api/admin' });
  await app.register(adminUsersRoutes, { prefix: '/api/admin' });
  await app.register(adminMediaRoutes, { prefix: '/api/admin' });
  await app.register(adminStatsRoutes, { prefix: '/api/admin' });
  await app.register(commentsRoutes, { prefix: '/api' });
  await app.register(adminCommentsRoutes, { prefix: '/api/admin' });

  return app;
}