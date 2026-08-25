<template>
  <n-card title="分类管理">
    <n-space style="margin-bottom:12px;" align="center">
      <n-input v-model:value="form.name" placeholder="分类名" style="width:180px" />
      <n-input v-model:value="form.slug" placeholder="slug（可选）" style="width:160px" />
      <n-input-number v-model:value="form.sort" :min="0" placeholder="排序" style="width:110px" />
      <n-button type="primary" @click="create">新增分类</n-button>
    </n-space>
    <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" :pagination="false" />
    <n-modal v-model:show="editShow" preset="card" title="编辑分类" style="width:420px;">
      <n-form :model="editForm" label-placement="left">
        <n-form-item label="名称"><n-input v-model:value="editForm.name" /></n-form-item>
        <n-form-item label="slug"><n-input v-model:value="editForm.slug" /></n-form-item>
        <n-form-item label="排序"><n-input-number v-model:value="editForm.sort" :min="0" style="width:100%" /></n-form-item>
        <n-form-item label="描述"><n-input v-model:value="editForm.description" type="textarea" /></n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="editShow = false">取消</n-button>
          <n-button type="primary" @click="saveEdit">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import type { CategoryDTO } from '@qujt/shared';
import { taxonomyApi } from '../api/index.js';

const message = useMessage();
const dialog = useDialog();
const items = ref<CategoryDTO[]>([]);
const loading = ref(false);
const form = reactive({ name: '', slug: '', sort: 0 });
const editShow = ref(false);
const editForm = reactive({ id: 0, name: '', slug: '', sort: 0, description: '' });

async function load() {
  loading.value = true;
  try {
    items.value = (await taxonomyApi.categories()).items;
  } finally {
    loading.value = false;
  }
}

async function create() {
  if (!form.name.trim()) return message.warning('请输入分类名');
  try {
    await taxonomyApi.createCategory({ name: form.name.trim(), slug: form.slug || undefined, sort: form.sort });
    message.success('已创建');
    form.name = ''; form.slug = '';
    await load();
  } catch (e) {
    message.error((e as Error).message);
  }
}

function openEdit(row: CategoryDTO) {
  Object.assign(editForm, { id: row.id, name: row.name, slug: row.slug, sort: row.sort, description: row.description ?? '' });
  editShow.value = true;
}

async function saveEdit() {
  try {
    await taxonomyApi.updateCategory(editForm.id, { name: editForm.name, slug: editForm.slug, sort: editForm.sort, description: editForm.description });
    editShow.value = false;
    message.success('已保存');
    await load();
  } catch (e) {
    message.error((e as Error).message);
  }
}

function remove(row: CategoryDTO) {
  dialog.warning({
    title: '删除分类',
    content: `确定删除分类「${row.name}」？文章将变为未分类。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await taxonomyApi.deleteCategory(row.id);
        message.success('已删除');
        await load();
      } catch (e) {
        message.error((e as Error).message);
      }
    },
  });
}

const columns: DataTableColumns<CategoryDTO> = [
  { title: '名称', key: 'name' },
  { title: 'slug', key: 'slug' },
  { title: '文章数', key: 'postCount', width: 90 },
  { title: '排序', key: 'sort', width: 80 },
  {
    title: '操作', key: 'actions', width: 140,
    render: (row) => h('span', { style: 'display:flex;gap:8px;' }, [
      h('a', { href: 'javascript:void(0)', onClick: () => openEdit(row) }, '编辑'),
      h('a', { href: 'javascript:void(0)', style: 'color:#e88080', onClick: () => remove(row) }, '删除'),
    ]),
  },
];

onMounted(load);
</script>
