import type { FastifyInstance } from 'fastify';
import { requireRoles } from '../plugins/auth.js';

export async function adminStatsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireRoles(app, ['admin', 'author']));

  app.get('/stats', async () => {
    const db = app.db;
    const one = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
    const today = new Date().toISOString().slice(0, 10);
    const recent = db
      .prepare(`SELECT id, slug, title, status, visibility, view_count, publish_at, updated_at FROM posts ORDER BY id DESC LIMIT 8`)
      .all();
    return {
      posts: {
        total: one('SELECT COUNT(*) AS c FROM posts'),
        published: one("SELECT COUNT(*) AS c FROM posts WHERE status='published'"),
        drafts: one("SELECT COUNT(*) AS c FROM posts WHERE status='draft'"),
        scheduled: one("SELECT COUNT(*) AS c FROM posts WHERE status='scheduled'"),
      },
      comments: {
        total: one('SELECT COUNT(*) AS c FROM comments'),
        pending: one("SELECT COUNT(*) AS c FROM comments WHERE status='pending'"),
      },
      users: one('SELECT COUNT(*) AS c FROM users'),
      views: {
        today: (db.prepare('SELECT COUNT(*) AS c FROM post_views WHERE date = ?').get(today) as { c: number }).c,
        total: one('SELECT COUNT(*) AS c FROM post_views'),
      },
      media: one('SELECT COUNT(*) AS c FROM media'),
      inviteCodes: {
        total: one('SELECT COUNT(*) AS c FROM invite_codes'),
        unused: (db.prepare("SELECT COUNT(*) AS c FROM invite_codes WHERE status='active' AND (max_uses = 0 OR used_count < max_uses) AND (expires_at IS NULL OR expires_at > ?)").get(new Date().toISOString()) as { c: number }).c,
      },
      recentPosts: recent,
    };
  });
}