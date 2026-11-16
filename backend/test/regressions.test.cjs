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
  const {
    canTransitionTicket,
    canTransitionAppointment,
    generateLookupCode,
    LOOKUP_CODE_RE,
    maskPhone,
    CONFIRMED_FOUR_COUNTERS_PRESET,
    resolveUnifiedTurnStatus,
    calculateCounterCapacitySummary,
  } = source('queue/queue-rules.ts');
  const { formatSlotRange } = source('queue/queue-common.ts');
  assert.equal(validateScheduleWindows([{ weekday: 1, startTime: '07:30', endTime: '11:30' }, { weekday: 1, startTime: '13:30', endTime: '17:00' }]), null);
  assert.ok(validateScheduleWindows([{ weekday: 1, startTime: '08:00', endTime: '10:00' }, { weekday: 1, startTime: '09:30', endTime: '11:00' }]));
  assert.deepEqual(generateSlots([{ startTime: '08:00', endTime: '09:00' }], 30), ['08:00', '08:30']);
  assert.equal(canTransitionTicket('WAITING', 'CALLING'), true);
  assert.equal(canTransitionTicket('WAITING', 'COMPLETED'), false);
  assert.equal(canTransitionAppointment('CONFIRMED', 'CHECKED_IN'), true);
  assert.equal(canTransitionAppointment('CONFIRMED', 'COMPLETED'), true);
  assert.equal(canTransitionAppointment('COMPLETED', 'CANCELLED'), false);
  assert.match(generateLookupCode('T'), LOOKUP_CODE_RE);
  assert.match(generateLookupCode('A'), LOOKUP_CODE_RE);
  assert.equal(maskPhone('0901234567'), '*******567');

  // Verify 4 confirmed counters preset (Q1..Q4), unified turn status and capacity calculator
  assert.deepEqual(CONFIRMED_FOUR_COUNTERS_PRESET.map(c => c.code), ['Q1', 'Q2', 'Q3', 'Q4']);
  assert.equal(formatSlotRange('07:30', 30), '07:30 – 08:00');
  assert.deepEqual(resolveUnifiedTurnStatus({ appointmentStatus: 'CONFIRMED', ticketStatus: 'WAITING', isPastSlot: false }), {
    status: 'BOOKED',
    label: 'Đã đặt lịch',
  });
  assert.deepEqual(resolveUnifiedTurnStatus({ appointmentStatus: 'CONFIRMED', ticketStatus: 'WAITING', isPastSlot: true }), {
    status: 'UNSERVED_PAST_SLOT',
    label: 'Chưa được phục vụ',
  });
  assert.deepEqual(resolveUnifiedTurnStatus({ appointmentStatus: 'CONFIRMED', ticketStatus: 'CALLING', isPastSlot: true }), {
    status: 'CALLING',
    label: 'Đang gọi',
  });
  assert.deepEqual(resolveUnifiedTurnStatus({ appointmentStatus: 'CHECKED_IN', ticketStatus: 'SERVING', isPastSlot: false }), {
    status: 'SERVING',
    label: 'Đang tiếp nhận',
  });
  const cap = calculateCounterCapacitySummary({
    slotCountPerDay: 15,
    slotMinutes: 30,
    slotCapacity: 1,
    appointmentQuota: 10,
    dailyCapacity: 15,
  });
  assert.equal(cap.theoreticalTurnsPerDay, 15);
  assert.equal(cap.maxOnlineBookings, 10);
  assert.equal(cap.remainingForWalkIn, 5);
});

