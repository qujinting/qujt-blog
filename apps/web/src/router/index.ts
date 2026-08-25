import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  {
    path: '/',
    component: () => import('../layouts/WebLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('../views/Home.vue') },
      { path: 'post/:slug', name: 'post', component: () => import('../views/PostDetail.vue') },
      { path: 'profile', name: 'profile', component: () => import('../views/Profile.vue'), meta: { auth: true } },
    ],
  },
  { path: '/login', name: 'login', component: () => import('../views/Login.vue'), meta: { public: true } },
  { path: '/register', name: 'register', component: () => import('../views/Register.vue'), meta: { public: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFound.vue'), meta: { public: true } },
];

export const router = createRouter({
  history: createWebHistory('/'),
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
