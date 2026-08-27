import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  // 首页：编辑风「留白 Marginalia」独立页面（自带导航/页脚，不套用 WebLayout）
  { path: '/', name: 'home', component: () => import('../views/Editorial.vue'), meta: { public: true } },
  // 博客正文 / 个人中心（沿用原有 WebLayout；首页为独立页面，故不再套用其渲染）
  {
    path: '/',
    component: () => import('../layouts/WebLayout.vue'),
    children: [
      { path: 'post/:slug', name: 'post', component: () => import('../views/PostDetail.vue') },
      { path: 'profile', name: 'profile', component: () => import('../views/Profile.vue'), meta: { auth: true } },
    ],
  },
  { path: '/login', name: 'login', component: () => import('../views/Login.vue'), meta: { public: true } },
  { path: '/register', name: 'register', component: () => import('../views/Register.vue'), meta: { public: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFound.vue'), meta: { public: true } },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.auth) {
    if (!auth.user && !auth.loaded) await auth.fetchMe();
    if (!auth.user) return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});
