<template>
  <div style="max-width:1100px; margin:0 auto; padding:24px 20px;">
    <n-spin :show="loading">
      <template v-if="post && !post.locked">
        <div class="qj-article-header">
          <div class="qj-article-meta" style="margin-bottom:10px;">
            <span v-if="post.category" class="qj-chip">{{ post.category.name }}</span>
            <n-tag v-for="t in post.tags" :key="t.id" size="tiny" :bordered="false" class="qj-tag">{{ t.name }}</n-tag>
          </div>
          <h1 class="qj-article-title">{{ post.title }}</h1>
          <div class="qj-article-meta">
            <span>📅 {{ dayjs(post.publishAt ?? post.createdAt).format('YYYY-MM-DD HH:mm') }}</span>
            <span>👁 {{ post.viewCount }} 阅读</span>
            <span>{{ post.wordCount }} 字</span>
          </div>
        </div>

        <n-grid :cols="3" x-gap="26" responsive="screen" item-responsive>
          <n-grid-item span="3 l:2">
            <article>
              <img v-if="post.coverImage" :src="post.coverImage" class="qj-cover" alt="cover" />
              <div class="article-body" v-html="post.contentHtml"></div>
            </article>
          </n-grid-item>
          <n-grid-item span="3 l:1">
            <div v-if="post.toc.length" class="qj-toc">
              <div class="qj-toc-title">📑 目录</div>
              <div
                v-for="t in post.toc"
                :key="t.id"
                class="qj-toc-item"
                :style="{ paddingLeft: (t.level - 1) * 14 + 10 + 'px' }"
                @click="scrollTo(t.id)"
              >{{ t.text }}</div>
            </div>
          </n-grid-item>
        </n-grid>

        <div class="qj-comments">
          <CommentSection v-if="post && !post.locked" :slug="post.slug" />
        </div>
      </template>

      <n-card v-else-if="post && post.locked" style="max-width:420px; margin:90px auto; text-align:center;">
        <div style="font-size:46px; margin-bottom:12px;">🔒</div>
        <h3 style="margin:0 0 18px;">该文章需要密码访问</h3>
        <n-input v-model:value="password" type="password" placeholder="输入访问密码" @keyup.enter="unlock" />
        <n-button type="primary" block :loading="unlocking" style="margin-top:14px;" @click="unlock">解锁阅读</n-button>
      </n-card>

      <n-card v-else-if="loginRequired" style="max-width:420px; margin:90px auto; text-align:center;">
        <div style="font-size:46px; margin-bottom:12px;">🔐</div>
        <h3 style="margin:0 0 18px;">该文章仅登录用户可见</h3>
        <n-button type="primary" block @click="goLogin">去登录</n-button>
      </n-card>

      <div v-else-if="!loading" class="qj-empty">
        <div class="big">🔍</div>
        <div>文章不存在或未发布</div>
        <n-button style="margin-top:16px;" @click="router.push('/')">返回首页</n-button>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import dayjs from 'dayjs';
import { postsApi } from '../api/index.js';
import type { PostDetailResp } from '../api/index.js';
import CommentSection from '../components/CommentSection.vue';

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
