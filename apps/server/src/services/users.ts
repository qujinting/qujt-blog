import argon2 from 'argon2';
import type Database from 'better-sqlite3';
import type { Role, UserDTO, UserStatus } from '@qujt/shared';
import { AppError } from '../lib/errors.js';

export interface DbUser {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  nickname: string;
  avatar: string | null;
  role: Role;
  status: UserStatus;
  invited_by: number | null;
  invite_code_id: number | null;
  created_at: string;
  updated_at: string;
}

// argon2id，memory 64MB（2G 内存可控）
export const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 2 };

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function findUserById(db: Database.Database, id: number): DbUser | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
}

export function findUserByAccount(db: Database.Database, account: string): DbUser | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(account, account.toLowerCase()) as DbUser | undefined;
}

export function toUserDTO(u: DbUser): UserDTO {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    nickname: u.nickname,
    avatar: u.avatar,
    role: u.role,
    status: u.status,
    invitedBy: u.invited_by,
    inviteCodeId: u.invite_code_id,
    createdAt: u.created_at,
  };
}
export interface UserListRow {
  id: number;
  username: string;
  email: string;
  nickname: string;
  role: Role;
  status: UserStatus;
  invited_by_username: string | null;
  invite_code: string | null;
  created_at: string;
}

export function listUsers(db: Database.Database, opts: { page: number; pageSize: number; q?: string }) {
  const params: unknown[] = [];
  let where = '1=1';
  if (opts.q?.trim()) {
    where += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.nickname LIKE ?)';
    const like = `%${opts.q.trim()}%`;
    params.push(like, like, like);
  }
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.nickname, u.role, u.status, u.created_at,
              inv.username AS invited_by_username, c.code AS invite_code
       FROM users u
       LEFT JOIN users inv ON inv.id = u.invited_by
       LEFT JOIN invite_codes c ON c.id = u.invite_code_id
       WHERE ${where}
       ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, opts.pageSize, (opts.page - 1) * opts.pageSize) as unknown as UserListRow[];
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM users u WHERE ${where}`).get(...params) as { c: number }
  ).c;
  return { items: rows, total };
}

export function updateUserRole(db: Database.Database, id: number, role: Role): void {
  const res = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  if (!res.changes) throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
}

export function updateUserStatus(db: Database.Database, id: number, status: UserStatus): void {
  const res = db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  if (!res.changes) throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
}
export function updateUserProfile(db: Database.Database, id: number, patch: { nickname?: string; avatar?: string | null }): DbUser {
  const cur = findUserById(db, id);
  if (!cur) throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
  const nickname = patch.nickname?.trim() || cur.nickname;
  const avatar = patch.avatar !== undefined ? patch.avatar : cur.avatar;
  db.prepare("UPDATE users SET nickname = ?, avatar = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(nickname, avatar, id);
  return findUserById(db, id)!;
}

/** 设置用户密码（管理员重置他人/自己用），并更新 updated_at */
export async function setUserPassword(db: Database.Database, id: number, password: string): Promise<void> {
  const hash = await hashPassword(password);
  const res = db
    .prepare("UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
    .run(hash, id);
  if (!res.changes) throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
}
