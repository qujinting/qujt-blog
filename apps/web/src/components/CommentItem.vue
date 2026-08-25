<template>
  <div>
    <div style="display:flex; gap:10px;">
      <n-avatar round :size="34">{{ node.comment.user.nickname.slice(0, 1) }}</n-avatar>
      <div style="flex:1; min-width:0;">
        <div style="display:flex; gap:8px; align-items:baseline; flex-wrap:wrap;">
          <span style="font-weight:600; font-size:14px;">{{ node.comment.user.nickname }}</span>
          <span style="font-size:12px; color:var(--n-text-color-3);">{{ dayjs(node.comment.createdAt).format('YYYY-MM-DD HH:mm') }}</span>
        </div>
        <div style="font-size:14px; line-height:1.7; margin:4px 0; white-space:pre-wrap; word-break:break-word;">
          <span v-if="node.comment.replyToUid" style="color:#18a058;">@{{ node.comment.replyToNickname }} </span>{{ node.comment.content }}
        </div>
        <div style="display:flex; gap:14px; font-size:12px;">
          <a href="javascript:void(0)" @click="reply">{{ auth.isAuthed ? '回复' : '登录回复' }}</a>
          <a v-if="isMine" href="javascript:void(0)" style="color:#e88080;" @click="remove">删除</a>
        </div>
      </div>
    </div>

    <!-- 二级回复（缩进） -->
    <div v-if="node.children.length && depth < 2" style="margin:10px 0 0 44px; padding-left:12px; border-left:2px solid rgba(128,128,128,0.15);">
      <CommentItem v-for="child in node.children" :key="child.comment.id" :node="child" :depth="depth + 1" @reply="emit('reply', $event)" @deleted="emit('deleted')" />
    </div>

    <!-- 更深回复平铺 -->
    <div v-if="node.children.length && depth >= 2" style="margin:8px 0 0 44px; padding-left:10px; border-left:2px solid rgba(128,128,128,0.15); font-size:13px;">
      <div v-for="flat in flattened" :key="flat.id" style="padding:4px 0;">
        <span style="font-weight:600;">{{ flat.user.nickname }}</span>
        <span v-if="flat.replyToUid" style="color:#18a058;"> 回复 @{{ flat.replyToNickname }}:</span>
        <span style="word-break:break-word;"> {{ flat.content }}</span>
        <span style="color:var(--n-text-color-3); font-size:11px; margin-left:8px;">{{ dayjs(flat.createdAt).format('MM-DD HH:mm') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDialog } from 'naive-ui';
import dayjs from 'dayjs';
import type { CommentDTO } from '@qujt/shared';
import { commentsApi } from '../api/index.js';
import { useAuthStore } from '../stores/auth.js';

interface TreeNode {
  comment: CommentDTO;
  children: TreeNode[];
}

const props = defineProps<{ node: TreeNode; depth: number }>();
const emit = defineEmits<{ (e: 'reply', comment: CommentDTO): void; (e: 'deleted'): void }>();
const auth = useAuthStore();
const router = useRouter();
const dialog = useDialog();

const isMine = computed(() => auth.user?.id === props.node.comment.user.id);

const flattened = computed<CommentDTO[]>(() => {
  const out: CommentDTO[] = [];
  const walk = (n: TreeNode) => {
    for (const ch of n.children) {
      out.push(ch.comment);
      walk(ch);
    }
  };
  walk(props.node);
  return out;
});

function reply() {
  if (!auth.isAuthed) {
    router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } });
    return;
  }
  emit('reply', props.node.comment);
}

function remove() {
  dialog.warning({
    title: '删除评论',
    content: '确定删除这条评论吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await commentsApi.remove(props.node.comment.id);
        emit('deleted');
      } catch (e) {
        // 错误提示由 interceptor 展示
      }
    },
  });
}
</script>
