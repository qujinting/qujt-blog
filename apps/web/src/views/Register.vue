<template>
  <AuthShell :is-typing="isTyping" :show-password="showPassword" :password-length="form.password.length" :login-failed="loginFailed" :login-success="loginSuccess">
    <div class="csr-form">
      <div class="csr-mobile-logo">
        <span class="csr-logo-mark">{{ logoLetter }}</span>
        <span>{{ site.info?.siteName || 'qujt-blog' }}</span>
      </div>

      <div class="csr-header">
        <h1 class="csr-title">创建账号 🎉</h1>
        <p class="csr-subtitle">{{ mode === 'closed' ? '当前注册已关闭' : '加入我们，开始创作' }}</p>
      </div>

      <n-alert v-if="mode === 'closed'" type="warning" style="margin-bottom:14px;">当前注册已关闭，请联系管理员。</n-alert>

      <template v-else>
        <div class="csr-field">
          <label class="csr-label">用户名</label>
          <n-input v-model:value="form.username" placeholder="3-20 位字母/数字/下划线" size="large" :round="true" :status="errors.username ? 'error' : undefined" />
          <p class="csr-error" :class="{ 'is-empty': !errors.username }">{{ errors.username }}</p>
        </div>

        <div class="csr-field">
          <label class="csr-label">邮箱</label>
          <n-input v-model:value="form.email" placeholder="example@mail.com" size="large" :round="true" :status="errors.email ? 'error' : undefined" />
          <p class="csr-error" :class="{ 'is-empty': !errors.email }">{{ errors.email }}</p>
        </div>

        <div class="csr-field">
          <label class="csr-label">密码</label>
          <n-input
            v-model:value="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="至少 8 位"
            size="large"
            :round="true"
            :status="errors.password ? 'error' : undefined"
            @focus="isTyping = true"
            @blur="isTyping = false"
          >
            <template #suffix>
              <n-button quaternary circle size="small" @click="showPassword = !showPassword">
                <span style="font-size:15px;">{{ showPassword ? '🙈' : '👁️' }}</span>
              </n-button>
            </template>
          </n-input>
          <p class="csr-error" :class="{ 'is-empty': !errors.password }">{{ errors.password }}</p>
        </div>

        <div v-if="mode === 'invite'" class="csr-field">
          <label class="csr-label">邀请码</label>
          <n-input v-model:value="form.inviteCode" placeholder="请输入邀请码" size="large" :round="true" :status="errors.inviteCode ? 'error' : undefined" />
          <p class="csr-error" :class="{ 'is-empty': !errors.inviteCode }">{{ errors.inviteCode }}</p>
        </div>

        <div v-if="errorMessage" class="csr-alert">{{ errorMessage }}</div>

        <n-button type="primary" size="large" block :round="true" :loading="loading" style="margin-top:8px;" @click="submit">
          {{ loading ? '注册中…' : '注册并登录' }}
        </n-button>
      </template>

      <div class="csr-link-row">
        已有账号？<a @click="router.push('/login')">去登录</a>
      </div>
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import AuthShell from '../components/login/AuthShell.vue';
import { authApi } from '../api/index.js';
import { useAuthStore } from '../stores/auth.js';
import { useSiteStore } from '../stores/site.js';

const router = useRouter();
const message = useMessage();
const site = useSiteStore();
const auth = useAuthStore();

const loading = ref(false);
const showPassword = ref(false);
const isTyping = ref(false);
const loginFailed = ref(false);
const loginSuccess = ref(false);
const errorMessage = ref('');
const errors = ref<Record<string, string>>({});
const form = ref({ username: '', email: '', password: '', inviteCode: '' });

const mode = computed(() => site.info?.registrationMode ?? 'invite');
const logoLetter = computed(() => (site.info?.siteName || 'B').slice(0, 1).toUpperCase());

let failTimer: number | undefined;
let successTimer: number | undefined;

function validate(): boolean {
  errors.value = {};
  let ok = true;
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(form.value.username)) {
    errors.value.username = '用户名需为 3-20 位字母/数字/下划线/连字符';
    ok = false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errors.value.email = '请输入有效的邮箱';
    ok = false;
  }
  if (form.value.password.length < 8) {
    errors.value.password = '密码至少 8 位';
    ok = false;
  }
  if (mode.value === 'invite' && !form.value.inviteCode.trim()) {
    errors.value.inviteCode = '请输入邀请码';
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
    await authApi.register({
      username: form.value.username.trim(),
      email: form.value.email.trim(),
      password: form.value.password,
      inviteCode: form.value.inviteCode.trim() || undefined,
    });
    await auth.login(form.value.username.trim(), form.value.password);
    loginSuccess.value = true;
    message.success('注册成功，欢迎加入！');
    if (successTimer) clearTimeout(successTimer);
    successTimer = window.setTimeout(() => {
      loginSuccess.value = false;
      router.push('/');
    }, 900);
  } catch (e) {
    const data = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    errorMessage.value = data?.error?.message ?? '注册失败，请重试';
    loginFailed.value = true;
    if (failTimer) clearTimeout(failTimer);
    failTimer = window.setTimeout(() => (loginFailed.value = false), 3000);
  } finally {
    loading.value = false;
  }
}

onMounted(() => site.load());
</script>
