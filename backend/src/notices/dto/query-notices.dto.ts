import { IsOptional, IsInt, Min, Max, IsBoolean, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

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
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  includeArchived?: boolean = false;

  /** Tìm kiếm theo tiêu đề */
  @IsOptional()
  @IsString()
  search?: string;
}
