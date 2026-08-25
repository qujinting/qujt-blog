import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { bootstrapAdmin } from './bootstrap.js';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const app = await buildApp({ dbPath: cfg.DATABASE_PATH, logger: true, config: cfg });
  await bootstrapAdmin(app);
  await app.listen({ host: cfg.HOST, port: cfg.PORT });
  const addr = app.server.address();
  const port = typeof addr === 'object' && addr ? addr.port : cfg.PORT;
  console.log(`[server] qujt-blog API 已启动: http://${cfg.HOST}:${port}`);
}

main().catch((e) => {
  console.error('[server] 启动失败:', e);
  process.exit(1);
});
