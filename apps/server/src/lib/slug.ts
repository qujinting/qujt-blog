import type Database from 'better-sqlite3';
import { pinyin } from 'pinyin-pro';

/** 中文标题 → 拼音 slug */
export function titleToSlug(title: string): string {
  const arr = pinyin(title, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
  return (
    arr
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'post'
  );
}

export function toTagSlug(name: string): string {
  return titleToSlug(name).slice(0, 50);
}

/** 保证 slug 唯一（重复时追加 -2、-3 …） */
export function ensureUniqueSlug(db: Database.Database, slug: string, excludeId?: number): string {
  let candidate = slug;
  const stmt = db.prepare(
    'SELECT id FROM posts WHERE slug = ?' + (excludeId ? ' AND id != ?' : ''),
  );
  let i = 2;
  while (stmt.get(...(excludeId ? [candidate, excludeId] : [candidate]))) {
    candidate = `${slug}-${i++}`;
  }
  return candidate;
}
