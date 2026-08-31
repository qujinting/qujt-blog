<template>
  <div class="od-page" :data-theme="theme">
    <header class="topnav">
      <div class="container topnav-inner">
        <a class="brand" href="#" @click.prevent>留白<small>Marginalia</small></a>

        <nav class="links" aria-label="主导航">
          <a href="#" aria-current="page">首页</a>
          <a href="#grid">归档</a>
          <a href="#grid">分类</a>
          <a href="#">关于</a>
        </nav>

        <div class="nav-actions">
          <button class="icon-btn" @click="toggleTheme" aria-label="切换日间与夜间模式" title="切换日间 / 夜间">
            <svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" :style="{ display: theme === 'dark' ? 'none' : 'block' }"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4L19 19M19 5l-1.6 1.6M6.6 17.4L5 19"/></svg>
            <svg class="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" :style="{ display: theme === 'dark' ? 'block' : 'none' }"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>
          </button>
          <button v-if="!auth.user" class="btn btn-secondary" @click="goLogin">登录</button>
          <button v-else class="nav-user" @click="logout" aria-haspopup="true" aria-expanded="false">
            <span class="avatar sm">{{ auth.user.nickname.charAt(0).toUpperCase() }}</span>
            <span class="who"><b>{{ auth.user.nickname }}</b></span>
          </button>
          <button class="icon-btn menu-toggle" @click="mobileOpen = !mobileOpen" aria-label="打开菜单">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </div>
      </div>
      <nav class="container mobile-menu" :class="{ open: mobileOpen }" aria-label="移动端导航">
        <a href="#">首页</a><a href="#grid">归档</a><a href="#grid">分类</a><a href="#">关于</a>
        <button v-if="!auth.user" class="btn btn-secondary" @click="goLogin">登录</button>
      </nav>
    </header>

    <main id="content">
      <section class="container masthead">
        <p class="kicker">编辑日志 · Editor's Journal · 2026</p>
        <h1>设计与产品的手艺，<br>值得被认真记录。</h1>
        <p class="lead">我们细读界面、系统与工艺中每一个不起眼的决定，并把它写成可以带走的方法与品评。</p>
      </section>

      <section class="container" aria-label="筛选与搜索">
        <div class="filter-bar">
          <div class="chips" role="group" aria-label="按分类筛选">
            <button v-for="c in categoryLabels" :key="c.id" class="fchip" :class="{ active: c.id === curCatId }" @click="setCat(c)">{{ c.name }}</button>
          </div>
          <div class="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6"/><path d="m20 20-3.2-3.2"/></svg>
            <input v-model="query" type="search" placeholder="搜索标题或摘要" aria-label="搜索文章" />
          </div>
        </div>
      </section>

      <section class="section" id="grid">
        <div class="container">
          <div class="row-between" style="margin-bottom:40px; align-items:baseline;">
            <h2>{{ gridTitle }}</h2>
            <span class="result-count">{{ resultCount }}</span>
          </div>
          <p class="lead" style="color: var(--muted); font-size:15px; margin:-22px 0 0;">没有封面也不影响阅读——有的文章，只用标题就足以开场。</p>

          <div v-if="loading && items.length === 0" class="empty">
            <p style="margin:0;">加载中…</p>
          </div>

          <div class="grid">
            <article v-for="(p, idx) in items" :key="p.id" class="post-card" @click="openPost(p)" :aria-label="'阅读：' + p.title">
              <div class="post-cover" :class="{ plate: !p.coverImage }">
                <img v-if="p.coverImage" :src="p.coverImage" alt="" class="cover-img" loading="lazy" />
                <span class="cover-mark">M·L</span>
                <span class="cover-num">{{ (idx + 1).toString().padStart(2, '0') }}</span>
              </div>
              <span class="post-cat">{{ p.category?.name ?? '未分类' }}</span>
              <h3>{{ p.title }}</h3>
              <p class="dek">{{ p.summary }}</p>
              <div class="byline">
                <span class="meta">{{ date(p) }} · {{ readTime(p) }}</span>
              </div>
            </article>
          </div>

          <div v-if="!loading && items.length === 0" class="empty">
            <p style="margin:0 0 6px;">没有匹配的文章。</p>
            <button class="btn btn-secondary" @click="clearFilter">清除筛选</button>
          </div>
          <div v-if="items.length < total" class="load-more">
            <button class="btn btn-ghost btn-arrow" :disabled="loading" @click="loadMore">加载更多</button>
          </div>
        </div>
      </section>
    </main>

    <footer class="pagefoot">
      <div class="container row-between">
        <span>© 2026 留白 Marginalia · 深圳 / 上海</span>
        <span class="meta">编辑来信 · hello@liubai.studio</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import type { PostSummaryDTO } from '@qujt/shared';
