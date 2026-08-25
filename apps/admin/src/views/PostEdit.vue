<template>
  <n-card :title="isEdit ? '编辑文章' : '写文章'">
    <n-spin :show="loading">
      <n-grid :cols="3" x-gap="12" responsive="screen" item-responsive>
        <n-grid-item span="3 l:2">
          <n-input v-model:value="form.title" placeholder="文章标题" size="large" style="margin-bottom:12px;" />
          <MdEditor v-model="form.contentMd" :on-upload-img="handleUploadImg" :toolbars="toolbars" style="height:520px;" />
        </n-grid-item>
        <n-grid-item span="3 l:1">
          <n-form label-placement="top" style="padding-left:8px;">
            <n-form-item label="Slug">
              <n-input v-model:value="form.slug" placeholder="留空则按标题自动生成（拼音）" />
            </n-form-item>
            <n-form-item label="摘要">
              <n-input v-model:value="form.summary" type="textarea" :rows="3" placeholder="留空则自动截取正文前 200 字" />
            </n-form-item>
            <n-form-item label="封面图 URL">
              <n-input v-model:value="form.coverImage" placeholder="https://…" />
            </n-form-item>
            <n-form-item label="分类">
              <n-select v-model:value="form.categoryId" :options="categoryOptions" clearable placeholder="选择分类" />
            </n-form-item>
            <n-form-item label="标签">
              <n-select v-model:value="form.tagNames" multiple filterable tag :options="tagOptions" placeholder="选择或输入新标签" />
            </n-form-item>
            <n-form-item label="阅读权限">
              <n-select v-model:value="form.visibility" :options="visibilityOptions" />
            </n-form-item>
            <n-form-item v-if="form.visibility === 'password'" label="访问密码">
              <n-input v-model:value="form.password" type="password" placeholder="设置阅读密码" />
            </n-form-item>
            <n-form-item label="状态">
              <n-select v-model:value="form.status" :options="statusOptions" />
            </n-form-item>
            <n-form-item v-if="form.status === 'scheduled'" label="发布时间">
              <n-date-picker v-model:value="publishAtTs" type="datetime" style="width:100%;" />
            </n-form-item>
            <n-form-item>
              <n-space>
                <n-button type="primary" :loading="saving" @click="save('draft')">保存草稿</n-button>
                <n-button type="success" :loading="saving" @click="save('published')">发布</n-button>
                <n-upload :show-file-list="false" accept=".md,.markdown,.zip" :custom-request="importRequest">
                  <n-button>导入 md/zip</n-button>
                </n-upload>
                <n-button @click="router.push('/posts')">返回</n-button>
              </n-space>
            </n-form-item>
          </n-form>
        </n-grid-item>
      </n-grid>
    </n-spin>

    <n-modal v-model:show="importShow" preset="card" title="导入结果" style="width:520px;">
      <p v-if="importResult">来源：{{ importResult.source }} · 标题：{{ importResult.post.title }}（已作为草稿载入，尚未保存到服务器）</p>
      <n-alert v-if="importResult && importResult.unresolvedImages.length" type="warning" style="margin-top:8px;">
        发现 {{ importResult.unresolvedImages.length }} 张相对路径图片未上传：{{ importResult.unresolvedImages.join('，') }}。
        <br />请在正文中用编辑器的图片上传功能重新插入这些图片（或使用媒体库上传后替换链接）。
      </n-alert>
      <template #footer>
        <n-button type="primary" @click="importShow = false">知道了</n-button>
      </template>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import type { UploadCustomRequestOptions } from 'naive-ui';
import { MdEditor, type ToolbarNames } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import type { CategoryDTO, TagDTO } from '@qujt/shared';
import { mediaApi, postsApi, taxonomyApi } from '../api/index.js';
import type { AdminPostDTO } from '../types.js';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const isEdit = computed(() => route.params.id !== undefined);
const postId = computed(() => Number(route.params.id));

const loading = ref(false);
const saving = ref(false);
const categories = ref<CategoryDTO[]>([]);
const tags = ref<TagDTO[]>([]);
const importShow = ref(false);
const importResult = ref<{ source: string; post: AdminPostDTO; unresolvedImages: string[] } | null>(null);
const publishAtTs = ref<number | null>(null);

