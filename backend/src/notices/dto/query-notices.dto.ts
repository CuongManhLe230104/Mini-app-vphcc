import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsString,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  NoticeType,
  NoticePublicationStatus,
  NoticeLegalStatus,
  SourceQualityStatus,
} from '@prisma/client';

/** Tham số truy vấn danh sách niêm yết */
export class QueryNoticesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** Nếu true, bao gồm cả niêm yết đã hết hạn */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeArchived?: boolean = false;

  /** Tìm kiếm theo số quyết định, tiêu đề hoặc từ khóa */
  @IsOptional()
  @IsString()
  search?: string;

  /** Lọc theo nhóm niêm yết */
  @IsOptional()
  @IsEnum(NoticeType)
  noticeType?: NoticeType;

  /** Lọc theo lĩnh vực (tag) */
  @IsOptional()
  @IsString()
  fieldTag?: string;

  /** Lọc theo cơ quan quản lý lĩnh vực */
  @IsOptional()
  @IsString()
  managingAuthority?: string;

  /** Lọc theo năm ban hành quyết định */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  /** Lọc theo trạng thái xuất bản (chỉ dùng cho Admin) */
  @IsOptional()
  @IsEnum(NoticePublicationStatus)
  publicationStatus?: NoticePublicationStatus;

  /** Lọc theo trạng thái hiệu lực pháp lý (chỉ dùng cho Admin) */
  @IsOptional()
  @IsEnum(NoticeLegalStatus)
  legalStatus?: NoticeLegalStatus;
}

/** Tham số truy vấn danh sách 53 nguồn kiểm kê (Admin) */
export class QuerySourceDocumentsDto {
  @IsOptional()
  @IsEnum(SourceQualityStatus)
  qualityStatus?: SourceQualityStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
