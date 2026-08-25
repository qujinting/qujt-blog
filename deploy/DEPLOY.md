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
