import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateFaqDto {
  @IsNotEmpty({ message: 'Câu hỏi không được để trống' })
  @IsString()
  question: string;

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

