<template>
  <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#1f2937,#111827);">
    <n-card style="width:400px;" title="注册">
      <n-alert v-if="mode === 'closed'" type="warning" style="margin-bottom:14px;">当前注册已关闭，请联系管理员。</n-alert>
      <n-form v-else ref="formRef" :model="form" :rules="rules" size="large">
        <n-form-item label="用户名" path="username">
          <n-input v-model:value="form.username" placeholder="3-20 位字母/数字/下划线" />
        </n-form-item>
        <n-form-item label="邮箱" path="email">
          <n-input v-model:value="form.email" placeholder="example@mail.com" />
        </n-form-item>
        <n-form-item label="密码" path="password">
          <n-input v-model:value="form.password" type="password" placeholder="至少 8 位" />
        </n-form-item>
        <n-form-item v-if="mode === 'invite'" label="邀请码" path="inviteCode">
          <n-input v-model:value="form.inviteCode" placeholder="请输入邀请码" />
        </n-form-item>
        <n-button type="primary" block :loading="loading" @click="submit">注册并登录</n-button>
      </n-form>
      <div style="text-align:center; margin-top:14px; font-size:13px;">
        已有账号？
        <a href="javascript:void(0)" style="color:#18a058;" @click="router.push('/login')">去登录</a>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import type { FormInst, FormRules } from 'naive-ui';
import { authApi } from '../api/index.js';
import { useSiteStore } from '../stores/site.js';
import { useAuthStore } from '../stores/auth.js';

const router = useRouter();
const message = useMessage();
const site = useSiteStore();
const auth = useAuthStore();
const formRef = ref<FormInst | null>(null);
const loading = ref(false);
const mode = computed(() => site.info?.registrationMode ?? 'invite');
const form = ref({ username: '', email: '', password: '', inviteCode: '' });

const rules = computed<FormRules>(() => {
  const r: FormRules = {
    username: {
      required: true,
      trigger: ['input', 'blur'],
      validator: (_r, v: string) =>
        /^[a-zA-Z0-9_-]{3,20}$/.test(v) ? true : new Error('3-20 位字母/数字/下划线/连字符'),
    },
    email: { required: true, type: 'email', message: '邮箱格式不正确', trigger: ['input', 'blur'] },
    password: { required: true, validator: (_r, v: string) => (v.length >= 8 ? true : new Error('密码至少 8 位')), trigger: ['input', 'blur'] },
  };
  if (mode.value === 'invite') {
    r.inviteCode = { required: true, message: '请输入邀请码', trigger: ['input', 'blur'] };
  }
  return r;
});

async function submit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  loading.value = true;
  try {
    await authApi.register({
      username: form.value.username,
      email: form.value.email,
      password: form.value.password,
      inviteCode: form.value.inviteCode || undefined,
    });
    // 注册成功后自动登录
    await auth.login(form.value.username, form.value.password);
    message.success('注册成功，欢迎！');
    router.push('/');
  } catch (e) {
    const data = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    message.error(data?.error?.message ?? '注册失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => site.load());
</script>