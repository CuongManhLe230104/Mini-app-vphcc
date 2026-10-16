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

  async updateCenterInfo(dto: UpdateCenterDto) {
    const center = await this.prisma.center.findFirst();
    const data = {
      ...dto,
      workingHours: dto.workingHours as Prisma.InputJsonValue | undefined,
      bannerImages: dto.bannerImages as Prisma.InputJsonValue | undefined,
    };
    if (center) return this.prisma.center.update({ where: { id: center.id }, data });
    if (!dto.name || !dto.fullName || !dto.address || !dto.hotline || !dto.workingHours) {
      throw new BadRequestException('Lần đầu cần cung cấp tên, tên đầy đủ, địa chỉ, hotline và lịch làm việc đã xác nhận');
    }
    return this.prisma.center.create({ data: {
      ...data, name: dto.name, fullName: dto.fullName, address: dto.address,
      hotline: dto.hotline, workingHours: dto.workingHours as Prisma.InputJsonValue,
    } });
  }
}
