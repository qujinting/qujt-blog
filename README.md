# qujt-blog

前后端分离的个人博客系统。设计文档见 [docs/DESIGN.md](docs/DESIGN.md)。

## 技术栈

- 前台/后台：Vue 3 + TypeScript + Naive UI（P2/P3 阶段）
- 服务端：Node.js + Fastify 5 + better-sqlite3（WAL + FTS5）
- 对象存储：阿里云 OSS（STS 直传，图片不经过服务器）

## 目录结构

```
apps/
  server/    # Fastify API（当前阶段）
  web/       # 前台 SPA（规划）
  admin/     # 后台 SPA（规划）
packages/
  shared/    # 共享类型/枚举/DTO
deploy/      # 部署脚本与配置（规划）
docs/        # 设计文档
```

## 快速开始（服务端）

```bash
pnpm install
pnpm dev:server
```

环境变量（可复制 `apps/server/.env.example` 为 `apps/server/.env`）：

| 变量 | 说明 |
|---|---|
| `PORT` | 监听端口，默认 3000 |
| `DATABASE_PATH` | SQLite 文件路径，默认 `data/qujt.db` |
| `JWT_SECRET` | 生产必填，≥16 字符 |
| `JWT_EXPIRES_IN` | access token 有效期，默认 2h |
| `REFRESH_EXPIRES_DAYS` | refresh token 有效期（天），默认 30 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL` | 首次启动自动创建管理员 |

注册模式默认 `invite`（邀请制）：`POST /api/admin/invite-codes` 生成邀请码（需管理员登录）。
通过 `settings.registration_mode`（closed/invite/open）切换注册开关。

## 测试

```bash
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
```

## 构建与运行

```bash
pnpm build:server          # tsup → apps/server/dist
cd apps/server && node dist/index.js
```
## 开发环境注意事项（Windows）

`better-sqlite3` 依赖预编译二进制。若 `pnpm install` 时 prebuild-install 从 GitHub 下载超时且本机无可用 Python 工具链，可手动放置预编译产物：

```bash
# 从 GitHub Releases 下载对应 node 版本（node -p process.versions.modules 获取 ABI，如 137）的
# better-sqlite3-v<version>-node-v<abi>-win32-x64.tar.gz，解压到：
# node_modules/.pnpm/better-sqlite3@<version>/node_modules/better-sqlite3/build/Release/
# 使 better_sqlite3.node 就位即可。
```

Linux 服务器部署时预编译下载正常，无需此步骤。
