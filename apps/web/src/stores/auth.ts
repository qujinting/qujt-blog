import { defineStore } from 'pinia';
import type { UserDTO } from '@qujt/shared';
import { authApi } from '../api/index.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as UserDTO | null,
    loaded: false,
  }),
  getters: {
    isAuthed: (s) => !!s.user,
  },
  actions: {
    init() {
      window.addEventListener('qujt:unauthorized', () => {
        this.user = null;
      });
    },
    async fetchMe(): Promise<boolean> {
      try {
        const res = await authApi.me();
        this.user = res.user;
        return true;
      } catch {
        this.user = null;
        return false;
      } finally {
        this.loaded = true;
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
