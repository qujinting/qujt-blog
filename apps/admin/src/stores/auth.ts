import { defineStore } from 'pinia';
import type { UserDTO } from '@qujt/shared';
import { authApi } from '../api/index.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as UserDTO | null,
  }),
  getters: {
    isAuthed: (s) => !!s.user,
    isAdmin: (s) => s.user?.role === 'admin',
    isAuthor: (s) => s.user?.role === 'admin' || s.user?.role === 'author',
  },
  actions: {
    async fetchMe(): Promise<boolean> {
      try {
        const res = await authApi.me();
        this.user = res.user;
        return true;
      } catch {
        this.user = null;
        return false;
      }
    },
    async login(account: string, password: string): Promise<UserDTO> {
      const res = await authApi.login(account, password);
      this.user = res.user;
      return res.user;
    },
    async logout(): Promise<void> {
      try {
        await authApi.logout();
      } finally {
        this.user = null;
      }
    },
  },
});
