import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@qujt/shared';
import { err } from '../lib/errors.js';
import { findUserById, type DbUser } from '../services/users.js';

export async function authenticate(app: FastifyInstance, req: FastifyRequest): Promise<DbUser> {
  try {
    await req.jwtVerify();
  } catch {
    throw err(401, 'UNAUTHORIZED', '未登录或登录已过期');
  }
  const sub = (req.user as { sub?: number }).sub;
  if (typeof sub !== 'number') throw err(401, 'UNAUTHORIZED', '未登录或登录已过期');
  const user = findUserById(app.db, sub);
  if (!user || user.status !== 'active') throw err(401, 'UNAUTHORIZED', '用户不存在或已被禁用');
  return user;
}

/** 要求登录（任意角色） */
export function requireAuth(app: FastifyInstance) {
  return async (req: FastifyRequest): Promise<void> => {
    req.currentUser = await authenticate(app, req);
  };
}

/** 要求角色白名单 + 管理接口 CSRF 头校验 */
export function requireRoles(app: FastifyInstance, roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = await authenticate(app, req);
    if (!roles.includes(user.role)) throw err(403, 'FORBIDDEN', '无权限执行此操作');
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      throw err(403, 'FORBIDDEN', '非法请求（缺少 CSRF 头）');
    }
    req.currentUser = user;
  };
}
