<template>
  <n-card title="邀请码管理">
    <n-space style="margin-bottom:12px;" align="center">
      <n-input-number v-model:value="form.count" :min="1" :max="100" placeholder="数量" style="width:100px" />
      <n-input v-model:value="form.prefix" placeholder="前缀（可选）" style="width:120px" />
      <n-input-number v-model:value="form.maxUses" :min="0" placeholder="次数(0=不限)" style="width:150px" />
      <n-date-picker v-model:value="form.expiresAtTs" type="datetime" clearable style="width:200px" />
      <n-input v-model:value="form.note" placeholder="备注（发给谁/渠道）" style="width:200px" />
      <n-button type="primary" :loading="creating" @click="generate">生成</n-button>
    </n-space>
    <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" :pagination="pagination" />
    <n-modal v-model:show="resultShow" preset="card" title="生成成功，请复制保存（仅显示一次）" style="width:520px;">
      <div style="max-height:400px; overflow:auto;">
        <n-space vertical>
          <div v-for="c in generatedCodes" :key="c" style="display:flex; align-items:center; gap:8px;">
            <n-text code>{{ c }}</n-text>
            <n-button size="tiny" @click="copyCode(c)">复制</n-button>
          </div>
        </n-space>
      </div>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import { NTag, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import dayjs from 'dayjs';
import { invitesApi } from '../api/index.js';
import type { InviteCodeDTO } from '@qujt/shared';

const message = useMessage();
const items = ref<InviteCodeDTO[]>([]);
const loading = ref(false);
const creating = ref(false);
const resultShow = ref(false);
const generatedCodes = ref<string[]>([]);
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 });
const form = reactive({ count: 5, prefix: '', maxUses: 1, expiresAtTs: null as number | null, note: '' });

async function load(page = pagination.page) {
  loading.value = true;
  try {
    const res = await invitesApi.list({ page, pageSize: pagination.pageSize });
    items.value = res.items;
    pagination.itemCount = res.total;
    pagination.page = page;
  } finally {
    loading.value = false;
  }
}

async function generate() {
  creating.value = true;
  try {
    const res = await invitesApi.create({
      count: form.count || 1,
      prefix: form.prefix || undefined,
      maxUses: form.maxUses ?? 1,
      expiresAt: form.expiresAtTs ? new Date(form.expiresAtTs).toISOString() : null,
      note: form.note || undefined,
    });
    generatedCodes.value = res.items.map((i) => i.code);
    resultShow.value = true;
    message.success(`已生成 ${res.count} 个邀请码`);
    await load(1);
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    creating.value = false;
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    message.success('已复制');
  } catch {
    message.error('复制失败，请手动选择');
  }
}

async function toggle(row: InviteCodeDTO) {
  try {
    await invitesApi.setStatus(row.id, row.status === 'active' ? 'disabled' : 'active');
    await load();
  } catch (e) {
    message.error((e as Error).message);
  }
}

const columns: DataTableColumns<InviteCodeDTO> = [
  { title: '邀请码', key: 'code', width: 180, render: (row) => h('span', { style: 'font-family:monospace;' }, row.code) },
  { title: '备注', key: 'note' },
  { title: '上限/已用', key: 'used', width: 90, render: (row) => `${row.maxUses === 0 ? '不限' : row.maxUses}/${row.usedCount}` },
  { title: '有效期', key: 'expiresAt', width: 150, render: (row) => (row.expiresAt ? dayjs(row.expiresAt).format('YYYY-MM-DD HH:mm') : '永久') },
  {
    title: '状态', key: 'status', width: 80,
    render: (row) => h(NTag, { type: row.status === 'active' ? 'success' : 'default', size: 'small' }, { default: () => (row.status === 'active' ? '启用' : '停用') }),
  },
  { title: '创建时间', key: 'createdAt', width: 150, render: (row) => dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') },
  {
    title: '操作', key: 'actions', width: 80,
    render: (row) => h('a', { href: 'javascript:void(0)', onClick: () => toggle(row) }, row.status === 'active' ? '停用' : '启用'),
  },
];

onMounted(() => load(1));
</script>
