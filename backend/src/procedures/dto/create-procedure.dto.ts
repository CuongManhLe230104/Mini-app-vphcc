import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsBoolean, IsInt, IsDate } from 'class-validator';

export class CreateProcedureDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsNotEmpty({ message: 'Tên thủ tục không được để trống' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Lĩnh vực không được để trống' })
  @IsString()
  fieldId: string;

  @IsNotEmpty({ message: 'Cơ quan thực hiện không được để trống' })
  @IsString()
  authority: string;

  @IsNotEmpty({ message: 'Thời hạn giải quyết không được để trống' })
  @IsString()
  deadline: string;

  @IsNotEmpty({ message: 'Lệ phí không được để trống' })
  @IsString()
  fee: string;

  @IsArray()
  @IsString({ each: true })
  components: string[];

  @IsNotEmpty({ message: 'Cách thức nộp không được để trống' })
  @IsString()
  submission: string;

  @IsOptional()
  @IsString()
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

