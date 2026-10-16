import { PrismaClient, AdminRole, PostType, PostStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed data cho môi trường phát triển
 * [DỮ LIỆU MẪU] — KHÔNG dùng trên production
 */
async function main() {
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Seed chỉ chạy khi NODE_ENV=development và ALLOW_DEMO_SEED=true');
  }
  const passwords = ['SEED_ADMIN_PASSWORD', 'SEED_EDITOR_PASSWORD', 'SEED_REVIEWER_PASSWORD'].map((key) => {
    const value = process.env[key];
    if (!value || value.length < 12) throw new Error(key + ' phải có ít nhất 12 ký tự');
    return value;
  });
  console.log('🌱 Bắt đầu seed dữ liệu mẫu...');

  // ── Admin mặc định ──────────────────────────
  const adminPassword = await bcrypt.hash(passwords[0], 10);
  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      fullName: 'Quản trị viên',
      role: AdminRole.SUPER_ADMIN,
    },
  });

  const editor = await prisma.admin.upsert({
    where: { username: 'editor' },
    update: {},
    create: {
      username: 'editor',
      passwordHash: await bcrypt.hash(passwords[1], 10),
      fullName: 'Biên tập viên',
      role: AdminRole.EDITOR,
    },
  });

  const reviewer = await prisma.admin.upsert({
    where: { username: 'reviewer' },
    update: {},
    create: {
      username: 'reviewer',
      passwordHash: await bcrypt.hash(passwords[2], 10),
      fullName: 'Người duyệt',
      role: AdminRole.REVIEWER,
    },
  });

  console.log('✅ Tạo admin accounts:', admin.username, editor.username, reviewer.username);

  // ── Thông tin Trung tâm ──────────────────────
  await prisma.center.upsert({
    where: { id: 'center-main' },
    update: {},
    create: {
      id: 'center-main',
      name: 'TT PVHCC xã Nghĩa Thành',
      fullName: 'Trung tâm Phục vụ hành chính công xã Nghĩa Thành',
      address: 'Xã Nghĩa Thành, huyện Châu Đức, tỉnh Bà Rịa - Vũng Tàu',
      hotline: '0274.XXX.XXXX', // [DỮ LIỆU MẪU] — cần xác nhận
      oaId: '',
      servicePortalUrl: 'https://dichvucong.gov.vn',
      caseTrackingUrl: 'https://dichvucong.gov.vn/tra-cuu',
      workingHours: [
        { day: 'Thứ Hai – Thứ Sáu', hours: '07:30 – 11:30 và 13:30 – 17:00' },
        { day: 'Thứ Bảy', hours: '07:30 – 11:30' },
        { day: 'Chủ Nhật & Ngày lễ', hours: 'Nghỉ' },
      ],
    },
  });
  console.log('✅ Tạo thông tin trung tâm');

  // ── Lĩnh vực thủ tục ────────────────────────
  const fields = [
    { slug: 'civil', label: 'Hộ tịch', sortOrder: 1 },
    { slug: 'residence', label: 'Cư trú', sortOrder: 2 },
    { slug: 'land', label: 'Đất đai', sortOrder: 3 },
    { slug: 'other', label: 'Khác', sortOrder: 4 },
  ];
  for (const f of fields) {
    await prisma.procedureField.upsert({
      where: { slug: f.slug },
      update: {},
      create: f,
    });
  }
  console.log('✅ Tạo lĩnh vực thủ tục');

  // ── Thủ tục mẫu ─────────────────────────────
  const civilField = await prisma.procedureField.findUnique({ where: { slug: 'civil' } });
  const residenceField = await prisma.procedureField.findUnique({ where: { slug: 'residence' } });

  if (civilField) {
    const procedures = [
      {
        code: '1.000.00.00.H14', // [DỮ LIỆU MẪU]
        name: 'Đăng ký khai sinh',
        fieldId: civilField.id,
        authority: 'UBND xã Nghĩa Thành',
        deadline: '15 ngày làm việc',
        fee: 'Miễn phí',
        components: [
          'Tờ khai đăng ký khai sinh (theo mẫu)',
          'Giấy chứng sinh do cơ sở y tế cấp',
          'Giấy tờ tùy thân của cha, mẹ',
        ],
        submission: 'Nộp trực tiếp tại bộ phận một cửa hoặc qua cổng dịch vụ công',
      },
      {
        code: '1.000.00.00.H15', // [DỮ LIỆU MẪU]
        name: 'Đăng ký kết hôn',
        fieldId: civilField.id,
        authority: 'UBND xã Nghĩa Thành',
        deadline: '3 ngày làm việc',
        fee: 'Miễn phí',
        components: [
          'Tờ khai đăng ký kết hôn (theo mẫu)',
          'Giấy xác nhận tình trạng hôn nhân',
          'CCCD/Hộ chiếu',
        ],
        submission: 'Nộp trực tiếp tại bộ phận một cửa',
      },
      {
        code: '2.000.00.00.H15', // [DỮ LIỆU MẪU]
        name: 'Xác nhận tình trạng hôn nhân',
        fieldId: civilField.id,
        authority: 'UBND xã Nghĩa Thành',
        deadline: '3 ngày làm việc',
        fee: 'Miễn phí',
        components: [
          'Phiếu yêu cầu xác nhận tình trạng hôn nhân (theo mẫu)',
          'CCCD/Hộ chiếu',
          'Sổ hộ khẩu (nếu có)',
        ],
        submission: 'Nộp trực tiếp tại bộ phận một cửa',
      },
    ];

    for (const proc of procedures) {
      const exists = await prisma.procedure.findFirst({ where: { code: proc.code } });
      if (!exists) {
        await prisma.procedure.create({ data: proc });
      }
    }
  }

  if (residenceField) {
    const resProcedures = [
      {
        code: '2.000.00.00.H14', // [DỮ LIỆU MẪU]
        name: 'Đăng ký thường trú',
        fieldId: residenceField.id,
        authority: 'Công an xã Nghĩa Thành',
        deadline: '7 ngày làm việc',
        fee: 'Miễn phí',
        components: [
          'Phiếu báo thay đổi hộ khẩu, nhân khẩu',
          'Giấy tờ chứng minh chỗ ở hợp pháp',
          'CCCD/Hộ chiếu',
        ],
        submission: 'Nộp trực tiếp hoặc qua cổng dịch vụ công',
      },
    ];

    for (const proc of resProcedures) {
      const exists = await prisma.procedure.findFirst({ where: { code: proc.code } });
      if (!exists) {
        await prisma.procedure.create({ data: proc });
      }
    }
  }
  console.log('✅ Tạo thủ tục mẫu');

  // ── Tin tức mẫu ──────────────────────────────
  const posts = [
    {
      type: PostType.NEWS,
      status: PostStatus.PUBLISHED,
      title: 'Thông báo lịch tiếp công dân tháng 10/2026',
      summary: '[DỮ LIỆU MẪU] Trung tâm PVHCC xã Nghĩa Thành thông báo lịch tiếp công dân.',
      content: '[DỮ LIỆU MẪU] Nội dung sẽ được cập nhật sau quy trình duyệt chính thức.',
      isHighlighted: true,
      authorId: editor.id,
      reviewerId: reviewer.id,
      publishedAt: new Date('2026-10-10'),
      tags: ['thông báo', 'tiếp công dân'],
    },
    {
      type: PostType.GUIDE,
      status: PostStatus.PUBLISHED,
      title: 'Hướng dẫn đăng ký khai sinh trực tuyến',
      summary: '[DỮ LIỆU MẪU] Các bước thực hiện thủ tục đăng ký khai sinh qua cổng dịch vụ công.',
      content: '[DỮ LIỆU MẪU] Nội dung hướng dẫn sẽ được cập nhật sau quy trình duyệt chính thức.',
      isHighlighted: true,
      authorId: editor.id,
      reviewerId: reviewer.id,
      publishedAt: new Date('2026-10-08'),
      tags: ['hướng dẫn', 'khai sinh'],
    },
    {
      type: PostType.NEWS,
      status: PostStatus.PUBLISHED,
      title: 'Triển khai dịch vụ hành chính công mức độ 4',
      summary: '[DỮ LIỆU MẪU] UBND xã Nghĩa Thành triển khai dịch vụ mức độ 4.',
      content: '[DỮ LIỆU MẪU] Nội dung sẽ được cập nhật.',
      isHighlighted: true,
      authorId: editor.id,
      reviewerId: reviewer.id,
      publishedAt: new Date('2026-10-05'),
      tags: ['dịch vụ công'],
    },
  ];

  for (const post of posts) {
    const exists = await prisma.post.findFirst({ where: { title: post.title } });
    if (!exists) {
      await prisma.post.create({ data: post });
    }
  }
  console.log('✅ Tạo tin tức mẫu');

  // ── Niêm yết mẫu ────────────────────────────
  const notice = await prisma.notice.findFirst({ where: { title: { contains: 'viên chức' } } });
  if (!notice) {
    await prisma.notice.create({
      data: {
        title: 'Niêm yết kết quả xét tuyển viên chức năm 2026',
        description: '[DỮ LIỆU MẪU] Thông báo kết quả xét tuyển viên chức năm 2026.',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-22'),
        isActive: true,
      },
    });
  }
  console.log('✅ Tạo niêm yết mẫu');

  // ── FAQ mẫu ──────────────────────────────────
  const faqs = [
    {
      question: 'Trung tâm PVHCC xã Nghĩa Thành làm việc vào giờ nào?',
      answer: '[DỮ LIỆU MẪU] Thứ Hai – Thứ Sáu: 07:30 – 11:30 và 13:30 – 17:00. Thứ Bảy: 07:30 – 11:30.',
      category: 'Chung',
      isPublished: true,
      sortOrder: 1,
    },
    {
      question: 'Tôi có thể nộp hồ sơ trực tuyến không?',
      answer: '[DỮ LIỆU MẪU] Có, bạn có thể nộp hồ sơ qua Cổng dịch vụ công quốc gia tại dichvucong.gov.vn.',
      category: 'Thủ tục',
      isPublished: true,
      sortOrder: 2,
    },
  ];

  for (const faq of faqs) {
    const exists = await prisma.faq.findFirst({ where: { question: faq.question } });
    if (!exists) {
      await prisma.faq.create({ data: faq });
    }
  }
  console.log('✅ Tạo FAQ mẫu');

  console.log('\n🎉 Seed hoàn tất!');
}

main()
  .catch((e) => {
    console.error('❌ Seed lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

