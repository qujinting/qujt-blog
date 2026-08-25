<template>
  <n-card title="文章管理">
    <n-space style="margin-bottom:12px;">
      <n-select v-model:value="status" :options="statusOptions" style="width:120px" @update:value="load(1)" />
      <n-input v-model:value="q" placeholder="搜索标题" style="width:200px" clearable @keyup.enter="load(1)" @clear="load(1)" />
      <n-button type="primary" @click="router.push('/posts/new')">写文章</n-button>
    </n-space>
    <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" :pagination="pagination" />
  </n-card>
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NTag, useDialog, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import dayjs from 'dayjs';
import { postsApi } from '../api/index.js';
import type { AdminPostDTO } from '../types.js';

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const items = ref<AdminPostDTO[]>([]);
const loading = ref(false);
const status = ref('');
const q = ref('');
const statusOptions = [
  { label: '全部', value: '' },
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' },
  { label: '定时', value: 'scheduled' },
];
const pagination = reactive({ page: 1, pageSize: 15, itemCount: 0 });

async function load(page = pagination.page) {
  loading.value = true;
  try {
    const res = await postsApi.list({ page, pageSize: pagination.pageSize, status: status.value || undefined, q: q.value || undefined });
    items.value = res.items;
    pagination.itemCount = res.total;
    pagination.page = page;
  } finally {
    loading.value = false;
  }
}

const visTag = (v: string) =>
  v === 'public' ? h(NTag, { size: 'small' }, { default: () => '公开' })
    : v === 'login' ? h(NTag, { type: 'info', size: 'small' }, { default: () => '登录' })
    : v === 'password' ? h(NTag, { type: 'warning', size: 'small' }, { default: () => '密码' })
    : h(NTag, { type: 'error', size: 'small' }, { default: () => '私密' });

const statusTag = (s: string) =>
  s === 'published' ? h(NTag, { type: 'success', size: 'small' }, { default: () => '已发布' })
    : s === 'scheduled' ? h(NTag, { type: 'warning', size: 'small' }, { default: () => '定时' })
    : h(NTag, { size: 'small' }, { default: () => '草稿' });

async function publish(row: AdminPostDTO) {
  try {
    await postsApi.publish(row.id);
    message.success('已发布');
    await load();
  } catch (e) { message.error((e as Error).message); }
}
async function unpublish(row: AdminPostDTO) {
  try {
    await postsApi.unpublish(row.id);
    message.success('已下线');
    await load();
  } catch (e) { message.error((e as Error).message); }
}
function remove(row: AdminPostDTO) {
  dialog.warning({
    title: '删除文章',
    content: `确定删除「${row.title}」？该操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await postsApi.remove(row.id);
        message.success('已删除');
        await load();
      } catch (e) { message.error((e as Error).message); }
    },
  });
}

const columns: DataTableColumns<AdminPostDTO> = [
  { title: '标题', key: 'title', ellipsis: true },
  { title: '分类', key: 'category', width: 100, render: (row) => row.category?.name ?? '-' },
  { title: '标签', key: 'tags', width: 130, render: (row) => row.tags.map((t) => t.name).join(', ') || '-' },
  { title: '状态', key: 'status', width: 80, render: (row) => statusTag(row.status) },
  { title: '可见性', key: 'visibility', width: 80, render: (row) => visTag(row.visibility) },
  { title: '浏览', key: 'viewCount', width: 70 },
  { title: '更新时间', key: 'updatedAt', width: 150, render: (row) => dayjs(row.updatedAt).format('YYYY-MM-DD HH:mm') },
  {
    title: '操作', key: 'actions', width: 180,
    render: (row) => h('span', { style: 'display:flex;gap:8px;' }, [
      h('a', { href: 'javascript:void(0)', onClick: () => router.push('/posts/' + row.id + '/edit') }, '编辑'),
      row.status === 'published'
        ? h('a', { href: 'javascript:void(0)', onClick: () => unpublish(row) }, '下线')
        : h('a', { href: 'javascript:void(0)', onClick: () => publish(row) }, '发布'),
      h('a', { href: 'javascript:void(0)', style: 'color:#e88080', onClick: () => remove(row) }, '删除'),
    ]),
  },
];

onMounted(() => load(1));
</script>
