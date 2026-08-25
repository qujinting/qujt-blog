<template>
  <n-card title="站点设置">
    <n-form :model="form" label-placement="left" label-width="120">
      <n-form-item label="站点名称"><n-input v-model:value="form.siteName" /></n-form-item>
      <n-form-item label="站点描述"><n-input v-model:value="form.siteDescription" type="textarea" /></n-form-item>
      <n-form-item label="ICP 备案号"><n-input v-model:value="form.icp" placeholder="如：京ICP备xxxxxxxx号" /></n-form-item>
      <n-form-item label="注册模式">
        <n-select v-model:value="form.registrationMode" :options="[
          { label: '关闭注册（仅后台建号）', value: 'closed' },
          { label: '邀请码注册（当前）', value: 'invite' },
          { label: '完全开放注册', value: 'open' },
        ]" style="max-width:300px;" />
      </n-form-item>
      <n-form-item label="评论需审核">
        <n-switch v-model:value="form.commentModeration" />
      </n-form-item>
      <n-form-item label="OSS 配置">
        <n-tag :type="ossConfigured ? 'success' : 'warning'">{{ ossConfigured ? '已配置' : '未配置（需设置 .env 中的 OSS_* 后重启）' }}</n-tag>
      </n-form-item>
      <n-form-item>
        <n-button type="primary" :loading="saving" @click="save">保存设置</n-button>
      </n-form-item>
    </n-form>
  </n-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useMessage } from 'naive-ui';
import { settingsApi } from '../api/index.js';
import type { Settings } from '../types.js';

const message = useMessage();
const saving = ref(false);
const ossConfigured = ref(false);
const form = reactive<Settings>({ siteName: '', siteDescription: '', icp: '', registrationMode: 'invite', commentModeration: true });

async function load() {
  try {
    const res = await settingsApi.get();
    Object.assign(form, res.settings);
    ossConfigured.value = res.ossConfigured;
  } catch (e) {
    message.error((e as Error).message);
  }
}

async function save() {
  saving.value = true;
  try {
    const res = await settingsApi.update(form);
    Object.assign(form, res.settings);
    message.success('已保存');
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
