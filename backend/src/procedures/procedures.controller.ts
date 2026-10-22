import { Req } from '@nestjs/common';
import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ProceduresService } from './procedures.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { QueryProceduresDto } from './dto/query-procedures.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';

@Controller('procedures')
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  /** Lấy danh sách lĩnh vực */
  @Get('fields')
  async getFields() {
    return this.proceduresService.getFields();
  }

  /** Danh sách thủ tục (công khai) */
  @Get()
  async findAll(@Query() query: QueryProceduresDto) {
    return this.proceduresService.findAll(query);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER, AdminRole.EDITOR)
  findAdmin(@Query() query: QueryProceduresDto) { return this.proceduresService.findAll(query, true); }

  /** Chi tiết thủ tục (công khai) */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.proceduresService.findOne(id);
  }

  /** Tạo thủ tục mới (Admin EDITOR+) */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  async create(@Req() req: any, @Body() dto: CreateProcedureDto) {
    return this.proceduresService.create(dto, req.user.id);
  }

  /** Cập nhật thủ tục (Admin EDITOR+) */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateProcedureDto) {
    return this.proceduresService.update(id, dto, req.user.id);
  }

  /** Xoá thủ tục (Admin SUPER_ADMIN) */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.proceduresService.remove(id, req.user.id);
  }
}

