import { Transform, Type } from 'class-transformer';
import {
  IsUrl,
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import {
  NoticeType,
  NoticePublicationStatus,
  NoticeLegalStatus,
  ProcedureImpactType,
} from '@prisma/client';

/** Tài liệu đính kèm khi tạo niêm yết */
export class CreateNoticeDocumentDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  name: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  fileUrl: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

/** Liên kết thủ tục hành chính với niêm yết */
export class NoticeProcedureLinkInputDto {
  @IsString()
  @IsNotEmpty()
  procedureId: string;

  @IsOptional()
  @IsEnum(ProcedureImpactType)
  impactType?: ProcedureImpactType;

  @IsOptional()
  @IsString()
  receivingAuthority?: string;

  @IsOptional()
  @IsString()
  resolvingAuthority?: string;

  @IsOptional()
  @IsBoolean()
  acceptsAtCenter?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

/** Tạo niêm yết công khai */
export class CreateNoticeDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  title: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  summary?: string;

  /** Ngày bắt đầu niêm yết (ISO 8601, tuỳ chọn đối với niêm yết văn bản dài hạn) */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Ngày kết thúc niêm yết (ISO 8601, tuỳ chọn đối với niêm yết văn bản dài hạn) */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  noticeNumber?: string;

  @IsOptional()
  @IsDateString()
  noticeDate?: string;

  @IsOptional()
  @IsString()
  publishingUnit?: string;

  @IsOptional()
  @IsEnum(NoticeType)
  noticeType?: NoticeType;

  @IsOptional()
  @IsEnum(NoticePublicationStatus)
  publicationStatus?: NoticePublicationStatus;

  @IsOptional()
  @IsString()
  legalDocumentNumber?: string;

  @IsOptional()
  @IsDateString()
  legalDocumentDate?: string;

  @IsOptional()
  @IsString()
  citedDateText?: string;

  @IsOptional()
  @IsString()
  issuingAuthority?: string;

  @IsOptional()
  @IsString()
  managingAuthority?: string;

  @IsOptional()
  @IsEnum(NoticeLegalStatus)
  legalStatus?: NoticeLegalStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fieldTags?: string[];

  @IsOptional()
  @IsString()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  sourcePortalUrl?: string;

  @IsOptional()
  @IsBoolean()
  needsVerification?: boolean;

  @IsOptional()
  @IsString()
  verificationNote?: string;

  /** Danh sách tài liệu đính kèm (tuỳ chọn) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNoticeDocumentDto)
  documents?: CreateNoticeDocumentDto[];

  /** Danh sách liên kết thủ tục hành chính (tuỳ chọn) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoticeProcedureLinkInputDto)
  procedureLinks?: NoticeProcedureLinkInputDto[];
}
