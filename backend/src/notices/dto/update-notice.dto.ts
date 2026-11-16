import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateNoticeDto } from './create-notice.dto';

export class UpdateNoticeDto extends PartialType(CreateNoticeDto, {
  skipNullProperties: false,
}) {
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}
