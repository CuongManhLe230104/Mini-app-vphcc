import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CenterModule } from './center/center.module';
import { ProceduresModule } from './procedures/procedures.module';
import { ContentModule } from './content/content.module';
import { NoticesModule } from './notices/notices.module';
import { FaqsModule } from './faqs/faqs.module';
import { AuditModule } from './audit/audit.module';

@Controller()
class AppController {
  @Get()
  getStatus() {
    return {
      status: 'ok',
      service: 'Backend API — Trung tâm Phục vụ hành chính công xã Nghĩa Thành',
      endpoints: [
        '/api/v1/center',
        '/api/v1/procedures',
        '/api/v1/procedures/fields',
        '/api/v1/posts',
        '/api/v1/notices',
        '/api/v1/faqs',
      ],
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CenterModule,
    ProceduresModule,
    ContentModule,
    NoticesModule,
    FaqsModule,
    AuditModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

