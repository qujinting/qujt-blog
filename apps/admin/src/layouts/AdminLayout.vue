<template>
  <n-layout has-sider style="height: 100vh">
    <n-layout-sider bordered collapse-mode="width" :collapsed-width="64" :width="200" :collapsed="collapsed" show-trigger @collapse="collapsed = true" @expand="collapsed = false">
      <div style="height:48px; display:flex; align-items:center; padding:0 16px; font-weight:600; white-space:nowrap; overflow:hidden;">
        {{ collapsed ? '博客' : 'qujt-blog 后台' }}
      </div>
      <n-menu :collapsed="collapsed" :collapsed-width="64" :options="menuOptions" :value="activeKey" @update:value="onSelect" />
    </n-layout-sider>
    <n-layout>
      <n-layout-header bordered style="height:48px; display:flex; align-items:center; justify-content:space-between; padding:0 16px;">
        <div style="font-weight:600;">{{ (route.meta.title as string) ?? '' }}</div>
        <div style="display:flex; gap:12px; align-items:center;">
          <n-switch :value="app.dark" @update:value="app.toggleDark">
            <template #checked>暗</template>
            <template #unchecked>亮</template>
          </n-switch>
          <n-dropdown :options="userMenuOptions" @select="onUserSelect">
            <n-tag round :bordered="false" style="cursor:pointer;">{{ auth.user?.nickname }} · {{ auth.user?.role }}</n-tag>
          </n-dropdown>
        </div>
      </n-layout-header>
      <n-layout-content style="padding:16px;">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { useAppStore } from '../stores/app.js';
import { useAuthStore } from '../stores/auth.js';

const route = useRoute();
const router = useRouter();
const app = useAppStore();
const auth = useAuthStore();
const message = useMessage();
const collapsed = ref(false);

const menuOptions = computed(() => {
  const base = [
    { key: 'dashboard', label: '仪表盘' },
    { key: 'posts', label: '文章' },
    { key: 'posts/new', label: '写文章' },
    { key: 'media', label: '媒体库' },
    { key: 'categories', label: '分类' },
    { key: 'tags', label: '标签' },
  ];
  if (auth.isAdmin) {
    base.push(
      { key: 'users', label: '用户' },
      { key: 'invite-codes', label: '邀请码' },
      { key: 'settings', label: '设置' },
    );
  }
  return base;
});

const activeKey = computed(() => {
  const seg = route.path.split('/').filter(Boolean);
  if (seg[0] === 'posts' && seg[1] === 'new') return 'posts/new';
  return seg[0] || 'dashboard';
});

function onSelect(key: string) {
  router.push('/' + key);
}

const userMenuOptions = [{ key: 'logout', label: '退出登录' }];

async function onUserSelect(key: string) {
  if (key === 'logout') {
    await auth.logout();
    message.success('已退出登录');
    router.push('/login');
  }
}
</script>
