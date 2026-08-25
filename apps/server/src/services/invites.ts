import type Database from 'better-sqlite3';
import type { InviteCodeCreateInput, InviteCodeDTO, InviteCodeStatus } from '@qujt/shared';
import { generateInviteCode } from '../lib/crypto.js';
import { err } from '../lib/errors.js';

interface InviteCodeRow {
  id: number;
  code: string;
  created_by: number;
  note: string | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  status: InviteCodeStatus;
  created_at: string;
}

function toDTO(r: InviteCodeRow): InviteCodeDTO {
  return {
    id: r.id,
    code: r.code,
    createdBy: r.created_by,
    note: r.note,
    maxUses: r.max_uses,
    usedCount: r.used_count,
    expiresAt: r.expires_at,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function createInviteCodes(
  db: Database.Database,
  input: InviteCodeCreateInput & { createdBy: number },
): InviteCodeDTO[] {
  const count = Math.min(Math.max(Math.floor(input.count) || 1, 1), 100);
  const maxUses = Math.max(0, input.maxUses ?? 1);
  const expiresAt = input.expiresAt ?? null;
  const note = input.note?.trim() || null;
  const prefix = input.prefix?.trim() || '';

  const create = db.transaction(() => {
    const codes: InviteCodeDTO[] = [];
    let guard = 0;
    while (codes.length < count && guard++ < count * 50) {
      const code = generateInviteCode(10, prefix);
      try {
        const info = db
          .prepare('INSERT INTO invite_codes (code, created_by, note, max_uses, expires_at) VALUES (?,?,?,?,?)')
          .run(code, input.createdBy, note, maxUses, expiresAt);
        codes.push({
          id: Number(info.lastInsertRowid),
          code,
          createdBy: input.createdBy,
          note,
          maxUses,
          usedCount: 0,
          expiresAt,
          status: 'active',
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') continue; // 碰撞重试
        throw e;
      }
    }
    return codes;
  });
  return create();
}

export function listInviteCodes(
  db: Database.Database,
  opts: { offset?: number; limit?: number } = {},
): { items: InviteCodeDTO[]; total: number } {
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 50;
  const rows = db
    .prepare('SELECT * FROM invite_codes ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as unknown as InviteCodeRow[];
  const total = (db.prepare('SELECT COUNT(*) AS c FROM invite_codes').get() as { c: number }).c;
  return { items: rows.map(toDTO), total };
}

export function setInviteCodeStatus(db: Database.Database, id: number, status: InviteCodeStatus): void {
  const res = db.prepare('UPDATE invite_codes SET status = ? WHERE id = ?').run(status, id);
  if (res.changes !== 1) throw err(404, 'INVITE_CODE_NOT_FOUND', '邀请码不存在');
}

/**
 * 原子消费邀请码（供注册事务内调用）：
 * 通过条件 UPDATE 保证并发下不超卖；返回 null 表示无效/停用/过期/超限。
 */
export function consumeInviteCode(
  db: Database.Database,
  code: string,
): { id: number; createdBy: number } | null {
  const now = new Date().toISOString();
  const res = db
    .prepare(
      `UPDATE invite_codes SET used_count = used_count + 1
       WHERE code = ? AND status = 'active'
         AND (expires_at IS NULL OR expires_at > ?)
         AND (max_uses = 0 OR used_count < max_uses)`,
    )
    .run(code, now);
  if (res.changes !== 1) return null;
  const row = db
    .prepare('SELECT id, created_by FROM invite_codes WHERE code = ?')
    .get(code) as { id: number; created_by: number } | undefined;
  return row ? { id: row.id, createdBy: row.created_by } : null;
}
