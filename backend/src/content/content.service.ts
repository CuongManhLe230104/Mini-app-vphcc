import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import { PostStatus, Prisma } from '@prisma/client';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  /** Lấy danh sách bài viết công khai (chỉ PUBLISHED) */
  async findPublished(query: QueryPostsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PostWhereInput = { status: PostStatus.PUBLISHED };

    if (query.type) {
      where.type = query.type;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { summary: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isHighlighted: 'desc' }, { publishedAt: 'desc' }],
        select: {
          id: true,
          type: true,
          title: true,
          summary: true,
          thumbnail: true,
          tags: true,
          isHighlighted: true,
          publishedAt: true,
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Lấy chi tiết bài viết công khai */
  async findPublishedOne(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, status: PostStatus.PUBLISHED },
      select: { id: true, type: true, title: true, summary: true, content: true, thumbnail: true, videoUrl: true, tags: true, isHighlighted: true, publishedAt: true, updatedAt: true },
    });
    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết hoặc bài viết chưa được công khai');
    }
    return post;
  }

  /** Admin: Danh sách bài viết đầy đủ trạng thái */
  async findAllAdmin(query: QueryPostsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PostWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { summary: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, fullName: true, username: true } },
          reviewer: { select: { id: true, fullName: true, username: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Admin: Tạo nháp bài viết */
  async createDraft(dto: CreatePostDto, authorId: string) {
    return this.prisma.post.create({
      data: {
        ...dto,
        tags: dto.tags ?? [],
        status: PostStatus.DRAFT,
        authorId,
      },
    });
  }

  /** Admin: Gửi duyệt */
  async submitForReview(id: string, authorId: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    if (post.authorId !== authorId) throw new ForbiddenException('Chỉ tác giả mới được gửi duyệt');
    if (post.status !== PostStatus.DRAFT && post.status !== PostStatus.REJECTED) {
      throw new BadRequestException('Chỉ bài viết ở trạng thái Nháp hoặc Từ chối mới được gửi duyệt');
    }

    return this.prisma.post.update({
      where: { id },
      data: { status: PostStatus.PENDING, rejectionNote: null, reviewerId: null },
    });
  }

  /** Admin: Duyệt bài viết (PUBLISH) */
  async publishPost(id: string, reviewerId: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    if (post.status !== PostStatus.PENDING) {
      throw new BadRequestException('Chỉ bài viết đang Chờ duyệt mới được công khai');
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.PUBLISHED,
        reviewerId,
        publishedAt: new Date(),
        rejectionNote: null,
      },
    });
  }

  /** Admin: Từ chối bài viết */
  async rejectPost(id: string, reviewerId: string, note?: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    if (post.status !== PostStatus.PENDING) {
      throw new BadRequestException('Chỉ bài viết đang Chờ duyệt mới được từ chối');
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.REJECTED,
        reviewerId,
        rejectionNote: note,
      },
    });
  }
}

