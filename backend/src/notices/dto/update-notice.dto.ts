import { IsString, IsOptional, IsDateString } from 'class-validator';

/** Cập nhật niêm yết công khai — tất cả trường tuỳ chọn */
export class UpdateNoticeDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
