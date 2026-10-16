import { ConfigService } from '@nestjs/config';

export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.length < 32 || /dev-secret|replace-with|thay-bang/i.test(secret)) {
    throw new Error('JWT_SECRET phải là chuỗi ngẫu nhiên riêng, tối thiểu 32 ký tự trong backend/.env');
  }
  return secret;
}
