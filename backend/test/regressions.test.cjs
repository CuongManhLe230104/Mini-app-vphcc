const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const backend = process.env.REVIEW_PROJECT ? path.join(process.env.REVIEW_PROJECT, 'backend') : path.resolve(__dirname, '..');
const req = createRequire(path.join(backend, 'package.json'));
req('ts-node').register({ project: path.join(backend, 'tsconfig.json') });
req('reflect-metadata');
const source = (file) => req(path.join(backend, 'src', file));
const { AuthService } = source('auth/auth.service.ts');
const { ProceduresService } = source('procedures/procedures.service.ts');
const { ContentService } = source('content/content.service.ts');
const { NoticesService } = source('notices/notices.service.ts');

test('disabled admin is rejected even with an existing token', async () => {
  const disabled = { id: 'a', role: 'SUPER_ADMIN', isActive: false };
  const prisma = { admin: {
    findUnique: async () => disabled,
    findFirst: async ({ where }) => where.isActive === false ? disabled : null,
  }};
  assert.equal(await new AuthService(prisma, {}).validateUser({ type: 'admin', sub: 'a' }), null);
});

test('active admin keeps access and current database role', async () => {
  const admin = { id: 'a', isActive: true, role: 'EDITOR' };
  const prisma = { admin: { findUnique: async () => admin, findFirst: async () => admin } };
  assert.equal((await new AuthService(prisma, {}).validateUser({ type: 'admin', sub: 'a' })).role, 'EDITOR');
});

test('invalid token subject is rejected before querying the database', async () => {
  const prisma = { admin: { findUnique: () => { throw new Error('must not query'); }, findFirst: () => { throw new Error('must not query'); } } };
  assert.equal(await new AuthService(prisma, {}).validateUser({ type: 'admin' }), null);
});

test('Zalo token is sent in a header, never in the request URL', async t => {
  t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(new URL(url).searchParams.has('access_token'), false);
    assert.equal(options.headers.access_token, 'test-token');
    return new Response('{"id":"citizen-zalo-id"}');
  });
  const service = new AuthService({ citizen: { upsert: async () => ({ id: 'c', zaloId: 'citizen-zalo-id' }) } }, { sign: () => 'local-session' });
  assert.equal((await service.zaloAuth({ accessToken: 'test-token' })).accessToken, 'local-session');
});

test('invalid upstream Zalo profile does not create a citizen', async t => {
  t.mock.method(global, 'fetch', async () => new Response('{"error":-1}'));
  const service = new AuthService({ citizen: { upsert: () => { throw new Error('must not create'); } } }, {});
  await assert.rejects(() => service.zaloAuth({ accessToken: 'invalid' }), e => e.getStatus() === 401);
});

test('soft-deleted procedure is not visible through its detail URL', async () => {
  const record = { id: 'p', isValid: false };
  const prisma = { procedure: { findUnique: async () => record, findFirst: async ({ where }) => where.isValid === true ? null : record } };
  await assert.rejects(() => new ProceduresService(prisma).findOne('p'), e => e.getStatus() === 404);
});

test('published post cannot be rejected outside the review workflow', async () => {
  const prisma = { post: { findUnique: async () => ({ id: 'p', status: 'PUBLISHED' }), update: async () => ({ status: 'REJECTED' }) } };
  await assert.rejects(() => new ContentService(prisma).rejectPost('p', 'r'), e => e.getStatus() === 400);
});

test('pending post can be rejected with a reason', async () => {
  const prisma = { post: { findUnique: async () => ({ id: 'p', status: 'PENDING' }), update: async ({ data }) => data } };
  const post = await new ContentService(prisma).rejectPost('p', 'r', 'Cần bổ sung');
  assert.equal(post.status, 'REJECTED');
  assert.equal(post.rejectionNote, 'Cần bổ sung');
});

test('scheduled notice is hidden publicly but remains editable by admin', async () => {
  const scheduled = { id: 'n', startDate: new Date(Date.now() + 86400000), endDate: new Date(Date.now() + 172800000) };
  const service = new NoticesService({ notice: { findUnique: async () => scheduled } });
  await assert.rejects(() => service.findOne('n'), e => e.getStatus() === 404);
  assert.equal((await service.findOne('n', true)).id, 'n');
});

test('archived notice listing excludes records that have not started yet', async () => {
  let filter;
  const service = new NoticesService({ notice: { findMany: async ({ where }) => { filter = where; return []; }, count: async () => 0 } });
  await service.findAll({ includeArchived: true });
  assert.ok(filter.startDate.lte instanceof Date);
  assert.equal(filter.endDate, undefined);
});

test('false stays false in query validation; invalid booleans are rejected', async () => {
  const { QueryNoticesDto } = source('notices/dto/query-notices.dto.ts');
  const { createValidationPipe } = source('common/validation.pipe.ts');
  const pipe = createValidationPipe();
  const meta = { type: 'query', metatype: QueryNoticesDto };
  assert.equal((await pipe.transform({ includeArchived: 'false' }, meta)).includeArchived, false);
  assert.equal((await pipe.transform({ includeArchived: 'true' }, meta)).includeArchived, true);
  await assert.rejects(() => pipe.transform({ includeArchived: 'invalid' }, meta), e => e.getStatus() === 400);
});

test('pagination limits and arrays are validated before database writes', async () => {
  const { createValidationPipe } = source('common/validation.pipe.ts');
  const pipe = createValidationPipe();
  for (const [file, name] of [['content/dto/query-posts.dto.ts', 'QueryPostsDto'], ['procedures/dto/query-procedures.dto.ts', 'QueryProceduresDto']]) {
    const Dto = source(file)[name];
    await assert.rejects(() => pipe.transform({ limit: '101' }, { type: 'query', metatype: Dto }), e => e.getStatus() === 400);
    assert.equal((await pipe.transform({ limit: '10' }, { type: 'query', metatype: Dto })).limit, 10);
  }
  const { CreatePostDto } = source('content/dto/create-post.dto.ts');
  await assert.rejects(() => pipe.transform({ title: 'Bài viết', content: 'Nội dung', type: 'NEWS', tags: [123] }, { type: 'body', metatype: CreatePostDto }), e => e.getStatus() === 400);
});

test('empty center data is reported explicitly instead of returning invented contacts', async () => {
  const { CenterService } = source('center/center.service.ts');
  const service = new CenterService({ center: { findFirst: async () => null } });
  await assert.rejects(() => service.getCenterInfo(), e => e.getStatus() === 404);
  await assert.rejects(() => service.updateCenterInfo({ name: 'Tên mới' }), e => e.getStatus() === 400);
});
