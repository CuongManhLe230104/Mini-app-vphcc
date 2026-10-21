// Uses only local development MySQL; cleans up records created by this test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
require('dotenv').config();
require('reflect-metadata');

test('HTTP workflows run correctly against MySQL', { timeout: 60000 }, async t => {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(process.env.NODE_ENV, 'development', 'Integration test is development-only');
  assert.equal(url.protocol, 'mysql:');
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Only local MySQL is permitted');
  assert.equal(url.pathname, '/mini_app_nghia_thanh');

  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const { createValidationPipe } = require('../dist/common/validation.pipe');
  const bcrypt = require('bcrypt');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  const db = app.get(PrismaService);
  const runId = randomUUID();
  const ids = {};
  t.after(async () => {
    try {
      if (ids.post) await db.post.deleteMany({ where: { id: ids.post } });
      if (ids.notice) await db.notice.deleteMany({ where: { id: ids.notice } });
      if (ids.procedure) await db.procedure.deleteMany({ where: { id: ids.procedure } });
      if (ids.field) await db.procedureField.deleteMany({ where: { id: ids.field } });
      if (ids.admin) await db.auditLog.deleteMany({ where: { adminId: ids.admin } });
      if (ids.admin) await db.admin.deleteMany({ where: { id: ids.admin } });
    } finally { await app.close(); }
  });
  app.useGlobalPipes(createValidationPipe());
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()) + '/api/v1';
  let token;
  async function request(method, route, body, authenticated = false) {
    const res = await fetch(base + route, {
      method,
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  }
  const password = randomBytes(24).toString('hex');
  const admin = await db.admin.create({ data: { username: 'test-' + runId, fullName: '[DỮ LIỆU KIỂM THỬ]', passwordHash: await bcrypt.hash(password, 10), role: 'SUPER_ADMIN' } });
  ids.admin = admin.id;
  const field = await db.procedureField.create({ data: { slug: 'test-' + runId, label: '[DỮ LIỆU KIỂM THỬ]' } });
  ids.field = field.id;

  await t.test('admin login and authenticated endpoints', async () => {
    const login = await request('POST', '/auth/admin/login', { username: admin.username, password });
    assert.equal(login.status, 200);
    token = login.data.accessToken;
    assert.ok(token);
    assert.equal((await request('GET', '/auth/me', undefined, true)).status, 200);
    assert.equal((await request('POST', '/posts/admin/draft', { title: 'x', content: 'x', type: 'NEWS' })).status, 401);
  });

  await t.test('JSON tags, long text, MySQL search and draft/publish visibility', async () => {
    const draft = await request('POST', '/posts/admin/draft', { title: '[DỮ LIỆU KIỂM THỬ] ' + runId, content: 'Nội dung thử', summary: 'Tóm tắt '.repeat(100), type: 'NEWS', tags: ['Tiếng Việt'] }, true);
    assert.equal(draft.status, 201);
    ids.post = draft.data.id;
    assert.deepEqual(draft.data.tags, ['Tiếng Việt']);
    assert.equal((await request('GET', '/posts/' + ids.post)).status, 404);
    assert.equal((await request('POST', '/posts/admin/' + ids.post + '/submit', {}, true)).status, 201);
    assert.equal((await request('POST', '/posts/admin/' + ids.post + '/publish', {}, true)).status, 201);
    const post = await request('GET', '/posts/' + ids.post);
    assert.equal(post.status, 200);
    assert.equal(post.data.rejectionNote, undefined);
    const found = await request('GET', '/posts?search=' + runId.toUpperCase());
    assert.equal(found.status, 200);
    assert.ok(found.data.data.some(p => p.id === ids.post));
    assert.equal((await request('POST', '/posts/admin/' + ids.post + '/reject', { note: 'test' }, true)).status, 400);
  });

  await t.test('archive requires permission, hides public content and retains audited data', async () => {
    const path = '/posts/admin/' + ids.post;
    assert.equal((await request('DELETE', path)).status, 401);
    await db.admin.update({ where: { id: ids.admin }, data: { role: 'EDITOR' } });
    assert.equal((await request('DELETE', path, undefined, true)).status, 403);
    await db.admin.update({ where: { id: ids.admin }, data: { role: 'REVIEWER' } });
    assert.equal((await request('DELETE', path, undefined, true)).status, 200);
    assert.equal((await request('GET', '/posts/' + ids.post)).status, 404);
    assert.equal((await request('GET', '/posts?search=' + runId)).data.total, 0);
    assert.equal((await request('GET', '/posts/admin/all?search=' + runId, undefined, true)).data.total, 0);
    assert.equal((await request('GET', '/posts/admin/all?status=ARCHIVED&search=' + runId, undefined, true)).data.total, 1);
    const saved = await db.post.findUnique({ where: { id: ids.post } });
    assert.equal(saved.status, 'ARCHIVED');
    assert.ok(saved.content);
    assert.equal((await request('DELETE', path, undefined, true)).status, 200);
    assert.equal(await db.auditLog.count({ where: { adminId: ids.admin, action: 'POST_ARCHIVE' } }), 1);
    await db.admin.update({ where: { id: ids.admin }, data: { role: 'SUPER_ADMIN' } });
    assert.equal((await request('DELETE', '/posts/admin/missing-test-post', undefined, true)).status, 404);
  });

  await t.test('invalid parameters fail with 400 before querying MySQL', async () => {
    assert.equal((await request('GET', '/posts?limit=101')).status, 400);
    assert.equal((await request('GET', '/notices?includeArchived=wrong')).status, 400);
    assert.equal((await request('POST', '/posts/admin/draft', { title: 'x', content: 'x', type: 'NEWS', tags: [123] }, true)).status, 400);
  });

  await t.test('soft-deleted procedure becomes inaccessible', async () => {
    const created = await request('POST', '/procedures', { name: '[DỮ LIỆU KIỂM THỬ] ' + runId, fieldId: field.id, authority: 'Đơn vị thử', deadline: 'Dữ liệu thử', fee: 'Dữ liệu thử', components: ['Mẫu thử'], submission: 'Dữ liệu thử' }, true);
    assert.equal(created.status, 201);
    ids.procedure = created.data.id;
    assert.equal((await request('GET', '/procedures/' + ids.procedure)).status, 200);
    assert.equal((await request('DELETE', '/procedures/' + ids.procedure, undefined, true)).status, 200);
    assert.equal((await request('GET', '/procedures/' + ids.procedure)).status, 404);
  });

  await t.test('scheduled notices stay hidden including archived listing', async () => {
    const created = await request('POST', '/notices', { title: '[DỮ LIỆU KIỂM THỬ] ' + runId, description: 'Dữ liệu thử', startDate: new Date(Date.now() + 86400000).toISOString(), endDate: new Date(Date.now() + 172800000).toISOString() }, true);
    assert.equal(created.status, 201);
    ids.notice = created.data.id;
    assert.equal((await request('GET', '/notices/' + ids.notice)).status, 404);
    const list = await request('GET', '/notices?includeArchived=true&search=' + runId);
    assert.equal(list.status, 200);
    assert.ok(!list.data.data.some(n => n.id === ids.notice));
    assert.equal((await request('PATCH', '/notices/' + ids.notice, { description: 'Đã chỉnh sửa thử' }, true)).status, 200);
  });

  await t.test('disabling admin immediately invalidates its existing session', async () => {
    await db.admin.update({ where: { id: admin.id }, data: { isActive: false } });
    assert.equal((await request('GET', '/auth/me', undefined, true)).status, 401);
  });
});
