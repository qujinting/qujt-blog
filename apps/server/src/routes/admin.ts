import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRoles } from '../plugins/auth.js';
import { createInviteCodes, listInviteCodes, setInviteCodeStatus } from '../services/invites.js';

const createSchema = z.object({
  count: z.coerce.number().int().min(1).max(100).default(1),
  prefix: z.string().trim().max(12).optional(),
  maxUses: z.coerce.number().int().min(0).max(100000).default(1),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  note: z.string().trim().max(200).optional(),
});

const statusSchema = z.object({ status: z.enum(['active', 'disabled']) });

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireRoles(app, ['admin']));

  app.post('/invite-codes', async (req, reply) => {
    const input = createSchema.parse(req.body ?? {});
    const items = createInviteCodes(app.db, { ...input, createdBy: req.currentUser.id });
    return reply.code(201).send({ items, count: items.length });
  });

  app.get('/invite-codes', async (req) => {
    const q = req.query as { page?: string; pageSize?: string };
    const page = Math.max(Number(q.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(q.pageSize) || 50, 1), 100);
    const res = listInviteCodes(app.db, { offset: (page - 1) * pageSize, limit: pageSize });
    return { items: res.items, total: res.total, page, pageSize };
  });

  app.patch('/invite-codes/:id/status', async (req) => {
    const { id } = req.params as { id: string };
    const { status } = statusSchema.parse(req.body);
    setInviteCodeStatus(app.db, Number(id), status);
    return { ok: true };
  });
}
