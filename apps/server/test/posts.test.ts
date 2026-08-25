import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { adminHeaders, adminSession, makeApp } from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('后台文章 CRUD 与前台发布链路', () => {
  it('创建草稿 → 前台列表不含 → 发布 → 前台可见（中文标题转拼音 slug）', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/posts',
      headers: adminHeaders(cookies),
      payload: { title: '你好世界', contentMd: '# 你好世界\n\n正文内容', visibility: 'public' },
    });
    expect(created.statusCode).toBe(201);
    const post = created.json().post;
    expect(post.slug).toBeTruthy();
    expect(post.status).toBe('draft');
    expect(post.contentHtml).toContain('<h1');
    expect(post.passwordProtected).toBe(false);

    const list1 = await app.inject({ method: 'GET', url: '/api/posts' });
    expect(list1.json().total).toBe(0);

    const pub = await app.inject({
      method: 'POST',
      url: `/api/admin/posts/${post.id}/publish`,
      headers: adminHeaders(cookies),
    });
    expect(pub.statusCode).toBe(200);
    expect(pub.json().post.status).toBe('published');
    expect(pub.json().post.publishAt).toBeTruthy();

    const detail = await app.inject({ method: 'GET', url: `/api/posts/${post.slug}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().post.title).toBe('你好世界');

    const list2 = await app.inject({ method: 'GET', url: '/api/posts' });
    expect(list2.json().total).toBe(1);
  });

  it('slug 冲突自动追加序号', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const p1 = await app.inject({
      method: 'POST',
      url: '/api/admin/posts',
      headers: adminHeaders(cookies),
      payload: { title: '同名文章', contentMd: 'x' },
    });
    const p2 = await app.inject({
      method: 'POST',
      url: '/api/admin/posts',
      headers: adminHeaders(cookies),
      payload: { title: '同名文章', contentMd: 'x' },
    });
    expect(p1.statusCode).toBe(201);
    expect(p2.statusCode).toBe(201);
    expect(p1.json().post.slug).not.toBe(p2.json().post.slug);
  });

  it('分类与标签关联（草稿不计入公共计数）', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const cat = await app.inject({
      method: 'POST',
      url: '/api/admin/categories',
      headers: adminHeaders(cookies),
      payload: { name: '技术' },
    });
    expect(cat.statusCode).toBe(201);
    const catId = cat.json().category.id;

    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/posts',
      headers: adminHeaders(cookies),
      payload: { title: '带分类', contentMd: 'x', categoryId: catId, tagNames: ['Vue', 'Node'] },
    });
    expect(created.json().post.category.name).toBe('技术');
    expect(created.json().post.tags.map((t: { name: string }) => t.name)).toEqual(['Vue', 'Node']);

    const pubCat = await app.inject({ method: 'GET', url: '/api/categories' });
    const found = pubCat.json().items.find((c: { id: number }) => c.id === catId);
    expect(found.postCount).toBe(0);
  });

  it('更新后重新编译 HTML', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/posts',
      headers: adminHeaders(cookies),
      payload: { title: '旧标题', contentMd: '## 旧内容' },
    });
    const id = created.json().post.id;
    const updated = await app.inject({
      method: 'PUT',
      url: `/api/admin/posts/${id}`,
      headers: adminHeaders(cookies),
      payload: { title: '新标题', contentMd: '## 新内容' },
    });
    expect(updated.statusCode).toBe(200);
    const post = updated.json().post;
    expect(post.title).toBe('新标题');
    expect(post.contentHtml).toContain('新内容');
    expect(post.contentHtml).not.toContain('旧内容');
    expect(post.toc[0]!.text).toBe('新内容');
  });

  it('删除文章', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/posts',
      headers: adminHeaders(cookies),
      payload: { title: '待删除', contentMd: 'x' },
    });
    const id = created.json().post.id;
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/admin/posts/${id}`,
      headers: adminHeaders(cookies),
    });
    expect(del.statusCode).toBe(200);
    const get = await app.inject({
      method: 'GET',
      url: `/api/admin/posts/${id}`,
      headers: adminHeaders(cookies),
    });
    expect(get.statusCode).toBe(404);
  });
});
