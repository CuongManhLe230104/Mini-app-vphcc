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

  /** Chi tiết thủ tục (công khai) */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.proceduresService.findOne(id);
  }

  /** Tạo thủ tục mới (Admin EDITOR+) */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.EDITOR)
  async create(@Body() dto: CreateProcedureDto) {
    return this.proceduresService.create(dto);
  }

  /** Cập nhật thủ tục (Admin EDITOR+) */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.EDITOR)
  async update(@Param('id') id: string, @Body() dto: UpdateProcedureDto) {
    return this.proceduresService.update(id, dto);
  }

  /** Xoá thủ tục (Admin SUPER_ADMIN) */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  async remove(@Param('id') id: string) {
    return this.proceduresService.remove(id);
  }
}

