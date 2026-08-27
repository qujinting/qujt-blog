# 生产部署

当前生产采用：GitHub Actions 持续集成验证、本机构建与 SSH 上传不可变产物、ECS 版本目录原子切换、PM2 运行 API、Nginx 托管前端。

## 目录结构

```text
/opt/qujt-blog/
  current -> releases/<git-sha>
  releases/                 # 最多保留最近 5 个版本
  shared/
    server.env              # 生产环境变量，权限 600
    data/                   # SQLite 生产/测试数据库
    backups/                # SQLite 备份，保留 14 天
  DEPLOYED_RELEASE
```

每个 release 都包含构建产物、锁文件、生产依赖和部署脚本。发布不会覆盖 `shared` 中的环境变量、数据库和备份。

## GitHub Actions 持续集成

推送到 `main` 或创建 PR 后，`.github/workflows/deploy-production.yml` 会在 GitHub Hosted Runner 执行：

1. `pnpm install --frozen-lockfile`
2. 服务端测试和整个 workspace 类型检查
3. 构建 server、web、admin

CI 不保存服务器凭据、不上传制品、不触发生产切换。这样避免 GitHub Runner 到国内 ECS 的跨境上传瓶颈。

## 首次迁移现有服务器

首次只执行一次：

```bash
scp -i ~/.ssh/qujt-deploy-key deploy/*.sh deploy/*.js deploy/*.conf deploy/logrotate.qujt-blog root@115.29.149.137:/tmp/qujt-deploy/
ssh -i ~/.ssh/qujt-deploy-key root@115.29.149.137
bash /tmp/qujt-deploy/migrate-legacy.sh
```

迁移脚本会短暂停止生产和测试 API，复制现有 `.env`、SQLite 数据、备份到 `shared`，建立初始 legacy release，切换 Nginx/PM2 后执行健康检查。源目录暂时保留，确认稳定后再人工清理。

## 本机手动发布

CI 通过后，在本机 Windows 或 WSL 执行：

```bash
node deploy/deploy.mjs 115.29.149.137
```

本机入口执行类型检查、三端构建、打包、SCP 上传和原子激活；Linux/WSL 还会运行完整服务端测试。Windows 上服务端测试由 GitHub Actions 的 Linux CI 负责，避免本地 `better-sqlite3` 原生模块状态阻碍部署。入口默认拒绝脏工作区，避免发布无法追溯的代码。只有明确的紧急情况才能使用 `ALLOW_DIRTY_DEPLOY=1`。

Windows 不能构建 Linux 原生模块，因此服务器保存一份已验证的共享 Linux runtime。日常前端、业务代码和未改变依赖锁文件的发布可直接从 Windows 执行；当 `pnpm-lock.yaml` 变化时，激活会拒绝继续，必须在 WSL/Linux 刷新共享 runtime，不能冒险上传 Windows 原生模块。

## 手动回滚

回滚到最近一个非当前版本：

```bash
ssh -i ~/.ssh/qujt-deploy-key root@115.29.149.137 \
  'bash /opt/qujt-blog/current/deploy/rollback-release.sh'
```

指定版本：

```bash
bash /opt/qujt-blog/current/deploy/rollback-release.sh <release-id>
```

数据库不随代码回滚。涉及数据库结构变更时，迁移必须保持向后兼容，否则代码回滚不能自动恢复旧 schema。

## 测试环境

测试环境仍与生产共用 ECS，但使用 `qujt-api-test`、端口 3001 和 `shared/data/test.db`。测试前端位于旧的隔离目录，不覆盖生产 `current`：

```bash
node deploy/deploy-test.mjs
```

- 前台：`http://115.29.149.137/test/`
- 后台：`http://115.29.149.137/test/admin/`
- API：`http://115.29.149.137/test/api/health`

## 数据和日志

- 生产数据库：`/opt/qujt-blog/shared/data/qujt.db`
- 测试数据库：`/opt/qujt-blog/shared/data/test.db`
- 备份：`/opt/qujt-blog/shared/backups/`，保留 14 天
- 应用日志：`/var/log/qujt-api*.log` 和 `/var/log/qujt-backup.log`
- 日志每日轮转，单文件达到 20MB 提前轮转，压缩并保留 14 份
- systemd journal 上限 256MB，并至少保留 2GB 空闲磁盘

## 首次服务器初始化

全新 Ubuntu 24.04 服务器先上传 release，然后以 root 执行：

```bash
bash /opt/qujt-blog/current/deploy/remote-setup.sh
pm2 startup systemd -u root --hp /root
pm2 save
```

服务器只安装运行依赖，不执行 TypeScript 或 Vite 构建。Node 版本固定为 22.14.0，与 GitHub Actions 一致。
