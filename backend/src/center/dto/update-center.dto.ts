import { Type, Transform } from 'class-transformer';
import { IsString, IsArray, IsNotEmpty, ValidateNested, ValidateIf, IsUrl, Matches, MaxLength } from 'class-validator';
class WorkingHourDto {
  @IsString() @IsNotEmpty() day: string;
  @IsString() @IsNotEmpty() hours: string;
}
class BannerDto {
  @IsUrl({ protocols: ['https'], require_protocol: true }) url: string;
  @IsString() alt: string;
}
export class UpdateCenterDto {
  @ValidateIf((_, v) => v !== undefined) @IsString() @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) name?: string;
  @ValidateIf((_, v) => v !== undefined) @IsString() @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) fullName?: string;
  @ValidateIf((_, v) => v !== undefined) @IsString() @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) address?: string;
  @ValidateIf((_, v) => v !== undefined) @IsString() @Matches(/^\+?[0-9 () .-]{8,30}$/) hotline?: string;
  @ValidateIf((_, v) => v !== undefined) @IsString() @Matches(/^(?:[0-9]+)?$/) @MaxLength(191) oaId?: string;
  @ValidateIf((_, v) => v !== undefined && v !== '')
  @IsUrl({ protocols: ['https'], require_protocol: true }) servicePortalUrl?: string;
  @ValidateIf((_, v) => v !== undefined && v !== '')
  @IsUrl({ protocols: ['https'], require_protocol: true }) caseTrackingUrl?: string;
  @ValidateIf((_, v) => v !== undefined) @IsArray() @ValidateNested({ each: true }) @Type(() => WorkingHourDto)
  workingHours?: WorkingHourDto[];
  @ValidateIf((_, v) => v !== undefined) @IsArray() @ValidateNested({ each: true }) @Type(() => BannerDto)
  bannerImages?: BannerDto[];
}
