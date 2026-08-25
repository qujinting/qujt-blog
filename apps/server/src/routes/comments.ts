import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CommentDTO } from '@qujt/shared';
import { err } from '../lib/errors.js';
import { authenticate } from '../plugins/auth.js';
import { getPostBySlug } from '../services/posts.js';
import {
  COMMENT_MAX_LENGTH,
  createComment,
  getCommentById,
  listApprovedByPost,
  setCommentStatus,
  type CommentRow,
} from '../services/comments.js';

function toDTO(r: CommentRow & { nickname: string; avatar: string | null; reply_to_nickname: string | null }): CommentDTO {
  return {
    id: r.id,
    postId: r.post_id,
    parentId: r.parent_id,
    rootId: r.root_id,
    replyToUid: r.reply_to_uid,
    replyToNickname: r.reply_to_nickname,
    content: r.content,
    user: { id: r.user_id, nickname: r.nickname, avatar: r.avatar },
    createdAt: r.created_at,
  };
}

const commentSchema = z.object({
  content: z.string().trim().min(1, '评论内容不能为空').max(COMMENT_MAX_LENGTH, '评论不能超过 1000 字'),
  parentId: z.number().int().positive().nullable().optional(),
});

export async function commentsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/posts/:slug/comments', async (req) => {
    const { slug } = req.params as { slug: string };
    const post = getPostBySlug(app.db, slug);
    if (!post || post.status !== 'published') throw err(404, 'POST_NOT_FOUND', '文章不存在或未发布');
    const q = req.query as { page?: string; pageSize?: string };
    const page = Math.max(Number(q.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(q.pageSize) || 50, 1), 100);
    const res = listApprovedByPost(app.db, post.id, { page, pageSize });
    return { items: res.items.map(toDTO), total: res.total, page, pageSize };
  });

  app.post(
    '/posts/:slug/comments',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const user = await authenticate(app, req);
      const { slug } = req.params as { slug: string };
      const post = getPostBySlug(app.db, slug);
      if (!post || post.status !== 'published') throw err(404, 'POST_NOT_FOUND', '文章不存在或未发布');
      const body = commentSchema.parse(req.body);
      const row = createComment(app.db, {
        postId: post.id,
        userId: user.id,
        parentId: body.parentId,
        content: body.content,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      const dto = toDTO({
        ...row,
        nickname: user.nickname,
        avatar: user.avatar,
        reply_to_nickname: row.reply_to_uid ? (app.db.prepare('SELECT nickname FROM users WHERE id = ?').get(row.reply_to_uid) as { nickname: string } | undefined)?.nickname ?? null : null,
      });
      return reply.code(201).send({ comment: dto });
    },
  );

  app.delete('/comments/:id', async (req) => {
    const user = await authenticate(app, req);
    const id = Number((req.params as { id: string }).id);
    const row = getCommentById(app.db, id);
    if (!row) throw err(404, 'COMMENT_NOT_FOUND', '评论不存在');
    if (row.user_id !== user.id && user.role === 'user') throw err(403, 'FORBIDDEN', '只能删除自己的评论');
    setCommentStatus(app.db, id, 'deleted');
    return { ok: true };
  });
}
