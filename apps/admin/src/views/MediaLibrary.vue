<template>
  <n-card title="媒体库">
    <n-upload :show-file-list="false" accept="image/*" :custom-request="uploadRequest">
      <n-button type="primary">上传图片</n-button>
    </n-upload>
    <n-grid :cols="4" x-gap="12" y-gap="12" style="margin-top:12px;" responsive="screen" item-responsive>
      <n-grid-item v-for="m in items" :key="m.id" span="4 m:2 l:1">
        <n-card size="small" :title="m.fileName" style="height:100%;">
          <div style="height:130px; display:flex; align-items:center; justify-content:center; background:#fafafa;">
            <n-image :src="m.url" width="100%" object-fit="contain" style="max-height:130px;" />
          </div>
          <div style="margin-top:8px; display:flex; gap:8px;">
            <n-button size="tiny" @click="copyUrl(m)">复制链接</n-button>
            <n-button size="tiny" type="error" @click="remove(m)">删除</n-button>
          </div>
        </n-card>
      </n-grid-item>
    </n-grid>
    <n-empty v-if="!loading && items.length === 0" description="暂无图片" style="margin-top:24px;" />
    <n-pagination v-if="pagination.itemCount > pageSize" v-model:page="pagination.page" :item-count="pagination.itemCount" :page-size="pageSize" style="margin-top:12px; justify-content:flex-end;" @update:page="load" />
  </n-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useMessage } from 'naive-ui';
import type { UploadCustomRequestOptions } from 'naive-ui';
import { mediaApi } from '../api/index.js';
import type { MediaDTO } from '../types.js';

const message = useMessage();
const items = ref<MediaDTO[]>([]);
const loading = ref(false);
const pageSize = 20;
const pagination = reactive({ page: 1, itemCount: 0 });

async function load(page = pagination.page) {
  loading.value = true;
  try {
    const res = await mediaApi.list({ page, pageSize });
    items.value = res.items;
    pagination.itemCount = res.total;
    pagination.page = page;
  } finally {
    loading.value = false;
  }
}

const uploadRequest = async (opt: UploadCustomRequestOptions) => {
  try {
    const res = await mediaApi.upload(opt.file.file as File);
    opt.onFinish();
    message.success('上传成功');
    await load();
  } catch (e) {
    opt.onError();
    message.error((e as Error).message);
  }
};

async function copyUrl(m: MediaDTO) {
  try {
    await navigator.clipboard.writeText(m.url);
    message.success('链接已复制');
  } catch {
    message.error('复制失败，请手动复制：' + m.url);
  }
}

async function remove(m: MediaDTO) {
  try {
    await mediaApi.remove(m.id);
    message.success('已删除');
    await load();
  } catch (e) {
    message.error((e as Error).message);
  }
}

onMounted(() => load(1));
</script>
