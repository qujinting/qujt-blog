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
          :password-length="passwordLength"
          :login-failed="loginFailed"
          :login-success="loginSuccess"
        />
      </div>
      <div class="csr-left-footer"><span>有趣的登录体验 · 认真的内容创作</span></div>
      <div class="csr-grid-overlay"></div>
      <div class="csr-blur csr-blur-1"></div>
      <div class="csr-blur csr-blur-2"></div>
    </div>

    <!-- 右侧：表单插槽 -->
    <div class="csr-right">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AnimatedCharacters from './AnimatedCharacters.vue';
import { useSiteStore } from '../../stores/site.js';

defineProps<{
  isTyping?: boolean;
  showPassword?: boolean;
  passwordLength?: number;
  loginFailed?: boolean;
  loginSuccess?: boolean;
}>();

const site = useSiteStore();
const logoLetter = computed(() => (site.info?.siteName || 'B').slice(0, 1).toUpperCase());
onMounted(() => site.load());
</script>

<style>
.csr-login {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
  overflow: hidden;
}
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

.csr-right { display: flex; align-items: center; justify-content: center; padding: 2rem; background: var(--qj-bg); }
.csr-form { width: 100%; max-width: 400px; }
.csr-mobile-logo { display: none; align-items: center; justify-content: center; gap: 10px; font-weight: 700; margin-bottom: 2rem; }
.csr-logo-mark { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; font-size: 15px; }
.csr-header { text-align: center; margin-bottom: 2.2rem; }
.csr-title { font-size: 1.8rem; font-weight: 800; color: var(--qj-text); margin: 0 0 8px; letter-spacing: -0.02em; }
.csr-subtitle { font-size: 0.9rem; color: var(--qj-text-2); margin: 0; }
.csr-field { margin-bottom: 1.1rem; }
.csr-label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--qj-text-2); margin-bottom: 6px; }
.csr-error {
  font-size: 0.8rem;
  color: #ef4444;
  margin: 6px 0 0;
  min-height: 1.4em;
  line-height: 1.4;
  transition: opacity 0.18s ease;
}
.csr-error.is-empty { opacity: 0; }
.csr-alert {
  padding: 10px 14px; font-size: 0.85rem; color: #ef4444;
  background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 10px; margin-bottom: 1rem;
}
.csr-link-row { margin-top: 1.6rem; text-align: center; font-size: 0.85rem; color: var(--qj-text-2); }
.csr-link-row a { color: var(--qj-accent); font-weight: 600; cursor: pointer; }
.csr-link-row a:hover { text-decoration: underline; }

@media (max-width: 900px) {
  .csr-login { grid-template-columns: 1fr; }
  .csr-left { display: none; }
  .csr-mobile-logo { display: flex; }
}
</style>