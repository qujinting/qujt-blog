import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { publishDuePosts } from '../src/services/scheduler.js';
import { adminHeaders, adminSession, makeApp } from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('定时发布', () => {
  it('scheduled 无 publishAt → 422', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/posts',
      headers: adminHeaders(cookies),
      payload: { title: '定时', contentMd: 'x', status: 'scheduled' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('PUBLISH_AT_REQUIRED');
  });

  it('到期文章由调度发布，未来文章不动', async () => {
    app = await makeApp();
    const cookies = await adminSession(app);
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 3600_000).toISOString();

    const due = await app.inject({
      method: 'POST',
      url: '/api/admin/posts',
      headers: adminHeaders(cookies),
      payload: { title: '到期文章', contentMd: 'x', status: 'scheduled', publishAt: past },
    });
    const later = await app.inject({
      method: 'POST',
      url: '/api/admin/posts',
      headers: adminHeaders(cookies),
      payload: { title: '未来文章', contentMd: 'x', status: 'scheduled', publishAt: future },
    });
    expect(due.statusCode).toBe(201);
    expect(later.statusCode).toBe(201);

    const n = publishDuePosts(app.db);
    expect(n).toBe(1);

    const duePost = await app.inject({
      method: 'GET',
      url: `/api/admin/posts/${due.json().post.id}`,
      headers: adminHeaders(cookies),
    });
    expect(duePost.json().post.status).toBe('published');
    const laterPost = await app.inject({
      method: 'GET',
      url: `/api/admin/posts/${later.json().post.id}`,
      headers: adminHeaders(cookies),
    });
    expect(laterPost.json().post.status).toBe('scheduled');
  });
});
