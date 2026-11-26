import { NestFactory } from '@nestjs/core';
import { createValidationPipe } from './common/validation.pipe';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Validation pipe toàn cục
  app.useGlobalPipes(createValidationPipe());

  // Tắt ETag để tránh lỗi 304 Not Modified làm rỗng dữ liệu hoặc lỗi cache CORS trên WebView điện thoại
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('etag', false);

  // Chỉ tin tưởng header X-Forwarded-For từ reverse proxy khi TRUST_PROXY được cấu hình tường minh trên VPS
  const trustProxy = config.get<string>('TRUST_PROXY', '').trim();
  if (trustProxy) {
    if (trustProxy === 'true' || trustProxy === '1') {
      expressApp.set('trust proxy', 1);
    } else if (/^\d+$/.test(trustProxy)) {
      expressApp.set('trust proxy', Number(trustProxy));
    } else {
      expressApp.set(
        'trust proxy',
        trustProxy.split(',').map(s => s.trim()).filter(Boolean),
      );
    }
  }

  expressApp.use((req: any, res: any, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.on('finish', () => {
      // Không ghi query string hay request body của các luồng nhạy cảm vào log truy cập
      const safePath = String(req.originalUrl || req.url || '').split('?')[0];
      console.log(
        `[API] ${req.method} ${safePath} -> ${res.statusCode} (Origin: ${req.headers.origin || 'none'})`,
      );
    });
    next();
  });

  // Cho phép mọi Origin từ Zalo WebView (zdn.vn, zadn.vn, zalo.me, zaloplatforms.com, null, localhost...)
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'ngrok-skip-browser-warning', 'Idempotency-Key'],
  });

  // Prefix API
  app.setGlobalPrefix('api/v1');

  app.enableShutdownHooks();
  const port = Number(config.get<string>('PORT', '3001'));
  await app.listen(port);
  console.log(`🚀 Backend đang chạy tại http://localhost:${port}/api/v1`);
}

bootstrap();

