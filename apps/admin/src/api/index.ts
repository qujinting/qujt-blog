import type { CategoryDTO, InviteCodeDTO, TagDTO, UserDTO } from '@qujt/shared';
import { get, post, put, del, api } from './client.js';
import type { AdminCommentDTO, AdminPostDTO, MediaDTO, Settings, Stats, UserListRow } from '../types.js';

export const authApi = {
  me: () => get<{ user: UserDTO }>('/auth/me'),
  login: (account: string, password: string) => post<{ user: UserDTO }>('/auth/login', { account, password }),
  logout: () => post<{ ok: boolean }>('/auth/logout'),
};

export const statsApi = { get: () => get<Stats>('/admin/stats') };

export const settingsApi = {
  get: () => get<{ settings: Settings; ossConfigured: boolean }>('/admin/settings'),
  update: (patch: Partial<Settings>) => put<{ settings: Settings }>('/admin/settings', patch),
};

export const usersApi = {
  list: (params?: { page?: number; pageSize?: number; q?: string }) => get<{ items: UserListRow[]; total: number }>('/admin/users', params),
  update: (id: number, patch: { role?: string; status?: string }) => put<{ ok: boolean }>('/admin/users/' + id, patch),
};

export const postsApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string; q?: string }) => get<{ items: AdminPostDTO[]; total: number }>('/admin/posts', params),
  get: (id: number) => get<{ post: AdminPostDTO }>('/admin/posts/' + id),
  create: (body: unknown) => post<{ post: AdminPostDTO }>('/admin/posts', body),
  update: (id: number, body: unknown) => put<{ post: AdminPostDTO }>('/admin/posts/' + id, body),
  remove: (id: number) => del<{ ok: boolean }>('/admin/posts/' + id),
  publish: (id: number) => post<{ post: AdminPostDTO }>('/admin/posts/' + id + '/publish'),
  unpublish: (id: number) => post<{ post: AdminPostDTO }>('/admin/posts/' + id + '/unpublish'),
  importFile: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post('/admin/posts/import', fd);
    return data as { post: AdminPostDTO; source: string; unresolvedImages: string[] };
  },
};

export const mediaApi = {
  upload: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post('/admin/media/upload', fd);
    return data as { media: MediaDTO };
  },
  list: (params?: { page?: number; pageSize?: number }) => get<{ items: MediaDTO[]; total: number }>('/admin/media', params),
  remove: (id: number) => del<{ ok: boolean }>('/admin/media/' + id),
};

export const taxonomyApi = {
  categories: () => get<{ items: CategoryDTO[] }>('/admin/categories'),
  createCategory: (body: { name: string; slug?: string; description?: string; sort?: number }) => post<{ category: CategoryDTO }>('/admin/categories', body),
  updateCategory: (id: number, body: unknown) => put<{ category: CategoryDTO }>('/admin/categories/' + id, body),
  deleteCategory: (id: number) => del<{ ok: boolean }>('/admin/categories/' + id),
  tags: () => get<{ items: TagDTO[] }>('/admin/tags'),
  createTag: (body: { name: string }) => post<{ tag: TagDTO }>('/admin/tags', body),
  updateTag: (id: number, body: { name: string }) => put<{ tag: TagDTO }>('/admin/tags/' + id, body),
  deleteTag: (id: number) => del<{ ok: boolean }>('/admin/tags/' + id),
};

export interface InviteCreateInput {
  count?: number;
  prefix?: string;
  maxUses?: number;
  expiresAt?: string | null;
  note?: string;
}
export const adminCommentsApi = {
  list: (params?: { status?: string; page?: number; pageSize?: number; q?: string }) => get<{ items: AdminCommentDTO[]; total: number }>('/admin/comments', params),
  setStatus: (id: number, status: 'pending' | 'approved' | 'spam' | 'deleted') => post<{ ok: boolean }>('/admin/comments/' + id + '/status', { status }),
};

export const invitesApi = {
  list: (params?: { page?: number; pageSize?: number }) => get<{ items: InviteCodeDTO[]; total: number }>('/admin/invite-codes', params),
  create: (body: InviteCreateInput) => post<{ items: InviteCodeDTO[]; count: number }>('/admin/invite-codes', body),
  setStatus: (id: number, status: 'active' | 'disabled') => put<{ ok: boolean }>('/admin/invite-codes/' + id + '/status', { status }),
};