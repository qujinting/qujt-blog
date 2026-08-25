import type Database from 'better-sqlite3';
import path from 'node:path';
import crypto from 'node:crypto';
import OSS from 'ali-oss';
import type { AppConfig } from '../config.js';
import { err } from '../lib/errors.js';

export interface MediaRow {
  id: number;
  uploader_id: number;
  oss_key: string;
  file_name: string;
  size: number;
  mime: string | null;
  width: number | null;
  height: number | null;
  content_hash: string;
  created_at: string;
}

export interface MediaDTO {
  id: number;
  url: string;
  fileName: string;
  size: number;
  mime: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export function isOssConfigured(cfg: AppConfig): boolean {
  return !!(cfg.OSS_BUCKET && cfg.OSS_REGION && cfg.OSS_ACCESS_KEY_ID && cfg.OSS_ACCESS_KEY_SECRET);
}

export function requireOssClient(cfg: AppConfig): OSS {
  if (!isOssConfigured(cfg)) {
    throw err(503, 'OSS_NOT_CONFIGURED', 'OSS 未配置：请设置 OSS_BUCKET / OSS_REGION / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET');
  }
  return new OSS({
    region: cfg.OSS_REGION!,
    bucket: cfg.OSS_BUCKET!,
    accessKeyId: cfg.OSS_ACCESS_KEY_ID!,
    accessKeySecret: cfg.OSS_ACCESS_KEY_SECRET!,
    secure: true,
  });
}

export function publicUrl(cfg: AppConfig, key: string): string {
  if (cfg.OSS_CDN_DOMAIN) return `https://${cfg.OSS_CDN_DOMAIN}/${key}`;
  return `https://${cfg.OSS_BUCKET}.oss-${cfg.OSS_REGION}.aliyuncs.com/${key}`;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif']);

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/avif': '.avif',
  };
  return map[mime] ?? '.bin';
}

export async function uploadImage(
  db: Database.Database,
  cfg: AppConfig,
  uploaderId: number,
  buffer: Buffer,
  originalName: string,
  mime: string | undefined,
): Promise<MediaDTO> {
  if (!mime || !ALLOWED_MIME.has(mime)) throw err(415, 'UNSUPPORTED_IMAGE', '仅支持图片（jpg/png/gif/webp/svg/avif）');
  if (buffer.length > 10 * 1024 * 1024) throw err(413, 'IMAGE_TOO_LARGE', '图片不能超过 10MB');

  const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const existing = db.prepare('SELECT * FROM media WHERE content_hash = ?').get(contentHash) as MediaRow | undefined;
  if (existing) {
    return toDTO(cfg, existing);
  }

  const client = requireOssClient(cfg);
  const ext = path.extname(originalName) || mimeToExt(mime);
  const key = `uploads/${new Date().toISOString().slice(0, 7).replace('-', '/')}/${crypto.randomUUID()}${ext.toLowerCase()}`;
  const { width, height } = probeImageSize(buffer, mime);

  await client.put(key, buffer, { mime });
  const info = db
    .prepare('INSERT INTO media (uploader_id, oss_key, file_name, size, mime, width, height, content_hash) VALUES (?,?,?,?,?,?,?,?)')
    .run(uploaderId, key, originalName, buffer.length, mime, width, height, contentHash);
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(info.lastInsertRowid)) as MediaRow;
  return toDTO(cfg, row);
}

export function toDTO(cfg: AppConfig, row: MediaRow): MediaDTO {
  return {
    id: row.id,
    url: publicUrl(cfg, row.oss_key),
    fileName: row.file_name,
    size: row.size,
    mime: row.mime,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

export function listMedia(db: Database.Database, cfg: AppConfig, opts: { page: number; pageSize: number }) {
  const rows = db
    .prepare('SELECT * FROM media ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(opts.pageSize, (opts.page - 1) * opts.pageSize) as unknown as MediaRow[];
  const total = (db.prepare('SELECT COUNT(*) AS c FROM media').get() as { c: number }).c;
  return { items: rows.map((r) => toDTO(cfg, r)), total };
}

export async function deleteMedia(db: Database.Database, cfg: AppConfig, id: number): Promise<void> {
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaRow | undefined;
  if (!row) throw err(404, 'MEDIA_NOT_FOUND', '媒体不存在');
  if (isOssConfigured(cfg)) {
    const client = requireOssClient(cfg);
    try {
      await client.delete(row.oss_key);
    } catch (e) {
      throw err(500, 'OSS_DELETE_FAILED', 'OSS 删除失败：' + (e as Error).message);
    }
  }
  db.prepare('DELETE FROM media WHERE id = ?').run(id);
}

/** 尽力读取图片宽高；解析失败返回 null（不影响上传） */
function probeImageSize(buffer: Buffer, mime: string): { width: number | null; height: number | null } {
  try {
    if (mime === 'image/png' && buffer.readUInt32BE(12) === 0x49484452) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (mime === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let off = 2;
      while (off + 9 < buffer.length) {
        if (buffer[off] !== 0xff) { off++; continue; }
        const marker = buffer[off + 1]!;
        if (marker >= 0xc0 && marker <= 0xc3 && marker !== 0xc4 && marker !== 0xc8) {
          return { width: buffer.readUInt16BE(off + 7), height: buffer.readUInt16BE(off + 5) };
        }
        off += 2 + buffer.readUInt16BE(off + 2);
      }
    }
    if (mime === 'image/webp' && buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
      const fmt = buffer.slice(12, 16).toString();
      if (fmt === 'VP8 ' && buffer.length > 30) {
        return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      }
      if (fmt === 'VP8L' && buffer.length > 25) {
        const width = 1 + (((buffer[21]! & 0x3f) << 8) | buffer[20]!);
        const height = 1 + (((buffer[23]! & 0xf) << 10) | (buffer[22]! << 2) | ((buffer[21]! & 0xc0) >> 6));
        return { width, height };
      }
    }
  } catch {
    // ignore
  }
  return { width: null, height: null };
}