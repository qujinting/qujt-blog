import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/Login.vue'), meta: { public: true, title: '登录' } },
  {
    path: '/',
    component: () => import('../layouts/AdminLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '仪表盘' } },
      { path: 'posts', name: 'posts', component: () => import('../views/PostList.vue'), meta: { title: '文章' } },
      { path: 'posts/new', name: 'post-new', component: () => import('../views/PostEdit.vue'), meta: { title: '写文章' } },
      { path: 'posts/:id/edit', name: 'post-edit', component: () => import('../views/PostEdit.vue'), meta: { title: '编辑文章' } },
      { path: 'media', name: 'media', component: () => import('../views/MediaLibrary.vue'), meta: { title: '媒体库' } },
      { path: 'categories', name: 'categories', component: () => import('../views/Categories.vue'), meta: { title: '分类' } },
      { path: 'tags', name: 'tags', component: () => import('../views/Tags.vue'), meta: { title: '标签' } },
      { path: 'users', name: 'users', component: () => import('../views/Users.vue'), meta: { title: '用户', admin: true } },
      { path: 'invite-codes', name: 'invite-codes', component: () => import('../views/InviteCodes.vue'), meta: { title: '邀请码', admin: true } },
      { path: 'settings', name: 'settings', component: () => import('../views/Settings.vue'), meta: { title: '设置', admin: true } },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory('/admin/'),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.public) return true;
  if (!auth.user) {
    const ok = await auth.fetchMe();
    if (!ok) return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.admin && !auth.isAdmin) return { name: 'dashboard' };
  return true;
});
