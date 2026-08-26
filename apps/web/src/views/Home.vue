<template>
  <div style="max-width:1100px; margin:0 auto; padding:24px 20px;">
    <!-- 精选 Hero（最新公开文章，非筛选态才显示） -->
    <div v-if="featured && !isFiltered" class="qj-hero" @click="router.push('/post/' + featured.slug)">
      <div class="qj-hero-bg" :style="featured.coverImage ? { backgroundImage: 'url(' + featured.coverImage + ')' } : {}"></div>
      <div class="qj-hero-overlay">
        <div class="hero-meta">
          <span style="background:rgba(255,255,255,0.92); color:#4f46e5; padding:1px 10px; border-radius:999px; font-weight:600;">精选</span>
          <span v-if="featured.category">{{ featured.category.name }}</span>
          <span>{{ dayjs(featured.publishAt ?? featured.createdAt).format('YYYY-MM-DD') }}</span>
          <span>{{ featured.viewCount }} 阅读</span>
        </div>
        <h1 class="qj-hero-title">{{ featured.title }}</h1>
        <p class="qj-hero-summary">{{ featured.summary }}</p>
      </div>
    </div>

    <!-- 筛选工具栏 -->
    <div class="qj-toolbar">
      <n-select v-model:value="filterCategory" :options="categoryOptions" clearable placeholder="全部分类" @update:value="applyFilters" />
      <n-input v-model:value="filterQ" placeholder="搜索文章标题/内容" clearable style="width:230px;" @keyup.enter="applyFilters" :round="true" />
      <n-tag v-if="activeTagName" closable size="small" type="info" @close="clearTag">标签：{{ activeTagName }}</n-tag>
      <span v-if="total > 0" style="color:var(--qj-text-3); font-size:13px; margin-left:auto;">共 {{ total }} 篇</span>
    </div>

    <!-- 文章网格 -->
    <div v-if="loading">
      <n-skeleton v-for="i in 2" :key="i" height="180px" style="margin-bottom:16px;" />
    </div>
    <div v-else-if="gridItems.length" class="qj-grid">
      <PostCard v-for="p in gridItems" :key="p.id" :post="p" />
    </div>
    <div v-else-if="!featured" class="qj-empty">
      <div class="big">🌱</div>
      <div>暂无文章，去后台写第一篇吧</div>
    </div>

    <n-pagination v-if="total > pageSize" v-model:page="page" :item-count="total" :page-size="pageSize" style="justify-content:center; margin-top:28px;" @update:page="onPage" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import dayjs from 'dayjs';
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
const isFiltered = computed(() => !!filterCategory.value || !!activeTag.value || !!filterQ.value.trim());
const featured = computed(() => (items.value.length ? items.value[0] : null));
const gridItems = computed(() => (featured.value && !isFiltered.value ? items.value.slice(1) : items.value));

async function load() {
  loading.value = true;
  try {
    const res = await postsApi.list({
      page: page.value,
      pageSize: pageSize + 1, // 多取一条用于判断是否还有下一页 + 精选
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