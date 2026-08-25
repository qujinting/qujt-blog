import type Database from 'better-sqlite3';
import type { CategoryDTO, TagDTO } from '@qujt/shared';
import { toTagSlug } from '../lib/slug.js';
import { err } from '../lib/errors.js';

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort: number;
  created_at: string;
}

interface TagRow {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}

export function findOrCreateCategory(db: Database.Database, name: string): { id: number } {
  const n = name.trim();
  if (!n) throw err(422, 'CATEGORY_NAME_REQUIRED', '分类名不能为空');
  const row = db.prepare('SELECT id FROM categories WHERE name = ?').get(n) as { id: number } | undefined;
  if (row) return row;
  const info = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(n, toTagSlug(n));
  return { id: Number(info.lastInsertRowid) };
}

export function findOrCreateTags(db: Database.Database, names: string[]): number[] {
  const ids: number[] = [];
  const byName = db.prepare('SELECT id FROM tags WHERE name = ?');
  const bySlug = db.prepare('SELECT id FROM tags WHERE slug = ?');
  const insert = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)');
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const existing = byName.get(name) as { id: number } | undefined;
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const slug = toTagSlug(name);
    const dupSlug = bySlug.get(slug) as { id: number } | undefined;
    const finalSlug = dupSlug ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug;
    const info = insert.run(name, finalSlug);
    ids.push(Number(info.lastInsertRowid));
  }
  return ids;
}

export function syncPostTags(db: Database.Database, postId: number, tagIds: number[]): void {
  db.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId);
  const ins = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?,?)');
  for (const id of tagIds) ins.run(postId, id);
}

export function getPostTags(db: Database.Database, postId: number): TagDTO[] {
  return db
    .prepare(
      'SELECT t.id, t.name, t.slug FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ? ORDER BY t.id',
    )
    .all(postId) as unknown as TagDTO[];
}

export function getCategory(db: Database.Database, id: number): CategoryDTO | null {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow | undefined;
  if (!row) return null;
  return { id: row.id, name: row.name, slug: row.slug, description: row.description, sort: row.sort };
}

export function listCategories(db: Database.Database): CategoryDTO[] {
  const rows = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id AND p.status = 'published') AS post_count
       FROM categories c ORDER BY c.sort ASC, c.id ASC`,
    )
    .all() as (CategoryRow & { post_count: number })[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    sort: r.sort,
    postCount: r.post_count,
  }));
}

export function listTags(db: Database.Database): TagDTO[] {
  const rows = db
    .prepare(
      `SELECT t.*, (SELECT COUNT(*) FROM post_tags pt JOIN posts p ON p.id = pt.post_id WHERE pt.tag_id = t.id AND p.status = 'published') AS post_count
       FROM tags t ORDER BY post_count DESC, t.id ASC`,
    )
    .all() as (TagRow & { post_count: number })[];
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, postCount: r.post_count }));
}

export function createCategory(db: Database.Database, input: { name: string; slug?: string; description?: string | null; sort?: number }): CategoryDTO {
  const name = input.name.trim();
  if (!name) throw err(422, 'CATEGORY_NAME_REQUIRED', '分类名不能为空');
  const slug = input.slug?.trim() || toTagSlug(name);
  const exists = db.prepare('SELECT id FROM categories WHERE slug = ? OR name = ?').get(slug, name);
  if (exists) throw err(409, 'CATEGORY_EXISTS', '分类名或 slug 已存在');
  const info = db
    .prepare('INSERT INTO categories (name, slug, description, sort) VALUES (?,?,?,?)')
    .run(name, slug, input.description?.trim() ?? null, input.sort ?? 0);
  return listCategories(db).find((c) => c.id === Number(info.lastInsertRowid))!;
}

export function updateCategory(db: Database.Database, id: number, input: { name?: string; slug?: string; description?: string | null; sort?: number }): CategoryDTO {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow | undefined;
  if (!existing) throw err(404, 'CATEGORY_NOT_FOUND', '分类不存在');
  const name = input.name?.trim() || existing.name;
  const slug = input.slug?.trim() || existing.slug;
  db.prepare('UPDATE categories SET name=?, slug=?, description=?, sort=? WHERE id=?')
    .run(name, slug, input.description !== undefined ? input.description : existing.description, input.sort ?? existing.sort, id);
  return listCategories(db).find((c) => c.id === id)!;
}

export function deleteCategory(db: Database.Database, id: number): void {
  // 先解除文章关联
  db.prepare('UPDATE posts SET category_id = NULL WHERE category_id = ?').run(id);
  const res = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  if (!res.changes) throw err(404, 'CATEGORY_NOT_FOUND', '分类不存在');
}

export function createTag(db: Database.Database, input: { name: string }): TagDTO {
  const name = input.name.trim();
  if (!name) throw err(422, 'TAG_NAME_REQUIRED', '标签名不能为空');
  const exists = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (exists) throw err(409, 'TAG_EXISTS', '标签已存在');
  const slug = toTagSlug(name);
  const info = db.prepare('INSERT INTO tags (name, slug) VALUES (?,?)').run(name, slug);
  return { id: Number(info.lastInsertRowid), name, slug, postCount: 0 };
}

export function updateTag(db: Database.Database, id: number, input: { name: string }): TagDTO {
  const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as TagRow | undefined;
  if (!existing) throw err(404, 'TAG_NOT_FOUND', '标签不存在');
  const name = input.name.trim();
  if (!name) throw err(422, 'TAG_NAME_REQUIRED', '标签名不能为空');
  const dup = db.prepare('SELECT id FROM tags WHERE name = ? AND id != ?').get(name, id);
  if (dup) throw err(409, 'TAG_EXISTS', '标签已存在');
  db.prepare('UPDATE tags SET name=?, slug=? WHERE id=?').run(name, toTagSlug(name), id);
  return { id, name, slug: toTagSlug(name), postCount: 0 };
}

export function deleteTag(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM post_tags WHERE tag_id = ?').run(id);
  const res = db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  if (!res.changes) throw err(404, 'TAG_NOT_FOUND', '标签不存在');
}