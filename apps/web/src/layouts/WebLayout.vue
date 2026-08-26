<template>
  <div style="min-height:100vh; display:flex; flex-direction:column;">
    <header class="qj-header">
      <div class="qj-header-inner">
        <router-link to="/" class="qj-logo">
          <span class="qj-logo-mark">{{ logoLetter }}</span>
          <span>{{ site.info?.siteName || '博客' }}</span>
        </router-link>
        <n-dropdown v-if="site.info?.categories.length" :options="categoryOptions" @select="onCategorySelect">
          <span class="qj-nav-link">分类</span>
        </n-dropdown>
        <n-dropdown v-if="tagSlugs.length" :options="tagOptions" @select="onTagSelect">
          <span class="qj-nav-link">标签</span>
        </n-dropdown>
        <div style="flex:1;"></div>
        <div style="display:flex; gap:12px; align-items:center;">
          <n-input v-model:value="search" placeholder="搜索…" clearable style="width:190px;" :round="true" @keyup.enter="doSearch">
            <template #prefix><span style="font-size:15px;">🔍</span></template>
          </n-input>
          <n-switch :value="app.dark" @update:value="app.toggleDark">
            <template #checked>🌙</template>
            <template #unchecked>☀️</template>
          </n-switch>
          <template v-if="auth.isAuthed">
            <n-dropdown :options="userMenuOptions" @select="onUserSelect">
              <span class="qj-logo-mark" style="width:32px;height:32px;border-radius:999px;cursor:pointer;">{{ auth.user?.nickname?.slice(0,1) || 'U' }}</span>
            </n-dropdown>
          </template>
          <template v-else>
            <router-link to="/login" class="qj-nav-link">登录</router-link>
            <n-button type="primary" size="small" round @click="router.push('/register')">注册</n-button>
          </template>
        </div>
      </div>
    </header>
    <main style="flex:1;">
      <router-view />
    </main>
    <footer class="qj-footer">
      <div class="qj-footer-inner">
        <div style="font-weight:600; color:var(--qj-text); margin-bottom:6px;">{{ site.info?.siteName || '博客' }}</div>
        <div v-if="site.info?.siteDescription">{{ site.info.siteDescription }}</div>
        <div>© {{ new Date().getFullYear() }} <template v-if="site.info?.icp"> · {{ site.info.icp }}</template></div>
      </div>
    </footer>
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

const logoLetter = computed(() => (site.info?.siteName || 'B').slice(0, 1).toUpperCase());

const categoryOptions = computed(() =>
  (site.info?.categories ?? []).map((c) => ({ label: `${c.name}（${c.postCount ?? 0}）`, value: String(c.id) })),
);
const tagSlugs = computed(() => (site.info as unknown as { tags?: { name: string; slug: string }[] })?.tags ?? []);
const tagOptions = computed(() => tagSlugs.value.map((t) => ({ label: t.name, value: t.slug })));

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
  if (key === 'profile') router.push('/profile');
  else if (key === 'logout') {
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
