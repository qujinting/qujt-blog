import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { err } from '../lib/errors.js';
import { requireRoles } from '../plugins/auth.js';
import { listUsers, updateUserRole, updateUserStatus, setUserPassword } from '../services/users.js';
import { revokeRefreshByUser } from '../services/session.js';

const updateSchema = z.object({
  role: z.enum(['admin', 'author', 'user']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

const passwordSchema = z.object({
  password: z.string().min(8, '密码至少 8 位').max(72, '密码过长'),
});

export async function adminUsersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireRoles(app, ['admin']));

  app.get('/users', async (req) => {
    const q = req.query as { page?: string; pageSize?: string; q?: string };
    const page = Math.max(Number(q.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(q.pageSize) || 20, 1), 100);
    const res = listUsers(app.db, { page, pageSize, q: q.q });
    return { items: res.items, total: res.total, page, pageSize };
  });

  app.put('/users/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw err(400, 'INVALID_ID', '无效的用户 id');
    const patch = updateSchema.parse(req.body ?? {});
    // 防止管理员把自己降级或禁用
    if (id === req.currentUser.id && (patch.role !== undefined && patch.role !== 'admin' || patch.status === 'disabled')) {
      throw err(400, 'CANNOT_MODIFY_SELF', '不能修改自己的角色或禁用自己');
    }
    if (patch.role !== undefined) updateUserRole(app.db, id, patch.role);
    if (patch.status !== undefined) updateUserStatus(app.db, id, patch.status);
    return { ok: true };
  });

  // 管理员重置任意用户密码；同时撤销该用户所有旧 refresh token，迫使其重新登录
  app.post('/users/:id/password', async (req) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw err(400, 'INVALID_ID', '无效的用户 id');
    const { password } = passwordSchema.parse(req.body ?? {});
    await setUserPassword(app.db, id, password);
    revokeRefreshByUser(app.db, id);
    return { ok: true };
  });
}
