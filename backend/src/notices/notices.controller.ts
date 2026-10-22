import { Req } from '@nestjs/common';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NoticesService } from './notices.service';
import { CreateNoticeDto, CreateNoticeDocumentDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { QueryNoticesDto } from './dto/query-notices.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';

@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  // ───────── PUBLIC ─────────

  /** Danh sách niêm yết công khai — có phân trang */
  @Get()
  findAll(@Query() query: QueryNoticesDto) {
    return this.noticesService.findAll(query);
  }

  @Get('admin/all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER, AdminRole.EDITOR)
  findAdmin(@Query() query: QueryNoticesDto) { return this.noticesService.findAll(query, true); }

  /** Chi tiết niêm yết kèm tài liệu */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.noticesService.findOne(id);
  }

  // ───────── ADMIN ─────────

  /** Tạo niêm yết — yêu cầu EDITOR trở lên */
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.REVIEWER, AdminRole.SUPER_ADMIN)
  create(@Req() req: any, @Body() dto: CreateNoticeDto) {
    return this.noticesService.create(dto, req.user.id);
  }

  /** Cập nhật niêm yết — admin */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.REVIEWER, AdminRole.SUPER_ADMIN)
  update(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoticeDto,
  ) {
    return this.noticesService.update(id, dto, req.user.id);
  }

  /** Thêm tài liệu vào niêm yết */
  @Post(':id/documents')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.REVIEWER, AdminRole.SUPER_ADMIN)
  addDocument(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNoticeDocumentDto,
  ) {
    return this.noticesService.addDocument(id, dto, req.user.id);
  }

  /** Xoá tài liệu khỏi niêm yết */
  @Delete(':id/documents/:docId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.REVIEWER, AdminRole.SUPER_ADMIN)
  removeDocument(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.noticesService.removeDocument(id, docId, req.user.id);
  }
}
