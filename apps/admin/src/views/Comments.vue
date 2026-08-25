<template>
  <n-card title="评论管理">
    <n-space style="margin-bottom:12px;">
      <n-tabs v-model:value="status" type="line" @update:value="load(1)">
        <n-tab-pane name="pending" tab="待审核" />
        <n-tab-pane name="approved" tab="已通过" />
        <n-tab-pane name="spam" tab="垃圾" />
        <n-tab-pane name="deleted" tab="已删除" />
        <n-tab-pane name="all" tab="全部" />
      </n-tabs>
      <n-input v-model:value="q" placeholder="搜索内容/用户/文章" style="width:220px;" clearable @keyup.enter="load(1)" @clear="load(1)" />
    </n-space>
    <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" :pagination="pagination" />
  </n-card>
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import { useMessage } from 'naive-ui';
import { NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import dayjs from 'dayjs';
import { adminCommentsApi } from '../api/index.js';
import type { AdminCommentDTO } from '../types.js';

const message = useMessage();
const items = ref<AdminCommentDTO[]>([]);
const loading = ref(false);
const status = ref('pending');
const q = ref('');
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 });

async function load(page = pagination.page) {
  loading.value = true;
  try {
    const res = await adminCommentsApi.list({
      page,
      pageSize: pagination.pageSize,
      status: status.value === 'all' ? undefined : status.value,
      q: q.value || undefined,
    });
    items.value = res.items;
    pagination.itemCount = res.total;
    pagination.page = page;
  } finally {
    loading.value = false;
  }
}

async function setStatus(row: AdminCommentDTO, next: 'approved' | 'spam' | 'deleted') {
  try {
    await adminCommentsApi.setStatus(row.id, next);
    message.success('已更新');
    await load();
  } catch (e) {
    message.error((e as Error).message);
  }
}

const statusTag = (s: string) =>
  s === 'pending' ? h(NTag, { type: 'warning', size: 'small' }, { default: () => '待审核' })
    : s === 'approved' ? h(NTag, { type: 'success', size: 'small' }, { default: () => '已通过' })
    : s === 'spam' ? h(NTag, { type: 'error', size: 'small' }, { default: () => '垃圾' })
    : h(NTag, { size: 'small' }, { default: () => '已删除' });

const columns: DataTableColumns<AdminCommentDTO> = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '文章', key: 'postTitle', ellipsis: true },
  { title: '用户', key: 'user', width: 110, render: (row) => row.user.nickname },
  { title: '内容', key: 'content', ellipsis: true },
  { title: '状态', key: 'status', width: 90, render: (row) => statusTag(row.status) },
  { title: 'IP', key: 'ip', width: 120 },
  { title: '时间', key: 'createdAt', width: 150, render: (row) => dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') },
  {
    title: '操作', key: 'actions', width: 150,
    render: (row) =>
      h('span', { style: 'display:flex; gap:8px;' }, [
        row.status !== 'approved' ? h('a', { href: 'javascript:void(0)', onClick: () => setStatus(row, 'approved') }, '通过') : null,
        row.status !== 'spam' ? h('a', { href: 'javascript:void(0)', onClick: () => setStatus(row, 'spam') }, '垃圾') : null,
        row.status !== 'deleted' ? h('a', { href: 'javascript:void(0)', style: 'color:#e88080', onClick: () => setStatus(row, 'deleted') }, '删除') : null,
      ]),
  },
];

onMounted(() => load(1));
</script>
