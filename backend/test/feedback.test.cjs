const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');

const backend = process.env.REVIEW_PROJECT
  ? path.join(process.env.REVIEW_PROJECT, 'backend')
  : path.resolve(__dirname, '..');
const req = createRequire(path.join(backend, 'package.json'));
req('ts-node').register({ project: path.join(backend, 'tsconfig.json') });
req('reflect-metadata');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-at-least-32-chars-long-12345';
process.env.FEEDBACK_RATE_LIMIT_PER_MIN = '5';
process.env.FEEDBACK_RATE_WINDOW_MS = '60000';

const { NestFactory } = req('@nestjs/core');
const { Global, Module } = req('@nestjs/common');
const { ConfigModule } = req('@nestjs/config');
const { JwtService } = req('@nestjs/jwt');
const { AuthModule } = req(path.join(backend, 'src/auth/auth.module.ts'));
const { PrismaService } = req(path.join(backend, 'src/prisma/prisma.service.ts'));
const { createValidationPipe } = req(path.join(backend, 'src/common/validation.pipe.ts'));
const { FeedbackModule } = req(path.join(backend, 'src/feedback/feedback.module.ts'));
const { FEEDBACK_LIMITS, normalizeVietnamesePhone, maskFeedbackPhone } = req(
  path.join(backend, 'src/feedback/feedback-rules.ts'),
);
const { sanitizeSpreadsheetText } = req(path.join(backend, 'src/feedback/xlsx-builder.ts'));

