<template>
  <AuthShell :is-typing="isTyping" :show-password="showPassword" :password-length="form.password.length" :login-failed="loginFailed" :login-success="loginSuccess">
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
        <n-input v-model:value="form.account" placeholder="用户名或邮箱" size="large" :round="true" :status="errors.account ? 'error' : undefined" @focus="isTyping = false" />
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

      <div class="csr-link-row">
        还没有账号？<a @click="router.push('/register')">去注册</a>
      </div>
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import AuthShell from '../components/login/AuthShell.vue';
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
  if (!form.value.account.trim()) { errors.value.account = '请输入账号'; ok = false; }
  if (!form.value.password) { errors.value.password = '请输入密码'; ok = false; }
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
</script>
