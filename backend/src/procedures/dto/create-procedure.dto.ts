import { IsUrl, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsBoolean, IsInt, IsDate } from 'class-validator';

export class CreateProcedureDto {
  @IsOptional()
  @IsString()
  code?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty({ message: 'Tên thủ tục không được để trống' })
  @IsString()
  name: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty({ message: 'Lĩnh vực không được để trống' })
  @IsString()
  fieldId: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty({ message: 'Cơ quan thực hiện không được để trống' })
  @IsString()
  authority: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty({ message: 'Thời hạn giải quyết không được để trống' })
  @IsString()
  deadline: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty({ message: 'Lệ phí không được để trống' })
  @IsString()
  fee: string;

  @IsArray()
  @IsString({ each: true })
  components: string[];

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty({ message: 'Cách thức nộp không được để trống' })
  @IsString()
  submission: string;

  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsUrl({ protocols: ['https'], require_protocol: true })
  sourceUrl?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  reviewDate?: Date;

  @IsOptional()
  @IsBoolean()
  isValid?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