import { postsApi } from '../api/index.js';
import { useSiteStore } from '../stores/site.js';
import { useAuthStore } from '../stores/auth.js';

const router = useRouter();
const site = useSiteStore();
const auth = useAuthStore();

const items = ref<PostSummaryDTO[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 9;
const loading = ref(false);
const curCatId = ref(0);
const query = ref('');
const theme = ref<'light' | 'dark'>('light');
const mobileOpen = ref(false);

let searchTimer: number | undefined;

const categoryLabels = computed(() => [
  { id: 0, name: '全部' },
  ...(site.info?.categories ?? []).map((c) => ({ id: c.id, name: c.name })),
]);
const curCatName = computed(() => categoryLabels.value.find((c) => c.id === curCatId.value)?.name ?? '');
const gridTitle = computed(() => (curCatId.value ? '分类 · ' + curCatName.value : '最新文章'));
const resultCount = computed(() => (total.value ? '共 ' + total.value + ' 篇' : ''));

function date(p: PostSummaryDTO) {
  return dayjs(p.publishAt ?? p.createdAt).format('YYYY-MM-DD');
}
function readTime(p: PostSummaryDTO) {
  const mins = Math.max(1, Math.round((p.wordCount || 0) / 300));
  return mins + ' 分钟';
}

async function reload(reset = true) {
  if (reset) {
    page.value = 1;
    items.value = [];
  }
  loading.value = true;
  try {
    const res = await postsApi.list({
      page: page.value,
      pageSize,
      category: curCatId.value ? String(curCatId.value) : undefined,
      q: query.value.trim() || undefined,
    });
    items.value = reset ? res.items : items.value.concat(res.items);
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function setCat(c: { id: number; name: string }) {
  curCatId.value = c.id;
  reload(true);
}
function clearFilter() {
  curCatId.value = 0;
  query.value = '';
  reload(true);
}
function loadMore() {
  page.value += 1;
  reload(false);
}
function openPost(p: PostSummaryDTO) {
  router.push('/post/' + p.slug);
}
function goLogin() {
  router.push({ path: '/login', query: { redirect: '/' } });
}
async function logout() {
  await auth.logout();
}

function applyTheme(t: 'light' | 'dark') {
  theme.value = t;
  try {
    localStorage.setItem('od-theme', t);
  } catch {
    /* ignore */
  }
}
function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark');
}

watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => reload(true), 300);
});

