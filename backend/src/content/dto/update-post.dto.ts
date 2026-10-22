import { PartialType } from '@nestjs/mapped-types';
import { IsInt, Min } from 'class-validator';
import { CreatePostDto } from './create-post.dto';
export class UpdatePostDto extends PartialType(CreatePostDto, { skipNullProperties: false }) {
  @IsInt() @Min(0) version: number;
}