const categoryOptions = computed(() => categories.value.map((c) => ({ label: c.name, value: c.id })));
const tagOptions = computed(() => tags.value.map((t) => ({ label: t.name, value: t.name })));
const visibilityOptions = [
  { label: '公开', value: 'public' },
  { label: '仅登录用户', value: 'login' },
  { label: '密码访问', value: 'password' },
  { label: '私密（仅自己）', value: 'private' },
];
const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '定时发布', value: 'scheduled' },
];
const toolbars = [
  'bold', 'italic', 'strikeThrough', 'underline', 'quote', 'unorderedList', 'orderedList', 'task', 'link', 'image', 'code', 'codeRow', 'codeBlock', 'table', 'mermaid', 'katex', 'fullscreen', 'preview', 'htmlPreview', 'catalog', 'save',
] as ToolbarNames[];

const form = reactive({
  title: '',
  slug: '',
  summary: '',
  coverImage: '',
  categoryId: null as number | null,
  tagNames: [] as string[],
  visibility: 'public',
  password: '',
  status: 'draft',
  contentMd: '',
});

async function loadMeta() {
  const [c, t] = await Promise.all([taxonomyApi.categories(), taxonomyApi.tags()]);
  categories.value = c.items;
  tags.value = t.items;
}

async function loadPost() {
  if (!isEdit.value) return;
  loading.value = true;
  try {
    const { post } = await postsApi.get(postId.value);
    form.title = post.title;
    form.slug = post.slug;
    form.summary = post.summary ?? '';
    form.coverImage = post.coverImage ?? '';
    form.categoryId = post.category?.id ?? null;
    form.tagNames = post.tags.map((t) => t.name);
    form.visibility = post.visibility;
    form.status = post.status;
    form.contentMd = post.contentMd;
    publishAtTs.value = post.publishAt ? new Date(post.publishAt).getTime() : null;
  } finally {
    loading.value = false;
  }
}

function buildPayload(forceStatus?: string) {
  const status = forceStatus ?? form.status;
  const payload: Record<string, unknown> = {
    title: form.title,
    contentMd: form.contentMd,
    visibility: form.visibility,
    status,
  };
  if (form.slug.trim()) payload.slug = form.slug.trim();
  if (form.summary.trim()) payload.summary = form.summary.trim();
  if (form.coverImage.trim()) payload.coverImage = form.coverImage.trim();
  if (form.categoryId != null) payload.categoryId = form.categoryId;
  if (form.tagNames.length) payload.tagNames = form.tagNames;
  if (form.visibility === 'password') {
    if (form.password) payload.password = form.password;
  } else {
    payload.password = null;
  }
  if (status === 'scheduled') {
    if (!publishAtTs.value) throw new Error('定时发布需要选择发布时间');
    payload.publishAt = new Date(publishAtTs.value).toISOString();
  }
  return payload;
}

async function save(forceStatus: string) {
  if (!form.title.trim()) return message.warning('请填写标题');
  if (!form.contentMd.trim()) return message.warning('正文为空');
  saving.value = true;
  try {
    const payload = buildPayload(forceStatus);
    if (isEdit.value) {
      await postsApi.update(postId.value, payload);
      message.success('已保存');
    } else {
      await postsApi.create(payload);
      message.success('已创建');
    }
    router.push('/posts');
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    saving.value = false;
  }
}

const handleUploadImg = async (files: File[], callback: (urls: string[], texts: string[]) => void) => {
  const urls: string[] = [];
  const texts: string[] = [];
  for (const f of files) {
    try {
      const res = await mediaApi.upload(f);
      urls.push(res.media.url);
      texts.push(f.name);
    } catch (e) {
      message.error((e as Error).message);
      urls.push('');
      texts.push('');
    }
  }
  callback(urls, texts);
};

const importRequest = async (opt: UploadCustomRequestOptions) => {
  const file = opt.file.file as File;
  try {
    const res = await postsApi.importFile(file);
    form.title = res.post.title;
    form.slug = res.post.slug;
    form.summary = res.post.summary ?? '';
    form.coverImage = res.post.coverImage ?? '';
    form.categoryId = res.post.category?.id ?? null;
    form.tagNames = res.post.tags.map((t) => t.name);
    form.visibility = res.post.visibility;
    form.status = 'draft';
    form.contentMd = res.post.contentMd;
    importResult.value = res;
    importShow.value = true;
    opt.onFinish();
    message.success('导入成功，内容已载入编辑器（保存后生效）');
  } catch (e) {
    opt.onError();
    message.error((e as Error).message);
  }
};

onMounted(async () => {
  await loadMeta();
  await loadPost();
});
</script>