import { auditedWrite } from '../audit/audited-write';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCenterDto } from './dto/update-center.dto';

@Injectable()
export class CenterService {
  constructor(private prisma: PrismaService) {}

  async getCenterInfo() {
    const center = await this.prisma.center.findFirst();
    if (!center) throw new NotFoundException('Thông tin trung tâm chưa được cấu hình');
    return center;
  }

  async updateCenterInfo(dto: UpdateCenterDto, adminId?: string) {
    const center = await this.prisma.center.findFirst();
    const data = {
      ...dto,
      workingHours: dto.workingHours?.map(row => ({ day: row.day, hours: row.hours })),
      bannerImages: dto.bannerImages?.map(row => ({ url: row.url, alt: row.alt })),
    };
    if (center) return auditedWrite(this.prisma, adminId, 'CENTER_UPDATE', 'center:' + center.id, tx => tx.center.update({ where: { id: center.id }, data }));
    if (!dto.name || !dto.fullName || !dto.address || !dto.hotline || !dto.workingHours) {
      throw new BadRequestException('Lần đầu cần cung cấp tên, tên đầy đủ, địa chỉ, hotline và lịch làm việc đã xác nhận');
    }
    return auditedWrite(this.prisma, adminId, 'CENTER_CREATE', 'center', tx => tx.center.create({ data: {
      ...data, name: dto.name!, fullName: dto.fullName!, address: dto.address!,
      hotline: dto.hotline!, workingHours: dto.workingHours!.map(row => ({ day: row.day, hours: row.hours })),
    } }));
  }
}