onMounted(async () => {
  let t = localStorage.getItem('od-theme') as 'light' | 'dark' | null;
  if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(t);
  await Promise.all([site.load(), auth.fetchMe()]);
  await reload(true);
});
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<style>
.od-page,
.od-page *,
.od-page *::before,
.od-page *::after {
  box-sizing: border-box;
}
.od-page {
  --bg: oklch(98% 0.004 95);
  --surface: oklch(100% 0.002 95);
  --fg: oklch(20% 0.018 70);
  --muted: oklch(48% 0.012 70);
  --border: oklch(90% 0.006 95);
  --accent: oklch(52% 0.10 28);
  color-scheme: light;
  --accent-soft: color-mix(in oklch, var(--accent) 14%, transparent);
  --fg-soft: color-mix(in oklch, var(--fg) 6%, transparent);
  --font-display: 'Iowan Old Style', 'Charter', 'Songti SC', 'Noto Serif SC', Georgia, serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, 'SFMono-Regular', monospace;
  --fs-h1: clamp(40px, 5.4vw, 64px);
  --fs-h2: clamp(28px, 3.4vw, 40px);
  --fs-h3: 22px;
  --fs-lead: 19px;
  --fs-body: 16px;
  --fs-meta: 13px;
  --gap-xs: 8px;
  --gap-sm: 12px;
  --gap-md: 20px;
  --gap-lg: 32px;
  --gap-xl: 56px;
  --gap-2xl: 96px;
  --container: 1120px;
  --gutter: 32px;
  --radius: 4px;
  --radius-lg: 6px;
  --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-body);
  font-size: var(--fs-body);
  line-height: 1.6;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  transition: background 0.25s ease, color 0.25s ease;
}
.od-page[data-theme="dark"] {
  --bg: oklch(17% 0.010 70);
  --surface: oklch(21% 0.010 70);
  --fg: oklch(93% 0.004 95);
  --muted: oklch(64% 0.012 70);
  --border: oklch(29% 0.008 70);
  --accent: oklch(66% 0.11 28);
  color-scheme: dark;
}
.od-page img,
.od-page svg {
  display: block;
  max-width: 100%;
}
.od-page a {
  color: inherit;
  text-decoration: none;
}
.od-page button {
  font: inherit;
  cursor: pointer;
  background: none;
  border: 0;
  color: inherit;
}
.od-page p {
  text-wrap: pretty;
}
.od-page h1,
.od-page h2,
.od-page h3,
.od-page h4 {
  text-wrap: balance;
}
.od-page .container {
  max-width: var(--container);
  margin-inline: auto;
  padding-inline: var(--gutter);
}
.od-page .section {
  padding-block: clamp(48px, 7vw, 92px);
}
.od-page .section + .section {
  border-top: 1px solid var(--border);
}
.od-page .row {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
}
.od-page .row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-md);
}
.od-page .grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--gap-lg);
}
.od-page .grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--gap-lg);
}
@media (max-width: 920px) {
  .od-page .grid-3,
  .od-page .grid-2 {
    grid-template-columns: 1fr;
  }
}
.od-page .h1,
.od-page h1 {
  font-family: var(--font-display);
  font-size: var(--fs-h1);
  line-height: 1.08;
  letter-spacing: -0.02em;
  margin: 0;
}
.od-page .h2,
.od-page h2 {
  font-family: var(--font-display);
  font-size: var(--fs-h2);
  line-height: 1.12;
  letter-spacing: -0.015em;
  margin: 0;
}
.od-page .h3,
.od-page h3 {
  font-size: var(--fs-h3);
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.005em;
  margin: 0;
}
.od-page .lead {
  font-size: var(--fs-lead);
  line-height: 1.55;
  color: var(--muted);
  max-width: 62ch;
  margin: 0;
}
.od-page .eyebrow {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 var(--gap-md);
}
.od-page .meta {
  font-family: var(--font-mono);
  font-size: var(--fs-meta);
  color: var(--muted);
}
.od-page .topnav {
  position: sticky;
  top: 0;
  z-index: 20;
  background: color-mix(in oklch, var(--bg) 88%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.od-page .topnav-inner {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding-block: 13px;
}
.od-page .brand {
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.od-page .brand small {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 400;
  margin-top: 1px;
}
.od-page .topnav nav.links {
  display: flex;
  gap: var(--gap-lg);
  margin-left: auto;
}
.od-page .topnav nav.links a {
  font-size: 14px;
  color: var(--muted);
  transition: color 0.15s ease;
}
.od-page .topnav nav.links a:hover,
.od-page .topnav nav.links a[aria-current="page"] {
  color: var(--fg);
}
.od-page .nav-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
}
.od-page .icon-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--radius);
  display: grid;
  place-items: center;
  color: var(--muted);
  border: 1px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.od-page .icon-btn:hover {
  color: var(--fg);
  border-color: var(--border);
  background: var(--surface);
}
.od-page .icon-btn svg {
  width: 20px;
  height: 20px;
}
.od-page .btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 20px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.005em;
  transition: transform 0.05s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  min-height: 44px;
}
.od-page .btn:active {
  transform: translateY(1px);
}
.od-page .btn-secondary {
  background: transparent;
  color: var(--fg);
  border-color: var(--border);
}
.od-page .btn-secondary:hover {
  border-color: var(--fg);
}
.od-page .btn-ghost {
  background: transparent;
  color: var(--fg);
  border-color: transparent;
  padding-inline: 10px;
}
.od-page .btn-ghost:hover {
  background: var(--fg-soft);
  color: var(--fg);
}
.od-page .btn-ghost:disabled {
  opacity: 0.5;
  cursor: default;
}
.od-page .btn-arrow::after {
  content: '→';
  transition: transform 0.15s ease;
}
.od-page .btn-arrow:hover::after {
  transform: translateX(3px);
}
.od-page .nav-user {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 4px 5px;
  border: 1px solid var(--border);
  border-radius: 999px;
  min-height: 44px;
}
.od-page .nav-user:hover {
  border-color: var(--fg);
}
.od-page .avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  flex: none;
  display: grid;
  place-items: center;
  background: color-mix(in oklch, var(--fg) 88%, transparent);
  color: var(--bg);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 600;
}
.od-page .avatar.sm {
  width: 26px;
  height: 26px;
  font-size: 12px;
}
.od-page .nav-user .who {
  text-align: left;
  line-height: 1.1;
}
.od-page .nav-user .who b {
  font-size: 13px;
  font-weight: 600;
  display: block;
}
.od-page .nav-user .who span {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.od-page .pagefoot {
  padding-block: var(--gap-xl);
  color: var(--muted);
  font-size: 13px;
  border-top: 1px solid var(--border);
}
.od-page .pagefoot .row-between {
  flex-wrap: wrap;
  gap: var(--gap-md);
}
.od-page .pagefoot a:hover {
  color: var(--fg);
}
.od-page .masthead {
  padding-block: clamp(56px, 9vw, 116px) clamp(32px, 5vw, 60px);
}
.od-page .masthead .kicker {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: var(--gap-md);
}
.od-page .masthead h1 {
  max-width: 16em;
}
.od-page .masthead .lead {
  margin-top: var(--gap-md);
  max-width: 44ch;
}
.od-page .filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-md);
  align-items: center;
  justify-content: space-between;
  padding-block: 18px;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.od-page .chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-sm);
}
.od-page .fchip {
  padding: 9px 16px;
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 14px;
  color: var(--muted);
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.od-page .fchip:hover {
  color: var(--fg);
  border-color: var(--fg);
}
.od-page .fchip.active {
  background: color-mix(in oklch, var(--accent) 72%, var(--fg));
  border-color: color-mix(in oklch, var(--accent) 72%, var(--fg));
  color: var(--bg);
}
.od-page .search {
  position: relative;
  display: flex;
  align-items: center;
}
.od-page .search svg {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: var(--muted);
  pointer-events: none;
}
.od-page .search input {
  width: 240px;
  padding: 11px 16px 11px 40px;
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 14px;
  transition: border-color 0.15s ease;
}
.od-page .search input:focus {
  outline: none;
  border-color: var(--fg);
}
.od-page .search input::placeholder {
  color: var(--muted);
}
.od-page .result-count {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 0.04em;
}
@media (max-width: 620px) {
  .od-page .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .od-page .search {
    width: 100%;
  }
  .od-page .search input {
    width: 100%;
  }
}
.od-page .post-cover {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.od-page .post-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--grain);
  opacity: 0.3;
  mix-blend-mode: overlay;
  pointer-events: none;
}
.od-page .post-cover .cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.od-page .post-cover .cover-num {
  position: absolute;
  right: 14px;
  bottom: 6px;
  font-family: var(--font-display);
  font-size: 96px;
  line-height: 1;
  font-weight: 600;
  color: color-mix(in oklch, var(--fg) 26%, transparent);
  letter-spacing: -0.04em;
}
.od-page .post-cover .cover-mark {
  position: absolute;
  top: 14px;
  left: 16px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: color-mix(in oklch, var(--fg) 55%, transparent);
}
.od-page .post-cover.plate {
  background: linear-gradient(160deg, color-mix(in oklch, var(--bg) 76%, var(--surface)), color-mix(in oklch, var(--fg) 7%, var(--surface)));
}
.od-page .post-cover.plate::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(to bottom, color-mix(in oklch, var(--fg) 11%, transparent) 0 1px, transparent 1px 42px);
  opacity: 0.55;
}
.od-page .post-cover.plate::after {
  opacity: 0.16;
}
.od-page .post-cover.plate .cover-mark {
  color: color-mix(in oklch, var(--muted) 78%, transparent);
}
.od-page .post-cover.plate .cover-num {
  color: color-mix(in oklch, var(--fg) 34%, transparent);
}
.od-page .post-card {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
  padding-top: 22px;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.od-page .post-card .post-cover {
  aspect-ratio: 3 / 2;
  margin-bottom: var(--gap-md);
}
.od-page .post-card .post-cover .cover-num {
  font-size: 64px;
}
.od-page .post-card:hover {
  transform: translateY(-2px);
}
.od-page .post-cat {
  display: inline-flex;
  align-self: flex-start;
  padding: 3px 9px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.od-page .post-card h3 {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 22px;
  line-height: 1.25;
  letter-spacing: -0.01em;
}
.od-page .post-card:hover h3 {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
  text-decoration-color: color-mix(in oklch, var(--accent) 80%, var(--fg));
}
.od-page .post-card .dek {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 14.5px;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.od-page .byline {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding-top: 18px;
}
.od-page .grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px 34px;
}
@media (max-width: 920px) {
  .od-page .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 620px) {
  .od-page .grid {
    grid-template-columns: 1fr;
  }
}
.od-page .empty {
  text-align: center;
  padding: 56px 0;
  color: var(--muted);
}
.od-page .empty .btn {
  margin-top: 18px;
}
.od-page .load-more {
  margin-top: var(--gap-2xl);
  text-align: center;
}
.od-page .mobile-menu {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 12px 0 18px;
  border-top: 1px solid var(--border);
}
.od-page .mobile-menu a {
  padding: 12px 0;
  font-size: 16px;
  color: var(--fg);
  border-bottom: 1px solid var(--border);
}
.od-page .mobile-menu.open {
  display: flex;
}
@media (max-width: 920px) {
  .od-page .topnav nav.links {
    display: none;
  }
  .od-page .menu-toggle {
    display: grid;
  }
  .od-page .nav-actions .btn:not(.icon-btn) {
    display: none;
  }
  .od-page .mobile-menu .btn {
    width: 100%;
    justify-content: center;
    margin-top: 12px;
  }
}
.od-page :focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
