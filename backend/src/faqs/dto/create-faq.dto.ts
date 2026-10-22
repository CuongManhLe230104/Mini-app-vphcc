import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateFaqDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty({ message: 'Câu hỏi không được để trống' })
  @IsString()
  question: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty({ message: 'Câu trả lời không được để trống' })
  @IsString()
  answer: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

