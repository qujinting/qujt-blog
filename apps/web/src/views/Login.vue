<template>
  <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#1f2937,#111827);">
    <n-card style="width:380px;" title="登录">
      <n-form ref="formRef" :model="form" :rules="rules" size="large">
        <n-form-item label="账号" path="account">
          <n-input v-model:value="form.account" placeholder="用户名或邮箱" autocomplete="username" />
        </n-form-item>
        <n-form-item label="密码" path="password">
          <n-input v-model:value="form.password" type="password" placeholder="密码" autocomplete="current-password" @keyup.enter="submit" />
        </n-form-item>
        <n-button type="primary" block :loading="loading" @click="submit">登录</n-button>
      </n-form>
      <div style="text-align:center; margin-top:14px; font-size:13px;">
        还没有账号？
        <a href="javascript:void(0)" style="color:#18a058;" @click="router.push('/register')">去注册</a>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import type { FormInst, FormRules } from 'naive-ui';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const message = useMessage();
const formRef = ref<FormInst | null>(null);
const loading = ref(false);
const form = ref({ account: '', password: '' });
const rules: FormRules = {
  account: { required: true, message: '请输入账号', trigger: ['input', 'blur'] },
  password: { required: true, message: '请输入密码', trigger: ['input', 'blur'] },
};

async function submit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  loading.value = true;
  try {
    await auth.login(form.value.account, form.value.password);
    message.success('登录成功');
    router.push((route.query.redirect as string) || '/');
  } catch (e) {
    const data = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    message.error(data?.error?.message ?? '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>
