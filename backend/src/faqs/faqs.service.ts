import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@Injectable()
export class FaqsService {
  constructor(private prisma: PrismaService) {}

  /** Lấy danh sách FAQ đã công khai (công khai) */
  async findPublished() {
    return this.prisma.faq.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Lấy tất cả FAQ (Admin) */
  async findAll() {
    return this.prisma.faq.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Tạo FAQ (Admin) */
  async create(dto: CreateFaqDto) {
    return this.prisma.faq.create({ data: dto });
  }

  /** Cập nhật FAQ (Admin) */
  async update(id: string, dto: UpdateFaqDto) {
    const faq = await this.prisma.faq.findUnique({ where: { id } });
    if (!faq) throw new NotFoundException('Không tìm thấy FAQ');
    return this.prisma.faq.update({ where: { id }, data: dto });
  }

  /** Xoá FAQ (Admin) */
  async remove(id: string) {
    const faq = await this.prisma.faq.findUnique({ where: { id } });
    if (!faq) throw new NotFoundException('Không tìm thấy FAQ');
    return this.prisma.faq.delete({ where: { id } });
  }
}

