import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import AdmZip from 'adm-zip';
import { adminHeaders, adminSession, makeApp, multipartBody } from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('MD / zip 导入', () => {
  it('导入 .md（front matter + 相对图片）→ 草稿 + 未解析图片清单', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const md = `---\ntitle: 导入测试\ntags: [Vue, 前端]\ncategory: 技术\nsummary: 导入摘要\n---\n# 导入测试\n\n正文 ![本地图](images/a.png) ![外链](https://cdn.example.com/b.png)\n`;
    const { body, contentType } = multipartBody({
      file: { filename: 'test.md', content: md, type: 'text/markdown' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/posts/import',
      headers: { ...adminHeaders(cookies), 'content-type': contentType },
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    const data = res.json();
    expect(data.source).toBe('md');
    expect(data.post.title).toBe('导入测试');
    expect(data.post.status).toBe('draft');
    expect(data.post.summary).toBe('导入摘要');
    expect(data.post.tags.map((t: { name: string }) => t.name)).toEqual(['Vue', '前端']);
    expect(data.post.category.name).toBe('技术');
    expect(data.unresolvedImages).toEqual(['images/a.png']);
  });

  it('导入 .zip（内含 .md）', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const zip = new AdmZip();
    zip.addFile('post.md', Buffer.from('---\ntitle: zip 导入\n---\n正文 ![img](images/x.png)'));
    const { body, contentType } = multipartBody({
      file: { filename: 'bundle.zip', content: zip.toBuffer(), type: 'application/zip' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/posts/import',
      headers: { ...adminHeaders(cookies), 'content-type': contentType },
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().source).toBe('zip');
    expect(res.json().post.title).toBe('zip 导入');
    expect(res.json().unresolvedImages).toContain('images/x.png');
  });

  it('不支持的文件类型 → 415', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const { body, contentType } = multipartBody({
      file: { filename: 'a.txt', content: 'hello' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/posts/import',
      headers: { ...adminHeaders(cookies), 'content-type': contentType },
      payload: body,
    });
    expect(res.statusCode).toBe(415);
  });
});
