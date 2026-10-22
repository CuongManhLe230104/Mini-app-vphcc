import { UpdatePostDto } from './dto/update-post.dto';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import { AdminRole, PostStatus, Prisma } from '@prisma/client';

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

    const where: Prisma.PostWhereInput = { status: { not: PostStatus.ARCHIVED } };
    if (query.status) {
      where.OR = [{ status: query.status }, { status: PostStatus.PUBLISHED, revisionStatus: query.status }];
      delete where.status;
    }
    if (query.type) where.type = query.type;
    if (query.search) {
      where.AND = [{ OR: [
        { title: { contains: query.search } },
        { summary: { contains: query.search } },
      ] }];
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


  private async change(id: string, actorId: string, action: string, version: number | undefined,
    build: (post: any) => Prisma.PostUncheckedUpdateManyInput) {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({ where: { id } });
      if (!post) throw new NotFoundException('Không tìm thấy bài viết');
      if (version !== undefined && version !== post.version) throw new ConflictException('Bài đã thay đổi. Tải lại danh sách trước khi thao tác.');
      const data = build(post);
      const changed = await tx.post.updateMany({ where: { id, version: post.version }, data: { ...data, version: { increment: 1 } } });
      if (!changed.count) throw new ConflictException('Bài vừa được người khác cập nhật. Vui lòng tải lại.');
      await tx.auditLog.create({ data: { adminId: actorId, action, resource: 'post:' + id,
        detail: { fromStatus: post.status, version: post.version + 1 } } });
      return tx.post.findUnique({ where: { id } });
    });
  }

  private assertAuthor(post: any, actorId: string, role?: AdminRole) {
    const owner = post.revision ? post.revisionAuthorId : post.authorId;
    if (role !== AdminRole.SUPER_ADMIN && owner !== actorId) throw new ForbiddenException('Chỉ người soạn hoặc quản trị viên được sửa/gửi duyệt bài này');
  }

  async createDraft(dto: CreatePostDto, authorId: string) {
    return this.prisma.$transaction(async tx => {
      const post = await tx.post.create({ data: { ...dto, tags: dto.tags ?? [], status: PostStatus.DRAFT, authorId } });
      await tx.auditLog.create({ data: { adminId: authorId, action: 'POST_CREATE', resource: 'post:' + post.id } });
      return post;
    });
  }

  async updatePost(id: string, dto: UpdatePostDto, actorId: string, role: AdminRole) {
    const { version, ...patch } = dto;
    for (const key of ['type', 'title', 'content', 'tags', 'isHighlighted']) {
      if ((patch as any)[key] === null) throw new BadRequestException('Trường ' + key + ' không được null');
    }
    if (!Object.keys(patch).length) throw new BadRequestException('Chưa có nội dung thay đổi');
    return this.change(id, actorId, 'POST_EDIT', version, post => {
      this.assertAuthor(post, actorId, role);
      if (post.status === PostStatus.ARCHIVED || post.status === PostStatus.PENDING || post.revisionStatus === PostStatus.PENDING)
        throw new BadRequestException('Không sửa bài lưu trữ hoặc đang chờ duyệt');
      if (post.status === PostStatus.PUBLISHED) {
        const current = post.revision || Object.fromEntries(['type','title','summary','content','thumbnail','videoUrl','tags','isHighlighted'].map(k => [k, post[k]]));
        return { revision: { ...current, ...patch }, revisionStatus: PostStatus.DRAFT, revisionAuthorId: actorId, rejectionNote: null };
      }
      return { ...patch, status: PostStatus.DRAFT, rejectionNote: null };
    });
  }

  async submitForReview(id: string, actorId: string, role?: AdminRole, version?: number) {
    return this.change(id, actorId, 'POST_SUBMIT', version, post => {
      this.assertAuthor(post, actorId, role);
      const state = post.revision ? post.revisionStatus : post.status;
      if (![PostStatus.DRAFT, PostStatus.REJECTED].includes(state)) throw new BadRequestException('Chỉ bản nháp hoặc bản bị từ chối mới được gửi duyệt');
      return post.revision
        ? { revisionStatus: PostStatus.PENDING, rejectionNote: null }
        : { status: PostStatus.PENDING, rejectionNote: null, reviewerId: null };
    });
  }

  async publishPost(id: string, reviewerId: string, version?: number) {
    return this.change(id, reviewerId, 'POST_PUBLISH', version, post => {
      const state = post.revision ? post.revisionStatus : post.status;
      if (state !== PostStatus.PENDING) throw new BadRequestException('Chỉ nội dung chờ duyệt mới được công khai');
      return { ...(post.revision || {}), status: PostStatus.PUBLISHED, reviewerId,
        publishedAt: post.publishedAt || new Date(), rejectionNote: null,
        revision: Prisma.DbNull, revisionStatus: null, revisionAuthorId: null };
    });
  }

  async rejectPost(id: string, reviewerId: string, note?: string, version?: number) {
    return this.change(id, reviewerId, 'POST_REJECT', version, post => {
      const state = post.revision ? post.revisionStatus : post.status;
      if (state !== PostStatus.PENDING) throw new BadRequestException('Chỉ nội dung chờ duyệt mới được từ chối');
      return post.revision ? { revisionStatus: PostStatus.REJECTED, rejectionNote: note || null }
        : { status: PostStatus.REJECTED, reviewerId, rejectionNote: note || null };
    });
  }

  async archivePost(id: string, adminId: string) {
    const current = await this.prisma.post.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy bài viết');
    if (current.status === PostStatus.ARCHIVED) return { id, status: current.status };
    return this.change(id, adminId, 'POST_ARCHIVE', current.version, () => ({
      status: PostStatus.ARCHIVED, isHighlighted: false,
      revisionStatus: null, revision: Prisma.DbNull, revisionAuthorId: null,
    }));
  }
}
