import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({ dark: false }),
  actions: {
    toggleDark() {
      this.dark = !this.dark;
    },
  },
});
