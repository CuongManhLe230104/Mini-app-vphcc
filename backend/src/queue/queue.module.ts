import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { RateLimitGuard } from './rate-limit.guard';
import { CitizenGuard } from './citizen.guard';

@Module({
  imports: [AuthModule],
  controllers: [QueueController],
  providers: [QueueService, RateLimitGuard, CitizenGuard],
  exports: [QueueService],
})
export class QueueModule {}


