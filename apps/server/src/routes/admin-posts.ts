import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { err } from '../lib/errors.js';
import { requireRoles } from '../plugins/auth.js';
import {
  createPost,
  deletePost,
  getPostById,
  listAdminPosts,
  publishPost,
  toAdminPostDTO,
  toPostSummaryDTO,
  unpublishPost,
  updatePost,
} from '../services/posts.js';
import { importPostFile } from '../services/import.js';

const postInputSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(200),
  contentMd: z.string().max(2_000_000),
  slug: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/, 'slug 仅允许字母数字下划线连字符').max(100).optional(),
  summary: z.string().trim().max(500).nullable().optional(),
  coverImage: z.string().trim().max(500).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  tagNames: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  visibility: z.enum(['public', 'login', 'password', 'private']).optional(),
  password: z.string().min(4, '密码至少 4 位').max(100).nullable().optional(),
  status: z.enum(['draft', 'published', 'scheduled']).optional(),
  publishAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const postUpdateSchema = postInputSchema.partial();

export async function adminPostsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireRoles(app, ['admin', 'author']));

  app.get('/posts', async (req) => {
    const q = req.query as { status?: string; q?: string; page?: string; pageSize?: string };
    const page = Math.max(Number(q.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(q.pageSize) || 20, 1), 100);
    const res = listAdminPosts(app.db, { status: q.status, q: q.q, page, pageSize });
    return {
      items: res.items.map((i) => toPostSummaryDTO(app.db, i)),
      total: res.total,
      page,
      pageSize,
    };
  });

  app.post('/posts', async (req, reply) => {
    const input = postInputSchema.parse(req.body ?? {});
    const post = await createPost(app.db, req.currentUser.id, input);
    return reply.code(201).send({ post: toAdminPostDTO(app.db, post) });
  });

  app.get('/posts/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const post = getPostById(app.db, id);
    if (!post) throw err(404, 'POST_NOT_FOUND', '文章不存在');
    return { post: toAdminPostDTO(app.db, post) };
  });

  app.put('/posts/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const input = postUpdateSchema.parse(req.body ?? {});
    const post = await updatePost(app.db, id, input);
    return { post: toAdminPostDTO(app.db, post) };
  });

  app.delete('/posts/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    deletePost(app.db, id);
    return { ok: true };
  });

  app.post('/posts/:id/publish', async (req) => {
    const id = Number((req.params as { id: string }).id);
    return { post: toAdminPostDTO(app.db, publishPost(app.db, id)) };
  });

  app.post('/posts/:id/unpublish', async (req) => {
    const id = Number((req.params as { id: string }).id);
    return { post: toAdminPostDTO(app.db, unpublishPost(app.db, id)) };
  });

  app.post('/posts/import', async (req, reply) => {
    const data = await req.file();
    if (!data) throw err(400, 'NO_FILE', '请上传文件');
    const buf = await data.toBuffer();
    if (buf.length > 50 * 1024 * 1024) throw err(413, 'FILE_TOO_LARGE', '文件超过 50MB 限制');
    const result = await importPostFile(app.db, req.currentUser.id, buf, data.filename);
    return reply.code(201).send({
      post: toAdminPostDTO(app.db, result.post),
      source: result.source,
      unresolvedImages: result.unresolvedImages,
    });
  });
}
