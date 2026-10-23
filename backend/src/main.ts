import { NestFactory } from '@nestjs/core';
import { createValidationPipe } from './common/validation.pipe';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Validation pipe toàn cục
  app.useGlobalPipes(createValidationPipe());

  // CORS
  const configuredOrigins = config
    .get<string>('CORS_ORIGIN', 'http://localhost:4000,http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = Array.from(
    new Set([
      ...configuredOrigins,
      'http://localhost:3000',
      'http://localhost:2999',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:2999',
      'http://localhost:4000',
      'https://h5.zdn.vn',
      'https://h5.zadn.vn',
    ]),
  );
  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https:\/\/([a-z0-9-]+\.)?(zdn|zadn|zalo)\.vn$/i.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  // Prefix API
  app.setGlobalPrefix('api/v1');

  app.enableShutdownHooks();
  const port = Number(config.get<string>('PORT', '3001'));
  await app.listen(port);
  console.log(`🚀 Backend đang chạy tại http://localhost:${port}/api/v1`);
}

bootstrap();

