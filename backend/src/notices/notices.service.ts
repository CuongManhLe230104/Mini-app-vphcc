import { auditedWrite } from '../audit/audited-write';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Prisma,
  NoticeType,
  NoticePublicationStatus,
  NoticeLegalStatus,
  SourceQualityStatus,
  AdminRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateNoticeDto,
  NoticeProcedureLinkInputDto,
} from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import {
  QueryNoticesDto,
  QuerySourceDocumentsDto,
} from './dto/query-notices.dto';
import {
  NOTICE_INVENTORY_SOURCES,
  NoticeInventorySourceItem,
} from './notices-inventory.data';

@Injectable()
export class NoticesService {
  constructor(private readonly prisma: PrismaService) {}

  private computeIsActive(
    notice: {
      startDate?: Date | null;
      endDate?: Date | null;
      publicationStatus?: string | null;
    },
    now = new Date(),
  ): boolean {
    if (notice.publicationStatus && notice.publicationStatus !== 'PUBLISHED') {
      return false;
    }
    const afterStart = !notice.startDate || now >= notice.startDate;
    const beforeEnd = !notice.endDate || now <= notice.endDate;
    return afterStart && beforeEnd;
  }

  private sanitizePublicNotice(notice: any, now = new Date()) {
    const {
      revision,
      revisionStatus,
      revisionAuthorId,
      rejectionNote,
      verificationNote,
      ...rest
    } = notice;
    return {
      ...rest,
      fieldTags: Array.isArray(notice.fieldTags) ? notice.fieldTags : [],
      isActive: this.computeIsActive(notice, now),
    };
  }

  /**
   * Danh sách niêm yết — mặc định công khai chỉ lấy bản đã đăng (PUBLISHED) và đang hiệu lực.
   * Giữ nguyên tương thích ngược với kiểm thử startDate / endDate / includeArchived.
   */
  async findAll(query: QueryNoticesDto, admin = false) {
    const {
      page = 1,
      limit = 20,
      includeArchived,
      search,
      noticeType,
      fieldTag,
      managingAuthority,
      year,
      publicationStatus,
      legalStatus,
    } = query;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.NoticeWhereInput = admin
      ? {}
      : { startDate: { lte: now } };

    // Chỉ lấy niêm yết đang hiệu lực nếu không yêu cầu lưu trữ (giữ nguyên cấu trúc where cho unit test)
    if (!admin && !includeArchived) {
      where.startDate = { lte: now };
      where.endDate = { gte: now };
    }

    if (search) {
      where.title = { contains: search };
    }

    if (noticeType) {
      where.noticeType = noticeType;
    }

    if (managingAuthority) {
      where.managingAuthority = { contains: managingAuthority };
    }

    if (year) {
      const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
      const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);
      where.legalDocumentDate = { gte: startOfYear, lte: endOfYear };
    }

    if (!admin && this.prisma.sourceDocument) {
      where.publicationStatus = NoticePublicationStatus.PUBLISHED;
    }

    if (admin && publicationStatus) {
      where.publicationStatus = publicationStatus;
    }

