# 部署指南（P5）

目标：Ubuntu 24.04 / 2C2G 服务器，HTTP(80) + PM2 + Nginx，公网 IP 直连（域名备案后可按注释切换）。

## 首次部署

1. **SSH 密钥**：本机已生成 `~/.ssh/qujt-deploy-key`（私钥勿外传），公钥已加入服务器 `~/.ssh/authorized_keys`。
2. **服务器安全组**：阿里云控制台放行 **80** 端口（22 已放行）。
3. 执行一键部署（会先构建三端产物）：

   ```bash
   # 在项目根目录（本地）
   ADMIN_PASSWORD=你的初始管理员密码 node deploy/deploy.mjs 115.29.149.137
   ```

   脚本自动：构建 → 打包 → 上传 `/opt/qujt-blog` → `pnpm install --prod` → 生成 `.env`（JWT_SECRET 随机）→ PM2 启动/重启 → Nginx reload。

4. **服务器首次环境初始化**（deploy.mjs 不包含，仅首次手动执行一次）：

   ```bash
   ssh -i ~/.ssh/qujt-deploy-key root@115.29.149.137
   bash /opt/qujt-blog/deploy/remote-setup.sh   # Node22/pnpm/pm2/nginx/swap/ufw(80,22)
   ```

5. **PM2 开机自启**（remote-setup 后执行一次）：

   ```bash
   pm2 startup systemd -u root --hp /root
   pm2 save
   ```

6. **每日备份 cron**（remote-setup 后执行一次）：

   ```bash
   (crontab -l 2>/dev/null; echo '0 3 * * * /usr/local/bin/node /opt/qujt-blog/apps/server/backup.mjs >> /var/log/qujt-backup.log 2>&1') | crontab -
   ```

## 日常更新（重新部署）

```bash
node deploy/deploy.mjs            # 或 ADMIN_PASSWORD=xxx node deploy/deploy.mjs
```
（不会覆盖服务器 `apps/server/.env` 与数据库）

## 常用运维

| 操作 | 命令 |
|---|---|
| 查看日志 | `pm2 logs qujt-api` / `journalctl -u pm2-root` |
| 重启 API | `pm2 restart qujt-api` |
| 备份目录 | `/opt/qujt-blog/backups/`（保留 14 天） |
| 数据库 | `/opt/qujt-blog/apps/server/data/qujt.db` |
| Nginx | `/etc/nginx/sites-available/qujt-blog`（配置源在仓库 `deploy/nginx.conf`） |

## 备案完成后切换域名（可选）

1. DNS 解析 A 记录到 `115.29.149.137`
2. `deploy/nginx.conf`：`server_name` 改为域名；OSS 防盗链 Referer 白名单加域名
3. （可选）申请证书后改为 HTTPS：加 443 server 块 + certbot；代码无需改动

## 注意

- 2C2G 服务器**不执行构建**，产物一律本地构建后上传。
- `.env` 只在首次生成；若需修改（如换 OSS Key），直接编辑服务器 `/opt/qujt-blog/apps/server/.env` 后 `pm2 restart qujt-api`。

---

# 测试环境（P1，与生产共用同一台服务器）

测试环境与生产**共用同一台服务器**，但业务上完全隔离：

- 独立 API 进程 `qujt-api-test`（端口 3001）+ 独立测试库 `apps/server/data/test.db`
- 前台 `http://IP/test/`、后台 `http://IP/test/admin/`（写入 `apps/test-web`、`apps/test-admin`，不覆盖生产前端）
- 测试前端通过 `/test/api/*` 反代到本机 3001；会话 Cookie 限定在 `/test` 路径，与生产会话互不干扰

> 注意：测试环境复用生产服务器上的 OSS 配置（媒体会上传到同一 OSS Bucket）。如需隔离媒体，请在 `deploy/ecosystem.test.config.js` 的测试进程里单独配置 `OSS_*`（`OSS_BUCKET` 等）。

## 部署测试环境

项目根目录（本地）执行：

```bash
node deploy/deploy-test.mjs            # 或 node deploy/deploy-test.mjs 115.29.149.137
```

脚本自动：构建 server + 测试前台(base=`/test/`) + 测试后台(base=`/test/admin/`) → 上传到服务器 → 启动/重启 `qujt-api-test` → 写入 Nginx 的 `/test` 路由并 reload。

## 首次访问

- 前台：`http://115.29.149.137/test`
- 后台：`http://115.29.149.137/test/admin`
- 测试管理员：默认 `admin`，初始密码在部署完成时打印（下次部署可用 `TEST_ADMIN_PASSWORD=xxx node deploy/deploy-test.mjs` 覆盖）

## 重新部署 / 更新

```bash
node deploy/deploy-test.mjs            # 幂等：会自动 restart qujt-api-test 并同步 Nginx
```

## 常用运维

| 操作 | 命令 |
|---|---|
| 查看测试 API 日志 | `pm2 logs qujt-api-test` |
| 重启测试 API | `pm2 restart qujt-api-test` |
| 测试库 | `/opt/qujt-blog/apps/server/data/test.db` |

## 移除测试环境

```bash
ssh -i ~/.ssh/qujt-deploy-key root@115.29.149.137
pm2 delete qujt-api-test && pm2 save
# 删除 Nginx 配置中的 /test 相关 location 后 reload nginx
```

> 生产环境不受影响：`deploy.mjs` 只管理 `qujt-api`，`deploy-test.mjs` 只管理 `qujt-api-test` 与 `/test` 路由；测试前端写入 `apps/test-web`、`apps/test-admin`，不会覆盖生产 `apps/web/dist`、`apps/admin/dist`。

---

## 本地开发：切换后端 / 数据库

前端 `web` / `admin` 的 dev 代理和 API 基址按 **Vite mode** 切换（`vite.config.ts`）：

| 命令 | 说明 | `/api` 流向 |
|---|---|---|
| `pnpm dev` | 本地沙箱（默认） | 本地后台 `127.0.0.1:3000`（本地 SQLite） |
| `pnpm dev:test` | 本地前端连线上测试 API | `/test/api` → `http://115.29.149.137`（测试库 `data/test.db`） |

> `dev:test` 时前端走 `/test/api`（不是 `/api`），因为测试 API 的登录 Cookie 限定在 `/test` 路径（`COOKIE_PATH=/test`），路径必须匹配才能带上会话；代理目标可通过 `VITE_TEST_HOST` 覆盖（默认 `115.29.149.137`）。

### 本地沙箱用真实测试数据（可选）

从测试服拉取一份一致性快照到本地沙箱库（旧库自动备份为 `.bak`）：

```bash
node deploy/fetch-test-db.mjs
```

会覆盖本地 `.env` 中 `DATABASE_PATH` 指向的库（默认 `apps/server/data/qujt.db`）；拉取前请先停止本地后台，拉完后 `pnpm dev` 重启即可用测试数据调试。

> 说明：项目后台是内嵌 SQLite（`better-sqlite3`），无法跨机器直接连远程库，所以“本地后台 + 线上测试库同步实时”不可行——`fetch-test-db.mjs` 是**一次性快照**，本地写入不会回传测试服；想要实时共享数据请直接用 `/test`、`/test/admin`。
