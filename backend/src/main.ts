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
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:4000,http://localhost:3000')
      .split(',').map((origin) => origin.trim()).filter(Boolean),
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

