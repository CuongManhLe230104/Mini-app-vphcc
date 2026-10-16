import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { QueryProceduresDto } from './dto/query-procedures.dto';

@Injectable()
export class ProceduresService {
  constructor(private prisma: PrismaService) {}

  /** Lấy danh sách lĩnh vực */
  async getFields() {
    return this.prisma.procedureField.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Lấy danh sách thủ tục (phân trang, lọc theo lĩnh vực, tìm kiếm) */
  async findAll(query: QueryProceduresDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProcedureWhereInput = { isValid: true };

    if (query.field && query.field !== 'all') {
      where.field = { slug: query.field };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.procedure.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { field: true },
      }),
      this.prisma.procedure.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Lấy chi tiết thủ tục */
  async findOne(id: string) {
    const proc = await this.prisma.procedure.findFirst({
      where: { id, isValid: true },
      include: { field: true },
    });
    if (!proc) {
      throw new NotFoundException(`Không tìm thấy thủ tục với ID: ${id}`);
    }
    return proc;
  }

  /** Tạo thủ tục mới (Admin) */
  async create(dto: CreateProcedureDto) {
    return this.prisma.procedure.create({
      data: dto as any,
    });
  }

  /** Cập nhật thủ tục (Admin) */
  async update(id: string, dto: UpdateProcedureDto) {
    await this.findOne(id);
    return this.prisma.procedure.update({
      where: { id },
      data: dto as any,
    });
  }

  /** Xoá mềm thủ tục */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.procedure.update({
      where: { id },
      data: { isValid: false },
    });
  }
}

