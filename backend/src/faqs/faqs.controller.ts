import { Req } from '@nestjs/common';
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';

@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  /** Lấy danh sách FAQ đã công khai (công khai) */
  @Get()
  async findPublished() {
    return this.faqsService.findPublished();
  }

  /** Admin: Lấy tất cả FAQ */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER, AdminRole.EDITOR)
  async findAllAdmin() {
    return this.faqsService.findAll();
  }

  /** Admin: Tạo FAQ */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  async create(@Req() req: any, @Body() dto: CreateFaqDto) {
    return this.faqsService.create(dto, req.user.id);
  }

  /** Admin: Cập nhật FAQ */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.faqsService.update(id, dto, req.user.id);
  }

  /** Admin: Xoá FAQ */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.faqsService.remove(id, req.user.id);
  }
}

