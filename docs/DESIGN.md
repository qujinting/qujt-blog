# qujt-blog 博客系统项目设计

> 本文档为项目设计与实施依据。后续编码按第 12 节路线图分阶段实施。

## 1. 目标与成功标准

一个部署在 **2核2G / 带宽 200M（后期降至 3M）** 云服务器上的个人博客，前后端分离，**全站 HTTP（无证书）**：

- 前端：Vue3 + TS + Naive UI，分**前台（访客）**与**后台管理**两个 SPA
- 后端：Node.js（Fastify + TypeScript）+ SQLite
- 文章：在线 MD 编辑（图片自动上传阿里云 OSS）、上传 .md/.zip 导入；发布时编译为 HTML 入库，访客看到的是编译后的 HTML
- 权限：公开 / 仅登录 / 密码访问 / 私密四级
- 登录 + 评论（嵌套回复、后台审核）
- 注册采用**邀请码机制**（当前邀请制、不完全对外开放，可追踪用户邀请来源；后台可一键切换为完全关闭/完全开放注册）
- 服务器稳态按 **3M 带宽** 设计：图片全部走 OSS 直链，服务器只出 HTML/JS/API

**验收标准（后文第 11 节展开）**：发布链路端到端可用；权限矩阵 12 种组合全部服务端强制、无正文泄漏；图片上传自动压缩→OSS→MD 引用 URL 回填；导入 MD 时相对图片 URL 自动重写；全新 2C2G 机器按部署文档可复现；内存峰值 < 1.2GB。

## 2. 总体架构

```
                         浏览器
        ┌───────────────┼───────────────────┐
   前台 SPA /app      后台 SPA /admin     图片直传 OSS（STS 临时凭证）
        │                  │                    │
        ▼                  ▼                    ▼
  ┌─────────────────────────────┐        ┌──────────────┐
  │  Nginx（HTTP:80/gzip/静态托管）│        │ 阿里云 OSS   │
  │  /            → web dist    │        │ 公共读+防盗链 │
  │  /admin       → admin dist  │        │ +图片处理参数 │
  │  /api 反代    → 127.0.0.1:3000      └──────────────┘
  └──────────────┬──────────────┘
                 ▼
  ┌──────────────────────────────┐
  │ PM2 单实例：Fastify API      │
  │ 认证(JWT) · 权限 · MD编译管线 │
  │ better-sqlite3(WAL) · 定时发布│
  └──────────────┬───────────────┘
                 ▼
        SQLite 单文件（每日备份 + 可选同步 OSS）
```

关键决策：

- **同域部署**（Nginx 反代 /api），无 CORS 烦恼，cookie 认证可用 SameSite=Strict
- **图片浏览器直传 OSS**（服务端签发 STS 临时凭证），图片字节流完全不经过服务器——3M 带宽下这是必要条件；服务端仅记录媒体表
- **PM2 单实例 fork 模式**（不 cluster），保证定时任务（定时发布、孤儿文件清理）不重复执行
- **全站 HTTP**：Nginx 仅监听 80；OSS 图片用 https URL 嵌在 http 页面中不存在混合内容问题

## 3. 技术选型

| 层 | 选型 | 说明 |
|---|---|---|
| 包管理/工程 | pnpm 10 monorepo（workspaces） | |
| 前台/后台 | Vue 3.5 + TS 5 + Vite + vue-router + Pinia + Naive UI 2.4x | 路由懒加载；后台编辑器独立 chunk |
| MD 编辑器 | **md-editor-v3**（Vue3 原生） | `onUploadImg` 钩子接 OSS 直传；粘贴/拖拽图片自动触发 |
| MD 编译 | markdown-it 14 + anchor/toc/emoji/task-lists/footnote/texmath(KaTeX) + highlight.js（服务端编译时高亮） | 编译产物入库，访客零渲染开销 |
| HTML 消毒 | isomorphic-dompurify（服务端） | 编译时消毒，前台 v-html 安全 |
| 后端 | Fastify 5 + @fastify/jwt、cookie、rate-limit、multipart | 低内存、TS 优先、JSON Schema 校验 |
| 校验 | Zod（DTO/设置/导入文件） | |
| 数据库 | better-sqlite3（同步、WAL、预编译语句）+ FTS5 **trigram** 分词（支持中文子串搜索） | 单文件、零常驻进程 |
| 密码 | argon2id（argon2 包） | |
| OSS | ali-oss SDK（浏览器端 + Node 端） | STS 直传 + 服务端管理操作 |
| 运行时 | Node 22 LTS | 与服务器保持一致 |