test('unified booking issues call number immediately and callNextTicket orders by slot before sequence', async () => {
  const { QueueService } = source('queue/queue.service.ts');
  const { parseDateOnly } = source('queue/queue-time.ts');

  const counter = {
    id: 'c-q1',
    code: 'Q1',
    name: 'Quầy 1 — Tư pháp – hộ tịch',
    isActive: true,
    ticketEnabled: true,
    appointmentEnabled: true,
    dailyCapacity: 15,
    ticketQuota: 5,
    appointmentQuota: 10,
    walkInQuota: 5,
    slotMinutes: 30,
    slotCapacity: 1,
    bookingMinLeadMinutes: 0,
    bookingMaxDaysAhead: 7,
    maxActiveTicketsPerCitizen: 1,
    maxActiveAppointmentsPerCitizen: 4,
    schedules: [0, 1, 2, 3, 4, 5, 6].flatMap(weekday => [
      { weekday, startTime: '07:30', endTime: '11:30' },
      { weekday, startTime: '13:30', endTime: '17:00' },
    ]),
  };

  let lastSeq = 0;
  const appointments = [];
  const tickets = [];
  const events = [];

  const db = {
    counterField: {
      findUnique: async () => ({
        fieldId: 'f-1',
        field: { id: 'f-1', label: 'Tư pháp – hộ tịch', slug: 'tu-phap' },
        counter,
      }),
    },
    serviceCounter: {
      findUnique: async () => counter,
    },
    counterClosure: {
      findUnique: async () => null,
    },
    counterDay: {
      upsert: async () => ({ id: 'cd-1', counterId: counter.id, lastSequence: lastSeq }),
      update: async ({ data }) => {
        lastSeq = data.lastSequence;
        return { id: 'cd-1', counterId: counter.id, lastSequence: lastSeq };
      },
    },
    $queryRaw: async () => [{ id: 'cd-1', lastSequence: lastSeq }],
    $executeRaw: async () => 1,
    appointment: {
      findUnique: async ({ where }) => {
        const found = appointments.find(a => (where.id && a.id === where.id) || (where.idempotencyKey && a.idempotencyKey === where.idempotencyKey));
        if (!found) return null;
        return { ...found, counter, tickets: tickets.filter(t => t.appointmentId === found.id) };
      },
      findUniqueOrThrow: async ({ where }) => {
        const found = appointments.find(a => a.id === where.id);
        return { ...found, counter, tickets: tickets.filter(t => t.appointmentId === found.id) };
      },
      findMany: async ({ where }) => {
        return appointments.filter(a => {
          if (where?.counterId && a.counterId !== where.counterId) return false;
          if (where?.slotStart && a.slotStart !== where.slotStart) return false;
          if (where?.slotSeat?.not === null && a.slotSeat === null) return false;
          if (where?.status && typeof where.status === 'string' && a.status !== where.status) return false;
          if (where?.tickets?.none) {
            const hasTicket = tickets.some(t => t.appointmentId === a.id);
            if (hasTicket) return false;
          }
          return true;
        });
      },
      count: async () => appointments.filter(a => a.status !== 'CANCELLED').length,
      create: async ({ data }) => {
        const created = { id: 'appt-' + (appointments.length + 1), version: 0, createdAt: new Date(), ...data };
        appointments.push(created);
        return created;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const a of appointments) {
          if (a.id === where.id) {
            if (data.status) a.status = data.status;
            if ('slotSeat' in data && data.slotSeat !== undefined) a.slotSeat = data.slotSeat;
            a.version += 1;
            count++;
          }
        }
        return { count };
      },
    },
    queueTicket: {
      count: async () => 0,
      create: async ({ data }) => {
        const created = { id: 'tkt-' + (tickets.length + 1), callCount: 0, version: 0, createdAt: new Date(), ...data };
        tickets.push(created);
        return created;
      },
      findMany: async ({ where }) => {
        return tickets
          .filter(t => {
            if (where?.counterId && t.counterId !== where.counterId) return false;
            if (where?.status && typeof where.status === 'string' && t.status !== where.status) return false;
            if (where?.status?.in && !where.status.in.includes(t.status)) return false;
            return true;
          })
          .map(t => ({
            ...t,
            appointment: appointments.find(a => a.id === t.appointmentId) || null,
          }));
      },
      updateMany: async ({ where, data }) => {
        const found = tickets.find(t => t.id === where.id && t.status === where.status && t.version === where.version);
        if (!found) return { count: 0 };
        found.status = data.status;
        if (data.callCount?.increment) found.callCount += data.callCount.increment;
        if (data.calledAt) found.calledAt = data.calledAt;
        if (data.servingAt) found.servingAt = data.servingAt;
        if (data.finishedAt) found.finishedAt = data.finishedAt;
        if (data.handledByAdminId) found.handledByAdminId = data.handledByAdminId;
        found.version += 1;
        return { count: 1 };
      },
      findUnique: async ({ where }) => {
        const found = tickets.find(t => t.id === where.id);
        return found ? { ...found, counter } : null;
      },
      findUniqueOrThrow: async ({ where }) => {
        return tickets.find(t => t.id === where.id);
      },
    },
    queueEvent: {
      create: async ({ data }) => {
        events.push(data);
        return data;
      },
    },
  };
  db.$transaction = fn => fn(db);

  const service = new QueueService(db);
  // 07:00 VN time = 00:00 UTC on 2026-11-16 (Monday)
  const morning7am = new Date('2026-11-16T00:00:00.000Z');

  // 1. Citizen A books afternoon slot 14:00 first -> immediately receives Q1-001
  const bookedAfternoon = await service.createAppointment(
    'cit-1',
    { fieldId: 'f-1', date: '2026-11-16', slot: '14:00', contactName: 'Công dân Chiều', contactPhone: '0901111222' },
    'idem_afternoon_1',
    morning7am,
  );
  assert.equal(bookedAfternoon.displayNumber, 'Q1-001');
  assert.equal(bookedAfternoon.ticket.displayNumber, 'Q1-001');
  assert.equal(bookedAfternoon.unifiedStatus, 'BOOKED');
  assert.equal(bookedAfternoon.unifiedStatusLabel, 'Đã đặt lịch');

  // 2. Citizen B books morning slot 08:00 second -> immediately receives Q1-002
  const bookedMorning = await service.createAppointment(
    'cit-2',
    { fieldId: 'f-1', date: '2026-11-16', slot: '08:00', contactName: 'Công dân Sáng', contactPhone: '0903333444' },
    'idem_morning_2',
    morning7am,
  );
  assert.equal(bookedMorning.displayNumber, 'Q1-002');
  assert.equal(bookedMorning.ticket.displayNumber, 'Q1-002');

  // 3. At 07:30 VN time (before 08:00 slot starts), callNextTicket refuses to auto-call future 08:00 slot early
  const at0730 = new Date('2026-11-16T00:30:00.000Z');
  await assert.rejects(
    () => service.callNextTicket({ id: 'adm-1', role: 'SUPER_ADMIN' }, counter.id, at0730),
    err => err.getStatus() === 409 && err.getResponse().code === 'FUTURE_SLOT_NOT_STARTED',
  );

  // 4. At 08:05 VN time (08:00 slot has started, 14:00 is still in the future),
  // callNextTicket calls Citizen B (08:00, Q1-002) FIRST even though Citizen A (14:00, Q1-001) booked earlier!
  const at0805 = new Date('2026-11-16T01:05:00.000Z');
  const called1 = await service.callNextTicket({ id: 'adm-1', role: 'SUPER_ADMIN' }, counter.id, at0805);
  assert.equal(called1.displayNumber, 'Q1-002');
  assert.equal(called1.slot, '08:00');
  assert.equal(called1.status, 'CALLING');

  // 5. Attempting to callNextTicket again while position is busy with Q1-002 is blocked with POSITION_BUSY
  await assert.rejects(
    () => service.callNextTicket({ id: 'adm-1', role: 'SUPER_ADMIN' }, counter.id, at0805),
    err => err.getStatus() === 409 && err.getResponse().code === 'POSITION_BUSY',
  );

  // 6. Serve (Tiếp nhận) -> Complete (Hoàn tất) syncs 1-1 Appointment status automatically without needing Check-in
  const served1 = await service.startServingTicket({ id: 'adm-1', role: 'SUPER_ADMIN' }, called1.id, at0805);
  assert.equal(served1.status, 'SERVING');
  assert.equal(appointments.find(a => a.id === bookedMorning.id).status, 'CHECKED_IN');

  const completed1 = await service.completeTicket({ id: 'adm-1', role: 'SUPER_ADMIN' }, called1.id, at0805);
  assert.equal(completed1.status, 'COMPLETED');
  assert.equal(appointments.find(a => a.id === bookedMorning.id).status, 'COMPLETED');
});

