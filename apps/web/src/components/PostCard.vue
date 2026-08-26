<template>
  <div class="qj-card" @click="router.push('/post/' + post.slug)">
    <div class="qj-card-cover" :style="coverStyle">
      <span v-if="post.category" class="qj-chip" style="position:absolute; top:10px; left:10px; background:rgba(255,255,255,0.9);">{{ post.category.name }}</span>
    </div>
    <div class="qj-card-body">
      <h3 class="qj-card-title">{{ post.title }}</h3>
      <p class="qj-card-summary">{{ post.summary }}</p>
      <div class="qj-card-meta">
        <n-tag v-for="t in post.tags" :key="t.id" size="tiny" :bordered="false" class="qj-tag">{{ t.name }}</n-tag>
        <span style="margin-left:auto;">{{ dayjs(post.publishAt ?? post.createdAt).format('YYYY-MM-DD') }}</span>
        <span>· {{ post.viewCount }} 阅读</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import type { PostSummaryDTO } from '@qujt/shared';

const props = defineProps<{ post: PostSummaryDTO }>();
const router = useRouter();

const coverStyle = computed(() => ({
  backgroundImage: props.post.coverImage ? `url("${props.post.coverImage}")` : undefined,
  position: 'relative' as const,
}));
</script>
