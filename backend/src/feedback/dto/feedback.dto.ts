import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FEEDBACK_LIMITS } from '../feedback-rules';

export class CreateCitizenFeedbackDto {
  @IsString({ message: 'Vui lòng nhập họ và tên.' })
  fullName!: string;

  @IsString({ message: 'Vui lòng nhập số điện thoại.' })
  phone!: string;

  @IsOptional()
  @IsIn(['CENTER', 'MINI_APP', 'OTHER'], {
    message: 'Nhóm góp ý không hợp lệ.',
  })
  target?: 'CENTER' | 'MINI_APP' | 'OTHER';

  @IsString({ message: 'Vui lòng nhập nội dung góp ý.' })
  content!: string;
}

export class QueryAdminFeedbackDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Giới hạn bản ghi phải là số nguyên.' })
  @Min(1)
  @Max(FEEDBACK_LIMITS.MAX_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày bắt đầu phải có định dạng YYYY-MM-DD.',
  })
  fromDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày kết thúc phải có định dạng YYYY-MM-DD.',
  })
  toDate?: string;
}

export class ExportAdminFeedbackDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày bắt đầu phải có định dạng YYYY-MM-DD.',
  })
  fromDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày kết thúc phải có định dạng YYYY-MM-DD.',
  })
  toDate?: string;
}
