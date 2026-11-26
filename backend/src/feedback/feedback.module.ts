import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AdminFeedbackController,
  PublicFeedbackController,
} from './feedback.controller';
import { FeedbackRateLimitGuard } from './feedback-rate-limit.guard';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [AuthModule],
  controllers: [PublicFeedbackController, AdminFeedbackController],
  providers: [FeedbackService, FeedbackRateLimitGuard],
  exports: [FeedbackService],
})
export class FeedbackModule {}
