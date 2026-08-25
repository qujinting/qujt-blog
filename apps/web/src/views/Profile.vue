<template>
  <div style="max-width:800px; margin:0 auto; padding:20px 16px;">
    <n-card title="个人中心">
      <n-descriptions :column="2" bordered style="margin-bottom:20px;">
        <n-descriptions-item label="用户名">{{ auth.user?.username }}</n-descriptions-item>
        <n-descriptions-item label="邮箱">{{ auth.user?.email }}</n-descriptions-item>
        <n-descriptions-item label="角色">{{ roleLabel }}</n-descriptions-item>
        <n-descriptions-item label="注册时间">{{ auth.user ? dayjs(auth.user.createdAt).format('YYYY-MM-DD') : '' }}</n-descriptions-item>
        <n-descriptions-item label="邀请人ID">{{ auth.user?.invitedBy ?? '无' }}</n-descriptions-item>
        <n-descriptions-item label="邀请码ID">{{ auth.user?.inviteCodeId ?? '无' }}</n-descriptions-item>
      </n-descriptions>

      <n-divider>资料设置</n-divider>
      <n-form label-placement="left" label-width="80">
        <n-form-item label="昵称">
          <n-input v-model:value="profile.nickname" style="max-width:300px;" />
        </n-form-item>
        <n-form-item label="头像 URL">
          <n-input v-model:value="profile.avatar" placeholder="https://…" style="max-width:400px;" />
        </n-form-item>
        <n-form-item>
          <n-button type="primary" :loading="savingProfile" @click="saveProfile">保存资料</n-button>
        </n-form-item>
      </n-form>

      <n-divider>修改密码</n-divider>
      <n-form label-placement="left" label-width="80">
        <n-form-item label="原密码">
          <n-input v-model:value="pwd.oldPassword" type="password" style="max-width:300px;" />
        </n-form-item>
        <n-form-item label="新密码">
          <n-input v-model:value="pwd.newPassword" type="password" placeholder="至少 8 位" style="max-width:300px;" />
        </n-form-item>
        <n-form-item label="确认新密码">
          <n-input v-model:value="pwd.confirm" type="password" style="max-width:300px;" />
        </n-form-item>
        <n-form-item>
          <n-button :loading="savingPwd" @click="savePassword">修改密码</n-button>
        </n-form-item>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useMessage } from 'naive-ui';
import dayjs from 'dayjs';
import { authApi } from '../api/index.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const message = useMessage();
const savingProfile = ref(false);
const savingPwd = ref(false);
const profile = reactive({ nickname: '', avatar: '' });
const pwd = reactive({ oldPassword: '', newPassword: '', confirm: '' });

const roleLabel = computed(() => ({ admin: '管理员', author: '作者', user: '普通用户' })[auth.user?.role ?? 'user']);

async function saveProfile() {
  savingProfile.value = true;
  try {
    const res = await authApi.updateProfile({
      nickname: profile.nickname || undefined,
      avatar: profile.avatar || null,
    });
    auth.user = res.user;
    message.success('资料已保存');
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    savingProfile.value = false;
  }
}

async function savePassword() {
  if (pwd.newPassword.length < 8) return message.warning('新密码至少 8 位');
  if (pwd.newPassword !== pwd.confirm) return message.warning('两次输入的新密码不一致');
  savingPwd.value = true;
  try {
    await authApi.changePassword(pwd.oldPassword, pwd.newPassword);
    message.success('密码已修改，下次登录请使用新密码');
    pwd.oldPassword = pwd.newPassword = pwd.confirm = '';
  } catch (e) {
    const data = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    message.error(data?.error?.message ?? '修改失败');
  } finally {
    savingPwd.value = false;
  }
}

onMounted(async () => {
  if (!auth.user) await auth.fetchMe();
  profile.nickname = auth.user?.nickname ?? '';
  profile.avatar = auth.user?.avatar ?? '';
});
</script>
