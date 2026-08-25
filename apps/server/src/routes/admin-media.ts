import type { FastifyInstance } from 'fastify';
import { err } from '../lib/errors.js';
import { requireRoles } from '../plugins/auth.js';
import { deleteMedia, listMedia, uploadImage } from '../services/media.js';

export async function adminMediaRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireRoles(app, ['admin', 'author']));

  app.get('/media', async (req) => {
    const q = req.query as { page?: string; pageSize?: string };
    const page = Math.max(Number(q.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(q.pageSize) || 24, 1), 100);
    const res = listMedia(app.db, app.cfg, { page, pageSize });
    return { items: res.items, total: res.total, page, pageSize };
  });

  app.post('/media/upload', async (req, reply) => {
    const data = await req.file();
    if (!data) throw err(400, 'NO_FILE', '请上传文件');
    const buf = await data.toBuffer();
    if (buf.length > 10 * 1024 * 1024) throw err(413, 'IMAGE_TOO_LARGE', '图片不能超过 10MB');
    const media = await uploadImage(app.db, app.cfg, req.currentUser.id, buf, data.filename, data.mimetype);
    return reply.code(201).send({ media });
  });

  app.delete('/media/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    await deleteMedia(app.db, app.cfg, id);
    return { ok: true };
  });
}
