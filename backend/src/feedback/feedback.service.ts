import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, CitizenFeedbackTarget, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCitizenFeedbackDto,
  ExportAdminFeedbackDto,
  QueryAdminFeedbackDto,
} from './dto/feedback.dto';
import {
  computeFeedbackPayloadHash,
  excerptFeedbackContent,
  FEEDBACK_LIMITS,
  generateFeedbackCode,
  maskFeedbackPhone,
  validateAndNormalizeContent,
  validateAndNormalizeFullName,
  validateAndNormalizePhone,
  validateOptionalIdempotencyKey,
} from './feedback-rules';
import { buildFeedbackExcelBuffer } from './xlsx-builder';

export interface AdminActor {
  id: string;
  role: AdminRole;
  type?: string;
  username?: string;
  fullName?: string;
}

const ALLOWED_STAFF_ROLES: AdminRole[] = [
  AdminRole.SUPER_ADMIN,
  AdminRole.HANDLER,
  AdminRole.EDITOR,
  AdminRole.REVIEWER,
  AdminRole.COUNTER_STAFF,
];

function formatVnDateTime(date: Date): string {
  const vn = new Date(date.getTime() + 7 * 3600_000);
  const dd = String(vn.getUTCDate()).padStart(2, '0');
  const mm = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = vn.getUTCFullYear();
  const hh = String(vn.getUTCHours()).padStart(2, '0');
  const mi = String(vn.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function getVnTimeBoundaries(now: Date = new Date()) {
  const vnNow = new Date(now.getTime() + 7 * 3600_000);
  const yyyy = vnNow.getUTCFullYear();
  const mm = String(vnNow.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vnNow.getUTCDate()).padStart(2, '0');
  const startOfToday = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000+07:00`);
  const startOfMonth = new Date(`${yyyy}-${mm}-01T00:00:00.000+07:00`);
  const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 86_400_000);
  return { todayDateStr: `${yyyy}-${mm}-${dd}`, startOfToday, startOfMonth, sevenDaysAgo };
}

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  private assertIsActiveStaff(admin: AdminActor) {
    if (!admin || !ALLOWED_STAFF_ROLES.includes(admin.role)) {
      throw new ForbiddenException(
        'Chỉ tài khoản cán bộ, công chức của Trung tâm mới có quyền xem góp ý.',
      );
    }
  }

  private parseVnDateRange(fromDate?: string, toDate?: string) {
    let gte: Date | undefined;
    let lte: Date | undefined;

    if (fromDate) {
      const d = new Date(`${fromDate}T00:00:00.000+07:00`);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Ngày bắt đầu không hợp lệ.');
      }
      gte = d;
    }

    if (toDate) {
      const d = new Date(`${toDate}T23:59:59.999+07:00`);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Ngày kết thúc không hợp lệ.');
      }
      lte = d;
    }

    if (gte && lte && gte.getTime() > lte.getTime()) {
      throw new BadRequestException(
        'Khoảng ngày không hợp lệ: ngày bắt đầu lớn hơn ngày kết thúc.',
      );
    }

    return { gte, lte };
  }

  /**
   * Tiếp nhận góp ý chung của người dân gửi đến Trung tâm (về Trung tâm, Mini App, thủ tục, thái độ phục vụ...).
   */
  async submitPublicFeedback(
    dto: CreateCitizenFeedbackDto,
    rawIdempotencyKey?: string,
  ) {
    const rawAny = dto as unknown as Record<string, unknown>;
    for (const forbiddenKey of [
      'status',
      'assignedToId',
      'phoneVerificationStatus',
      'resolutionSummary',
      'resolvedAt',
    ]) {
      if (rawAny && forbiddenKey in rawAny && rawAny[forbiddenKey] !== undefined) {
        throw new BadRequestException(
          `Trường "${forbiddenKey}" không được phép gửi từ phía người dùng.`,
        );
      }
    }

    const fullName = validateAndNormalizeFullName(dto?.fullName);
    const phoneNormalized = validateAndNormalizePhone(dto?.phone);
    const target: CitizenFeedbackTarget =
      dto?.target === 'MINI_APP' || dto?.target === 'OTHER' || dto?.target === 'CENTER'
        ? dto.target
        : 'CENTER';
    const content = validateAndNormalizeContent(dto?.content);
    const idempotencyKey = validateOptionalIdempotencyKey(rawIdempotencyKey);

    const payloadHash = computeFeedbackPayloadHash({
      fullName,
      phoneNormalized,
      target,
      content,
    });

    if (idempotencyKey) {
      const existing = await this.prisma.citizenFeedback.findUnique({
        where: { idempotencyKey },
        select: { code: true, createdAt: true, payloadHash: true },
      });
      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
            message:
              'Khóa gửi đã được sử dụng cho một nội dung góp ý khác. Vui lòng thử gửi lại.',
          });
        }
        return {
          code: existing.code,
          createdAt: existing.createdAt,
        };
      }
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateCode = generateFeedbackCode();
      try {
        const created = await this.prisma.citizenFeedback.create({
          data: {
            code: candidateCode,
            fullName,
            phoneNormalized,
            phoneVerificationStatus: 'UNVERIFIED',
            target,
            content,
            status: 'NEW',
            idempotencyKey,
            payloadHash,
          },
          select: { id: true, code: true, createdAt: true },
        });

        return {
          code: created.code,
          createdAt: created.createdAt,
        };
      } catch (err: any) {
        if (err?.code === 'P2002') {
          if (idempotencyKey) {
            const concurrent = await this.prisma.citizenFeedback.findUnique({
              where: { idempotencyKey },
              select: { code: true, createdAt: true, payloadHash: true },
            });
            if (concurrent) {
              if (concurrent.payloadHash !== payloadHash) {
                throw new ConflictException({
                  code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
                  message:
                    'Khóa gửi đã được sử dụng cho một nội dung góp ý khác. Vui lòng thử gửi lại.',
                });
              }
              return {
                code: concurrent.code,
                createdAt: concurrent.createdAt,
              };
            }
          }
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException('Không thể cấp mã góp ý lúc này. Vui lòng thử lại.');
  }

  private buildFilterWhere(query: { code?: string; fromDate?: string; toDate?: string }): Prisma.CitizenFeedbackWhereInput {
    const where: Prisma.CitizenFeedbackWhereInput = {};
    if (query.code?.trim()) {
      where.code = { contains: query.code.trim().toUpperCase() };
    }
    const { gte, lte } = this.parseVnDateRange(query.fromDate, query.toDate);
    if (gte || lte) {
      where.createdAt = {
        ...(gte ? { gte } : {}),
        ...(lte ? { lte } : {}),
      };
    }
    return where;
  }

  /**
   * Danh sách & Thống kê tổng hợp góp ý cho cán bộ, chuyên viên và quản trị viên xem.
   */
  async listAdminFeedback(query: QueryAdminFeedbackDto, admin: AdminActor) {
    this.assertIsActiveStaff(admin);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(
      FEEDBACK_LIMITS.MAX_PAGE_SIZE,
      Math.max(1, query.limit ?? FEEDBACK_LIMITS.DEFAULT_PAGE_SIZE),
    );
    const skip = (page - 1) * limit;

    const where = this.buildFilterWhere(query);
    const { startOfToday, sevenDaysAgo, startOfMonth } = getVnTimeBoundaries();

    const [rows, filteredTotal, totalAll, todayCount, last7DaysCount, thisMonthCount] =
      await Promise.all([
        this.prisma.citizenFeedback.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.citizenFeedback.count({ where }),
        this.prisma.citizenFeedback.count(),
        this.prisma.citizenFeedback.count({
          where: { createdAt: { gte: startOfToday } },
        }),
        this.prisma.citizenFeedback.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
        this.prisma.citizenFeedback.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
      ]);

    return {
      data: rows.map(row => ({
        id: row.id,
        code: row.code,
        fullName: row.fullName,
        maskedPhone: maskFeedbackPhone(row.phoneNormalized),
        phoneVerificationStatus: row.phoneVerificationStatus,
        contentExcerpt: excerptFeedbackContent(row.content),
        createdAt: row.createdAt,
      })),
      summary: {
        totalAll,
        todayCount,
        last7DaysCount,
        thisMonthCount,
        filteredTotal,
      },
      meta: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.max(1, Math.ceil(filteredTotal / limit)),
      },
    };
  }

  /**
   * Xem chi tiết nội dung góp ý dành cho cán bộ, công chức của Trung tâm.
   */
  async getAdminFeedbackDetail(id: string, admin: AdminActor) {
    this.assertIsActiveStaff(admin);

    const record = await this.prisma.citizenFeedback.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Không tìm thấy bản ghi góp ý.');
    }

    return {
      id: record.id,
      code: record.code,
      fullName: record.fullName,
      phone: record.phoneNormalized,
      phoneVerificationStatus: record.phoneVerificationStatus,
      content: record.content,
      createdAt: record.createdAt,
    };
  }

  /**
   * Tổng hợp và xuất file Excel (.xlsx) danh sách góp ý dành cho Quản trị viên (SUPER_ADMIN).
   */
  async exportAdminFeedbackExcel(
    query: ExportAdminFeedbackDto,
    admin: AdminActor,
  ): Promise<{ fileName: string; buffer: Buffer }> {
    if (!admin || admin.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Chỉ Quản trị viên (Admin) mới có quyền tổng hợp và xuất file Excel góp ý.',
      );
    }

    const where = this.buildFilterWhere(query);
    const rows = await this.prisma.citizenFeedback.findMany({
      where,
      take: 5000,
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const { todayDateStr } = getVnTimeBoundaries(now);
    const rangeParts: string[] = [];
    if (query.fromDate) rangeParts.push(`Từ ngày ${query.fromDate}`);
    if (query.toDate) rangeParts.push(`Đến ngày ${query.toDate}`);
    if (query.code?.trim()) rangeParts.push(`Mã chứa "${query.code.trim().toUpperCase()}"`);
    const filterSummaryText = rangeParts.length > 0 ? rangeParts.join(' — ') : 'Toàn bộ góp ý';

    const buffer = buildFeedbackExcelBuffer({
      exportedAtText: formatVnDateTime(now),
      filterSummaryText,
      rows: rows.map((r, idx) => ({
        index: idx + 1,
        code: r.code,
        createdAtText: formatVnDateTime(r.createdAt),
        fullName: r.fullName,
        phone: r.phoneNormalized,
        content: r.content,
      })),
    });

    await this.prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'FEEDBACK_EXPORT_EXCEL',
        resource: 'feedback:export',
        detail: {
          exportedCount: rows.length,
          fromDate: query.fromDate || null,
          toDate: query.toDate || null,
        },
      },
    });

    return {
      fileName: `Tong-hop-gop-y-Nghia-Thanh-${todayDateStr}.xlsx`,
      buffer,
    };
  }
}