## 4. Monorepo 目录结构

```
qujt-blog/
├─ apps/
│  ├─ web/          # 前台 SPA：首页/文章/搜索/分类标签/登录注册/个人中心
│  ├─ admin/        # 后台 SPA：仪表盘/文章/媒体库/分类标签/评论/用户/邀请码/设置
│  └─ server/       # Fastify API（tsup 构建）
├─ packages/shared/ # 共享类型：DTO、权限/角色枚举、设置键名、API 路径常量
├─ deploy/          # nginx.conf、ecosystem.config.js、backup.sh、deploy.mjs、GitHub Actions yml
├─ docs/DESIGN.md   # 本设计文档
└─ pnpm-workspace.yaml
```

## 5. 数据模型（SQLite）

```sql
users(id, username UNIQUE, email UNIQUE, password_hash, nickname, avatar,
      role TEXT /* admin|author|user */, status /* active|disabled */,
      invited_by FK users NULL, invite_code_id FK invite_codes NULL,  -- 邀请来源追踪
      created_at, updated_at)

invite_codes(id, code UNIQUE, created_by FK users, note, max_uses /* 0=不限 */,
             used_count, expires_at NULL, status /* active|disabled */,
             created_at)  -- 10 位大写字母数字（去 0/O/1/I 易混淆字符）；
                          -- used_count 与注册同事务原子递增，防并发超卖

posts(id, slug UNIQUE, title, summary, content_md, content_html, toc JSON, cover_image,
      category_id FK, author_id FK,
      visibility /* public|login|password|private */, password_hash NULL,
      status /* draft|published|scheduled */, publish_at, word_count,
      view_count, comment_count, created_at, updated_at)

categories(id, name, slug UNIQUE, description, sort)
tags(id, name, slug UNIQUE)
post_tags(post_id, tag_id, UNIQUE(post_id, tag_id))

comments(id, post_id, user_id, parent_id, root_id, reply_to_uid,
         content TEXT, status /* pending|approved|spam|deleted */,
         ip, ua, created_at)
-- 树结构：parent_id/root_id 扁平存储，前台组装；显示深度限 2 层，更深的回复平铺

media(id, uploader_id, oss_key, file_name, size, mime, width, height,
      content_hash UNIQUE, created_at)   -- 去重：同图重传不产生新对象

refresh_tokens(id, user_id, token_hash, expires_at, revoked_at, created_at)

settings(key PRIMARY KEY, value JSON)   -- 站点信息/ICP备案/registration_mode(closed|invite|open)/评论审核开关等

post_views(post_id, date, ip, PRIMARY KEY(post_id,date,ip))  -- 当日去重计数
posts_fts(FTS5, content='posts', tokenize='trigram')          -- 触发器同步 title+正文纯文本
```

要点：`content_html` 即编译产物（访客所见）；FTS5 触发器在 posts 更新后自动同步；敏感配置（JWT_SECRET、OSS AccessKey）只进服务器 `.env`，不进 settings 表。

## 6. API 设计（REST，前缀 /api）

**认证**：`POST /auth/register {username,email,password,invite_code}`（按 registration_mode 控制：closed 拒绝注册 / invite 校验邀请码 / open 免码；可选邮箱验证）、`/auth/login`、`/auth/logout`、`GET /auth/me`、`PUT /auth/me`、`POST /auth/password/reset`（可选 SMTP）。登录返回 **JWT 放 httpOnly Cookie（SameSite=Strict，不加 Secure——HTTP 环境）** + 服务端 refresh_token（滑动续期 30 天）；管理端接口额外校验自定义头 `X-Requested-With`（防 CSRF）。

**前台公开**：

- `GET /site` 站点信息+分类导航+registration_mode（前台据此决定是否显示注册入口与邀请码输入框）；`GET /posts?page&category&tag&q` 列表（任何情况下只返回摘要，**正文绝不进列表接口**）
- `GET /posts/:slug` 返回元数据；正文按权限矩阵返回：public→全文；login→登录后全文；password→返回锁定态，`POST /posts/:slug/unlock {password}` 通过后种下该文章的短期解锁 cookie（JWT 按 post 签发，7 天）；private→仅后台可读
- `GET /posts/:slug/comments`（仅 approved）；`POST /posts/:slug/comments`（须登录，限流 10 条/时/用户）；`DELETE /comments/:id`（作者本人）
- `GET /categories`、`/tags`、`/feed.xml`（RSS，可选）、`/health`

**后台**（角色 ≥ author；用户管理/设置类仅 admin）：

