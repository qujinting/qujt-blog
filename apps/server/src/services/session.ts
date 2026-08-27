import type Database from 'better-sqlite3';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { randomToken, sha256Hex } from '../lib/crypto.js';
import { err } from '../lib/errors.js';
import { findUserById, type DbUser } from './users.js';

export function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export function createAccessToken(app: FastifyInstance, user: DbUser): string {
  return app.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: app.cfg.JWT_EXPIRES_IN });
}

function insertRefreshToken(db: Database.Database, userId: number, hash: string, expiresAt: string): void {
  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)').run(userId, hash, expiresAt);
}

export function accessCookieOptions(app: FastifyInstance) {
  return { path: app.cfg.COOKIE_PATH, httpOnly: true, sameSite: 'strict' as const, secure: false };
}

export function refreshCookieOptions(app: FastifyInstance) {
  return {
    path: app.cfg.COOKIE_PATH,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: false,
    maxAge: app.cfg.REFRESH_EXPIRES_DAYS * 86400,
  };
}

export async function issueSessionCookies(app: FastifyInstance, reply: FastifyReply, user: DbUser): Promise<void> {
  const accessToken = createAccessToken(app, user);
  const raw = randomToken();
  insertRefreshToken(app.db, user.id, sha256Hex(raw), isoDaysFromNow(app.cfg.REFRESH_EXPIRES_DAYS));
  reply.setCookie('access_token', accessToken, accessCookieOptions(app));
  reply.setCookie('refresh_token', raw, refreshCookieOptions(app));
}

export async function rotateRefresh(
  app: FastifyInstance,
  raw: string,
): Promise<{ accessToken: string; refreshToken: string; user: DbUser }> {
  const row = app.db
    .prepare(
      `SELECT id, user_id FROM refresh_tokens
       WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
    )
    .get(sha256Hex(raw), new Date().toISOString()) as { id: number; user_id: number } | undefined;
  if (!row) throw err(401, 'INVALID_REFRESH', '登录已失效，请重新登录');

  app.db
    .prepare(`UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(row.id);

  const user = findUserById(app.db, row.user_id);
  if (!user || user.status !== 'active') throw err(401, 'INVALID_REFRESH', '用户不存在或已被禁用');

  const accessToken = createAccessToken(app, user);
  const newRaw = randomToken();
  insertRefreshToken(app.db, user.id, sha256Hex(newRaw), isoDaysFromNow(app.cfg.REFRESH_EXPIRES_DAYS));
  return { accessToken, refreshToken: newRaw, user };
}

export function revokeRefreshByRaw(db: Database.Database, raw: string): void {
  db.prepare(`UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE token_hash = ?`).run(
    sha256Hex(raw),
  );
}

/** 撤销某用户所有未失效的 refresh token（用于管理员重置密码后让其旧会话失效） */
export function revokeRefreshByUser(db: Database.Database, userId: number): void {
  db.prepare(
    `UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ? AND revoked_at IS NULL`,
  ).run(userId);
}
