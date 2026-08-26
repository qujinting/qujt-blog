import { createApp } from 'vue';
import { createPinia } from 'pinia';
import naive from 'naive-ui';
import App from './App.vue';
import { router } from './router/index.js';
import { useAuthStore } from './stores/auth.js';
import './styles/article.css';
import './styles/global.css';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';

createApp(App).use(createPinia()).use(router).use(naive).mount('#app');

// 会话失效事件（由 api client 派发）
useAuthStore().init();