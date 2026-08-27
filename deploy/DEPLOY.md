# 生产部署

当前生产采用：GitHub Actions 构建与测试、SSH 上传不可变产物、ECS 版本目录原子切换、PM2 运行 API、Nginx 托管前端。

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

## GitHub Actions 自动发布

推送到 `main` 后，`.github/workflows/deploy-production.yml` 会依次执行：

1. `pnpm install --frozen-lockfile`
2. 服务端测试和整个 workspace 类型检查
3. 构建 server、web、admin
4. 生成带 Git SHA 和构建时间的 `release.tar.gz`
5. SCP 上传到 ECS
6. 在 GitHub Ubuntu Runner 中按锁文件生成并打包 Linux 生产依赖（ECS 发布时不联网安装）
7. 原子切换 `current`，重启 PM2 并 reload Nginx
8. 验证 `/api/health`、`/`、`/admin/`
9. 验证失败时自动切回上一个 release

在 GitHub 仓库的 `production` Environment 中配置以下 Secrets：

| Secret | 内容 |
|---|---|
| `DEPLOY_HOST` | ECS 公网 IP，例如 `115.29.149.137` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | `~/.ssh/qujt-deploy-key` 私钥全文 |

ECS 主机公钥固定在 `deploy/known_hosts`；服务器重装或 SSH host key 变化时，必须先人工核验新指纹再更新该文件。

建议给 `production` Environment 配置审批保护规则。工作流使用 concurrency，生产发布不会并发执行。

## 首次迁移现有服务器

首次只执行一次：

```bash
scp -i ~/.ssh/qujt-deploy-key deploy/*.sh deploy/*.js deploy/*.conf deploy/logrotate.qujt-blog root@115.29.149.137:/tmp/qujt-deploy/
ssh -i ~/.ssh/qujt-deploy-key root@115.29.149.137
bash /tmp/qujt-deploy/migrate-legacy.sh
```

迁移脚本会短暂停止生产和测试 API，复制现有 `.env`、SQLite 数据、备份到 `shared`，建立初始 legacy release，切换 Nginx/PM2 后执行健康检查。源目录暂时保留，确认稳定后再人工清理。

## 手动应急发布

正常发布应通过 GitHub Actions。需要从 Linux 本机或 WSL 应急发布时（Windows 原生环境不能生成兼容 ECS 的原生依赖，请使用 GitHub Actions）：

```bash
node deploy/deploy.mjs 115.29.149.137
```

手动入口执行与 CI 相同的测试、类型检查、构建、打包和原子激活流程。默认拒绝脏工作区，避免发布无法追溯的代码。只有明确的紧急情况才能使用 `ALLOW_DIRTY_DEPLOY=1`。

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
