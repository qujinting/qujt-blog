import type Database from 'better-sqlite3';
import AdmZip from 'adm-zip';
import { err } from '../lib/errors.js';
import { parseFrontMatter, normalizeTagList } from '../lib/frontmatter.js';
import { findOrCreateCategory } from './taxonomy.js';
import { createPost, type PostRow } from './posts.js';
import type { PostVisibility } from '@qujt/shared';

export interface ImportResult {
  post: PostRow;
  source: 'md' | 'zip';
  unresolvedImages: string[];
}

const VALID_VISIBILITY: PostVisibility[] = ['public', 'login', 'password', 'private'];

export async function importPostFile(
  db: Database.Database,
  authorId: number,
  buffer: Buffer,
  filename: string,
): Promise<ImportResult> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return importMarkdown(db, authorId, buffer.toString('utf8'));
  }
  if (lower.endsWith('.zip')) {
    return importZip(db, authorId, buffer);
  }
  throw err(415, 'UNSUPPORTED_FILE', '仅支持 .md / .zip 文件');
}

/** 收集 MD 中的相对路径图片引用（http/https、绝对路径、data: 除外） */
export function detectRelativeImages(mdText: string): string[] {
  const refs = new Set<string>();
  const re = /!\[[^\]]*\]\(\s*([^)\s]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(mdText)) !== null) {
    const url = m[1]!;
    if (/^https?:\/\//i.test(url) || url.startsWith('/') || url.startsWith('data:') || /^[a-z][a-z0-9+.-]*:/i.test(url)) {
      continue;
    }
    refs.add(url);
  }
  return [...refs];
}

function firstH1(text: string): string | null {
  const m = /^#\s+(.+)$/m.exec(text);
  return m ? m[1]!.trim() : null;
}

function toVisibility(v: unknown): PostVisibility {
  return VALID_VISIBILITY.includes(v as PostVisibility) ? (v as PostVisibility) : 'public';
}

async function importMarkdown(
  db: Database.Database,
  authorId: number,
  text: string,
  source: 'md' | 'zip' = 'md',
): Promise<ImportResult> {
  const { data, body } = parseFrontMatter(text);
  const title = (typeof data.title === 'string' && data.title.trim()) || firstH1(body) || '未命名文章';
  const tagNames = normalizeTagList(data.tags);
  const category = typeof data.category === 'string' ? data.category : undefined;
  const categoryId = category ? findOrCreateCategory(db, category).id : null;
  const post = await createPost(db, authorId, {
    title,
    contentMd: body,
    tagNames,
    categoryId,
    summary: typeof data.summary === 'string' ? data.summary : undefined,
    visibility: toVisibility(data.visibility),
    slug: typeof data.slug === 'string' ? data.slug : undefined,
  });
  return { post, source, unresolvedImages: detectRelativeImages(body) };
}

function importZip(db: Database.Database, authorId: number, buffer: Buffer): Promise<ImportResult> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw err(422, 'INVALID_ZIP', '无法解析 zip 文件');
  }
  const entries = zip.getEntries();
  const mdEntry = entries.find((e) => !e.isDirectory && /\.md$/i.test(e.entryName));
  if (!mdEntry) throw err(422, 'NO_MARKDOWN_IN_ZIP', 'zip 内未找到 .md 文件');
  const text = mdEntry.getData().toString('utf8');
  return importMarkdown(db, authorId, text, 'zip');
}