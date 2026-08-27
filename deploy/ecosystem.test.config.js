// PM2 配置：测试环境 API 进程（与生产共用同一台服务器，但完全隔离）
// 端口 3001 + 独立测试库 apps/server/data/test.db，仅由 deploy/deploy-test.mjs 部署。
// 敏感值通过环境变量注入（deploy-test.mjs 会自动生成并 export）：
//   TEST_JWT_SECRET / TEST_ADMIN_PASSWORD / TEST_ADMIN_USERNAME（可选，默认 admin）
module.exports = {
  apps: [
    {
      name: 'qujt-api-test',
      cwd: '/opt/qujt-blog/apps/server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: '3001',
        DATABASE_PATH: 'data/test.db',
        COOKIE_PATH: '/test',
        JWT_SECRET: process.env.TEST_JWT_SECRET || 'test-jwt-secret-change-me',
        ADMIN_USERNAME: process.env.TEST_ADMIN_USERNAME || 'admin',
        ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD || 'test-admin-password',
      },
      out_file: '/var/log/qujt-api-test.out.log',
      error_file: '/var/log/qujt-api-test.err.log',
      merge_logs: true,
    },
  ],
};
