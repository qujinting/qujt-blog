<template>
  <div style="max-width:1100px; margin:0 auto; padding:20px 16px;">
    <n-space style="margin-bottom:16px;" align="center">
      <n-select v-model:value="filterCategory" :options="categoryOptions" clearable placeholder="全部分类" style="width:160px;" @update:value="applyFilters" />
      <n-input v-model:value="filterQ" placeholder="搜索文章标题/内容" clearable style="width:220px;" @keyup.enter="applyFilters" />
      <n-tag v-if="activeTagName" closable size="small" type="info" @close="clearTag">标签：{{ activeTagName }}</n-tag>
      <span v-if="total > 0" style="color:var(--n-text-color-3); font-size:13px;">共 {{ total }} 篇</span>
    </n-space>

    <div v-if="loading">
      <n-skeleton v-for="i in 4" :key="i" height="100px" style="margin-bottom:14px;" />
    </div>
    <template v-else>
      <PostCard v-for="p in items" :key="p.id" :post="p" />
      <n-empty v-if="items.length === 0" description="暂无文章" style="margin-top:60px;" />
    </template>

    <n-pagination v-if="total > pageSize" v-model:page="page" :item-count="total" :page-size="pageSize" style="justify-content:center; margin-top:24px;" @update:page="onPage" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { PostSummaryDTO } from '@qujt/shared';
import { postsApi, taxonomyApi } from '../api/index.js';
import { useSiteStore } from '../stores/site.js';
import PostCard from '../components/PostCard.vue';

const route = useRoute();
const router = useRouter();
const site = useSiteStore();
const items = ref<PostSummaryDTO[]>([]);
const total = ref(0);
const loading = ref(false);
const pageSize = 10;
const page = ref(1);
const filterCategory = ref<string | null>(null);
const filterQ = ref('');
const activeTag = ref<string | null>(null);
const tagNames = ref<Record<string, string>>({});

const categoryOptions = computed(() =>
  (site.info?.categories ?? []).map((c) => ({ label: c.name, value: String(c.id) })),
);
const activeTagName = computed(() => (activeTag.value ? tagNames.value[activeTag.value] ?? activeTag.value : ''));

async function load() {
  loading.value = true;
  try {
    const res = await postsApi.list({
      page: page.value,
      pageSize,
      category: filterCategory.value ?? undefined,
      tag: activeTag.value ?? undefined,
      q: filterQ.value || undefined,
    });
    items.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function syncFromRoute() {
  const q = route.query;
  filterCategory.value = typeof q.category === 'string' ? q.category : null;
  filterQ.value = typeof q.q === 'string' ? q.q : '';
  activeTag.value = typeof q.tag === 'string' ? q.tag : null;
  page.value = Math.max(Number(q.page) || 1, 1);
}

function applyFilters() {
  const query: Record<string, string> = {};
  if (filterCategory.value) query.category = filterCategory.value;
  if (filterQ.value.trim()) query.q = filterQ.value.trim();
  if (activeTag.value) query.tag = activeTag.value;
  if (page.value > 1) query.page = String(page.value);
  router.push({ path: '/', query });
}

function onPage(p: number) {
  page.value = p;
  const query = { ...route.query, page: p > 1 ? String(p) : undefined };
  router.push({ path: '/', query });
}

function clearTag() {
  activeTag.value = null;
  applyFilters();
}

onMounted(async () => {
  await Promise.all([site.load(), taxonomyApi.tags()]);
  tagNames.value = Object.fromEntries(((await taxonomyApi.tags()).items).map((t) => [t.slug, t.name]));
  syncFromRoute();
  await load();
});

watch(() => route.query, () => {
  syncFromRoute();
  load();
});
</script>
