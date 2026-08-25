// PM2 配置（服务器 /opt/qujt-blog/deploy/ecosystem.config.js）
module.exports = {
  apps: [
    {
      name: 'qujt-api',
      cwd: '/opt/qujt-blog/apps/server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production' },
      out_file: '/var/log/qujt-api.out.log',
      error_file: '/var/log/qujt-api.err.log',
      merge_logs: true,
    },
  ],
};
