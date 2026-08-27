<template>
  <n-card title="用户管理">
    <n-space style="margin-bottom:12px;">
      <n-input v-model:value="q" placeholder="搜索用户名/邮箱/昵称" style="width:240px" clearable @keyup.enter="load(1)" @clear="load(1)" />
      <n-button @click="load(1)">搜索</n-button>
    </n-space>
    <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" :pagination="pagination" />

    <n-modal v-model:show="showReset" preset="card" title="重置密码" style="width:420px;">
      <n-form>
        <n-form-item label="用户"><n-input :value="resetTarget?.username || ''" disabled /></n-form-item>
        <n-form-item label="新密码"><n-input v-model:value="resetPassword" type="password" show-password-on="click" placeholder="至少 8 位" /></n-form-item>
        <n-form-item label="确认新密码"><n-input v-model:value="resetPassword2" type="password" show-password-on="click" placeholder="再次输入" /></n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showReset = false">取消</n-button>
          <n-button type="primary" :loading="resetLoading" @click="confirmReset">确定</n-button>
        </n-space>
      </template>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import { NTag, NDropdown, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import dayjs from 'dayjs';
import { usersApi } from '../api/index.js';
import type { UserListRow } from '../types.js';

const message = useMessage();
const items = ref<UserListRow[]>([]);
const loading = ref(false);
const q = ref('');
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 });

const showReset = ref(false);
const resetTarget = ref<UserListRow | null>(null);
const resetPassword = ref('');
const resetPassword2 = ref('');
const resetLoading = ref(false);

async function load(page = pagination.page) {
  loading.value = true;
  try {
    const res = await usersApi.list({ page, pageSize: pagination.pageSize, q: q.value || undefined });
    items.value = res.items;
    pagination.itemCount = res.total;
    pagination.page = page;
  } finally {
    loading.value = false;
  }
}

const actionOptions = [
  { label: '设为作者', key: 'author' },
  { label: '设为管理员', key: 'admin' },
  { label: '设为普通用户', key: 'user' },
  { type: 'divider', key: 'd1' },
  { label: '禁用账号', key: 'disabled' },
  { label: '启用账号', key: 'active' },
  { type: 'divider', key: 'd2' },
  { label: '重置密码', key: 'reset-password' },
];

async function onAction(key: string, row: UserListRow) {
  try {
    if (key === 'reset-password') {
      resetTarget.value = row;
      resetPassword.value = '';
      resetPassword2.value = '';
      showReset.value = true;
      return;
    }
    if (key === 'author' || key === 'admin' || key === 'user') {
      await usersApi.update(row.id, { role: key });
      message.success('已更新角色');
    } else {
      await usersApi.update(row.id, { status: key });
      message.success('已更新状态');
    }
    await load();
  } catch (e) {
    message.error((e as Error).message);
  }
}

async function confirmReset() {
  if (!resetTarget.value) return;
  if (resetPassword.value.length < 8) {
    message.warning('新密码至少 8 位');
    return;
  }
  if (resetPassword.value !== resetPassword2.value) {
    message.warning('两次输入的密码不一致');
    return;
  }
  resetLoading.value = true;
  try {
    await usersApi.resetPassword(resetTarget.value.id, resetPassword.value);
    message.success(`已重置 ${resetTarget.value.username} 的密码`);
    showReset.value = false;
    await load();
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    resetLoading.value = false;
  }
}

const columns: DataTableColumns<UserListRow> = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '用户名', key: 'username' },
  { title: '昵称', key: 'nickname' },
  { title: '邮箱', key: 'email', ellipsis: true },
  {
    title: '角色', key: 'role', width: 90,
    render: (row) => h(NTag, { type: row.role === 'admin' ? 'error' : row.role === 'author' ? 'warning' : 'default', size: 'small' }, { default: () => ({ admin: '管理员', author: '作者', user: '用户' })[row.role] }),
  },
  {
    title: '状态', key: 'status', width: 80,
    render: (row) => h(NTag, { type: row.status === 'active' ? 'success' : 'default', size: 'small' }, { default: () => (row.status === 'active' ? '正常' : '禁用') }),
  },
  { title: '邀请人', key: 'invited_by_username', width: 110 },
  { title: '邀请码', key: 'invite_code', width: 130 },
  { title: '注册时间', key: 'created_at', width: 150, render: (row) => dayjs(row.created_at).format('YYYY-MM-DD HH:mm') },
  {
    title: '操作', key: 'actions', width: 90,
    render: (row) => h(NDropdown, { options: actionOptions, onSelect: (k) => onAction(k as string, row) }, { default: () => h('a', { href: 'javascript:void(0)' }, '操作') }),
  },
];

onMounted(() => load(1));
</script>
