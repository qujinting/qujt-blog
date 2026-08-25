<template>
  <n-card :bordered="true" size="small" style="margin-bottom:14px; cursor:pointer;" @click="router.push('/post/' + post.slug)">
    <div style="display:flex; gap:14px;">
      <img v-if="post.coverImage" :src="post.coverImage" loading="lazy" style="width:150px; height:100px; object-fit:cover; border-radius:6px; flex-shrink:0;" />
      <div style="flex:1; min-width:0;">
        <div style="font-size:17px; font-weight:600; margin-bottom:6px;" class="post-card-title">{{ post.title }}</div>
        <div style="color:var(--n-text-color-3); font-size:13px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:8px;">
          {{ post.summary }}
        </div>
        <div style="display:flex; gap:10px; align-items:center; font-size:12px; color:var(--n-text-color-3); flex-wrap:wrap;">
          <n-tag v-if="post.category" size="tiny">{{ post.category.name }}</n-tag>
          <n-tag v-for="t in post.tags" :key="t.id" size="tiny" type="info">{{ t.name }}</n-tag>
          <span>{{ dayjs(post.publishAt ?? post.createdAt).format('YYYY-MM-DD') }}</span>
          <span>{{ post.viewCount }} 阅读</span>
          <span>{{ post.wordCount }} 字</span>
        </div>
      </div>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import type { PostSummaryDTO } from '@qujt/shared';

defineProps<{ post: PostSummaryDTO }>();
const router = useRouter();
</script>

<style scoped>
.post-card-title:hover { color: #18a058; }
</style>