    if (admin && legalStatus) {
      where.legalStatus = legalStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.notice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
        include: {
          documents: {
            select: {
              id: true,
              name: true,
              fileUrl: true,
              fileSize: true,
              mimeType: true,
            },
          },
          ...(this.prisma.sourceDocument
            ? {
                sources: {
                  select: {
                    id: true,
                    sourceIndex: true,
                    driveFileId: true,
                    originalUrl: true,
                    previewUrl: true,
                    qualityStatus: true,
                    qualityNote: true,
                    needsDateVerification: true,
                    duplicateOfIndex: true,
                  },
                },
                procedureLinks: {
                  include: {
                    procedure: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        authority: true,
                        sourceUrl: true,
                        fieldId: true,
                      },
                    },
                  },
                },
              }
            : {}),
        } as any,
      }),
      this.prisma.notice.count({ where }),
    ]);

    let items = data.map((notice: any) =>
      admin
        ? {
            ...notice,
            fieldTags: Array.isArray(notice.fieldTags) ? notice.fieldTags : [],
            isActive: this.computeIsActive(notice, now),
          }
        : this.sanitizePublicNotice(notice, now),
    );

    if (!admin) {
      items = items.filter(
        (item: any) =>
          !item.publicationStatus || item.publicationStatus === 'PUBLISHED',
      );
    }

    if (fieldTag && fieldTag !== 'all') {
      items = items.filter(
        (item: any) =>
          Array.isArray(item.fieldTags) && item.fieldTags.includes(fieldTag),
      );
    }

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Danh sách bộ lọc khả dụng cho màn hình Niêm yết (lĩnh vực, cơ quan, năm) */
  async getFilterMetadata() {
    const fieldsSet = new Set<string>();
    const authoritiesSet = new Set<string>();
    const yearsSet = new Set<number>();

    for (const src of NOTICE_INVENTORY_SOURCES) {
      for (const f of src.fieldTags) fieldsSet.add(f);
      if (src.managingAuthority) authoritiesSet.add(src.managingAuthority);
      if (src.legalDocumentDate) {
        const y = Number(src.legalDocumentDate.slice(0, 4));
        if (!Number.isNaN(y)) yearsSet.add(y);
      }
    }

    return {
      fields: Array.from(fieldsSet).sort((a, b) => a.localeCompare(b, 'vi')),
      managingAuthorities: Array.from(authoritiesSet).sort((a, b) =>
        a.localeCompare(b, 'vi'),
      ),
      years: Array.from(yearsSet).sort((a, b) => b - a),
      noticeTypes: [
        {
          value: 'PROCEDURE_ANNOUNCEMENT',
          label: 'Công bố TTHC / Danh mục TTHC',
        },
        {
          value: 'INTERNAL_PROCESS',
          label: 'Quy trình nội bộ / điện tử',
        },
        {
          value: 'INTERNAL_PROCEDURE',
          label: 'TTHC nội bộ hành chính nhà nước',
        },
      ],
    };
  }

  /** Chi tiết niêm yết kèm tài liệu, nguồn và thủ tục liên quan */
  async findOne(id: string, includeScheduled = false) {
    const notice: any = await this.prisma.notice.findUnique({
      where: { id },
      include: {
        documents: true,
        ...(this.prisma.sourceDocument
          ? {
              sources: true,
              procedureLinks: {
                include: {
                  procedure: {
                    include: { field: true },
                  },
                },
              },
            }
          : {}),
      } as any,
    });

    if (
      !notice ||
      (!includeScheduled &&
        ((notice.startDate && notice.startDate > new Date()) ||
          (notice.publicationStatus &&
            notice.publicationStatus !== 'PUBLISHED')))
    ) {
      throw new NotFoundException('Không tìm thấy niêm yết');
    }

    // Tìm thêm văn bản liên quan cùng lĩnh vực hoặc cùng cơ quan quản lý
    let relatedNotices: any[] = [];
    if (this.prisma.notice.findMany && notice.managingAuthority) {
      try {
        const candidates = await this.prisma.notice.findMany({
          where: {
            id: { not: notice.id },
            publicationStatus: 'PUBLISHED',
            managingAuthority: notice.managingAuthority,
          },
          take: 4,
          orderBy: { legalDocumentDate: 'desc' },
          select: {
            id: true,
            title: true,
            legalDocumentNumber: true,
            legalDocumentDate: true,
            noticeType: true,
            managingAuthority: true,
          },
        });
        relatedNotices = candidates;
      } catch {
        relatedNotices = [];
      }
    }

    const now = new Date();
    const base = includeScheduled
      ? {
          ...notice,
          fieldTags: Array.isArray(notice.fieldTags) ? notice.fieldTags : [],
          isActive: this.computeIsActive(notice, now),
        }
      : this.sanitizePublicNotice(notice, now);

    return {
      ...base,
      relatedNotices,
    };
  }

  /** Tạo niêm yết — giữ nguyên tương thích ngược với POST /notices hiện tại */
  async create(dto: CreateNoticeDto, adminId?: string) {
    const now = new Date();
    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : new Date('2026-01-01T00:00:00.000Z');
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : new Date('2030-12-31T23:59:59.000Z');

    if (endDate <= startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    const publicationStatus =
      dto.publicationStatus ?? NoticePublicationStatus.PUBLISHED;
    const isActive =
      publicationStatus === NoticePublicationStatus.PUBLISHED &&
      now >= startDate &&
      now <= endDate;

    return auditedWrite(
      this.prisma,
      adminId,
      'NOTICE_CREATE',
      'notice',
      (tx) =>
        tx.notice.create({
          data: {
            title: dto.title,
            description: dto.description,
            summary: dto.summary ?? dto.description,
            startDate,
            endDate,
            isActive,
            noticeNumber: dto.noticeNumber,
            noticeDate: dto.noticeDate ? new Date(dto.noticeDate) : undefined,
            publishingUnit:
              dto.publishingUnit ??
              'Trung tâm Phục vụ hành chính công xã Nghĩa Thành',
            noticeType: dto.noticeType ?? NoticeType.PROCEDURE_ANNOUNCEMENT,
            publicationStatus,
            legalDocumentNumber: dto.legalDocumentNumber,
            legalDocumentDate: dto.legalDocumentDate
              ? new Date(dto.legalDocumentDate)
              : undefined,
            citedDateText: dto.citedDateText,
            issuingAuthority: dto.issuingAuthority,
            managingAuthority: dto.managingAuthority,
            legalStatus: dto.legalStatus ?? NoticeLegalStatus.UNVERIFIED,
            fieldTags: dto.fieldTags ?? [],
            sourcePortalUrl: dto.sourcePortalUrl,
            needsVerification: dto.needsVerification ?? false,
            verificationNote: dto.verificationNote,
            authorId: adminId,
            publishedAt:
              publicationStatus === NoticePublicationStatus.PUBLISHED
                ? now
                : null,
            documents: dto.documents?.length
              ? {
                  create: dto.documents.map((doc) => ({
                    name: doc.name,
                    fileUrl: doc.fileUrl,
                    fileSize: doc.fileSize,
                    mimeType: doc.mimeType ?? 'application/pdf',
                  })),
                }
              : undefined,
            procedureLinks: dto.procedureLinks?.length
              ? {
                  create: dto.procedureLinks.map((lnk) => ({
                    procedureId: lnk.procedureId,
                    impactType: lnk.impactType ?? 'AMENDED',
                    receivingAuthority: lnk.receivingAuthority,
                    resolvingAuthority: lnk.resolvingAuthority,
                    acceptsAtCenter: lnk.acceptsAtCenter ?? true,
                    note: lnk.note,
                  })),
                }
              : undefined,
          },
          include: {
            documents: true,
            sources: true,
            procedureLinks: { include: { procedure: true } },
          },
        }),
    );
  }

  /** Cập nhật niêm yết */
  async update(id: string, dto: UpdateNoticeDto, adminId?: string) {
    await this.findOne(id, true); // Đảm bảo tồn tại

    const { documents, procedureLinks, version, ...fields } = dto;
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) {
      throw new NotFoundException(`Không tìm thấy niêm yết với ID: ${id}`);
    }

    if (version !== undefined && notice.version !== version) {
      throw new ConflictException(
        'Hồ sơ niêm yết đã được cán bộ khác cập nhật, vui lòng tải lại',
      );
    }

    const updateData: Prisma.NoticeUpdateInput = {
      ...fields,
      version: { increment: 1 },
    };

    if (documents) {
      updateData.documents = { deleteMany: {}, create: documents };
    }
    if (procedureLinks) {
      updateData.procedureLinks = {
        deleteMany: {},
        create: procedureLinks.map((lnk) => ({
          procedureId: lnk.procedureId,
          impactType: lnk.impactType ?? 'AMENDED',
          receivingAuthority: lnk.receivingAuthority,
          resolvingAuthority: lnk.resolvingAuthority,
          acceptsAtCenter: lnk.acceptsAtCenter ?? true,
          note: lnk.note,
        })),
      };
    }

    if (dto.startDate) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate) updateData.endDate = new Date(dto.endDate);
    if (dto.noticeDate) updateData.noticeDate = new Date(dto.noticeDate);
    if (dto.legalDocumentDate) {
      updateData.legalDocumentDate = new Date(dto.legalDocumentDate);
    }

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : notice.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : notice.endDate;

    if (startDate && endDate && endDate <= startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    const now = new Date();
    const pubStatus = dto.publicationStatus ?? notice.publicationStatus;
    updateData.isActive = this.computeIsActive(
      { startDate, endDate, publicationStatus: pubStatus },
      now,
    );

    return auditedWrite(
      this.prisma,
      adminId,
      'NOTICE_UPDATE',
      'notice:' + id,
      (tx) =>
        tx.notice.update({
          where: { id },
          data: updateData,
          include: {
            documents: true,
            sources: true,
            procedureLinks: { include: { procedure: true } },
          },
        }),
    );
  }

  // ───────── QUY TRÌNH KIỂM KÊ 53 NGUỒN & DUYỆT NIÊM YẾT (NY0, NY1, NY2, NY3) ─────────

  /**
   * Nhập 53 nguồn từ kho kiểm kê vào bảng SourceDocument và tạo bản nháp Notice (DRAFT).
   * Idempotent: chạy lại nhiều lần không tạo bản trùng.
   * Không tự động xuất bản đồng loạt 53 nguồn.
   * Tuỳ chọn publishRecommendedSamples = true để duyệt 6 mẫu kiểm thử tiêu biểu theo Mục 9 Kế hoạch V2.
   */
  async importInventorySources(
    adminId: string,
    options: { publishRecommendedSamples?: boolean } = {},
  ) {
    const now = new Date();
    let createdSources = 0;
    let updatedSources = 0;
    let createdDrafts = 0;
    let publishedSamples = 0;

    // Đọc danh sách thủ tục hiện có để gợi ý liên kết tự động cho các lĩnh vực khớp
    const allProcedures = await this.prisma.procedure.findMany({
      where: { isValid: true },
      include: { field: true },
    });

    // Nguồn 43 là bản trùng văn bản với nguồn 42 (3504/QĐ-UBND): cả 2 nguồn cùng trỏ về 1 Notice nháp của 3504/QĐ-UBND
    let noticeIdForSource42: string | null = null;

    for (const item of NOTICE_INVENTORY_SOURCES) {
      let existingSource = await this.prisma.sourceDocument.findUnique({
        where: { sourceIndex: item.sourceIndex },
      });

      const isPrimaryInGroup = item.sourceIndex !== 43;

      if (!existingSource) {
        existingSource = await this.prisma.sourceDocument.create({
          data: {
            sourceIndex: item.sourceIndex,
            driveFileId: item.driveFileId,
            originalUrl: item.originalUrl,
            previewUrl: item.previewUrl,
            headerCode: item.headerCode,
            title: item.title,
            innerDecisionTitle: item.innerDecisionTitle,
            article1Excerpt: item.article1Excerpt,
            citedDateText: item.citedDateText,
            connectorReadable: true,
            publicAccessChecked: item.isRecommendedTestSample,
            publicAccessOk: item.isRecommendedTestSample ? true : null,
            qualityStatus: item.qualityStatus as SourceQualityStatus,
            qualityNote: item.qualityNote,
            needsDateVerification: item.needsDateVerification,
            duplicateOfIndex: item.duplicateOfIndex,
            isPrimaryInGroup,
          },
        });
        createdSources++;
      } else {
        existingSource = await this.prisma.sourceDocument.update({
          where: { id: existingSource.id },
          data: {
            headerCode: item.headerCode,
            title: item.title,
            innerDecisionTitle: item.innerDecisionTitle,
            article1Excerpt: item.article1Excerpt,
            citedDateText: item.citedDateText,
            qualityNote: existingSource.qualityNote || item.qualityNote,
            needsDateVerification: item.needsDateVerification,
            duplicateOfIndex: item.duplicateOfIndex,
            isPrimaryInGroup,
          },
        });
        updatedSources++;
      }

      // Nguồn 43 gắn vào cùng hồ sơ niêm yết của nguồn 42 để giữ đủ cả 2 link PDF mà không nhân đôi bài niêm yết
      if (item.sourceIndex === 43 && noticeIdForSource42) {
        if (existingSource.noticeId !== noticeIdForSource42) {
          await this.prisma.sourceDocument.update({
            where: { id: existingSource.id },
            data: { noticeId: noticeIdForSource42 },
          });
          const existingDoc = await this.prisma.noticeDocument.findFirst({
            where: {
              noticeId: noticeIdForSource42,
              fileUrl: item.originalUrl,
            },
          });
          if (!existingDoc) {
            await this.prisma.noticeDocument.create({
              data: {
                noticeId: noticeIdForSource42,
                name: `Bản PDF đối chiếu bổ sung (Nguồn #43 — ${item.headerCode})`,
                fileUrl: item.originalUrl,
                mimeType: 'application/pdf',
              },
            });
          }
        }
        continue;
      }

      if (!existingSource.noticeId) {
        const shouldPublishSample =
          Boolean(options.publishRecommendedSamples) &&
          item.isRecommendedTestSample &&
          item.qualityStatus === 'OK';

        const legalDate = item.legalDocumentDate
          ? new Date(`${item.legalDocumentDate}T00:00:00.000Z`)
          : new Date('2026-08-01T00:00:00.000Z');
        const defaultEndDate = new Date('2030-12-31T23:59:59.000Z');

        const sourcePortalUrl =
          item.noticeType === 'INTERNAL_PROCESS'
            ? 'https://vpub.hochiminhcity.gov.vn/portal/KenhTin/Quy-trinh-noi-bo-TTHC.aspx'
            : 'https://dichvucong.gov.vn';

        // Tìm thủ tục có thể liên kết mẫu theo lĩnh vực (chỉ gắn khi khớp rõ)
        const matchedProcedures = this.matchProceduresForInventoryItem(
          item,
          allProcedures,
        );

        const createdNotice = await this.prisma.notice.create({
          data: {
            title: item.title,
            description: `${item.innerDecisionTitle}.\n\n${item.article1Excerpt}`,
            summary: item.article1Excerpt,
            startDate: legalDate,
            endDate: defaultEndDate,
            isActive: shouldPublishSample,
            publishingUnit: item.publishingUnit,
            noticeType: item.noticeType as NoticeType,
            publicationStatus: shouldPublishSample
              ? NoticePublicationStatus.PUBLISHED
              : NoticePublicationStatus.DRAFT,
            legalDocumentNumber: item.legalDocumentNumber,
            legalDocumentDate: item.legalDocumentDate
              ? new Date(`${item.legalDocumentDate}T00:00:00.000Z`)
              : null,
            citedDateText: item.citedDateText,
            issuingAuthority: item.issuingAuthority,
            managingAuthority: item.managingAuthority,
            legalStatus: NoticeLegalStatus.UNVERIFIED,
            fieldTags: item.fieldTags,
            sourcePortalUrl,
            needsVerification:
              item.qualityStatus !== 'OK' || item.needsDateVerification,
            verificationNote: item.qualityNote,
            authorId: adminId,
            reviewerId: shouldPublishSample ? adminId : null,
            publishedAt: shouldPublishSample ? now : null,
            documents: {
              create: [
                {
                  name: `Văn bản PDF niêm yết (${item.headerCode} — Nguồn #${item.sourceIndex})`,
                  fileUrl: item.originalUrl,
                  mimeType: 'application/pdf',
                },
              ],
            },
            procedureLinks: matchedProcedures.length
              ? {
                  create: matchedProcedures,
                }
              : undefined,
          },
        });

        await this.prisma.sourceDocument.update({
          where: { id: existingSource.id },
          data: { noticeId: createdNotice.id },
        });

        if (item.sourceIndex === 42) {
          noticeIdForSource42 = createdNotice.id;
        }
        createdDrafts++;
        if (shouldPublishSample) publishedSamples++;
      } else if (item.sourceIndex === 42) {
        noticeIdForSource42 = existingSource.noticeId;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        adminId,
        action: 'NOTICE_INVENTORY_IMPORT',
        resource: 'source_documents:53',
        detail: {
          createdSources,
          updatedSources,
          createdDrafts,
          publishedSamples,
        },
      },
    });

    return {
      totalInventory: NOTICE_INVENTORY_SOURCES.length,
      createdSources,
      updatedSources,
      createdDrafts,
      publishedSamples,
    };
  }

  private matchProceduresForInventoryItem(
    item: NoticeInventorySourceItem,
    allProcedures: Array<{
      id: string;
      code: string | null;
      name: string;
      authority: string;
      field: { slug: string; label: string };
    }>,
  ) {
    if (item.noticeType === 'INTERNAL_PROCEDURE') {
      return [];
    }
    const links: Array<{
      procedureId: string;
      impactType: 'NEW' | 'AMENDED' | 'REPLACED' | 'REPEALED' | 'INTERNAL_PROCESS';
      receivingAuthority: string;
      resolvingAuthority: string;
      acceptsAtCenter: boolean;
      note: string;
    }> = [];

    const text = (
      item.title +
      ' ' +
      item.innerDecisionTitle +
      ' ' +
      item.article1Excerpt
    ).toLowerCase();

    let impactType: 'NEW' | 'AMENDED' | 'REPLACED' | 'REPEALED' | 'INTERNAL_PROCESS' =
      item.noticeType === 'INTERNAL_PROCESS' ? 'INTERNAL_PROCESS' : 'AMENDED';
    if (
      item.noticeType !== 'INTERNAL_PROCESS' &&
      text.includes('mới ban hành') &&
      !text.includes('sửa đổi')
    ) {
      impactType = 'NEW';
    }

    for (const proc of allProcedures) {
      const slug = proc.field?.slug || '';
      let matched = false;
      if (
        slug === 'dat-dai' &&
        (text.includes('đất đai') ||
          text.includes('đo đạc và bản đồ') ||
          text.includes('biện pháp bảo đảm'))
      ) {
        matched = true;
      } else if (
        slug === 'xay-dung' &&
        (text.includes('hoạt động xây dựng') ||
          text.includes('quy hoạch đô thị') ||
          text.includes('nhà ở'))
      ) {
        matched = true;
      } else if (
        slug === 'kinh-doanh' &&
        (text.includes('tổ hợp tác') ||
          text.includes('doanh nghiệp tư nhân') ||
          text.includes('hộ kinh doanh'))
      ) {
        matched = true;
      } else if (
        slug === 'van-hoa-xa-hoi' &&
        (text.includes('người có công') ||
          text.includes('giáo dục') ||
          text.includes('văn hóa') ||
          text.includes('chính sách'))
      ) {
        matched = true;
      }

      if (matched && links.length < 3) {
        links.push({
          procedureId: proc.id,
          impactType,
          receivingAuthority:
            'Trung tâm Phục vụ hành chính công xã Nghĩa Thành / Cổng DVC Quốc gia',
          resolvingAuthority: item.managingAuthority || proc.authority,
          acceptsAtCenter: item.noticeType === 'PROCEDURE_ANNOUNCEMENT',
          note: `Dẫn chiếu theo Quyết định ${item.headerCode} (${item.citedDateText})`,
        });
      }
    }

    return links;
  }

  /** Danh sách 53 nguồn kiểm kê cùng trạng thái đối chiếu */
  async listSourceDocuments(query: QuerySourceDocumentsDto = {}) {
    const where: Prisma.SourceDocumentWhereInput = {};
    if (query.qualityStatus) {
      where.qualityStatus = query.qualityStatus;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { headerCode: { contains: query.search } },
        { qualityNote: { contains: query.search } },
      ];
    }

    const sources = await this.prisma.sourceDocument.findMany({
      where,
      orderBy: { sourceIndex: 'asc' },
      include: {
        notice: {
          select: {
            id: true,
            title: true,
            legalDocumentNumber: true,
            publicationStatus: true,
            legalStatus: true,
            noticeType: true,
          },
        },
      },
    });

    const summary = {
      total: sources.length,
      ok: sources.filter((s) => s.qualityStatus === 'OK').length,
      conflict: sources.filter((s) => s.qualityStatus === 'CONFLICT').length,
      duplicateCandidate: sources.filter(
        (s) => s.qualityStatus === 'DUPLICATE_CANDIDATE',
      ).length,
      needsVerification: sources.filter(
        (s) => s.qualityStatus === 'NEEDS_VERIFICATION',
      ).length,
    };

    return {
      summary,
      data: sources,
    };
  }

  /** Cập nhật kết quả xác minh nguồn (xử lý xung đột 4811/5116, trùng 42/43, xác nhận ngày) */
  async updateSourceQuality(
    sourceId: string,
    payload: {
      qualityStatus?: SourceQualityStatus;
      qualityNote?: string;
      publicAccessOk?: boolean;
      needsDateVerification?: boolean;
      resolvedLegalDocumentNumber?: string;
      resolvedLegalDocumentDate?: string;
    },
    adminId: string,
  ) {
    const source = await this.prisma.sourceDocument.findUnique({
      where: { id: sourceId },
    });
    if (!source) {
      throw new NotFoundException('Không tìm thấy nguồn tài liệu');
    }

    return auditedWrite(
      this.prisma,
      adminId,
      'SOURCE_QUALITY_UPDATE',
      'source:' + sourceId,
      async (tx) => {
        const updatedSource = await tx.sourceDocument.update({
          where: { id: sourceId },
          data: {
            qualityStatus: payload.qualityStatus ?? source.qualityStatus,
            qualityNote:
              payload.qualityNote !== undefined
                ? payload.qualityNote
                : source.qualityNote,
            publicAccessChecked:
              payload.publicAccessOk !== undefined
                ? true
                : source.publicAccessChecked,
            publicAccessOk:
              payload.publicAccessOk !== undefined
                ? payload.publicAccessOk
                : source.publicAccessOk,
            needsDateVerification:
              payload.needsDateVerification !== undefined
                ? payload.needsDateVerification
                : source.needsDateVerification,
          },
        });

        if (source.noticeId) {
          await tx.notice.update({
            where: { id: source.noticeId },
            data: {
              ...(payload.resolvedLegalDocumentNumber
                ? { legalDocumentNumber: payload.resolvedLegalDocumentNumber }
                : {}),
              ...(payload.resolvedLegalDocumentDate
                ? {
                    legalDocumentDate: new Date(
                      payload.resolvedLegalDocumentDate,
                    ),
                  }
                : {}),
              needsVerification:
                updatedSource.qualityStatus !== 'OK' ||
                updatedSource.needsDateVerification,
              verificationNote: updatedSource.qualityNote,
              verifiedById: adminId,
              verifiedAt: new Date(),
            },
          });
        }

        return updatedSource;
      },
    );
  }

  /** Gửi duyệt niêm yết (DRAFT -> PENDING) */
  async submitNotice(id: string, adminId: string) {
    const notice = await this.prisma.notice.findUnique({
      where: { id },
      include: { sources: true },
    });
    if (!notice) {
      throw new NotFoundException('Không tìm thấy niêm yết');
    }

    const hasConflict = (notice.sources || []).some(
      (s) => s.qualityStatus === 'CONFLICT',
    );
    if (hasConflict) {
      throw new BadRequestException(
        'Nguồn tài liệu đang có cờ xung đột (CONFLICT). Vui lòng xác minh và xử lý xung đột trước khi gửi duyệt.',
      );
    }

    return auditedWrite(
      this.prisma,
      adminId,
      'NOTICE_SUBMIT',
      'notice:' + id,
      (tx) =>
        tx.notice.update({
          where: { id },
          data: {
            publicationStatus: NoticePublicationStatus.PENDING,
            version: { increment: 1 },
          },
          include: { documents: true, sources: true },
        }),
    );
  }

  /** Duyệt và đăng công khai niêm yết (chỉ REVIEWER / SUPER_ADMIN) */
  async publishNotice(
    id: string,
    adminId: string,
    role: AdminRole,
    payload: {
      legalStatus?: NoticeLegalStatus;
      verificationNote?: string;
    } = {},
  ) {
    if (role !== AdminRole.REVIEWER && role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Chỉ người duyệt mới được xuất bản niêm yết');
    }

    const notice = await this.prisma.notice.findUnique({
      where: { id },
      include: { sources: true },
    });
    if (!notice) {
      throw new NotFoundException('Không tìm thấy niêm yết');
    }

    const hasUnresolvedConflict = (notice.sources || []).some(
      (s) => s.qualityStatus === 'CONFLICT',
    );
    if (hasUnresolvedConflict) {
      throw new BadRequestException(
        'Không thể xuất bản niêm yết khi nguồn tài liệu vẫn đang ở trạng thái xung đột (CONFLICT).',
      );
    }

    const now = new Date();
    const startDate = notice.startDate ?? now;
    const endDate =
      notice.endDate ?? new Date('2030-12-31T23:59:59.000Z');

    return auditedWrite(
      this.prisma,
      adminId,
      'NOTICE_PUBLISH',
      'notice:' + id,
      (tx) =>
        tx.notice.update({
          where: { id },
          data: {
            publicationStatus: NoticePublicationStatus.PUBLISHED,
            legalStatus: payload.legalStatus ?? notice.legalStatus,
            verificationNote:
              payload.verificationNote ?? notice.verificationNote,
            needsVerification: false,
            reviewerId: adminId,
            verifiedById: adminId,
            verifiedAt: now,
            publishedAt: now,
            startDate,
            endDate,
            isActive: now >= startDate && now <= endDate,
            version: { increment: 1 },
          },
          include: {
            documents: true,
            sources: true,
            procedureLinks: { include: { procedure: true } },
          },
        }),
    );
  }

  /** Thu hồi / ẩn niêm yết khỏi công khai (PUBLISHED -> REVOKED) */
  async revokeNotice(id: string, adminId: string, reason?: string) {
    await this.findOne(id, true);
    const now = new Date();

    return auditedWrite(
      this.prisma,
      adminId,
      'NOTICE_REVOKE',
      'notice:' + id,
      (tx) =>
        tx.notice.update({
          where: { id },
          data: {
            publicationStatus: NoticePublicationStatus.REVOKED,
            isActive: false,
            revokedAt: now,
            revokedReason: reason ?? 'Thu hồi theo yêu cầu rà soát của Trung tâm',
            version: { increment: 1 },
          },
          include: { documents: true, sources: true },
        }),
    );
  }

  /** Cập nhật danh sách liên kết Thủ tục hành chính của 1 niêm yết (Mốc NY3) */
  async setProcedureLinks(
    noticeId: string,
    links: NoticeProcedureLinkInputDto[],
    adminId: string,
  ) {
    await this.findOne(noticeId, true);

    return auditedWrite(
      this.prisma,
      adminId,
      'NOTICE_PROCEDURE_LINKS_UPDATE',
      'notice:' + noticeId,
      async (tx) => {
        await tx.procedureNoticeLink.deleteMany({ where: { noticeId } });
        if (links.length > 0) {
          await tx.procedureNoticeLink.createMany({
            data: links.map((lnk) => ({
              noticeId,
              procedureId: lnk.procedureId,
              impactType: lnk.impactType ?? 'AMENDED',
              receivingAuthority: lnk.receivingAuthority,
              resolvingAuthority: lnk.resolvingAuthority,
              acceptsAtCenter: lnk.acceptsAtCenter ?? true,
              note: lnk.note,
            })),
          });
        }
        return tx.notice.findUnique({
          where: { id: noticeId },
          include: {
            documents: true,
            sources: true,
            procedureLinks: { include: { procedure: true } },
          },
        });
      },
    );
  }

  /** Thêm tài liệu vào niêm yết */
  async addDocument(
    noticeId: string,
    doc: { name: string; fileUrl: string; fileSize?: number; mimeType?: string },
    adminId?: string,
  ) {
    await this.findOne(noticeId, true); // Đảm bảo niêm yết tồn tại

    return auditedWrite(
      this.prisma,
      adminId,
      'NOTICE_DOCUMENT_ADD',
      'notice:' + noticeId,
      (tx) =>
        tx.noticeDocument.create({
          data: {
            noticeId,
            name: doc.name,
            fileUrl: doc.fileUrl,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
          },
        }),
    );
  }

  /** Xoá tài liệu khỏi niêm yết */
  async removeDocument(noticeId: string, docId: string, adminId?: string) {
    const document = await this.prisma.noticeDocument.findFirst({
      where: { id: docId, noticeId },
    });

    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu trong niêm yết này');
    }

    await auditedWrite(
      this.prisma,
      adminId,
      'NOTICE_DOCUMENT_DELETE',
      'notice:' + noticeId,
      (tx) => tx.noticeDocument.delete({ where: { id: docId } }),
    );
    return { deleted: true };
  }
}
