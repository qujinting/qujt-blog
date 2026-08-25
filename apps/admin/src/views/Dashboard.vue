<template>
  <div>
    <n-grid :cols="4" x-gap="12" y-gap="12" responsive="screen" item-responsive>
      <n-grid-item span="4 m:2 l:1"><n-card><n-statistic label="文章总数" :value="stats?.posts.total ?? 0" /></n-card></n-grid-item>
      <n-grid-item span="4 m:2 l:1"><n-card><n-statistic label="已发布" :value="stats?.posts.published ?? 0" /></n-card></n-grid-item>
      <n-grid-item span="4 m:2 l:1"><n-card><n-statistic label="草稿" :value="stats?.posts.drafts ?? 0" /></n-card></n-grid-item>
      <n-grid-item span="4 m:2 l:1"><n-card><n-statistic label="待审评论" :value="stats?.comments.pending ?? 0" /></n-card></n-grid-item>
      <n-grid-item span="4 m:2 l:1"><n-card><n-statistic label="用户" :value="stats?.users ?? 0" /></n-card></n-grid-item>
      <n-grid-item span="4 m:2 l:1"><n-card><n-statistic label="今日浏览" :value="stats?.views.today ?? 0" /></n-card></n-grid-item>
      <n-grid-item span="4 m:2 l:1"><n-card><n-statistic label="媒体" :value="stats?.media ?? 0" /></n-card></n-grid-item>
      <n-grid-item span="4 m:2 l:1"><n-card><n-statistic label="未用邀请码" :value="stats?.inviteCodes.unused ?? 0" /></n-card></n-grid-item>
    </n-grid>
    <n-card title="最近文章" style="margin-top:12px;">
      <n-data-table :columns="columns" :data="stats?.recentPosts ?? []" :bordered="false" :loading="loading" />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import dayjs from 'dayjs';
import { statsApi } from '../api/index.js';
import type { Stats } from '../types.js';

const router = useRouter();
const stats = ref<Stats | null>(null);
const loading = ref(false);

const statusTag = (s: string) =>
  s === 'published' ? h(NTag, { type: 'success', size: 'small' }, { default: () => '已发布' })
    : s === 'scheduled' ? h(NTag, { type: 'warning', size: 'small' }, { default: () => '定时' })
    : h(NTag, { size: 'small' }, { default: () => '草稿' });

interface RecentPostRow { id: number; title: string; status: string; visibility: string; view_count: number; updated_at: string; }

const columns: DataTableColumns<RecentPostRow> = [
  { title: '标题', key: 'title', ellipsis: true },
  { title: '状态', key: 'status', width: 90, render: (row: RecentPostRow) => statusTag(row.status) },
  { title: '浏览', key: 'view_count', width: 80 },
  { title: '更新时间', key: 'updated_at', width: 170, render: (row: RecentPostRow) => dayjs(row.updated_at).format('YYYY-MM-DD HH:mm') },
];

async function load() {
  loading.value = true;
  try {
    stats.value = await statsApi.get();
  } catch (e) {
    // handled by interceptor
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>