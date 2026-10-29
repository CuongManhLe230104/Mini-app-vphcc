import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { RateLimitGuard } from './rate-limit.guard';
import { CitizenGuard } from './citizen.guard';

@Module({
  controllers: [QueueController],
  providers: [QueueService, RateLimitGuard, CitizenGuard],
  exports: [QueueService],
})
export class QueueModule {}

