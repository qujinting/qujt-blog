import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AdminCommentDTO } from '@qujt/shared';
import { requireRoles } from '../plugins/auth.js';
import { listAdminComments, setCommentStatus } from '../services/comments.js';

function toDTO(r: {
  id: number; post_id: number; user_id: number; parent_id: number | null; root_id: number | null; reply_to_uid: number | null;
  content: string; status: string; ip: string | null; created_at: string;
  username: string; nickname: string; avatar: string | null; post_title: string;
}): AdminCommentDTO {
  return {
    id: r.id,
    postId: r.post_id,
    parentId: r.parent_id,
    rootId: r.root_id,
    replyToUid: r.reply_to_uid,
    replyToNickname: null,
    content: r.content,
    user: { id: r.user_id, nickname: r.nickname, avatar: r.avatar },
    createdAt: r.created_at,
    status: r.status as AdminCommentDTO['status'],
    ip: r.ip,
    username: r.username,
    postTitle: r.post_title,
  };
}

const statusSchema = z.object({ status: z.enum(['pending', 'approved', 'spam', 'deleted']) });

export async function adminCommentsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireRoles(app, ['admin', 'author']));

  app.get('/comments', async (req) => {
    const q = req.query as { status?: string; page?: string; pageSize?: string; q?: string };
    const page = Math.max(Number(q.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(q.pageSize) || 20, 1), 100);
    const validStatus = ['pending', 'approved', 'spam', 'deleted'].includes(q.status ?? '') ? (q.status as 'pending' | 'approved' | 'spam' | 'deleted') : undefined;
    const res = listAdminComments(app.db, { status: validStatus, page, pageSize, q: q.q });
    return { items: res.items.map(toDTO), total: res.total, page, pageSize };
  });

  app.post('/comments/:id/status', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const { status } = statusSchema.parse(req.body);
    setCommentStatus(app.db, id, status);
    return { ok: true };
  });
}