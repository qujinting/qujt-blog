import type { CategoryDTO, PostSummaryDTO, TagDTO, UserDTO } from '@qujt/shared';
import { get, post, put, del } from './client.js';
import type { SiteInfo } from '../types.js';

export interface PostDetailResp {
  post: import('@qujt/shared').PostDetailDTO & { locked?: boolean; lockedReason?: string };
}

export const siteApi = { get: () => get<SiteInfo>('/site') };

export const postsApi = {
  list: (params?: { page?: number; pageSize?: number; category?: string; tag?: string; q?: string }) =>
    get<{ items: PostSummaryDTO[]; total: number; page: number; pageSize: number }>('/posts', params),
  detail: (slug: string) => get<PostDetailResp>('/posts/' + slug),
  unlock: (slug: string, password: string) => post<{ unlocked: boolean }>('/posts/' + slug + '/unlock', { password }),
};

export const taxonomyApi = {
  categories: () => get<{ items: CategoryDTO[] }>('/categories'),
  tags: () => get<{ items: TagDTO[] }>('/tags'),
};

export const commentsApi = {
  list: (slug: string, params?: { page?: number; pageSize?: number }) =>
    get<{ items: import('@qujt/shared').CommentDTO[]; total: number }>('/posts/' + slug + '/comments', params),
  create: (slug: string, body: { content: string; parentId?: number | null }) =>
    post<{ comment: import('@qujt/shared').CommentDTO }>('/posts/' + slug + '/comments', body),
  remove: (id: number) => del<{ ok: boolean }>('/comments/' + id),
};

export const authApi = {
  me: () => get<{ user: UserDTO }>('/auth/me'),
  login: (account: string, password: string) => post<{ user: UserDTO }>('/auth/login', { account, password }),
  register: (body: { username: string; email: string; password: string; inviteCode?: string }) =>
    post<{ user: UserDTO; inviteCodeUsed: boolean }>('/auth/register', body),
  logout: () => post<{ ok: boolean }>('/auth/logout'),
  updateProfile: (patch: { nickname?: string; avatar?: string | null }) => put<{ user: UserDTO }>('/auth/me', patch),
  changePassword: (oldPassword: string, newPassword: string) =>
    post<{ ok: boolean }>('/auth/me/password', { oldPassword, newPassword }),
};