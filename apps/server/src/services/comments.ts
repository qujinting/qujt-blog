import type Database from 'better-sqlite3';
import type { CommentStatus } from '@qujt/shared';
import { err } from '../lib/errors.js';
import { getSetting } from './settings.js';

export interface CommentRow {
  id: number;
  post_id: number;
  user_id: number;
  parent_id: number | null;
  root_id: number | null;
  reply_to_uid: number | null;
  content: string;
  status: CommentStatus;
  ip: string | null;
  ua: string | null;
  created_at: string;
}

export const COMMENT_MAX_LENGTH = 1000;

export function getCommentById(db: Database.Database, id: number): CommentRow | undefined {
  return db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as CommentRow | undefined;
}

/** 简单垃圾启发式：链接数量 */
function spamLinks(content: string): number {
  return (content.match(/https?:\/\//gi) || []).length;
}

export interface CreateCommentInput {
  postId: number;
  userId: number;
  parentId?: number | null;
  content: string;
  ip?: string;
  ua?: string;
}

export function createComment(db: Database.Database, input: CreateCommentInput): CommentRow {
  const content = input.content.trim();
  if (!content) throw err(422, 'COMMENT_EMPTY', '评论内容不能为空');
  if (content.length > COMMENT_MAX_LENGTH) throw err(422, 'COMMENT_TOO_LONG', '评论不能超过 1000 字');

  let parent: CommentRow | null = null;
  let rootId: number | null = null;
  let replyToUid: number | null = null;
  if (input.parentId) {
    parent = getCommentById(db, input.parentId) ?? null;
    if (!parent || parent.post_id !== input.postId || parent.status !== 'approved') {
      throw err(422, 'PARENT_INVALID', '被回复的评论不存在或不可回复');
    }
    rootId = parent.root_id ?? parent.id;
    replyToUid = parent.user_id;
  }

  const moderation = (getSetting<boolean>(db, 'comment_moderation') ?? true) === true;
  const status: CommentStatus = spamLinks(content) >= 3 ? 'spam' : moderation ? 'pending' : 'approved';

  const info = db
    .prepare(
      `INSERT INTO comments (post_id, user_id, parent_id, root_id, reply_to_uid, content, status, ip, ua)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .run(input.postId, input.userId, parent?.id ?? null, rootId, replyToUid, content, status, input.ip ?? null, input.ua ?? null);
  const row = getCommentById(db, Number(info.lastInsertRowid))!;
  if (status === 'approved') refreshCommentCount(db, input.postId);
  return row;
}

/** 重新统计文章已通过评论数（状态变更后保持计数一致） */
export function refreshCommentCount(db: Database.Database, postId: number): void {
  db.prepare(
    `UPDATE posts SET comment_count = (SELECT COUNT(*) FROM comments WHERE post_id = ? AND status = 'approved') WHERE id = ?`,
  ).run(postId, postId);
}

export function setCommentStatus(db: Database.Database, id: number, status: CommentStatus): void {
  const row = getCommentById(db, id);
  if (!row) throw err(404, 'COMMENT_NOT_FOUND', '评论不存在');
  const wasApproved = row.status === 'approved';
  db.prepare('UPDATE comments SET status = ? WHERE id = ?').run(status, id);
  if (wasApproved !== (status === 'approved')) refreshCommentCount(db, row.post_id);
}

export function listApprovedByPost(
  db: Database.Database,
  postId: number,
  opts: { page: number; pageSize: number },
): { items: (CommentRow & { nickname: string; avatar: string | null; reply_to_nickname: string | null })[]; total: number } {
  const pageSize = Math.min(Math.max(opts.pageSize, 1), 100);
  const rows = db
    .prepare(
      `SELECT c.*, u.nickname, u.avatar, ru.nickname AS reply_to_nickname
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN users ru ON ru.id = c.reply_to_uid
       WHERE c.post_id = ? AND c.status = 'approved'
       ORDER BY c.id DESC LIMIT ? OFFSET ?`,
    )
    .all(postId, pageSize, (opts.page - 1) * pageSize) as (CommentRow & { nickname: string; avatar: string | null; reply_to_nickname: string | null })[];
  const total = (
    db.prepare("SELECT COUNT(*) AS c FROM comments WHERE post_id = ? AND status = 'approved'").get(postId) as { c: number }
  ).c;
  return { items: rows.reverse(), total }; // 倒序取最新，展示时按时间正序
}

export interface AdminCommentRow extends CommentRow {
  username: string;
  nickname: string;
  avatar: string | null;
  post_title: string;
}

export function listAdminComments(
  db: Database.Database,
  opts: { status?: CommentStatus; page: number; pageSize: number; q?: string },
): { items: AdminCommentRow[]; total: number } {
  const params: unknown[] = [];
  let where = '1=1';
  if (opts.status) {
    where += ' AND c.status = ?';
    params.push(opts.status);
  }
  if (opts.q?.trim()) {
    where += ' AND (c.content LIKE ? OR u.username LIKE ? OR p.title LIKE ?)';
    const like = `%${opts.q.trim()}%`;
    params.push(like, like, like);
  }
  const items = db
    .prepare(
      `SELECT c.*, u.username, u.nickname, u.avatar, p.title AS post_title
       FROM comments c
       JOIN users u ON u.id = c.user_id
       JOIN posts p ON p.id = c.post_id
       WHERE ${where}
       ORDER BY c.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, opts.pageSize, (opts.page - 1) * opts.pageSize) as unknown as AdminCommentRow[];
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM comments c JOIN posts p ON p.id = c.post_id WHERE ${where}`).get(...params) as { c: number }
  ).c;
  return { items, total };
}