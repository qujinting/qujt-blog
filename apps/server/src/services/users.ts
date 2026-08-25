import argon2 from 'argon2';
import type Database from 'better-sqlite3';
import type { Role, UserDTO, UserStatus } from '@qujt/shared';

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
