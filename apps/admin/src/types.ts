// 管理端本地类型（复用 @qujt/shared 的基础 DTO）
export type { UserDTO, PostSummaryDTO, PostDetailDTO, AdminPostDTO, CategoryDTO, TagDTO, Role, PostVisibility, PostStatus, RegistrationMode } from '@qujt/shared';

export interface Settings {
  siteName: string;
  siteDescription: string;
  icp: string;
  registrationMode: 'closed' | 'invite' | 'open';
  commentModeration: boolean;
}

export interface UserListRow {
  id: number;
  username: string;
  email: string;
  nickname: string;
  role: 'admin' | 'author' | 'user';
  status: 'active' | 'disabled';
  invited_by_username: string | null;
  invite_code: string | null;
  created_at: string;
}

export interface Stats {
  posts: { total: number; published: number; drafts: number; scheduled: number };
  comments: { total: number; pending: number };
  users: number;
  views: { today: number; total: number };
  media: number;
  inviteCodes: { total: number; unused: number };
  recentPosts: { id: number; slug: string; title: string; status: string; visibility: string; view_count: number; publish_at: string | null; updated_at: string }[];
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
