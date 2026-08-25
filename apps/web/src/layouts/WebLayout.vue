<template>
  <div style="min-height:100vh; display:flex; flex-direction:column;">
    <n-layout-header bordered style="position:sticky; top:0; z-index:10; backdrop-filter:blur(8px);">
      <div style="max-width:1100px; margin:0 auto; height:56px; display:flex; align-items:center; gap:18px; padding:0 16px;">
        <router-link to="/" style="font-size:20px; font-weight:700; color:inherit; text-decoration:none; white-space:nowrap;">
          {{ site.info?.siteName || '博客' }}
        </router-link>
        <n-dropdown v-if="site.info?.categories.length" :options="categoryOptions" @select="onCategorySelect">
          <span style="cursor:pointer; color:var(--n-text-color-2);">分类</span>
        </n-dropdown>
        <n-dropdown v-if="site.info" :options="tagOptions" @select="onTagSelect">
          <span style="cursor:pointer; color:var(--n-text-color-2);">标签</span>
        </n-dropdown>
        <div style="flex:1;"></div>
        <n-input v-model:value="search" placeholder="搜索文章" clearable style="width:200px;" @keyup.enter="doSearch" />
        <n-switch :value="app.dark" @update:value="app.toggleDark">
          <template #checked>暗</template>
          <template #unchecked>亮</template>
        </n-switch>
        <template v-if="auth.isAuthed">
          <n-dropdown :options="userMenuOptions" @select="onUserSelect">
            <n-tag round :bordered="false" style="cursor:pointer;">{{ auth.user?.nickname }}</n-tag>
          </n-dropdown>
        </template>
        <template v-else>
          <n-button quaternary size="small" @click="router.push('/login')">登录</n-button>
          <n-button type="primary" size="small" @click="router.push('/register')">注册</n-button>
        </template>
      </div>
    </n-layout-header>
    <n-layout-content style="flex:1;">
      <router-view />
    </n-layout-content>
    <n-layout-footer bordered>
      <div style="max-width:1100px; margin:0 auto; padding:20px 16px; text-align:center; color:var(--n-text-color-3); font-size:13px;">
        © {{ new Date().getFullYear() }} {{ site.info?.siteName || '' }}
        <template v-if="site.info?.icp"><span style="margin:0 8px;">|</span>{{ site.info.icp }}</template>
      </div>
    </n-layout-footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { useAppStore } from '../stores/app.js';
import { useAuthStore } from '../stores/auth.js';
import { useSiteStore } from '../stores/site.js';

const app = useAppStore();
const auth = useAuthStore();
const site = useSiteStore();
const router = useRouter();
const message = useMessage();
const search = ref('');

const categoryOptions = computed(() =>
  (site.info?.categories ?? []).map((c) => ({ label: `${c.name}（${c.postCount ?? 0}）`, value: String(c.id) })),
);
const tagOptions = computed(() => {
  const tags = (site.info?.categories as unknown as { tags?: { name: string; slug: string }[] })?.tags ?? [];
  return tags.map((t) => ({ label: t.name, value: t.slug }));
});

function onCategorySelect(key: string) {
  router.push({ path: '/', query: { category: key } });
}
function onTagSelect(key: string) {
  router.push({ path: '/', query: { tag: key } });
}
function doSearch() {
  const q = search.value.trim();
  router.push(q ? { path: '/', query: { q } } : { path: '/' });
}

const userMenuOptions = [
  { label: '个人中心', key: 'profile' },
  { label: '退出登录', key: 'logout' },
];
async function onUserSelect(key: string) {
  if (key === 'profile') {
    router.push('/profile');
  } else if (key === 'logout') {
    await auth.logout();
    message.success('已退出登录');
    router.push('/');
  }
}

onMounted(async () => {
  await site.load();
  await auth.fetchMe();
});
</script>
