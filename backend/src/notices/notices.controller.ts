import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NoticesService } from './notices.service';
import {
  CreateNoticeDto,
  CreateNoticeDocumentDto,
  NoticeProcedureLinkInputDto,
} from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import {
  QueryNoticesDto,
  QuerySourceDocumentsDto,
} from './dto/query-notices.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  AdminRole,
  NoticeLegalStatus,
  SourceQualityStatus,
} from '@prisma/client';

@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  // ───────── PUBLIC ─────────

  /** Danh sách niêm yết công khai — có phân trang và bộ lọc */
  @Get()
  findAll(@Query() query: QueryNoticesDto) {
    return this.noticesService.findAll(query);
  }

  /** Danh mục bộ lọc (lĩnh vực, cơ quan quản lý, năm, nhóm niêm yết) */
  @Get('filters/metadata')
  getFilterMetadata() {
    return this.noticesService.getFilterMetadata();
  }

  // ───────── ADMIN (Đặt trước route :id) ─────────

  @Get('admin/all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER, AdminRole.EDITOR)
  findAdmin(@Query() query: QueryNoticesDto) {
    return this.noticesService.findAll(query, true);
  }

  /** Danh sách 53 nguồn kiểm kê từ Google Drive kèm cờ chất lượng */
  @Get('admin/sources')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER, AdminRole.EDITOR)
  listSources(@Query() query: QuerySourceDocumentsDto) {
    return this.noticesService.listSourceDocuments(query);
  }

  /** Nhập kho kiểm kê 53 nguồn vào DB và khởi tạo bản nháp (Idempotent) */
  @Post('admin/import-inventory')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  importInventory(
    @Req() req: any,
    @Body() body: { publishRecommendedSamples?: boolean },
  ) {
    return this.noticesService.importInventorySources(req.user.id, {
      publishRecommendedSamples: Boolean(body?.publishRecommendedSamples),
    });
  }

  /** Cập nhật trạng thái đối chiếu nguồn (xử lý xung đột 4811/5116, trùng 42/43, ngày ban hành) */
  @Patch('admin/sources/:sourceId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  updateSourceQuality(
    @Req() req: any,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @Body()
    body: {
      qualityStatus?: SourceQualityStatus;
      qualityNote?: string;
      publicAccessOk?: boolean;
      needsDateVerification?: boolean;
      resolvedLegalDocumentNumber?: string;
      resolvedLegalDocumentDate?: string;
    },
  ) {
    return this.noticesService.updateSourceQuality(
      sourceId,
      body,
      req.user.id,
    );
  }

  /** Gửi duyệt niêm yết (DRAFT -> PENDING) */
  @Post('admin/:id/submit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER, AdminRole.EDITOR)
  submitNotice(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.noticesService.submitNotice(id, req.user.id);
  }

  /** Duyệt và đăng công khai niêm yết */
  @Post('admin/:id/publish')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  publishNotice(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      legalStatus?: NoticeLegalStatus;
      verificationNote?: string;
    },
  ) {
    return this.noticesService.publishNotice(
      id,
      req.user.id,
      req.user.role,
      body,
    );
  }

  /** Thu hồi / ẩn niêm yết khỏi công khai */
  @Post('admin/:id/revoke')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  revokeNotice(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    return this.noticesService.revokeNotice(id, req.user.id, body?.reason);
  }

  /** Gắn danh sách Thủ tục hành chính liên quan đến niêm yết (Mốc NY3) */
  @Put('admin/:id/procedures')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  setProcedureLinks(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { links: NoticeProcedureLinkInputDto[] },
  ) {
    return this.noticesService.setProcedureLinks(
      id,
      Array.isArray(body?.links) ? body.links : [],
      req.user.id,
    );
  }

  /** Chi tiết niêm yết kèm tài liệu */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.noticesService.findOne(id);
  }

  /** Tạo niêm yết — yêu cầu REVIEWER / SUPER_ADMIN */
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
