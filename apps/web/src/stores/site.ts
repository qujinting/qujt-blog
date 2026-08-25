import { defineStore } from 'pinia';
import { siteApi } from '../api/index.js';
import type { SiteInfo } from '../types.js';

export const useSiteStore = defineStore('site', {
  state: () => ({
    info: null as SiteInfo | null,
  }),
  actions: {
    async load(force = false): Promise<void> {
      if (!this.info || force) {
        this.info = await siteApi.get();
      }
    },
  },
});
