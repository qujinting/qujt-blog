import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import cron from 'node-cron';

/** 到期文章发布，返回发布数量 */
export function publishDuePosts(db: Database.Database): number {
  const res = db
    .prepare(
      `UPDATE posts SET status = 'published', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= ?`,
    )
    .run(new Date().toISOString());
  return res.changes;
}

/** 每分钟执行一次；返回停止函数 */
export function startScheduler(app: FastifyInstance): () => void {
  const job = cron.schedule('* * * * *', () => {
    try {
      const n = publishDuePosts(app.db);
      if (n > 0) app.log.info({ published: n }, '定时发布完成');
    } catch (e) {
      app.log.error(e, '定时发布失败');
    }
  });
  return () => job.stop();
}
