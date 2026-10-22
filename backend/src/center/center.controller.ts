import { Req } from '@nestjs/common';
import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { CenterService } from './center.service';
import { UpdateCenterDto } from './dto/update-center.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';

@Controller('center')
export class CenterController {
  constructor(private readonly centerService: CenterService) {}

  /** Lấy thông tin trung tâm (công khai) */
  @Get()
  async getCenter() {
    return this.centerService.getCenterInfo();
  }

  /** Cập nhật thông tin trung tâm (Admin SUPER_ADMIN) */
  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  async updateCenter(@Req() req: any, @Body() dto: UpdateCenterDto) {
    return this.centerService.updateCenterInfo(dto, req.user.id);
  }
}