- 文章：`GET/POST/PUT/DELETE /admin/posts`、`POST /admin/posts/:id/publish|unpublish`、`POST /admin/posts/import`（multipart：.md/.zip）
- 媒体：`POST /admin/media/sts`（签发 STS）→ 浏览器直传 OSS → `POST /admin/media` 确认登记；`GET/DELETE /admin/media`
- 分类/标签 CRUD；评论：`GET /admin/comments?status`、`POST /admin/comments/:id/approve|spam|delete`
- `GET/PUT /admin/settings`；`GET /admin/users`（含邀请来源过滤/展示）、`PUT /admin/users/:id`；`GET /admin/stats`（仪表盘）
- 邀请码：`GET /admin/invite-codes`（列表+用量）、`POST /admin/invite-codes`（批量生成 {count,prefix,max_uses,expires_at,note}，明文一次性返回）、`PUT /admin/invite-codes/:id`（停用/启用/改限额）、`GET /admin/invite-codes/:id/users`（该码注册的用户清单，即邀请来源明细）

## 7. 核心流程设计

### 7.1 MD 编译管线（保存/发布时服务端执行）

markdown-it 解析 → 代码高亮(hljs，常见语言子集) → KaTeX 数学公式 → 生成标题锚点与 TOC → **DOMPurify 消毒**（白名单标签/属性，外链加 `rel="noopener nofollow" target="_blank"`）→ 图片标签注入 `loading="lazy"` 与宽高 → 输出 `content_html`；同时提取：TOC JSON、正文字数、摘要（为空时取正文前 200 字）、首图作封面（未设封面时）。草稿保存即编译，保证预览所见即所得；发布只是改状态（content_html 不变）。

### 7.2 图片上传（编辑器内粘贴/拖拽/选择）

浏览器端 canvas 压缩（>1920px 缩到 1920，WebP q=0.85，目标 ≤1.5MB）→ `GET /admin/media/sts` 取临时凭证 → ali-oss 浏览器 SDK 直传 → 编辑器 `onUploadImg` 回调把返回 URL 插成 `![](...)` → `POST /admin/media` 登记（按 content_hash 去重）。封面图走同一通道。OSS 桶配置：**公共读 + Referer 防盗链白名单（含本站域名与空 Referer）**；列表/缩略图 URL 附加 `x-oss-process=image/resize` 参数，正文大图原样。备选路径：STS 异常时回退服务端代理上传（`POST /admin/media` 直传 multipart），代码里保留。

### 7.3 上传 MD / zip 导入

- `.md`：解析 front matter（标题/分类/标签/权限），正文导入编辑器继续编辑；检测相对路径图片引用 → 列出"未解析图片清单"，弹窗支持拖拽/批量选择同名图片 → 逐张走 7.2 通道上传并重写 URL（图名匹配则自动对齐，不匹配手工指定）
- `.zip`：解压后取第一个 .md + 包内图片按相对路径自动上传重写（适合 Typora 等带图导出场景）
- 限制：md ≤5MB、zip ≤50MB；重复 slug 自动加序号；导入结果为**草稿**，不直接发布

### 7.4 阅读权限校验（全部服务端强制）

```
GET /posts/:slug ── 元数据始终返回
  ├─ public        → 返回 content_html
  ├─ login         → 校验登录 JWT，通过返回正文，否则 401+前端引导登录
  ├─ password      → 未解锁返回 locked 态；unlock 校验 argon2，签发按 post 的短期 JWT cookie
  └─ private       → 前台一律 404 语义（不暴露存在性）；后台接口方可读
列表/搜索/feed/RSS 同步按同一矩阵过滤：未授权文章连摘要也不出现
```

### 7.5 注册（邀请码）与会话

**注册模式**（settings.registration_mode，后台可随时切换）：`closed` 完全关闭注册（仅管理员后台建号）→ `invite` 必须持有效邀请码（**当前默认**，不完全开放）→ `open` 完全开放注册（未来可能，免码）。

**邀请码校验（invite 模式）**：注册时校验 code 存在、active、未过期、`used_count < max_uses`（max_uses=0 不限）；通过与用户创建**同一事务**原子递增 used_count（并发防超卖：`UPDATE invite_codes SET used_count=used_count+1 WHERE ... AND used_count < max_uses` 断言影响行数=1），失败即回滚。用户落库同时写入 `invite_code_id` 与 `invited_by`（邀请码创建者），形成可查询的邀请来源链；后台可查看每个码注册了哪些用户。邀请码仅后台生成（批量），明文一次性展示，停用/改限额即时生效。

