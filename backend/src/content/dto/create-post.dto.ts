import { IsUrl, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsArray } from 'class-validator';
import { PostType } from '@prisma/client';

export class CreatePostDto {
  @IsEnum(PostType, { message: 'Loại bài viết phải là NEWS, GUIDE hoặc VIDEO' })
  type: PostType;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  @IsString()
  content: string;

  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsUrl({ protocols: ['https'], require_protocol: true })
  thumbnail?: string;

  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsUrl({ protocols: ['https'], require_protocol: true })
  videoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isHighlighted?: boolean;
}

