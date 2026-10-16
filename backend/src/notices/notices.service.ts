import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { QueryNoticesDto } from './dto/query-notices.dto';

@Injectable()
export class NoticesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Danh sách niêm yết — mặc định chỉ lấy đang có hiệu lực.
   * isActive tính theo ngày hiện tại, không phụ thuộc DB flag.
   */
  async findAll(query: QueryNoticesDto) {
    const { page = 1, limit = 20, includeArchived, search } = query;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.NoticeWhereInput = { startDate: { lte: now } };

    // Chỉ lấy niêm yết đang hiệu lực nếu không yêu cầu lưu trữ
    if (!includeArchived) {
      where.startDate = { lte: now };
      where.endDate = { gte: now };
    }

    if (search) {
      where.title = { contains: search };
    }

    const [data, total] = await Promise.all([
      this.prisma.notice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
        include: {
          documents: {
            select: { id: true, name: true, fileUrl: true, fileSize: true, mimeType: true },
          },
        },
      }),
      this.prisma.notice.count({ where }),
    ]);

    // Tính isActive dựa trên ngày
    const items = data.map((notice) => ({
      ...notice,
      isActive: now >= notice.startDate && now <= notice.endDate,
    }));

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

  /** Chi tiết niêm yết kèm tài liệu */
  async findOne(id: string, includeScheduled = false) {
    const notice = await this.prisma.notice.findUnique({
      where: { id },
      include: {
        documents: true,
      },
    });

    if (!notice || (!includeScheduled && notice.startDate > new Date())) {
      throw new NotFoundException('Không tìm thấy niêm yết');
    }

    const now = new Date();
    return {
      ...notice,
      isActive: now >= notice.startDate && now <= notice.endDate,
    };
  }

  /** Tạo niêm yết — chỉ EDITOR trở lên */
  async create(dto: CreateNoticeDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    const now = new Date();
    const isActive = now >= startDate && now <= endDate;

    return this.prisma.notice.create({
      data: {
        title: dto.title,
        description: dto.description,
        startDate,
        endDate,
        isActive,
        documents: dto.documents?.length
          ? {
              create: dto.documents.map((doc) => ({
                name: doc.name,
                fileUrl: doc.fileUrl,
                fileSize: doc.fileSize,
                mimeType: doc.mimeType,
              })),
            }
          : undefined,
      },
      include: { documents: true },
    });
  }

  /** Cập nhật niêm yết */
  async update(id: string, dto: UpdateNoticeDto) {
    await this.findOne(id, true); // Đảm bảo tồn tại

    const updateData: Prisma.NoticeUpdateInput = { ...dto };

    if (dto.startDate) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate) updateData.endDate = new Date(dto.endDate);

    // Tính lại isActive nếu ngày thay đổi
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) {
      throw new NotFoundException(`Không tìm thấy niêm yết với ID: ${id}`);
    }
    const startDate = dto.startDate ? new Date(dto.startDate) : notice.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : notice.endDate;

    if (endDate <= startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    const now = new Date();
    updateData.isActive = now >= startDate && now <= endDate;

    return this.prisma.notice.update({
      where: { id },
      data: updateData,
      include: { documents: true },
    });
  }

  /** Thêm tài liệu vào niêm yết */
  async addDocument(
    noticeId: string,
    doc: { name: string; fileUrl: string; fileSize?: number; mimeType?: string },
  ) {
    await this.findOne(noticeId, true); // Đảm bảo niêm yết tồn tại

    return this.prisma.noticeDocument.create({
      data: {
        noticeId,
        name: doc.name,
        fileUrl: doc.fileUrl,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
      },
    });
  }

  /** Xoá tài liệu khỏi niêm yết */
  async removeDocument(noticeId: string, docId: string) {
    // Kiểm tra tài liệu thuộc đúng niêm yết
    const document = await this.prisma.noticeDocument.findFirst({
      where: { id: docId, noticeId },
    });

    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu trong niêm yết này');
    }

    await this.prisma.noticeDocument.delete({ where: { id: docId } });
    return { deleted: true };
  }
}
