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
  const ids = { counters: [], citizens: [], staffAdmins: [] };
  t.after(async () => {
    try {
      if (ids.counters.length) {
        await db.queueEvent.deleteMany({ where: { counterId: { in: ids.counters } } });
        await db.appointment.deleteMany({ where: { counterId: { in: ids.counters } } });
        await db.queueTicket.deleteMany({ where: { counterId: { in: ids.counters } } });
        await db.counterDay.deleteMany({ where: { counterId: { in: ids.counters } } });
        await db.serviceCounter.deleteMany({ where: { id: { in: ids.counters } } });
      }
      if (ids.citizens.length) await db.citizen.deleteMany({ where: { id: { in: ids.citizens } } });
      if (ids.faq) await db.faq.deleteMany({ where: { id: ids.faq } });
      if (ids.post) await db.post.deleteMany({ where: { id: ids.post } });
      if (ids.notice) await db.notice.deleteMany({ where: { id: ids.notice } });
      if (ids.procedure) await db.procedure.deleteMany({ where: { id: ids.procedure } });
      if (ids.field) await db.procedureField.deleteMany({ where: { id: ids.field } });
      if (ids.staffAdmins.length) {
        await db.auditLog.deleteMany({ where: { adminId: { in: ids.staffAdmins } } });
        await db.admin.deleteMany({ where: { id: { in: ids.staffAdmins } } });
      }
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
    assert.equal((await request('POST', '/posts/admin/' + ids.post + '/submit', { version: 0 }, true)).status, 201);
    assert.equal((await request('POST', '/posts/admin/' + ids.post + '/publish', { version: 1 }, true)).status, 201);
    const post = await request('GET', '/posts/' + ids.post);
    assert.equal(post.status, 200);
    assert.equal(post.data.rejectionNote, undefined);
    const found = await request('GET', '/posts?search=' + runId.toUpperCase());
    assert.equal(found.status, 200);
    assert.ok(found.data.data.some(p => p.id === ids.post));
    assert.equal((await request('POST', '/posts/admin/' + ids.post + '/reject', { note: 'test' }, true)).status, 400);
  });

  await t.test('edits retain public content until review, reject stale approval and never duplicate posts', async () => {
    const path = '/posts/admin/' + ids.post;
    const before = (await request('GET', '/posts/' + ids.post)).data;
    const edit = await request('PATCH', path, { version: 2, content: 'Bản sửa phải qua duyệt' }, true);
    assert.equal(edit.status, 200); assert.equal(edit.data.id, ids.post);
    assert.equal(edit.data.status, 'PUBLISHED'); assert.equal(edit.data.revisionStatus, 'DRAFT');
    assert.equal((await request('GET', '/posts/' + ids.post)).data.content, before.content);
    assert.equal((await request('GET', '/posts/' + ids.post)).data.revision, undefined);
    assert.equal((await request('PATCH', path, { version: 2, title: 'Ghi đè cũ' }, true)).status, 409);
    assert.equal((await request('POST', path + '/submit', { version: 3 }, true)).status, 201);
    assert.equal((await request('PATCH', path, { version: 4, title: 'Sửa khi chờ' }, true)).status, 400);
    assert.equal((await request('POST', path + '/publish', { version: 3 }, true)).status, 409);
    assert.equal((await request('POST', path + '/reject', { version: 4, note: 'Bổ sung nguồn' }, true)).status, 201);
    assert.equal((await request('GET', '/posts/' + ids.post)).data.content, before.content);
    assert.equal((await request('PATCH', path, { version: 5, content: 'Đã bổ sung nguồn' }, true)).status, 200);
    assert.equal((await request('POST', path + '/submit', { version: 6 }, true)).status, 201);
    const pending = await request('GET', '/posts/admin/all?status=PENDING&search=' + runId, undefined, true);
    assert.equal(pending.data.total, 1);
    await db.admin.update({ where: { id: ids.admin }, data: { role: 'EDITOR' } });
    assert.equal((await request('POST', path + '/publish', { version: 7 }, true)).status, 403);
    await db.admin.update({ where: { id: ids.admin }, data: { role: 'REVIEWER' } });
    assert.equal((await request('PATCH', path, { version: 7, title: 'Không có quyền soạn' }, true)).status, 403);
    assert.equal((await request('POST', path + '/publish', { version: 7 }, true)).status, 201);
    assert.equal((await request('GET', '/posts/' + ids.post)).data.content, 'Đã bổ sung nguồn');
    assert.equal(await db.post.count({ where: { authorId: ids.admin } }), 1);
    assert.equal(await db.auditLog.count({ where: { adminId: ids.admin, action: 'POST_EDIT' } }), 2);
    await db.admin.update({ where: { id: ids.admin }, data: { role: 'SUPER_ADMIN' } });
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
    const adminList = await request('GET', '/procedures/admin/all?field=' + field.slug, undefined, true);
    assert.equal(adminList.status, 200); assert.equal(adminList.data.total, 1);
    assert.equal((await request('PATCH', '/procedures/' + ids.procedure, { isValid: true }, true)).status, 200);
    assert.equal((await request('GET', '/procedures/' + ids.procedure)).status, 200);
  });

  await t.test('scheduled notices stay hidden including archived listing', async () => {
    const created = await request('POST', '/notices', { title: '[DỮ LIỆU KIỂM THỬ] ' + runId, description: 'Dữ liệu thử', startDate: new Date(Date.now() + 86400000).toISOString(), endDate: new Date(Date.now() + 172800000).toISOString() }, true);
    assert.equal(created.status, 201);
    ids.notice = created.data.id;
    assert.equal((await request('GET', '/notices/' + ids.notice)).status, 404);
    const list = await request('GET', '/notices?includeArchived=true&search=' + runId);
    assert.equal(list.status, 200);
    assert.ok(!list.data.data.some(n => n.id === ids.notice));
    const adminList = await request('GET', '/notices/admin/all?search=' + runId, undefined, true);
    assert.equal(adminList.data.meta.total, 1);
    const updated = await request('PATCH', '/notices/' + ids.notice, { description: 'Đã chỉnh sửa thử', documents: [{ name: 'Tệp thử', fileUrl: 'https://example.com/test.pdf' }] }, true);
    assert.equal(updated.status, 200); assert.equal(updated.data.documents.length, 1);
    assert.equal((await request('PATCH', '/notices/' + ids.notice, { documents: [] }, true)).data.documents.length, 0);
  });

  await t.test('reference publishing is restricted and FAQs hide until explicitly published', async () => {
    await db.admin.update({ where: { id: ids.admin }, data: { role: 'EDITOR' } });
    assert.equal((await request('PATCH', '/procedures/' + ids.procedure, { fee: 'Tự sửa' }, true)).status, 403);
    assert.equal((await request('PATCH', '/notices/' + ids.notice, { description: 'Tự sửa' }, true)).status, 403);
    assert.equal((await request('POST', '/faqs', { question: 'Thử', answer: 'Thử', isPublished: true }, true)).status, 403);
    assert.equal((await request('GET', '/faqs/admin/all', undefined, true)).status, 200);
    assert.equal((await request('GET', '/audit', undefined, true)).status, 403);
    await db.admin.update({ where: { id: ids.admin }, data: { role: 'REVIEWER' } });
    const faq = await request('POST', '/faqs', { question: '[DỮ LIỆU KIỂM THỬ] ' + runId, answer: 'Thử', isPublished: false }, true);
    assert.equal(faq.status, 201); ids.faq = faq.data.id;
    assert.ok(!(await request('GET', '/faqs')).data.some(f => f.id === ids.faq));
    assert.equal((await request('PATCH', '/faqs/' + ids.faq, { isPublished: true }, true)).status, 200);
    assert.ok((await request('GET', '/faqs')).data.some(f => f.id === ids.faq));
    assert.equal((await request('PATCH', '/center', { name: 'Không có quyền' }, true)).status, 403);
    await db.admin.update({ where: { id: ids.admin }, data: { role: 'SUPER_ADMIN' } });
    assert.equal((await request('PATCH', '/center', { workingHours: {} }, true)).status, 400);
    assert.equal(await db.auditLog.count({ where: { adminId: ids.admin, action: 'FAQ_UPDATE' } }), 1);
    assert.equal((await request('GET', '/audit', undefined, true)).status, 200);
    assert.equal((await request('GET', '/audit?limit=1000', undefined, true)).status, 400);
  });

  await t.test('queue and appointment concurrency, idempotency, state transitions and counter permissions', async () => {
    const { JwtService } = require('@nestjs/jwt');
    const { vnToday, addDays } = require('../dist/queue/queue-time');
    const jwt = app.get(JwtService);
    const reqWithToken = async (method, route, body, bearer, extraHeaders = {}) => {
      const res = await fetch(base + route, {
        method,
        headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}), ...extraHeaders },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, data: await res.json() };
    };

    const codeSuffix = runId.replace(/-/g, '').slice(0, 4).toUpperCase();
    const c1Res = await request('POST', '/queue/admin/counters', { code: 'QA' + codeSuffix, name: '[DỮ LIỆU KIỂM THỬ] Quầy A' }, true);
    assert.equal(c1Res.status, 201);
    const counterA = c1Res.data;
    ids.counters.push(counterA.id);

    const c2Res = await request('POST', '/queue/admin/counters', { code: 'QB' + codeSuffix, name: '[DỮ LIỆU KIỂM THỬ] Quầy B' }, true);
    assert.equal(c2Res.status, 201);
    const counterB = c2Res.data;
    ids.counters.push(counterB.id);

    // Unconfigured counter must reject activating ticketEnabled without required fields
    assert.equal((await request('PATCH', `/queue/admin/counters/${counterA.id}`, { ticketEnabled: true }, true)).status, 400);

    // Assign 24/7 schedule so tests run at any hour
    const fullWeek = [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, startTime: '00:00', endTime: '23:59' }));
    assert.equal((await request('PUT', `/queue/admin/counters/${counterA.id}/schedules`, { windows: fullWeek }, true)).status, 200);

    // Configure quotas, fieldIds and activate Counter A
    const cfgRes = await request('PATCH', `/queue/admin/counters/${counterA.id}`, {
      dailyCapacity: 10,
      ticketQuota: 3,
      appointmentQuota: 3,
      walkInQuota: 2,
      slotMinutes: 60,
      slotCapacity: 2,
      bookingMinLeadMinutes: 0,
      bookingMaxDaysAhead: 7,
      maxActiveTicketsPerCitizen: 1,
      maxActiveAppointmentsPerCitizen: 2,
      ticketEnabled: true,
      appointmentEnabled: true,
      isActive: true,
      fieldIds: [field.id],
    }, true);
    assert.equal(cfgRes.status, 200);
    assert.equal(cfgRes.data.isActive, true);
    assert.equal(cfgRes.data.ticketEnabled, true);
    assert.equal(cfgRes.data.appointmentEnabled, true);
    const catalog = await request('GET', '/queue/catalog');
    assert.equal(catalog.status, 200);
    const catalogCounterA = catalog.data.counters.find(c => c.id === counterA.id);
    assert.equal(catalogCounterA.readiness.ticket.ready, true);
    assert.equal(catalogCounterA.readiness.appointment.ready, true);

    // Create 4 test citizens
    const citizens = [];
    for (let i = 0; i < 4; i++) {
      const c = await db.citizen.create({ data: { zaloId: `zalo-${runId}-${i}`, name: `[DỮ LIỆU KIỂM THỬ] Công dân ${i}` } });
      ids.citizens.push(c.id);
      citizens.push({ ...c, token: jwt.sign({ type: 'citizen', sub: c.id }) });
    }

    // 1. Idempotency key replay for ticket issuance returns identical ticket without incrementing sequence
    const idemTicketKey = 'idem_ticket_' + codeSuffix;
    const tFirst = await reqWithToken('POST', '/queue/tickets', { fieldId: field.id }, citizens[0].token, { 'Idempotency-Key': idemTicketKey, 'X-Forwarded-For': '10.0.1.1' });
    const tReplay = await reqWithToken('POST', '/queue/tickets', { fieldId: field.id }, citizens[0].token, { 'Idempotency-Key': idemTicketKey, 'X-Forwarded-For': '10.0.1.1' });
    assert.equal(tFirst.status, 201);
    assert.equal(tReplay.status, 201);
    assert.equal(tFirst.data.id, tReplay.data.id);
    assert.equal(tFirst.data.sequence, 1);

    // 2. Concurrent ticket issuance across 3 remaining citizens with remaining ticketQuota = 2 (total quota = 3)
    const concurrentTickets = await Promise.all([
      reqWithToken('POST', '/queue/tickets', { fieldId: field.id }, citizens[1].token, { 'X-Forwarded-For': '10.0.1.2' }),
      reqWithToken('POST', '/queue/tickets', { fieldId: field.id }, citizens[2].token, { 'X-Forwarded-For': '10.0.1.3' }),
      reqWithToken('POST', '/queue/tickets', { fieldId: field.id }, citizens[3].token, { 'X-Forwarded-For': '10.0.1.4' }),
    ]);
    const okTickets = concurrentTickets.filter(r => r.status === 201);
    const fullTickets = concurrentTickets.filter(r => r.status === 409);
    assert.equal(okTickets.length, 2, 'Exactly 2 more tickets should succeed within ticketQuota=3');
    assert.equal(fullTickets.length, 1, 'The 4th concurrent ticket must fail with 409 quota full');
    const sequences = [tFirst.data.sequence, ...okTickets.map(r => r.data.sequence)].sort((a, b) => a - b);
    assert.deepEqual(sequences, [1, 2, 3], 'Ticket sequences must be strictly sequential without duplicates');

    // 3. Citizen ownership check: citizen 1 cannot cancel citizen 0's ticket (hidden as 404 to prevent ID probing)
    assert.equal((await reqWithToken('POST', `/queue/tickets/${tFirst.data.id}/cancel`, {}, citizens[1].token)).status, 404);

    // 4. Counter staff role & counter assignment isolation
    const staffAdmin = await db.admin.create({
      data: { username: 'staff-' + runId, fullName: '[DỮ LIỆU KIỂM THỬ] Cán bộ quầy', passwordHash: await bcrypt.hash(password, 10), role: 'COUNTER_STAFF' },
    });
    ids.staffAdmins.push(staffAdmin.id);
    const staffLogin = await request('POST', '/auth/admin/login', { username: staffAdmin.username, password });
    const staffToken = staffLogin.data.accessToken;

    // Staff not yet assigned to Counter A -> 403
    assert.equal((await reqWithToken('GET', `/queue/admin/counters/${counterA.id}/board`, undefined, staffToken)).status, 403);

    // Assign staff to Counter A only
    assert.equal((await request('PUT', `/queue/admin/counters/${counterA.id}/staff`, { adminIds: [staffAdmin.id] }, true)).status, 200);
    assert.equal((await reqWithToken('GET', `/queue/admin/counters/${counterA.id}/board`, undefined, staffToken)).status, 200);
    assert.equal((await reqWithToken('GET', `/queue/admin/counters/${counterB.id}/board`, undefined, staffToken)).status, 403);

    // Call next -> Serve -> Complete state transitions on Ticket #1
    const called = await reqWithToken('POST', `/queue/admin/counters/${counterA.id}/call-next`, {}, staffToken);
    assert.equal(called.status, 201);
    assert.equal(called.data.id, tFirst.data.id);
    assert.equal(called.data.status, 'CALLING');
    // Invalid jump WAITING -> COMPLETED on another ticket is rejected
    const secondTicketId = okTickets[0].data.id;
    assert.equal((await reqWithToken('POST', `/queue/admin/tickets/${secondTicketId}/complete`, {}, staffToken)).status, 409);

    const serving = await reqWithToken('POST', `/queue/admin/tickets/${tFirst.data.id}/serve`, {}, staffToken);
    assert.equal(serving.status, 201);
    assert.equal(serving.data.status, 'SERVING');

    const completed = await reqWithToken('POST', `/queue/admin/tickets/${tFirst.data.id}/complete`, {}, staffToken);
    assert.equal(completed.status, 201);
    assert.equal(completed.data.status, 'COMPLETED');

    // 5. Concurrent appointment booking for tomorrow at 09:00 with slotCapacity = 2
    const tomorrow = addDays(vnToday(), 1);
    const idemApptKey = 'idem_appt_' + codeSuffix;
    const aFirst = await reqWithToken('POST', '/queue/appointments', {
      fieldId: field.id, date: tomorrow, slot: '09:00', contactName: '[DỮ LIỆU KIỂM THỬ] C0', contactPhone: '0901234560',
    }, citizens[0].token, { 'Idempotency-Key': idemApptKey, 'X-Forwarded-For': '10.0.2.1' });
    const aReplay = await reqWithToken('POST', '/queue/appointments', {
      fieldId: field.id, date: tomorrow, slot: '09:00', contactName: '[DỮ LIỆU KIỂM THỬ] C0', contactPhone: '0901234560',
    }, citizens[0].token, { 'Idempotency-Key': idemApptKey, 'X-Forwarded-For': '10.0.2.1' });
    assert.equal(aFirst.status, 201);
    assert.equal(aReplay.status, 201);
    assert.equal(aFirst.data.id, aReplay.data.id);

    // Two more citizens concurrently try to book the remaining 1 seat in 09:00 (slotCapacity = 2)
    const concurrentAppts = await Promise.all([
      reqWithToken('POST', '/queue/appointments', {
        fieldId: field.id, date: tomorrow, slot: '09:00', contactName: '[DỮ LIỆU KIỂM THỬ] C1', contactPhone: '0901234561',
      }, citizens[1].token, { 'X-Forwarded-For': '10.0.2.2' }),
      reqWithToken('POST', '/queue/appointments', {
        fieldId: field.id, date: tomorrow, slot: '09:00', contactName: '[DỮ LIỆU KIỂM THỬ] C2', contactPhone: '0901234562',
      }, citizens[2].token, { 'X-Forwarded-For': '10.0.2.3' }),
    ]);
    assert.equal(concurrentAppts.filter(r => r.status === 201).length, 1, 'Only 1 remaining seat in 09:00 slot');
    assert.equal(concurrentAppts.filter(r => r.status === 409).length, 1, 'Over-capacity concurrent booking rejected with 409');

    // Public lookup masks phone and never leaks full phone number
    const lookup = await reqWithToken('GET', `/queue/lookup/${aFirst.data.lookupCode}`, undefined, undefined, { 'X-Forwarded-For': '10.0.2.9' });
    assert.equal(lookup.status, 200);
    assert.equal(lookup.data.appointment.maskedPhone, '*******560');
    assert.equal(lookup.data.appointment.contactPhone, undefined);
    assert.equal(lookup.data.appointment.contactName, undefined);
  });

  await t.test('disabling admin immediately invalidates its existing session', async () => {
    await db.admin.update({ where: { id: admin.id }, data: { isActive: false } });
    assert.equal((await request('GET', '/auth/me', undefined, true)).status, 401);
  });
});
