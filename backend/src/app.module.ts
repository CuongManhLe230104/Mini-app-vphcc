import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CenterModule } from './center/center.module';
import { ProceduresModule } from './procedures/procedures.module';
import { ContentModule } from './content/content.module';
import { NoticesModule } from './notices/notices.module';
import { FaqsModule } from './faqs/faqs.module';
import { AuditModule } from './audit/audit.module';

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
})
export class AppModule {}

