import { PostVersionDto } from './post-version.dto';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectPostDto extends PostVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
