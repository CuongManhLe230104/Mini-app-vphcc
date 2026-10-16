import { IsNotEmpty, IsString } from 'class-validator';

/** DTO nhận access token Zalo từ client */
export class ZaloAuthDto {
  @IsString()
  @IsNotEmpty({ message: 'accessToken không được để trống' })
  accessToken: string;
}
