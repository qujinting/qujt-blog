<template>
  <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:16px;">
    <div style="font-size:72px; font-weight:800; color:var(--n-text-color-3);">404</div>
    <div style="color:var(--n-text-color-3);">页面不存在或文章未发布</div>
    <n-button type="primary" @click="router.push('/')">返回首页</n-button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
const router = useRouter();
</script>
