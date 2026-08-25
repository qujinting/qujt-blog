import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRoles } from '../plugins/auth.js';
import { getSiteSettings, updateSiteSettings } from '../services/settings.js';
import { isOssConfigured } from '../services/media.js';

const settingsSchema = z.object({
  siteName: z.string().trim().min(1).max(100).optional(),
  siteDescription: z.string().trim().max(300).optional(),
  icp: z.string().trim().max(100).optional(),
  registrationMode: z.enum(['closed', 'invite', 'open']).optional(),
  commentModeration: z.boolean().optional(),
});

export async function adminSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireRoles(app, ['admin']));

  app.get('/settings', async () => ({
    settings: getSiteSettings(app.db),
    ossConfigured: isOssConfigured(app.cfg),
  }));

  app.put('/settings', async (req) => {
    const patch = settingsSchema.parse(req.body ?? {});
    return { settings: updateSiteSettings(app.db, patch) };
  });
}
