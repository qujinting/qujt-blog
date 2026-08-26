<template>
  <n-config-provider :theme="theme" :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <div :class="{ dark: app.dark }" class="app-shell">
          <router-view />
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme, zhCN, dateZhCN } from 'naive-ui';
import { useAppStore } from './stores/app.js';

const app = useAppStore();
const theme = computed(() => (app.dark ? darkTheme : null));

const themeOverrides = computed(() => {
  if (app.dark) {
    return {
      common: {
        primaryColor: '#818cf8',
        primaryColorHover: '#a5b4fc',
        primaryColorPressed: '#6366f1',
        borderRadius: '8px',
        fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif",
      },
    };
  }
  return {
    common: {
      primaryColor: '#6366f1',
      primaryColorHover: '#4f46e5',
      primaryColorPressed: '#4338ca',
      primaryColorSuppl: '#4f46e5',
      borderRadius: '8px',
      fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif",
    },
  };
});
</script>
