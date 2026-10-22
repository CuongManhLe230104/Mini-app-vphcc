import { IsInt, Min } from 'class-validator';
export class PostVersionDto {
  @IsInt() @Min(0) version: number;
}
