<template>
  <n-card title="标签管理">
    <n-space style="margin-bottom:12px;" align="center">
      <n-input v-model:value="form.name" placeholder="标签名" style="width:200px" @keyup.enter="create" />
      <n-button type="primary" @click="create">新增标签</n-button>
    </n-space>
    <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" />
  </n-card>
</template>

<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import type { TagDTO } from '@qujt/shared';
import { taxonomyApi } from '../api/index.js';

const message = useMessage();
const dialog = useDialog();
const items = ref<TagDTO[]>([]);
const loading = ref(false);
const form = ref({ name: '' });

async function load() {
  loading.value = true;
  try {
    items.value = (await taxonomyApi.tags()).items;
  } finally {
    loading.value = false;
  }
}

async function create() {
  const name = form.value.name.trim();
  if (!name) return message.warning('请输入标签名');
  try {
    await taxonomyApi.createTag({ name });
    message.success('已创建');
    form.value.name = '';
    await load();
  } catch (e) {
    message.error((e as Error).message);
  }
}

function remove(row: TagDTO) {
  dialog.warning({
    title: '删除标签',
    content: `确定删除标签「${row.name}」？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await taxonomyApi.deleteTag(row.id);
        message.success('已删除');
        await load();
      } catch (e) {
        message.error((e as Error).message);
      }
    },
  });
}

const columns: DataTableColumns<TagDTO> = [
  { title: '名称', key: 'name' },
  { title: 'slug', key: 'slug' },
  { title: '文章数', key: 'postCount', width: 90 },
  {
    title: '操作', key: 'actions', width: 90,
    render: (row) => h('a', { href: 'javascript:void(0)', style: 'color:#e88080', onClick: () => remove(row) }, '删除'),
  },
];

onMounted(load);
</script>