**会话**：注册/登录 → argon2id 入库/校验 → 发放 access JWT（2h，httpOnly + SameSite=Strict）+ refresh（30 天，哈希入库可吊销）。后台角色门：路由守卫 + 每个接口服务端复验。统一登录失败文案防用户名枚举；登录接口限流 5 次/分/IP，注册限流 3 次/h/IP（高熵邀请码配合限流，爆破不可行）。**HTTP 明文环境说明**：凭证经网络明文传输，属用户接受的取舍；后续若配置证书，只需在 Nginx 加 443 段、cookie 补 Secure 标记，代码无需改动。

### 7.6 评论

必须登录（与权限体系一致，匿名评论列为后续扩展）；纯文本（不做 MD 渲染，XSS 全转义），限长 1000 字；提交后按设置进入 pending 或直接 approved；后台审核（通过/垃圾/删除）；垃圾启发式（链接数/关键词）打标；树状显示 2 层，深层平铺；`comment_count` 只计 approved。

### 7.7 定时任务（PM2 单实例内 node-cron）

- 每分钟：`scheduled` 且 `publish_at ≤ now` 的文章 → published
- 每月：孤儿媒体扫描（OSS key 与 media 表、content_md 引用比对）→ 报告/清理

## 8. 安全设计

- 传输：全站 HTTP（用户指定）；Nginx 只监听 80，不启用 HSTS；基础安全头（X-Content-Type-Options、X-Frame-Options、Referrer-Policy）照常配置
- 认证：argon2id（memory 64MB 档，2G 内存可控）、httpOnly+SameSite=Strict Cookie（HTTP 下不加 Secure）、refresh 可吊销、管理接口 CSRF 头校验
- XSS：编译时 DOMPurify 白名单消毒（服务端权威）；评论纯文本转义；前端 v-html 仅渲染已消毒正文
- 越权：所有后台接口按角色+资源属主校验；权限矩阵服务端强制，前端只是展示层
- 限流：登录 5/min/IP、注册 3/h/IP、评论 10/h/用户、解锁 10/min/IP、全局 API 兜底限流；邀请码为高熵随机（10 位、去 0/O/1/I 易混淆字符），配合注册限流防爆破
- OSS：桶公共读+防盗链 Referer 白名单（http 页面加载图片时浏览器默认仍发送 origin Referer，可正常防盗链；同时放行空 Referer 兜底）；STS 仅授 `uploads/` 目录写权限、15 分钟有效期；AccessKey 只存服务器 .env
- 其他：登录失败统一文案、slug 全局唯一防碰撞、导入文件大小/类型白名单校验

## 9. 性能与 2C2G/3M 适配（稳态按 3M 设计）

- **带宽**：图片/封面全部 OSS 直链（服务器带宽只承担 HTML/JS/API）→ 3M（≈375KB/s）下文章页仍可 <2s；Nginx gzip(+brotli) 压缩静态资源，哈希资源 `Cache-Control: immutable`；API 响应 gzip
- **前端体积**：路由/编辑器懒加载，前台首屏 gzip 后 <200KB；highlight.js 只打包常用语言子集（仅后台需要，前台正文高亮已在服务端完成）
- **内存预算**：系统 ~250MB + Nginx ~15MB + Node(Fastify+SQLite) ~150-250MB ≈ **峰值 <600MB**，余量充足；建议配置 2GB swap
- **数据库**：WAL 模式、预编译语句、常用查询索引（slug/category/publish_at）；浏览量按日去重表 + 内存缓冲批量落库，避免每次阅读写库
- **构建**：Vite 构建峰值内存约 1.2GB，**不在 2C2G 上构建**——本地构建或 CI 构建后 rsync 产物上服务器（部署脚本与 Actions yml 均提供）

## 10. 部署设计（裸机，HTTP）

1. 服务器准备：Node 22、pnpm、PM2、Nginx；2GB swap；安全组放行 **80**（无需 443）
2. Nginx：`deploy/nginx.conf`——仅 `listen 80`，`/` 前台 dist、`/admin` 后台 dist（SPA fallback）、`/api` 反代 127.0.0.1:3000、gzip/brotli、安全头；不配置证书与跳转
3. API：`pm2 start ecosystem.config.js`（fork 单实例）→ `pm2 startup + save` 开机自启；`.env` 放 JWT_SECRET/OSS 密钥/DB 路径；首次启动按环境变量引导创建 admin 账号（随后在后台生成首批邀请码）
4. 发布：本地 `pnpm deploy`（构建→rsync 排除 node_modules/db/.env→服务器 `pnpm i --prod` + pm2 reload）或 GitHub Actions 同流程
5. 备份：每日 cron `sqlite .backup` → 本地保留 7 份 + 可选 ossutil 同步 OSS；pm2 日志 logrotate
6. 健康检查：`/api/health`（DB 连通性），接入 PM2 自动重启
7. 备案提示：若服务器在大陆，域名指向该服务器前需完成 ICP 备案（仅开 80 端口同样需要）；境外/香港服务器则无需

