import type Database from 'better-sqlite3';
import type { RegisterInput, UserDTO } from '@qujt/shared';
import { err } from '../lib/errors.js';
import { getRegistrationMode } from './settings.js';
import { consumeInviteCode } from './invites.js';
import { findUserByAccount, findUserById, hashPassword, toUserDTO, verifyPassword, type DbUser } from './users.js';

export interface RegisterResult {
  user: UserDTO;
  inviteCodeUsed: boolean;
}

export async function register(db: Database.Database, input: RegisterInput): Promise<RegisterResult> {
  const mode = getRegistrationMode(db);
  if (mode === 'closed') throw err(403, 'REGISTRATION_CLOSED', '注册已关闭，请联系管理员');

  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  const inviteCode = input.inviteCode?.trim().toUpperCase() || undefined;

  // argon2 为异步操作，先于同步事务完成
  const passwordHash = await hashPassword(input.password);

  const insert = db.transaction((): { id: number; inviteCodeUsed: boolean } => {
    if (mode === 'invite') {
      if (!inviteCode) throw err(422, 'INVITE_CODE_REQUIRED', '当前为邀请制注册，需要邀请码');
      const consumed = consumeInviteCode(db, inviteCode);
      if (!consumed) throw err(422, 'INVITE_CODE_INVALID', '邀请码无效、已停用或已达使用上限');
      const info = db
        .prepare(
          `INSERT INTO users (username, email, password_hash, nickname, invited_by, invite_code_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(username, email, passwordHash, username, consumed.createdBy, consumed.id);
      return { id: Number(info.lastInsertRowid), inviteCodeUsed: true };
    }
    const info = db
      .prepare('INSERT INTO users (username, email, password_hash, nickname) VALUES (?,?,?,?)')
      .run(username, email, passwordHash, username);
    return { id: Number(info.lastInsertRowid), inviteCodeUsed: false };
  });

  try {
    const { id, inviteCodeUsed } = insert();
    const user = findUserById(db, id);
    if (!user) throw err(500, 'INTERNAL_ERROR', '创建用户失败');
    return { user: toUserDTO(user), inviteCodeUsed };
  } catch (e) {
    if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw err(409, 'USER_EXISTS', '用户名或邮箱已被注册');
    }
    throw e;
  }
}

export async function login(db: Database.Database, account: string, password: string): Promise<DbUser> {
  const user = findUserByAccount(db, account);
  if (!user || user.status !== 'active') throw err(401, 'INVALID_CREDENTIALS', '用户名或密码错误');
  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) throw err(401, 'INVALID_CREDENTIALS', '用户名或密码错误');
  return user;
}
