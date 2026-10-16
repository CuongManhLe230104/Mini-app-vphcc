import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ghi nhật ký thao tác quan trọng
   * KHÔNG ghi secrets, nội dung phản ánh, thông tin cá nhân
   */
  async log(params: {
    adminId?: string;
    action: string;
    resource: string;
    detail?: Record<string, unknown>;
    ip?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        resource: params.resource,
        detail: (params.detail as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ip: params.ip,
      },
    });
  }

  /** Danh sách audit log (admin only) */
  async findAll(params: {
    page?: number;
    limit?: number;
    action?: string;
    adminId?: string;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (params.action) where.action = params.action;
    if (params.adminId) where.adminId = params.adminId;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { id: true, fullName: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
