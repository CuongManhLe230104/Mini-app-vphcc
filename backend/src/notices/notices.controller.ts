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

  /** Chi tiết niêm yết kèm tài liệu */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.noticesService.findOne(id);
  }

  // ───────── ADMIN ─────────

  /** Tạo niêm yết — yêu cầu EDITOR trở lên */
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.REVIEWER, AdminRole.SUPER_ADMIN)
  create(@Body() dto: CreateNoticeDto) {
    return this.noticesService.create(dto);
  }

  /** Cập nhật niêm yết — admin */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.REVIEWER, AdminRole.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoticeDto,
  ) {
    return this.noticesService.update(id, dto);
  }

  /** Thêm tài liệu vào niêm yết */
  @Post(':id/documents')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.REVIEWER, AdminRole.SUPER_ADMIN)
  addDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNoticeDocumentDto,
  ) {
    return this.noticesService.addDocument(id, dto);
  }

  /** Xoá tài liệu khỏi niêm yết */
  @Delete(':id/documents/:docId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.REVIEWER, AdminRole.SUPER_ADMIN)
  removeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.noticesService.removeDocument(id, docId);
  }
}