test('53-source notice inventory preserves order, Drive URLs, 3 notice types and special quality flags', async () => {
  const { NOTICE_INVENTORY_SOURCES } = source('notices/notices-inventory.data.ts');
  assert.equal(NOTICE_INVENTORY_SOURCES.length, 53);
  for (let i = 0; i < 53; i++) {
    assert.equal(NOTICE_INVENTORY_SOURCES[i].sourceIndex, i + 1);
    assert.match(NOTICE_INVENTORY_SOURCES[i].originalUrl, /^https:\/\/drive\.google\.com\/file\/d\/[^/]+\/view$/);
  }
  const byType = NOTICE_INVENTORY_SOURCES.reduce((acc, s) => {
    acc[s.noticeType] = (acc[s.noticeType] || 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byType, {
    PROCEDURE_ANNOUNCEMENT: 41,
    INTERNAL_PROCESS: 10,
    INTERNAL_PROCEDURE: 2,
  });

  // Verify special anomalies from Plan V2 (Section 2.2)
  const src1 = NOTICE_INVENTORY_SOURCES.find(s => s.sourceIndex === 1);
  assert.equal(src1.qualityStatus, 'NEEDS_VERIFICATION');
  assert.equal(src1.needsDateVerification, true);

  const src22 = NOTICE_INVENTORY_SOURCES.find(s => s.sourceIndex === 22);
  assert.equal(src22.qualityStatus, 'CONFLICT');
  assert.ok(src22.legalDocumentNumber.includes('5116/QĐ-UBND'));

  const src24 = NOTICE_INVENTORY_SOURCES.find(s => s.sourceIndex === 24);
  assert.equal(src24.qualityStatus, 'OK');
  assert.notEqual(src22.driveFileId, src24.driveFileId);

  const src31 = NOTICE_INVENTORY_SOURCES.find(s => s.sourceIndex === 31);
  assert.equal(src31.qualityStatus, 'NEEDS_VERIFICATION');

  const src42 = NOTICE_INVENTORY_SOURCES.find(s => s.sourceIndex === 42);
  const src43 = NOTICE_INVENTORY_SOURCES.find(s => s.sourceIndex === 43);
  assert.equal(src42.qualityStatus, 'DUPLICATE_CANDIDATE');
  assert.equal(src43.qualityStatus, 'DUPLICATE_CANDIDATE');
  assert.equal(src42.duplicateOfIndex, 43);
  assert.equal(src43.duplicateOfIndex, 42);

  // Verify unresolved CONFLICT source cannot be submitted or published
  const conflictNotice = {
    id: 'n-22',
    publicationStatus: 'DRAFT',
    sources: [{ id: 's-22', qualityStatus: 'CONFLICT' }],
  };
  const service = new NoticesService({
    notice: { findUnique: async () => conflictNotice },
  });
  await assert.rejects(() => service.submitNotice('n-22', 'admin-1'), e => e.getStatus() === 400);
  await assert.rejects(() => service.publishNotice('n-22', 'admin-1', 'REVIEWER'), e => e.getStatus() === 400);
});


