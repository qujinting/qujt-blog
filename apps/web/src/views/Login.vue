<template>
  <div class="csr-login">
    <!-- 左侧：品牌 + 动画角色 -->
    <div class="csr-left">
      <div class="csr-logo">
        <span class="csr-logo-mark">{{ logoLetter }}</span>
        <span>{{ site.info?.siteName || 'qujt-blog' }}</span>
      </div>

      <div class="csr-stage">
        <AnimatedCharacters
          :is-typing="isTyping"
          :show-password="showPassword"
          :password-length="form.password.length"
          :login-failed="loginFailed"
          :login-success="loginSuccess"
        />
      </div>

      <div class="csr-left-footer">
        <span>有趣的登录体验 · 认真的内容创作</span>
      </div>

      <div class="csr-grid-overlay"></div>
      <div class="csr-blur csr-blur-1"></div>
      <div class="csr-blur csr-blur-2"></div>
    </div>

    <!-- 右侧：登录表单 -->
    <div class="csr-right">
      <div class="csr-form">
        <div class="csr-mobile-logo">
          <span class="csr-logo-mark">{{ logoLetter }}</span>
          <span>{{ site.info?.siteName || 'qujt-blog' }}</span>
        </div>

        <div class="csr-header">
          <h1 class="csr-title">欢迎回来 👋</h1>
          <p class="csr-subtitle">登录你的博客账号</p>
        </div>

        <div class="csr-field">
          <label class="csr-label">账号</label>
          <n-input
            v-model:value="form.account"
            placeholder="用户名或邮箱"
            size="large"
            :round="true"
            :status="errors.account ? 'error' : undefined"
            @focus="isTyping = false"
          />
          <p v-if="errors.account" class="csr-error">{{ errors.account }}</p>
        </div>

        <div class="csr-field">
          <label class="csr-label">密码</label>
          <n-input
            v-model:value="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            size="large"
            :round="true"
            :status="errors.password ? 'error' : undefined"
            @focus="isTyping = true"
            @blur="isTyping = false"
            @keyup.enter="submit"
          >
            <template #suffix>
              <n-button quaternary circle size="small" @click="showPassword = !showPassword">
                <span style="font-size:15px;">{{ showPassword ? '🙈' : '👁️' }}</span>
              </n-button>
            </template>
          </n-input>
          <p v-if="errors.password" class="csr-error">{{ errors.password }}</p>
        </div>

        <div v-if="errorMessage" class="csr-alert">{{ errorMessage }}</div>

        <n-button type="primary" size="large" block :round="true" :loading="loading" style="margin-top:8px;" @click="submit">
          {{ loading ? '登录中…' : '登 录' }}
        </n-button>

        <div class="csr-signup">
          还没有账号？<a @click="router.push('/register')">去注册</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import AnimatedCharacters from '../components/login/AnimatedCharacters.vue';
import { useAuthStore } from '../stores/auth.js';
import { useSiteStore } from '../stores/site.js';

const auth = useAuthStore();
const site = useSiteStore();
const router = useRouter();
const route = useRoute();
const message = useMessage();

const loading = ref(false);
const showPassword = ref(false);
const isTyping = ref(false);
const loginFailed = ref(false);
const loginSuccess = ref(false);
const errorMessage = ref('');
const errors = ref({ account: '', password: '' });
const form = ref({ account: '', password: '' });

const logoLetter = computed(() => (site.info?.siteName || 'B').slice(0, 1).toUpperCase());

let failTimer: number | undefined;
let successTimer: number | undefined;

function validate(): boolean {
  errors.value = { account: '', password: '' };
  let ok = true;
  if (!form.value.account.trim()) {
    errors.value.account = '请输入账号';
    ok = false;
  }
  if (!form.value.password) {
    errors.value.password = '请输入密码';
    ok = false;
  }
  return ok;
}

async function submit() {
  if (!validate()) return;
  loading.value = true;
  errorMessage.value = '';
  loginFailed.value = false;
  try {
    const user = await auth.login(form.value.account.trim(), form.value.password);
    loginSuccess.value = true;
    message.success('登录成功，欢迎回来！');
    if (successTimer) clearTimeout(successTimer);
    successTimer = window.setTimeout(() => {
      loginSuccess.value = false;
      router.push((route.query.redirect as string) || '/');
    }, 900);
  } catch (e) {
    const data = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    errorMessage.value = data?.error?.message ?? '账号或密码错误，请重试';
    loginFailed.value = true;
    if (failTimer) clearTimeout(failTimer);
    failTimer = window.setTimeout(() => (loginFailed.value = false), 3000);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  site.load();
});
</script>

<style scoped>
.csr-login {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
  overflow: hidden;
}

/* 左侧 */
.csr-left {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 2.5rem 3rem;
  background: linear-gradient(to bottom right, #9ca3af, #6b7280, #4b5563);
  color: #fff;
}
.csr-logo { position: relative; z-index: 20; display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.15rem; }
.csr-logo-mark {
  width: 32px; height: 32px; border-radius: 9px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; color: #fff; font-size: 17px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}
.csr-stage { position: relative; z-index: 20; display: flex; align-items: flex-end; justify-content: center; flex: 1; min-height: 380px; padding: 30px 0; }
.csr-left-footer { position: relative; z-index: 20; font-size: 0.85rem; color: rgba(255, 255, 255, 0.75); }
.csr-grid-overlay {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 22px 22px;
}
.csr-blur { position: absolute; border-radius: 50%; filter: blur(96px); }
.csr-blur-1 { top: 20%; right: 22%; width: 15rem; height: 15rem; background: rgba(99, 102, 241, 0.35); }
.csr-blur-2 { bottom: 18%; left: 20%; width: 20rem; height: 20rem; background: rgba(236, 72, 153, 0.24); }

/* 右侧 */
.csr-right { display: flex; align-items: center; justify-content: center; padding: 2rem; background: var(--qj-bg); }
.csr-form { width: 100%; max-width: 400px; }
.csr-mobile-logo { display: none; align-items: center; justify-content: center; gap: 10px; font-weight: 700; margin-bottom: 2rem; }
.csr-header { text-align: center; margin-bottom: 2.2rem; }
.csr-title { font-size: 1.8rem; font-weight: 800; color: var(--qj-text); margin: 0 0 8px; letter-spacing: -0.02em; }
.csr-subtitle { font-size: 0.9rem; color: var(--qj-text-2); margin: 0; }
.csr-field { margin-bottom: 1.1rem; }
.csr-label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--qj-text-2); margin-bottom: 6px; }
.csr-error { font-size: 0.8rem; color: #ef4444; margin: 6px 0 0; }
.csr-alert {
  padding: 10px 14px; font-size: 0.85rem; color: #ef4444;
  background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 10px; margin-bottom: 1rem;
}
.csr-signup { margin-top: 1.6rem; text-align: center; font-size: 0.85rem; color: var(--qj-text-2); }
.csr-signup a { color: var(--qj-accent); font-weight: 600; cursor: pointer; }
.csr-signup a:hover { text-decoration: underline; }

@media (max-width: 900px) {
  .csr-login { grid-template-columns: 1fr; }
  .csr-left { display: none; }
  .csr-mobile-logo { display: flex; }
}
</style>
