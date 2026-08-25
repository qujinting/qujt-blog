<template>
  <n-config-provider :theme="theme" :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <n-loading-bar-provider>
          <router-view />
        </n-loading-bar-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NConfigProvider, NMessageProvider, NDialogProvider, NLoadingBarProvider, darkTheme, zhCN, dateZhCN } from 'naive-ui';
import { useAppStore } from './stores/app.js';

const app = useAppStore();
const theme = computed(() => (app.dark ? darkTheme : null));
const themeOverrides = { common: { primaryColor: '#18a058' } };
</script>