## 11. 测试与验收标准

**后端（vitest + Fastify inject + 临时 SQLite）**

- 权限矩阵参数化测试：4 可见性 × 访客/登录用户/作者/admin × 列表/详情/搜索/feed 全接口无正文泄漏
- 编译管线 fixtures：标题锚点/TOC、代码块、表格、数学公式、XSS payload 消毒断言、外链属性
- 导入：md 相对图片重写、zip 解包、大小超限拒绝；认证：登录/续期/吊销/限流；解锁 cookie 过期与按 post 隔离
- 邀请码：closed/invite/open 三模式行为矩阵；码过期/停用/超限/不存在均拒绝注册；并发注册同码不超卖（max_uses 断言）；用户 invited_by/invite_code_id 来源链正确记录

**前端（vitest）**：权限门组件渲染分支、API 封装；人工 E2E 清单覆盖发布/评论/解锁全链路

**验收清单**

1. 新建→粘贴图片（自动压缩上传 OSS，URL 回填）→草稿→发布→前台立即可见，HTML 与编辑器预览一致
2. 权限矩阵 12 组合全通过，未授权访问任何接口都拿不到正文
3. .md/.zip 导入成功且图片 URL 重写；同图重传命中去重
4. 登录→评论→（审核模式）后台通过→前台树状展示；未登录评论被拒
5. 前台首屏 gzip <200KB；服务器内存峰值 <1.2GB；3M 带宽下文章页 <2s
6. 部署文档在全新 2C2G 机器按步骤复现成功；每日备份脚本产出可恢复备份；全站 HTTP 访问正常（无证书报错、无自动跳转 https）
7. 邀请制下：无码/错码注册被拒；有效码注册成功且后台可见来源明细；切换 open 模式免码注册成功；切回 closed 注册关闭

## 12. 实施路线图（编码阶段，按此顺序）

| 阶段 | 内容 | 产出 |
|---|---|---|
| P0 基础设施 | monorepo 骨架、server 启动、SQLite 迁移、认证+邀请码注册 | 可登录的 API |
| P1 文章内核 | 编译管线、文章 CRUD、权限矩阵、导入、定时发布 | 后台可发文章 |
| P2 管理后台 | 布局/路由守卫、编辑器+OSS 直传、文章/媒体/分类标签/邀请码/设置页 | 后台可用 |
| P3 前台 | 首页/详情/权限门（登录/密码弹窗）/搜索/分类标签 | 访客可读 |
| P4 评论+用户 | 评论树、审核、注册登录、个人中心、用户列表含邀请来源 | 互动闭环 |
| P5 部署 | nginx(80)/pm2/备份/deploy 脚本/文档/性能收尾 | 上线 |

## 13. 假设与后续扩展

**假设**：已有阿里云账号与 OSS 资源；域名已备案（大陆服务器）或使用境外服务器；访客量级为个人博客（日 UV 千级内）；本期单管理员+可选作者，不做多租户；**注册当前为邀请制（registration_mode=invite），保留随时切换开放/关闭的能力**；**用户接受 HTTP 明文传输的凭证风险**。

**本期不含（数据模型已预留）**：VIP/付费阅读（users.role、settings 已可扩展）、文章版本历史、第三方登录、通知邮件（除找回密码）、匿名评论、HTTPS/CDN（后续可直接给 OSS 挂 CDN、Nginx 加证书段，架构不变）、**用户自助生成邀请码（老带新）——当前仅管理员后台生成，invite_codes.created_by 支持任意用户，届时 invited_by 即真实邀请人**。

**风险与对策**：trigram 中文搜索质量一般 → 关键词回退 LIKE 双通道；better-sqlite3 为原生模块 → 优先用官方 linux-x64 预编译包，失败才在服务器装编译工具链；STS 直传配置出错 → 保留服务端代理上传回退路径；HTTP 下凭证可被网络嗅探 → 属既定取舍，文档中明确提示，必要时可随时升级 HTTPS。

## 14. 实施说明

本文档批准后已写入 `docs/DESIGN.md`。P0 编码（monorepo 骨架 + server + 认证）在用户另行确认后开始。
