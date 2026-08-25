<template>
  <div style="max-width:1100px; margin:0 auto; padding:20px 16px;">
    <n-spin :show="loading">
      <template v-if="post && !post.locked">
        <n-grid :cols="3" x-gap="24" responsive="screen" item-responsive>
          <n-grid-item span="3 l:2">
            <article>
              <h1 style="font-size:28px; font-weight:700; margin:8px 0 10px;">{{ post.title }}</h1>
              <div style="display:flex; gap:12px; align-items:center; font-size:13px; color:var(--n-text-color-3); flex-wrap:wrap; margin-bottom:16px;">
                <n-tag v-if="post.category" size="small">{{ post.category.name }}</n-tag>
                <n-tag v-for="t in post.tags" :key="t.id" size="small" type="info">{{ t.name }}</n-tag>
                <span>{{ dayjs(post.publishAt ?? post.createdAt).format('YYYY-MM-DD HH:mm') }}</span>
                <span>{{ post.viewCount }} 阅读</span>
                <span>{{ post.wordCount }} 字</span>
              </div>
              <img v-if="post.coverImage" :src="post.coverImage" style="max-width:100%; border-radius:8px; margin-bottom:18px;" />
              <div class="article-body" v-html="post.contentHtml"></div>
            </article>
          </n-grid-item>
          <n-grid-item span="3 l:1">
            <div v-if="post.toc.length" style="position:sticky; top:80px; max-height:calc(100vh - 120px); overflow:auto; border-left:1px solid rgba(128,128,128,0.2); padding-left:14px;">
              <div style="font-weight:600; margin-bottom:8px; font-size:14px;">目录</div>
              <div
                v-for="t in post.toc"
                :key="t.id"
                class="toc-item"
                :style="{ paddingLeft: (t.level - 1) * 14 + 'px' }"
                @click="scrollTo(t.id)"
              >{{ t.text }}</div>
            </div>
          </n-grid-item>
        </n-grid>
        <CommentSection v-if="post && !post.locked" :slug="post.slug" />
      </template>

      <n-card v-else-if="post && post.locked" style="max-width:420px; margin:70px auto;">
        <div style="text-align:center; font-size:40px; margin-bottom:10px;">🔒</div>
        <h3 style="text-align:center; margin:0 0 18px;">该文章需要密码访问</h3>
        <n-input v-model:value="password" type="password" placeholder="输入访问密码" @keyup.enter="unlock" />
        <n-button type="primary" block :loading="unlocking" style="margin-top:14px;" @click="unlock">解锁阅读</n-button>
      </n-card>

      <n-card v-else-if="loginRequired" style="max-width:420px; margin:70px auto;">
        <div style="text-align:center; font-size:40px; margin-bottom:10px;">🔐</div>
        <h3 style="text-align:center; margin:0 0 18px;">该文章仅登录用户可见</h3>
        <n-button type="primary" block @click="goLogin">去登录</n-button>
      </n-card>

      <n-empty v-else-if="!loading" description="文章不存在或未发布" style="margin-top:80px;">
        <template #extra>
          <n-button @click="router.push('/')">返回首页</n-button>
        </template>
      </n-empty>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import dayjs from 'dayjs';
import { postsApi } from '../api/index.js';
import CommentSection from '../components/CommentSection.vue';
import type { PostDetailResp } from '../api/index.js';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const loading = ref(false);
const post = ref<PostDetailResp['post'] | null>(null);
const loginRequired = ref(false);
const password = ref('');
const unlocking = ref(false);

async function load() {
  loading.value = true;
  loginRequired.value = false;
  post.value = null;
  const slug = String(route.params.slug);
  try {
    const res = await postsApi.detail(slug);
    post.value = res.post;
    document.title = res.post.title + ' - qujt-blog';
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status;
    if (status === 401) {
      loginRequired.value = true;
    } else {
      document.title = '404 - qujt-blog';
    }
  } finally {
    loading.value = false;
  }
}

async function unlock() {
  if (!password.value) return message.warning('请输入密码');
  unlocking.value = true;
  try {
    await postsApi.unlock(String(route.params.slug), password.value);
    message.success('解锁成功');
    await load();
  } catch (e) {
    const data = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    message.error(data?.error?.message ?? '密码错误');
  } finally {
    unlocking.value = false;
  }
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function goLogin() {
  router.push({ path: '/login', query: { redirect: route.fullPath } });
}

onMounted(load);
watch(() => route.params.slug, load);
</script>

<style scoped>
.toc-item {
  cursor: pointer;
  font-size: 13px;
  line-height: 1.9;
  color: var(--n-text-color-2);
  border-left: 2px solid transparent;
  margin-left: -14px;
  padding-left: 14px;
  transition: all 0.15s;
}
.toc-item:hover {
  color: #18a058;
  border-left-color: #18a058;
}
</style>