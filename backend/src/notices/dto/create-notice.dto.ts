import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Tài liệu đính kèm khi tạo niêm yết */
export class CreateNoticeDocumentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

/** Tạo niêm yết công khai */
export class CreateNoticeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  /** Ngày bắt đầu niêm yết (ISO 8601) */
  @IsDateString()
  startDate: string;

  /** Ngày kết thúc niêm yết (ISO 8601) */
  @IsDateString()
  endDate: string;

  /** Danh sách tài liệu đính kèm (tuỳ chọn) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNoticeDocumentDto)
  documents?: CreateNoticeDocumentDto[];
}
