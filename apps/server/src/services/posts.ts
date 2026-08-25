import argon2 from 'argon2';
import type Database from 'better-sqlite3';
import type { PostStatus, PostVisibility } from '@qujt/shared';
import type { AdminPostDTO, PostDetailDTO, PostSummaryDTO } from '@qujt/shared';
import { compileMarkdown, makeSummary } from '../lib/markdown.js';
import { ensureUniqueSlug, titleToSlug } from '../lib/slug.js';
import { err } from '../lib/errors.js';
import { findOrCreateTags, getCategory, getPostTags, syncPostTags } from './taxonomy.js';

export interface PostRow {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  content_md: string;
  content_html: string;
  content_text: string;
  toc: string;
  cover_image: string | null;
  category_id: number | null;
  author_id: number;
  visibility: PostVisibility;
  password_hash: string | null;
  status: PostStatus;
  publish_at: string | null;
  word_count: number;
  view_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface PostInput {
  title: string;
  contentMd: string;
  slug?: string;
  summary?: string | null;
  coverImage?: string | null;
  categoryId?: number | null;
  tagNames?: string[];
  visibility?: PostVisibility;
  password?: string | null;
  status?: PostStatus;
  publishAt?: string | null;
}

// 文章密码：argon2id 低配（解锁请求频繁，够用即可）
const POST_ARGON2 = { type: argon2.argon2id, memoryCost: 16384, timeCost: 2, parallelism: 2 };

export function hashPostPassword(pw: string): Promise<string> {
  return argon2.hash(pw, POST_ARGON2);
}

export function verifyPostPassword(hash: string, pw: string): Promise<boolean> {
  return argon2.verify(hash, pw);
}

export function getPostById(db: Database.Database, id: number): PostRow | undefined {
  return db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as PostRow | undefined;
}

export function getPostBySlug(db: Database.Database, slug: string): PostRow | undefined {
  return db.prepare('SELECT * FROM posts WHERE slug = ?').get(slug) as PostRow | undefined;
}

function resolvePublishAt(status: PostStatus, publishAt?: string | null): string | null {
  if (status === 'scheduled') {
    if (!publishAt) throw err(422, 'PUBLISH_AT_REQUIRED', '定时发布需提供 publishAt');
    return publishAt;
  }
  if (status === 'published') return publishAt ?? new Date().toISOString();
  return null;
}

export async function createPost(db: Database.Database, authorId: number, input: PostInput): Promise<PostRow> {
  const title = input.title.trim();
  if (!title) throw err(422, 'TITLE_REQUIRED', '标题不能为空');
  const compiled = compileMarkdown(input.contentMd);
  const slug = ensureUniqueSlug(db, input.slug?.trim() || titleToSlug(title));
  const visibility = input.visibility ?? 'public';
  const passwordHash = visibility === 'password' && input.password ? await hashPostPassword(input.password) : null;
  const status = input.status ?? 'draft';
  const publishAt = resolvePublishAt(status, input.publishAt);
  const summary = input.summary?.trim() || makeSummary(compiled.text);
  const cover = input.coverImage?.trim() || compiled.cover;
  const categoryId = input.categoryId ?? null;
  const tagIds = input.tagNames ? findOrCreateTags(db, input.tagNames) : [];

  const insert = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO posts
         (slug, title, summary, content_md, content_html, content_text, toc, cover_image,
          category_id, author_id, visibility, password_hash, status, publish_at, word_count)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        slug, title, summary, input.contentMd, compiled.html, compiled.text,
        JSON.stringify(compiled.toc), cover, categoryId, authorId, visibility,
        passwordHash, status, publishAt, compiled.wordCount,
      );
    const postId = Number(info.lastInsertRowid);
    syncPostTags(db, postId, tagIds);
    return postId;
  });
  const id = insert();
  const post = getPostById(db, id);
  if (!post) throw err(500, 'INTERNAL_ERROR', '创建文章失败');
  return post;
}

export async function updatePost(db: Database.Database, id: number, input: Partial<PostInput>): Promise<PostRow> {
  const existing = getPostById(db, id);
  if (!existing) throw err(404, 'POST_NOT_FOUND', '文章不存在');

  const title = input.title?.trim() || existing.title;
  const contentMd = input.contentMd ?? existing.content_md;
  const compiled = compileMarkdown(contentMd);
  const slug = input.slug?.trim() ? ensureUniqueSlug(db, input.slug.trim(), id) : existing.slug;
  const visibility = input.visibility ?? existing.visibility;
  let passwordHash = existing.password_hash;
  if (input.password) passwordHash = await hashPostPassword(input.password);
  else if (input.password === null) passwordHash = null;
  const status = input.status ?? existing.status;
  const publishAt = input.publishAt !== undefined ? resolvePublishAt(status, input.publishAt) : existing.publish_at;
  const summary = input.summary !== undefined ? input.summary?.trim() || makeSummary(compiled.text) : existing.summary;
  const cover = input.coverImage !== undefined ? input.coverImage?.trim() || compiled.cover : existing.cover_image;
  const categoryId = input.categoryId !== undefined ? input.categoryId : existing.category_id;
  const tagNames = input.tagNames;

  const upd = db.transaction(() => {
    db.prepare(
      `UPDATE posts SET slug=?, title=?, summary=?, content_md=?, content_html=?, content_text=?, toc=?,
         cover_image=?, category_id=?, visibility=?, password_hash=?, status=?, publish_at=?, word_count=?,
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id=?`,
    ).run(
      slug, title, summary, contentMd, compiled.html, compiled.text, JSON.stringify(compiled.toc),
      cover, categoryId, visibility, passwordHash, status, publishAt, compiled.wordCount, id,
    );
    if (tagNames) syncPostTags(db, id, findOrCreateTags(db, tagNames));
  });
  upd();
  const post = getPostById(db, id);
  if (!post) throw err(500, 'INTERNAL_ERROR', '更新文章失败');
  return post;
}

