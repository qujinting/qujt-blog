import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { err } from '../lib/errors.js';
import { requireRoles } from '../plugins/auth.js';
import {
  createCategory,
  createTag,
  deleteCategory,
  deleteTag,
  listCategories,
  listTags,
  updateCategory,
  updateTag,
} from '../services/taxonomy.js';

const categorySchema = z.object({
  name: z.string().trim().min(1).max(50),
  slug: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/).max(60).optional(),
  description: z.string().trim().max(200).nullable().optional(),
  sort: z.number().int().min(0).optional(),
});

const tagSchema = z.object({ name: z.string().trim().min(1).max(30) });

export async function adminTaxonomyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireRoles(app, ['admin', 'author']));

  app.get('/categories', async () => ({ items: listCategories(app.db) }));

  app.post('/categories', async (req, reply) => {
    const input = categorySchema.parse(req.body ?? {});
    return reply.code(201).send({ category: createCategory(app.db, input) });
  });

  app.put('/categories/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const input = categorySchema.partial().parse(req.body ?? {});
    return { category: updateCategory(app.db, id, input) };
  });

  app.delete('/categories/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    deleteCategory(app.db, id);
    return { ok: true };
  });

  app.get('/tags', async () => ({ items: listTags(app.db) }));

  app.post('/tags', async (req, reply) => {
    const input = tagSchema.parse(req.body ?? {});
    return reply.code(201).send({ tag: createTag(app.db, input) });
  });

  app.put('/tags/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const input = tagSchema.parse(req.body ?? {});
    return { tag: updateTag(app.db, id, input) };
  });

  app.delete('/tags/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    deleteTag(app.db, id);
    return { ok: true };
  });
}
