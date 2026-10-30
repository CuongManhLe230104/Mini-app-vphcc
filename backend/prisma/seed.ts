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
    { slug: 'certification', label: 'Chứng thực', sortOrder: 2 },
    { slug: 'social-welfare', label: 'Người có công & Bảo trợ xã hội', sortOrder: 3 },
    { slug: 'sports', label: 'Thể dục - Thể thao', sortOrder: 4 },
    { slug: 'land', label: 'Đất đai', sortOrder: 5 },
    { slug: 'construction-planning', label: 'Xây dựng & Quy hoạch', sortOrder: 6 },
    { slug: 'business-household', label: 'Đăng ký hộ kinh doanh', sortOrder: 7 },
  ];
  const fieldBySlug: Record<string, string> = {};
  for (const f of fields) {
    const record = await prisma.procedureField.upsert({
      where: { slug: f.slug },
      update: { label: f.label, sortOrder: f.sortOrder },
      create: f,
    });
    fieldBySlug[f.slug] = record.id;
  }
  console.log('✅ Tạo 7 lĩnh vực thủ tục');

  // ── Danh mục 33 thủ tục hành chính & đường dẫn DVC Quốc gia ──
  const catalog = [
    // I. Hộ tịch
    { sortOrder: 1, fieldSlug: 'civil', code: '1.001193', name: 'Thủ tục đăng ký khai sinh', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-3fe0-70ac-b9d6-5e9e20d6eef7', submission: 'Nộp hồ sơ đăng ký khai sinh trực tuyến cho trẻ mới sinh.' },
    { sortOrder: 2, fieldSlug: 'civil', code: '1.000894', name: 'Thủ tục đăng ký kết hôn', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-3fac-7489-b53b-a15eb239a6fe', submission: 'Đăng ký kết hôn cho công dân Việt Nam cư trú trong nước.' },
    { sortOrder: 3, fieldSlug: 'civil', code: '2.000635', name: 'Cấp bản sao Trích lục hộ tịch, bản sao Giấy khai sinh', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-867c-72db-b6a7-dcbd8c763807', submission: 'Yêu cầu cấp bản sao trích lục từ cơ sở dữ liệu hộ tịch (khai sinh, kết hôn, khai tử,...).' },
    { sortOrder: 4, fieldSlug: 'civil', code: '1.004772', name: 'Đăng ký khai sinh cho người đã có hồ sơ, giấy tờ cá nhân', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-6711-733d-b674-fc3d805e70c8', submission: 'Đăng ký khai sinh cho người đã có giấy tờ cá nhân nhưng chưa từng có giấy khai sinh gốc.' },
    { sortOrder: 5, fieldSlug: 'civil', code: '1.004859', name: 'Thay đổi, cải chính, bổ sung thông tin hộ tịch, xác định lại dân tộc', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-671e-714b-8fd6-8230c82f7867', submission: 'Đính chính sai sót, bổ sung thông tin hộ tịch hoặc thay đổi thông tin dân tộc trên giấy tờ.' },
    { sortOrder: 6, fieldSlug: 'civil', code: '2.002189', name: 'Ghi vào Sổ hộ tịch việc kết hôn của công dân VN tại nước ngoài', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-9dec-73f6-b213-be4bfb4f911b', submission: 'Ghi chú việc kết hôn đã được công nhận hợp pháp ở nước ngoài vào sổ hộ tịch Việt Nam.' },
    { sortOrder: 7, fieldSlug: 'civil', code: '2.000554', name: 'Ghi vào Sổ hộ tịch việc ly hôn, hủy kết hôn tại nước ngoài', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-867a-70eb-bc54-e836b23a4649', submission: 'Ghi chú việc ly hôn hoặc hủy hôn đã giải quyết ở nước ngoài vào sổ bộ hộ tịch Việt Nam.' },
    { sortOrder: 8, fieldSlug: 'civil', code: '1.000656', name: 'Thủ tục đăng ký khai tử', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-3fac-7489-b53b-9c6c958f2da4', submission: 'Khai báo tử vong và làm thủ tục cấp Trích lục khai tử/Giấy chứng tử cho người mất.' },
    { sortOrder: 9, fieldSlug: 'civil', code: '1.001022', name: 'Thủ tục đăng ký nhận cha, mẹ, con', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-3fa6-722f-ac1a-e949c8ce3418', submission: 'Đăng ký công nhận quan hệ huyết thống cha, mẹ, con giữa công dân Việt Nam.' },
    { sortOrder: 11, fieldSlug: 'civil', code: '1.004884', name: 'Thủ tục đăng ký lại khai sinh', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-6eac-7598-b88b-15f8a61b366a', submission: 'Đăng ký lại giấy khai sinh khi cả sổ đăng ký gốc và bản chính đều bị mất/thất lạc.' },
    { sortOrder: 12, fieldSlug: 'civil', code: '1.004873', name: 'Cấp Giấy xác nhận tình trạng hôn nhân', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-6eb3-7019-bf3f-fc58c9ee44b9', submission: 'Cấp chứng nhận độc thân để đăng ký kết hôn, chuyển nhượng tài sản hoặc giao dịch khác.' },
    { sortOrder: 13, fieldSlug: 'civil', code: '2.000528', name: 'Đăng ký khai sinh có yếu tố nước ngoài', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-8662-763f-927f-dc039ede198c', submission: 'Khai sinh cho trẻ em có cha hoặc mẹ là người nước ngoài, hoặc sinh ra ở nước ngoài.' },
    { sortOrder: 14, fieldSlug: 'civil', code: '2.000806', name: 'Đăng ký kết hôn có yếu tố nước ngoài', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-8e13-728a-a0cd-635811d8432e', submission: 'Đăng ký kết hôn giữa công dân Việt Nam với người nước ngoài.' },
    { sortOrder: 15, fieldSlug: 'civil', code: '1.004746', name: 'Thủ tục đăng ký lại kết hôn', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-6711-733d-b674-f82cb6606242', submission: 'Nộp hồ sơ đăng ký lại khi sổ hộ tịch và giấy chứng nhận kết hôn gốc đã bị thất lạc.' },
    { sortOrder: 16, fieldSlug: 'civil', code: '1.001766', name: 'Đăng ký khai tử có yếu tố nước ngoài', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-47da-7259-b8fe-0d5327727234', submission: 'Khai tử cho người nước ngoài hoặc người Việt Nam định cư ở nước ngoài chết tại Việt Nam.' },
    { sortOrder: 17, fieldSlug: 'civil', code: '2.000779', name: 'Đăng ký nhận cha, mẹ, con có yếu tố nước ngoài', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-8dff-7296-94d7-25b5966319d5', submission: 'Đăng ký nhận huyết thống cha, mẹ, con khi có ít nhất một bên là công dân nước ngoài.' },
    { sortOrder: 18, fieldSlug: 'civil', code: '1.001695', name: 'Đăng ký khai sinh kết hợp nhận cha, mẹ, con có yếu tố nước ngoài', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-47b0-7285-b035-456104e16436', submission: 'Giải quyết liên thông đồng thời cả thủ tục khai sinh và nhận quan hệ cha/mẹ/con có yếu tố quốc tế.' },
    // II. Chứng thực
    { sortOrder: 19, fieldSlug: 'certification', code: '2.000815', name: 'Chứng thực bản sao từ bản chính giấy tờ, văn bản', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-8e22-77ef-819f-e49460350904', submission: 'Cấp bản sao điện tử chứng thực hoặc đối chiếu chứng thực sao y bản chính từ giấy tờ gốc.' },
    { sortOrder: 20, fieldSlug: 'certification', code: '2.000884', name: 'Chứng thực chữ ký trong các giấy tờ, văn bản', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-8e2e-7359-b42f-d5dc8d74741b', submission: 'Chứng nhận chữ ký hoặc dấu điểm chỉ của cá nhân trên các văn bản, giấy ủy quyền, đơn từ.' },
    // III. Người có công & Bảo trợ xã hội
    { sortOrder: 21, fieldSlug: 'social-welfare', code: '1.013750', name: 'Thăm viếng mộ liệt sĩ', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfb-2324-7555-8e56-024dcdb30038', submission: 'Đề nghị cấp kinh phí hoặc giấy giới thiệu thăm viếng mộ liệt sĩ cho thân nhân người có công.' },
    { sortOrder: 22, fieldSlug: 'social-welfare', code: '1.010833', name: 'Cấp giấy xác nhận thân nhân của người có công', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfb-03d5-700b-9bb5-d92070224137', submission: 'Xác nhận mối quan hệ thân nhân với liệt sĩ/thương binh để hưởng các chính sách ưu đãi.' },
    { sortOrder: 24, fieldSlug: 'social-welfare', code: '1.116910', name: 'Hỗ trợ chi phí mai táng cho đối tượng bảo trợ xã hội', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/01a0f66e-63a3-749a-a9d8-2dcbeda6af79', submission: 'Nộp hồ sơ nhận tiền hỗ trợ chi phí mai táng khi đối tượng hưởng trợ cấp xã hội qua đời.' },
    { sortOrder: 25, fieldSlug: 'social-welfare', code: '1.001653', name: 'Đổi, cấp lại Giấy xác nhận khuyết tật', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfe-b7ab-731d-844a-5e232b77afef', submission: 'Cấp đổi hoặc cấp lại giấy xác nhận mức độ khuyết tật khi bị mất, rách, hỏng hoặc tái thẩm định.' },
    // IV. Thể dục - Thể thao
    { sortOrder: 28, fieldSlug: 'sports', code: '2.000794', name: 'Thủ tục công nhận câu lạc bộ thể thao cơ sở', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfd-fba4-7418-b25f-d4e06bd25809', submission: 'Nộp hồ sơ thành lập và đề nghị UBND cấp xã ra quyết định công nhận CLB thể thao cơ sở.' },
    // V. Đất đai
    { sortOrder: 29, fieldSlug: 'land', code: '1.013823', name: 'Giao đất, cho thuê đất, chuyển mục đích sử dụng đất...', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfa-7ec9-76f0-b9d3-985182762c76', submission: 'Nộp đơn đề nghị giao đất, thuê đất, gia hạn hoặc chuyển mục đích sử dụng đất không đấu giá.' },
    { sortOrder: 30, fieldSlug: 'land', code: '1.115939', name: 'Đăng ký đất đai, cấp Giấy chứng nhận lần đầu', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfa-7ec9-76f0-b9d3-985182762c76', submission: 'Nộp hồ sơ đề nghị cấp Giấy chứng nhận quyền sử dụng đất (Sổ đỏ) lần đầu cho cá nhân, hộ gia đình.' },
    { sortOrder: 31, fieldSlug: 'land', code: '1.012812', name: 'Hòa giải tranh chấp đất đai', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfa-76e6-7468-b6f2-3d412e902b88', submission: 'Gửi đơn yêu cầu chính quyền cơ sở thụ lý và đứng ra tổ chức hòa giải mâu thuẫn tranh chấp đất.' },
    { sortOrder: 32, fieldSlug: 'land', code: '1.012796', name: 'Đính chính Giấy chứng nhận đã cấp lần đầu có sai sót', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfa-76cb-741b-996e-33d1ef50be50', submission: 'Đề nghị cơ quan đăng ký đất đai chỉnh sửa các sai sót về nhân thân, diện tích, số tờ/số thửa trên Sổ đỏ.' },
    { sortOrder: 33, fieldSlug: 'land', code: '1.013826', name: 'Điều chỉnh quyết định giao đất, cho thuê đất, chuyển mục đích sử dụng đất', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfa-7ecc-735b-9e4f-6121df9b059d', submission: 'Nộp hồ sơ điều chỉnh thông tin hoặc thời hạn sử dụng đất theo các quyết định giao đất trước đó.' },
    // VI. Xây dựng & Quy hoạch
    { sortOrder: 34, fieldSlug: 'construction-planning', code: '1.013227', name: 'Gia hạn giấy phép xây dựng', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfe-9097-700f-899f-6dfc532f0e6b', submission: 'Đề nghị kéo dài thời hạn khởi công công trình khi giấy phép xây dựng đã cấp sắp hết hạn.' },
    { sortOrder: 36, fieldSlug: 'construction-planning', code: '1.013226', name: 'Cấp điều chỉnh giấy phép xây dựng', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfe-9097-7135-94e7-f539d8b0cc19', submission: 'Nộp hồ sơ điều chỉnh bản vẽ, diện tích hoặc kết cấu so với giấy phép xây dựng đã được duyệt.' },
    { sortOrder: 38, fieldSlug: 'construction-planning', code: '1.014159', name: 'Cung cấp thông tin quy hoạch đô thị và nông thôn', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfe-9852-71ed-96f2-8110da8fd4f0', submission: 'Tra cứu và yêu cầu cung cấp chứng chỉ/thông tin quy hoạch xây dựng, chỉ giới đất đai tại địa phương.' },
    // VII. Đăng ký hộ kinh doanh
    { sortOrder: 39, fieldSlug: 'business-household', code: '2.000720', name: 'Đăng ký thay đổi nội dung đăng ký hộ kinh doanh', sourceUrl: 'https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bfc-d9ca-768c-a8f4-cc0dff5f41ed', submission: 'Báo cáo thay đổi ngành nghề kinh doanh, vốn, địa chỉ điểm kinh doanh hoặc người đại diện hộ.' },
  ];

  const reviewDate = new Date('2026-10-30');
  for (const item of catalog) {
    const fieldId = fieldBySlug[item.fieldSlug];
    const existing = await prisma.procedure.findFirst({ where: { code: item.code } });
    const data = {
      code: item.code,
      name: item.name,
      fieldId,
      authority: 'UBND xã Nghĩa Thành',
      deadline: 'Theo quy định trên Cổng Dịch vụ công Quốc gia',
      fee: 'Theo quy định trên Cổng Dịch vụ công Quốc gia',
      components: ['Xem chi tiết thành phần hồ sơ và biểu mẫu trên Cổng Dịch vụ công Quốc gia'],
      submission: item.submission,
      sourceUrl: item.sourceUrl,
      reviewDate,
      isValid: true,
      sortOrder: item.sortOrder,
    };
    if (existing) {
      await prisma.procedure.update({ where: { id: existing.id }, data });
    } else {
      await prisma.procedure.create({ data });
    }
  }
  console.log('✅ Đồng bộ 33 thủ tục hành chính từ danh mục');

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