export function publishPost(db: Database.Database, id: number): PostRow {
  const post = getPostById(db, id);
  if (!post) throw err(404, 'POST_NOT_FOUND', '文章不存在');
  db.prepare(
    `UPDATE posts SET status='published', publish_at=COALESCE(publish_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`,
  ).run(id);
  return getPostById(db, id)!;
}

export function unpublishPost(db: Database.Database, id: number): PostRow {
  const post = getPostById(db, id);
  if (!post) throw err(404, 'POST_NOT_FOUND', '文章不存在');
  db.prepare(
    `UPDATE posts SET status='draft', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`,
  ).run(id);
  return getPostById(db, id)!;
}

export function deletePost(db: Database.Database, id: number): void {
  const res = db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  if (!res.changes) throw err(404, 'POST_NOT_FOUND', '文章不存在');
}

export interface AdminListOptions {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export function listAdminPosts(db: Database.Database, opts: AdminListOptions = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const params: unknown[] = [];
  let where = '1=1';
  if (opts.status) {
    where += ' AND p.status = ?';
    params.push(opts.status);
  }
  if (opts.q?.trim()) {
    where += ' AND (p.title LIKE ? OR p.content_text LIKE ?)';
    const like = `%${opts.q.trim()}%`;
    params.push(like, like);
  }
  const rows = db
    .prepare(`SELECT p.* FROM posts p WHERE ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as unknown as PostRow[];
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM posts p WHERE ${where}`).get(...params) as { c: number }
  ).c;
  return { items: rows, total };
}

export interface PublicListOptions {
  page: number;
  pageSize: number;
  category?: string;
  tag?: string;
  q?: string;
  authed: boolean;
}

export function listPublicPosts(db: Database.Database, opts: PublicListOptions) {
  const params: unknown[] = [];
  let where = "p.status='published' AND (p.visibility='public' OR (p.visibility='login' AND ?))";
  params.push(opts.authed ? 1 : 0);
  if (opts.category) {
    where += ' AND p.category_id = ?';
    params.push(Number(opts.category) || null);
  }
  if (opts.tag) {
    where += ' AND p.id IN (SELECT pt.post_id FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE t.slug = ?)';
    params.push(opts.tag);
  }
  if (opts.q?.trim()) {
    const ids = searchPostIds(db, opts.q);
    if (ids.length === 0) return { items: [], total: 0 };
    where += ` AND p.id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  const rows = db
    .prepare(`SELECT p.* FROM posts p WHERE ${where} ORDER BY p.publish_at DESC, p.id DESC LIMIT ? OFFSET ?`)
    .all(...params, opts.pageSize, (opts.page - 1) * opts.pageSize) as unknown as PostRow[];
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM posts p WHERE ${where}`).get(...params) as { c: number }
  ).c;
  return { items: rows, total };
}

/** FTS5 trigram（≥3 字符）+ LIKE 兜底双通道 */
export function searchPostIds(db: Database.Database, q: string): number[] {
  const term = q.trim();
  if (!term) return [];
  const ids = new Set<number>();
  if (term.length >= 3) {
    try {
      const rows = db
        .prepare('SELECT rowid FROM posts_fts WHERE posts_fts MATCH ? LIMIT 200')
        .all(`"${term.replace(/"/g, '""')}"`) as { rowid: number }[];
      for (const r of rows) ids.add(r.rowid);
    } catch {
      // 回退 LIKE
    }
  }
  const like = db
    .prepare('SELECT id FROM posts WHERE title LIKE ? OR content_text LIKE ? LIMIT 200')
    .all(`%${term}%`, `%${term}%`) as { id: number }[];
  for (const r of like) ids.add(r.id);
  return [...ids];
}

/** 浏览量：按 文章+日期+IP 去重后计数 */
export function recordView(db: Database.Database, postId: number, ip: string | undefined): void {
  const today = new Date().toISOString().slice(0, 10);
  const ins = db
    .prepare('INSERT OR IGNORE INTO post_views (post_id, date, ip) VALUES (?,?,?)')
    .run(postId, today, ip ?? 'unknown');
  if (ins.changes === 1) {
    db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').run(postId);
  }
}

// ===== DTO 映射 =====
export function toPostSummaryDTO(db: Database.Database, p: PostRow): PostSummaryDTO {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    coverImage: p.cover_image,
    category: p.category_id ? getCategory(db, p.category_id) : null,
    tags: getPostTags(db, p.id),
    visibility: p.visibility,
    wordCount: p.word_count,
    viewCount: p.view_count,
    commentCount: p.comment_count,
    publishAt: p.publish_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export function toPostDetailDTO(db: Database.Database, p: PostRow): PostDetailDTO {
  return {
    ...toPostSummaryDTO(db, p),
    contentHtml: p.content_html,
    toc: JSON.parse(p.toc || '[]') as PostDetailDTO['toc'],
  };
}

export function toAdminPostDTO(db: Database.Database, p: PostRow): AdminPostDTO {
  return {
    ...toPostDetailDTO(db, p),
    contentMd: p.content_md,
    status: p.status,
    authorId: p.author_id,
    passwordProtected: !!p.password_hash,
  };
}
