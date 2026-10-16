import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateCenterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  hotline?: string;

  @IsOptional()
  @IsString()
  oaId?: string;

  @IsOptional()
  @IsString()
  servicePortalUrl?: string;

  @IsOptional()
  @IsString()
  caseTrackingUrl?: string;

  @IsOptional()
  workingHours?: any;

  @IsOptional()
  bannerImages?: any;
}

