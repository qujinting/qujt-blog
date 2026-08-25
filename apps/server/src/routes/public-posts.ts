import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { err } from '../lib/errors.js';
import { authenticate } from '../plugins/auth.js';
import type { DbUser } from '../services/users.js';
import { getRegistrationMode, getSetting } from '../services/settings.js';
import { listCategories, listTags } from '../services/taxonomy.js';
import {
  getPostBySlug,
  listPublicPosts,
  recordView,
  toPostDetailDTO,
  toPostSummaryDTO,
  verifyPostPassword,
} from '../services/posts.js';

const UNLOCK_COOKIE = 'post_unlock';

async function tryGetUser(app: FastifyInstance, req: FastifyRequest): Promise<DbUser | null> {
  try {
    return await authenticate(app, req);
  } catch {
    return null;
  }
}

function readUnlockPayload(app: FastifyInstance, req: FastifyRequest): { postId: number } | null {
  const raw = req.cookies?.[UNLOCK_COOKIE];
  if (!raw) return null;
  try {
    const payload = app.jwt.verify(raw) as { type?: string; postId?: number };
    if (payload.type === 'post_unlock' && typeof payload.postId === 'number') {
      return { postId: payload.postId };
    }
  } catch {
    // 忽略无效解锁 cookie
  }
  return null;
}

export async function publicPostsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/site', async () => {
    return {
      siteName: getSetting(app.db, 'site_name') ?? 'qujt-blog',
      siteDescription: getSetting(app.db, 'site_description') ?? '',
      icp: getSetting(app.db, 'icp') ?? '',
      registrationMode: getRegistrationMode(app.db),
      commentModeration: (getSetting<boolean>(app.db, 'comment_moderation') ?? true) === true,
      categories: listCategories(app.db),
    };
  });

  app.get('/posts', async (req) => {
    const q = req.query as { page?: string; pageSize?: string; category?: string; tag?: string; q?: string };
    const page = Math.max(Number(q.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(q.pageSize) || 10, 1), 50);
    const user = await tryGetUser(app, req);
    const res = listPublicPosts(app.db, {
      page,
      pageSize,
      category: q.category,
      tag: q.tag,
      q: q.q,
      authed: !!user,
    });
    return {
      items: res.items.map((i) => toPostSummaryDTO(app.db, i)),
      total: res.total,
      page,
      pageSize,
    };
  });

  app.get('/posts/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const post = getPostBySlug(app.db, slug);
    if (!post || post.status !== 'published') throw err(404, 'POST_NOT_FOUND', '文章不存在或未发布');
    if (post.visibility === 'private') throw err(404, 'POST_NOT_FOUND', '文章不存在或未发布');

    const user = await tryGetUser(app, req);
    if (post.visibility === 'login' && !user) {
      throw err(401, 'LOGIN_REQUIRED', '该文章仅登录用户可见');
    }
    if (post.visibility === 'password') {
      const unlock = readUnlockPayload(app, req);
      if (!unlock || unlock.postId !== post.id) {
        return { post: { ...toPostSummaryDTO(app.db, post), locked: true, lockedReason: 'password' } };
      }
    }
    recordView(app.db, post.id, req.ip);
    const fresh = getPostBySlug(app.db, slug)!;
    return { post: toPostDetailDTO(app.db, fresh) };
  });

  app.post(
    '/posts/:slug/unlock',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const body = z.object({ password: z.string().min(1).max(100) }).parse(req.body);
      const post = getPostBySlug(app.db, slug);
      if (!post || post.status !== 'published' || post.visibility !== 'password') {
        throw err(404, 'POST_NOT_FOUND', '文章不存在');
      }
      if (!post.password_hash) throw err(500, 'INTERNAL_ERROR', '文章未设置密码');
      const ok = await verifyPostPassword(post.password_hash, body.password);
      if (!ok) throw err(401, 'WRONG_PASSWORD', '密码错误');
      const token = app.jwt.sign({ type: 'post_unlock', postId: post.id }, { expiresIn: '7d' });
      reply.setCookie(UNLOCK_COOKIE, token, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: false,
        maxAge: 7 * 86400,
      });
      return { unlocked: true };
    },
  );

  app.get('/categories', async () => ({ items: listCategories(app.db) }));
  app.get('/tags', async () => ({ items: listTags(app.db) }));
}