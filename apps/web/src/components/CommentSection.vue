<template>
  <div style="margin-top:32px; border-top:1px solid rgba(128,128,128,0.2); padding-top:20px;">
    <div style="font-size:18px; font-weight:600; margin-bottom:16px;">评论（{{ total }}）</div>

    <!-- 发表区 -->
    <div v-if="auth.isAuthed" style="margin-bottom:20px;">
      <n-tag v-if="replyTo" closable size="small" type="info" style="margin-bottom:8px;" @close="replyTo = null">
        回复 @{{ replyTo.user.nickname }}
      </n-tag>
      <n-input v-model:value="content" type="textarea" :rows="3" placeholder="友善评论，理性发言（支持纯文本，最多 1000 字）" maxlength="1000" show-count />
      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <n-button type="primary" size="small" :loading="submitting" @click="submit">发表评论</n-button>
      </div>
    </div>
    <n-empty v-else description="登录后参与评论" style="margin: 20px 0 28px;">
      <template #extra>
        <n-button size="small" type="primary" @click="goLogin">去登录</n-button>
      </template>
    </n-empty>

    <!-- 评论列表 -->
    <div v-if="loading"><n-skeleton v-for="i in 3" :key="i" height="60px" style="margin-bottom:12px;" /></div>
    <n-empty v-else-if="!loading && roots.length === 0" description="暂无评论，快来抢沙发" style="margin:24px 0;" />

    <div v-for="node in roots" :key="node.comment.id" style="margin-bottom:14px;">
      <CommentItem :node="node" :depth="1" @reply="onReply" @deleted="load" />
    </div>

    <n-pagination v-if="total > pageSize" v-model:page="page" :item-count="total" :page-size="pageSize" size="small" style="justify-content:flex-end; margin-top:12px;" @update:page="load" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import type { CommentDTO } from '@qujt/shared';
import { commentsApi } from '../api/index.js';
import { useAuthStore } from '../stores/auth.js';
import CommentItem from './CommentItem.vue';

const props = defineProps<{ slug: string }>();
const auth = useAuthStore();
const router = useRouter();
const message = useMessage();
const items = ref<CommentDTO[]>([]);
const total = ref(0);
const loading = ref(false);
const submitting = ref(false);
const page = ref(1);
const pageSize = 50;
const content = ref('');
const replyTo = ref<CommentDTO | null>(null);

interface TreeNode {
  comment: CommentDTO;
  children: TreeNode[];
}

const roots = computed<TreeNode[]>(() => {
  const map = new Map<number, TreeNode>();
  const result: TreeNode[] = [];
  for (const c of items.value) map.set(c.id, { comment: c, children: [] });
  for (const c of items.value) {
    const node = map.get(c.id)!;
    const parent = c.parentId ? map.get(c.parentId) : undefined;
    if (parent) parent.children.push(node);
    else result.push(node);
  }
  return result;
});

async function load() {
  loading.value = true;
  try {
    const res = await commentsApi.list(props.slug, { page: page.value, pageSize });
    items.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function submit() {
  const text = content.value.trim();
  if (!text) return message.warning('请输入评论内容');
  submitting.value = true;
  try {
    await commentsApi.create(props.slug, { content: text, parentId: replyTo.value?.id ?? null });
    message.success('评论已提交' + (replyTo.value ? '（回复成功）' : '') + '，审核通过后显示');
    content.value = '';
    replyTo.value = null;
    await load();
  } catch (e) {
    const data = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    message.error(data?.error?.message ?? '发表失败');
  } finally {
    submitting.value = false;
  }
}

function onReply(comment: CommentDTO) {
  replyTo.value = comment;
}

function goLogin() {
  router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } });
}

onMounted(load);
watch(() => props.slug, load);
</script>