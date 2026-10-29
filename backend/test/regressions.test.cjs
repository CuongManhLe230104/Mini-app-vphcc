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

function postStore(initial) {
  let record = { version: 0, ...initial };
  const db = { post: {
    findUnique: async () => record,
    updateMany: async ({ where, data }) => { if (where.version !== record.version) return { count: 0 }; record = { ...record, ...data, version: record.version + 1 }; return { count: 1 }; },
  }, auditLog: { create: async () => ({}) } };
  db.$transaction = fn => fn(db);
  return db;
}
test('published post cannot be rejected outside the review workflow', async () => {
  await assert.rejects(() => new ContentService(postStore({ id: 'p', status: 'PUBLISHED' })).rejectPost('p', 'r'), e => e.getStatus() === 400);
});
test('pending post can be rejected with a reason', async () => {
  const post = await new ContentService(postStore({ id: 'p', status: 'PENDING' })).rejectPost('p', 'r', 'Cần bổ sung');
  assert.equal(post.status, 'REJECTED'); assert.equal(post.rejectionNote, 'Cần bổ sung');
});
test('stale version cannot overwrite a newer revision', async () => {
  await assert.rejects(() => new ContentService(postStore({ id: 'p', status: 'DRAFT', authorId: 'a', version: 2 })).updatePost('p', { version: 1, title: 'Cũ' }, 'a', 'EDITOR'), e => e.getStatus() === 409);
});
test('another editor cannot change the author draft', async () => {
  await assert.rejects(() => new ContentService(postStore({ id: 'p', status: 'DRAFT', authorId: 'a' })).updatePost('p', { version: 0, title: 'Sửa' }, 'b', 'EDITOR'), e => e.getStatus() === 403);
});
test('malformed center schedule and unsafe document links are rejected', async () => {
  const pipe = source('common/validation.pipe.ts').createValidationPipe();
  const Center = source('center/dto/update-center.dto.ts').UpdateCenterDto;
  const Doc = source('notices/dto/create-notice.dto.ts').CreateNoticeDocumentDto;
  for (const body of [{ workingHours: {} }, { workingHours: [{ day: 'Hai', hours: 123 }] }, { servicePortalUrl: 'javascript:alert(1)' }, { name: null }]) {
    await assert.rejects(() => pipe.transform(body, { type: 'body', metatype: Center }), e => e.getStatus() === 400);
  }
  await assert.rejects(() => pipe.transform({ name: 'Tệp', fileUrl: 'javascript:alert(1)' }, { type: 'body', metatype: Doc }), e => e.getStatus() === 400);
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

test('queue readiness requires active counter, field, schedule and non-null quotas', () => {
  const { evaluateReadiness, validateCounterConfig } = source('queue/queue-rules.ts');
  const unconfigured = {
    isActive: false, ticketEnabled: false, appointmentEnabled: false,
    dailyCapacity: null, ticketQuota: null, appointmentQuota: null, walkInQuota: null,
    slotMinutes: null, slotCapacity: null, bookingMinLeadMinutes: null,
    bookingMaxDaysAhead: null, maxActiveTicketsPerCitizen: null, maxActiveAppointmentsPerCitizen: null,
  };
  const r0 = evaluateReadiness(unconfigured, 0, 0);
  assert.equal(r0.ticket.ready, false);
  assert.equal(r0.appointment.ready, false);
  assert.ok(validateCounterConfig({ ...unconfigured, ticketEnabled: true }));
  assert.ok(validateCounterConfig({ ...unconfigured, dailyCapacity: 10, ticketQuota: 6, appointmentQuota: 6 }));
  const readyCfg = {
    ...unconfigured, isActive: true, ticketEnabled: true, appointmentEnabled: true,
    dailyCapacity: 50, ticketQuota: 20, appointmentQuota: 20, walkInQuota: 10,
    slotMinutes: 30, slotCapacity: 2, bookingMaxDaysAhead: 7,
    maxActiveTicketsPerCitizen: 1, maxActiveAppointmentsPerCitizen: 2,
  };
  assert.equal(validateCounterConfig(readyCfg), null);
  const r1 = evaluateReadiness(readyCfg, 1, 1);
  assert.equal(r1.ticket.ready, true);
  assert.equal(r1.appointment.ready, true);
});

test('queue schedule validation, slot generation, state transitions and lookup masking', () => {
  const { validateScheduleWindows, generateSlots } = source('queue/queue-time.ts');
  const { canTransitionTicket, canTransitionAppointment, generateLookupCode, LOOKUP_CODE_RE, maskPhone } = source('queue/queue-rules.ts');
  assert.equal(validateScheduleWindows([{ weekday: 1, startTime: '07:30', endTime: '11:30' }, { weekday: 1, startTime: '13:30', endTime: '17:00' }]), null);
  assert.ok(validateScheduleWindows([{ weekday: 1, startTime: '08:00', endTime: '10:00' }, { weekday: 1, startTime: '09:30', endTime: '11:00' }]));
  assert.deepEqual(generateSlots([{ startTime: '08:00', endTime: '09:00' }], 30), ['08:00', '08:30']);
  assert.equal(canTransitionTicket('WAITING', 'CALLING'), true);
  assert.equal(canTransitionTicket('WAITING', 'COMPLETED'), false);
  assert.equal(canTransitionAppointment('CONFIRMED', 'CHECKED_IN'), true);
  assert.equal(canTransitionAppointment('COMPLETED', 'CANCELLED'), false);
  assert.match(generateLookupCode('T'), LOOKUP_CODE_RE);
  assert.match(generateLookupCode('A'), LOOKUP_CODE_RE);
  assert.equal(maskPhone('0901234567'), '*******567');
});

