import { PostVersionDto } from './dto/post-version.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Controller, Get, Post, Delete, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { QueryPostsDto } from './dto/query-posts.dto';
import { RejectPostDto } from './dto/reject-post.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminRole } from '@prisma/client';

@Controller('posts')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  /** Lấy danh sách bài viết đã xuất bản (công khai) */
  @Get()
  async findPublished(@Query() query: QueryPostsDto) {
    return this.contentService.findPublished(query);
  }

  /** Lấy chi tiết bài viết đã xuất bản (công khai) */
  @Get(':id')
  async findPublishedOne(@Param('id') id: string) {
    return this.contentService.findPublishedOne(id);
  }

  /** Admin: Xem danh sách bài viết */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER, AdminRole.EDITOR)
  async findAllAdmin(@Query() query: QueryPostsDto) {
    return this.contentService.findAllAdmin(query);
  }

  /** Admin: Tạo nháp bài viết */
  @Post('admin/draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.EDITOR)
  async createDraft(@Body() dto: CreatePostDto, @CurrentUser() user: any) {
    return this.contentService.createDraft(dto, user.id);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.EDITOR)
  update(@Param('id') id: string, @Body() dto: UpdatePostDto, @CurrentUser() user: any) {
    return this.contentService.updatePost(id, dto, user.id, user.role);
  }

  /** Admin: Gửi duyệt */
  @Post('admin/:id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.EDITOR)
  async submitForReview(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: PostVersionDto) {
    return this.contentService.submitForReview(id, user.id, user.role, dto.version);
  }

  /** Admin: Xuất bản bài viết */
  @Post('admin/:id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  async publish(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: PostVersionDto) {
    return this.contentService.publishPost(id, user.id, dto.version);
  }

  /** Xóa mềm: chỉ quản trị viên/người duyệt được gỡ bài. */
  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contentService.archivePost(id, user.id);
  }

  /** Admin: Từ chối bài viết */
  @Post('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.REVIEWER)
  async reject(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: RejectPostDto) {
    return this.contentService.rejectPost(id, user.id, dto.note, dto.version);
  }
}