function createInMemoryPrisma() {
  const admins = new Map([
    [
      '11111111-1111-4111-8111-111111111111',
      {
        id: '11111111-1111-4111-8111-111111111111',
        username: 'superadmin',
        fullName: 'Quản trị viên',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    ],
    [
      '22222222-2222-4222-8222-222222222222',
      {
        id: '22222222-2222-4222-8222-222222222222',
        username: 'handler1',
        fullName: 'Chuyên viên 1',
        role: 'HANDLER',
        isActive: true,
      },
    ],
    [
      '44444444-4444-4444-8444-444444444444',
      {
        id: '44444444-4444-4444-8444-444444444444',
        username: 'editor1',
        fullName: 'Công chức biên tập',
        role: 'EDITOR',
        isActive: true,
      },
    ],
  ]);

  const citizens = new Map([
    [
      '99999999-9999-4999-8999-999999999999',
      {
        id: '99999999-9999-4999-8999-999999999999',
        zaloId: 'zalo-citizen-1',
        name: 'Người dân',
      },
    ],
  ]);

  const feedbacks = [];
  const auditLogs = [];

  function matchesWhere(item, where = {}) {
    if (!where) return true;
    if (where.code?.contains) {
      if (!item.code.toUpperCase().includes(String(where.code.contains).toUpperCase())) return false;
    }
    if (where.createdAt) {
      if (where.createdAt.gte && item.createdAt < where.createdAt.gte) return false;
      if (where.createdAt.lte && item.createdAt > where.createdAt.lte) return false;
    }
    return true;
  }

  return {
    _state: { feedbacks, auditLogs },
    admin: {
      findFirst: async ({ where }) => {
        for (const adm of admins.values()) {
          if (where.id && adm.id !== where.id) continue;
          if (where.isActive !== undefined && adm.isActive !== where.isActive) continue;
          return { ...adm };
        }
        return null;
      },
    },
    citizen: {
      findUnique: async ({ where }) => citizens.get(where.id) || null,
    },
    citizenFeedback: {
      findUnique: async ({ where }) => {
        const found = feedbacks.find(
          f =>
            (where.id && f.id === where.id) ||
            (where.code && f.code === where.code) ||
            (where.idempotencyKey && f.idempotencyKey === where.idempotencyKey),
        );
        return found ? { ...found } : null;
      },
      create: async ({ data }) => {
        if (feedbacks.some(f => f.code === data.code)) {
          throw Object.assign(new Error('Unique code'), { code: 'P2002' });
        }
        if (data.idempotencyKey && feedbacks.some(f => f.idempotencyKey === data.idempotencyKey)) {
          throw Object.assign(new Error('Unique idem'), { code: 'P2002' });
        }
        const now = new Date();
        const row = {
          id: crypto.randomUUID(),
          code: data.code,
          fullName: data.fullName,
          phoneNormalized: data.phoneNormalized,
          phoneVerificationStatus: data.phoneVerificationStatus || 'UNVERIFIED',
          target: data.target || 'CENTER',
          content: data.content,
          status: data.status || 'NEW',
          assignedToId: null,
          resolutionSummary: null,
          resolvedAt: null,
          idempotencyKey: data.idempotencyKey ?? null,
          payloadHash: data.payloadHash ?? null,
          createdAt: now,
          updatedAt: now,
        };
        feedbacks.push(row);
        return { ...row };
      },
      findMany: async ({ where, skip = 0, take = 15 } = {}) => {
        return feedbacks
          .filter(f => matchesWhere(f, where))
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(skip, skip + take)
          .map(f => ({ ...f }));
      },
      count: async (args = {}) => feedbacks.filter(f => matchesWhere(f, args.where)).length,
    },
    auditLog: {
      create: async ({ data }) => {
        const row = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        auditLogs.push(row);
        return row;
      },
    },
  };
}

test('phone normalization, masking, and Excel formula injection protection work properly', () => {
  assert.equal(normalizeVietnamesePhone('0912 345 678'), '0912345678');
  assert.equal(normalizeVietnamesePhone('+84 912-345-678'), '0912345678');
  assert.equal(normalizeVietnamesePhone('0254.3979.999'), '02543979999');
  assert.equal(normalizeVietnamesePhone('+842543979999'), '02543979999');
  assert.equal(normalizeVietnamesePhone('0012345678'), null);
  assert.equal(normalizeVietnamesePhone('12345'), null);
  assert.equal(maskFeedbackPhone('0912345678'), '091****678');
  assert.equal(sanitizeSpreadsheetText('=CMD|"/C calc"!A0'), '\'=CMD|"/C calc"!A0');
  assert.equal(sanitizeSpreadsheetText('+84912345678'), '\'+84912345678');
  assert.equal(sanitizeSpreadsheetText('Ý kiến bình thường'), 'Ý kiến bình thường');
});

test('end-to-end HTTP feedback workflow: public submission, staff viewing, summary stats, and Admin Excel (.xlsx) export', async t => {
  const prismaMock = createInMemoryPrisma();

  class MockPrismaModule {}
  Global()(MockPrismaModule);
  Module({
    providers: [{ provide: PrismaService, useValue: prismaMock }],
    exports: [PrismaService],
  })(MockPrismaModule);

  class TestAppModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      MockPrismaModule,
      AuthModule,
      FeedbackModule,
    ],
  })(TestAppModule);

  const app = await NestFactory.create(TestAppModule, { logger: false });
  app.useGlobalPipes(createValidationPipe());
  app.setGlobalPrefix('api/v1');
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);
  await app.listen(0, '127.0.0.1');
  t.after(async () => {
    await app.close();
  });

  const addr = app.getHttpServer().address();
  const baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
  const jwtService = app.get(JwtService);

  const superToken = jwtService.sign({
    sub: '11111111-1111-4111-8111-111111111111',
    username: 'superadmin',
    role: 'SUPER_ADMIN',
    type: 'admin',
  });
  const staffEditorToken = jwtService.sign({
    sub: '44444444-4444-4444-8444-444444444444',
    username: 'editor1',
    role: 'EDITOR',
    type: 'admin',
  });
  const citizenToken = jwtService.sign({
    sub: '99999999-9999-4999-8999-999999999999',
    type: 'citizen',
  });

  async function apiCall(method, route, body, headers = {}) {
    const res = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, data: json };
  }

  // 1. Validate trường rỗng / khoảng trắng / SĐT sai / quá giới hạn / mass-assignment
  assert.equal((await apiCall('POST', '/feedback', {}, { 'X-Forwarded-For': '10.20.1.1' })).status, 400);
  assert.equal(
    (
      await apiCall(
        'POST',
        '/feedback',
        { fullName: '   ', phone: '0912345678', content: 'Nội dung góp ý đủ 10 ký tự' },
        { 'X-Forwarded-For': '10.20.1.1' },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await apiCall(
        'POST',
        '/feedback',
        { fullName: 'Nguyễn Văn An', phone: '12345', content: 'Nội dung góp ý đủ 10 ký tự' },
        { 'X-Forwarded-For': '10.20.1.1' },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await apiCall(
        'POST',
        '/feedback',
        {
          fullName: 'Nguyễn Văn An',
          phone: '0912345678',
          content: 'A'.repeat(FEEDBACK_LIMITS.CONTENT_MAX + 1),
        },
        { 'X-Forwarded-For': '10.20.1.2' },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await apiCall(
        'POST',
        '/feedback',
        {
          fullName: 'Nguyễn Văn An',
          phone: '0912345678',
          content: 'Nội dung góp ý hợp lệ',
          status: 'RESOLVED',
        },
        { 'X-Forwarded-For': '10.20.1.2' },
      )
    ).status,
    400,
  );

  // 2. Gửi hợp lệ không cần chọn nhóm (chỉ Họ tên + SĐT + Nội dung) + Idempotency-Key
  const xssContent = '=SUM(1,2) Góp ý giao diện Mini App <script>alert(1)</script> rất dễ dùng.';
  const idemKey = 'fb_idem_simple_0001';
  const createRes = await apiCall(
    'POST',
    '/feedback',
    {
      fullName: '  Trần Thị Ánh Tuyết  ',
      phone: '+84 937 064 147',
      content: `  ${xssContent}  `,
    },
    { 'Idempotency-Key': idemKey, 'X-Forwarded-For': '10.20.1.3' },
  );
  assert.equal(createRes.status, 201);
  assert.match(createRes.data.code, /^GY-\d{6}-[A-Z0-9]{6}$/);
  assert.equal(createRes.data.fullName, undefined);
  assert.equal(createRes.data.phone, undefined);

  // Gửi lặp cùng khóa -> không nhân đôi bản ghi
  const replayRes = await apiCall(
    'POST',
    '/feedback',
    {
      fullName: 'Trần Thị Ánh Tuyết',
      phone: '0937064147',
      content: xssContent,
    },
    { 'Idempotency-Key': idemKey, 'X-Forwarded-For': '10.20.1.3' },
  );
  assert.equal(replayRes.status, 201);
  assert.equal(replayRes.data.code, createRes.data.code);
  assert.equal(prismaMock._state.feedbacks.length, 1);

  // Cùng khóa khác nội dung -> 409
  const mismatchRes = await apiCall(
    'POST',
    '/feedback',
    {
      fullName: 'Trần Thị Ánh Tuyết',
      phone: '0937064147',
      content: 'Một nội dung góp ý hoàn toàn khác.',
    },
    { 'Idempotency-Key': idemKey, 'X-Forwarded-For': '10.20.1.3' },
  );
  assert.equal(mismatchRes.status, 409);

  // 3. Rate limit: vượt quá 5 lần/phút/IP -> 429
  for (let i = 0; i < 5; i++) {
    assert.equal(
      (
        await apiCall(
          'POST',
          '/feedback',
          { fullName: `Người dân ${i}`, phone: '0901234567', content: `Nội dung góp ý lần ${i} hợp lệ` },
          { 'X-Forwarded-For': '10.20.9.9' },
        )
      ).status,
      201,
    );
  }
  assert.equal(
    (
      await apiCall(
        'POST',
        '/feedback',
        { fullName: 'Người dân 6', phone: '0901234567', content: 'Nội dung góp ý vượt ngưỡng' },
        { 'X-Forwarded-For': '10.20.9.9' },
      )
    ).status,
    429,
  );

  // 4. Phân quyền xem: Chưa đăng nhập -> 401; Citizen token -> 403; Công chức / Chuyên viên (EDITOR) -> 200
  assert.equal((await apiCall('GET', '/admin/feedback')).status, 401);
  assert.equal(
    (await apiCall('GET', '/admin/feedback', undefined, { Authorization: `Bearer ${citizenToken}` })).status,
    403,
  );

  const staffList = await apiCall('GET', `/admin/feedback?code=${createRes.data.code}`, undefined, {
    Authorization: `Bearer ${staffEditorToken}`,
  });
  assert.equal(staffList.status, 200);
  assert.equal(staffList.data.data.length, 1);
  assert.equal(staffList.data.data[0].maskedPhone, '093****147');
  assert.equal(staffList.data.summary.totalAll, 6);
  assert.equal(staffList.data.summary.filteredTotal, 1);

  const staffDetail = await apiCall(
    'GET',
    `/admin/feedback/${staffList.data.data[0].id}`,
    undefined,
    { Authorization: `Bearer ${staffEditorToken}` },
  );
  assert.equal(staffDetail.status, 200);
  assert.equal(staffDetail.data.phone, '0937064147');
  assert.equal(staffDetail.data.phoneVerificationStatus, 'UNVERIFIED');
  assert.equal(staffDetail.data.content, xssContent);

  // 5. Xuất file Excel (.xlsx): Chuyên viên thường -> 403; SUPER_ADMIN -> 200 kèm file .xlsx hợp lệ
  const forbiddenExport = await fetch(`${baseUrl}/admin/feedback/export`, {
    headers: { Authorization: `Bearer ${staffEditorToken}` },
  });
  assert.equal(forbiddenExport.status, 403);

  const excelRes = await fetch(`${baseUrl}/admin/feedback/export`, {
    headers: { Authorization: `Bearer ${superToken}` },
  });
  assert.equal(excelRes.status, 200);
  assert.equal(
    excelRes.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  assert.match(excelRes.headers.get('content-disposition') || '', /\.xlsx"/);
  const excelBuf = Buffer.from(await excelRes.arrayBuffer());
  // Magic bytes của file ZIP/XLSX chuẩn OpenXML: PK\x03\x04
  assert.equal(excelBuf[0], 0x50);
  assert.equal(excelBuf[1], 0x4b);
  assert.equal(excelBuf[2], 0x03);
  assert.equal(excelBuf[3], 0x04);

  // AuditLog ghi nhận xuất Excel nhưng không chứa PII
  assert.equal(prismaMock._state.auditLogs.length, 1);
  assert.equal(prismaMock._state.auditLogs[0].action, 'FEEDBACK_EXPORT_EXCEL');
  const serializedLogs = JSON.stringify(prismaMock._state.auditLogs);
  assert.equal(serializedLogs.includes('0937064147'), false);
  assert.equal(serializedLogs.includes('Trần Thị Ánh Tuyết'), false);
});
