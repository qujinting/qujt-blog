// ===== 枚举与常量 =====
export type Role = 'admin' | 'author' | 'user';
export type UserStatus = 'active' | 'disabled';
export type PostVisibility = 'public' | 'login' | 'password' | 'private';
export type PostStatus = 'draft' | 'published' | 'scheduled';
export type CommentStatus = 'pending' | 'approved' | 'spam' | 'deleted';
export type RegistrationMode = 'closed' | 'invite' | 'open';
export type InviteCodeStatus = 'active' | 'disabled';

export const ROLES: readonly Role[] = ['admin', 'author', 'user'];
export const REGISTRATION_MODES: readonly RegistrationMode[] = ['closed', 'invite', 'open'];

export const SETTINGS_KEYS = {
  registrationMode: 'registration_mode',
  siteName: 'site_name',
  siteDescription: 'site_description',
  icp: 'icp',
  commentModeration: 'comment_moderation',
} as const;

// ===== DTO =====
export interface UserDTO {
  id: number;
  username: string;
  email: string;
  nickname: string;
  avatar: string | null;
  role: Role;
  status: UserStatus;
  invitedBy: number | null;
  inviteCodeId: number | null;
  createdAt: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  inviteCode?: string;
}

export interface LoginInput {
  account: string;
  password: string;
}

export interface InviteCodeDTO {
  id: number;
  code: string;
  createdBy: number;
  note: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  status: InviteCodeStatus;
  createdAt: string;
}

export interface InviteCodeCreateInput {
  count: number;
  prefix?: string;
  maxUses?: number;
  expiresAt?: string | null;
  note?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface SiteInfoDTO {
  siteName: string;
  siteDescription: string;
  icp: string;
  registrationMode: RegistrationMode;
  commentModeration: boolean;
}
// ===== 文章/分类/标签 DTO =====
export interface CategoryDTO {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort: number;
  postCount?: number;
}

export interface TagDTO {
  id: number;
  name: string;
  slug: string;
  postCount?: number;
}

export interface PostSummaryDTO {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  coverImage: string | null;
  category: CategoryDTO | null;
  tags: TagDTO[];
  visibility: PostVisibility;
  wordCount: number;
  viewCount: number;
  commentCount: number;
  publishAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostDetailDTO extends PostSummaryDTO {
  contentHtml: string;
  toc: { level: number; id: string; text: string }[];
}

/** 管理端完整文章（含 MD 源码） */
export interface AdminPostDTO extends PostDetailDTO {
  contentMd: string;
  status: PostStatus;
  authorId: number;
  passwordProtected: boolean;
}
// ===== 评论 DTO =====
export interface CommentUserDTO {
  id: number;
  nickname: string;
  avatar: string | null;
}

export interface CommentDTO {
  id: number;
  postId: number;
  parentId: number | null;
  rootId: number | null;
  replyToUid: number | null;
  replyToNickname: string | null;
  content: string;
  user: CommentUserDTO;
  createdAt: string;
}

export interface AdminCommentDTO extends CommentDTO {
  status: CommentStatus;
  ip: string | null;
  username: string;
  postId: number;
  postTitle: string;
}
