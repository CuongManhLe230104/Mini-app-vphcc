import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateCitizenFeedbackDto,
  ExportAdminFeedbackDto,
  QueryAdminFeedbackDto,
} from './dto/feedback.dto';
import { FeedbackRateLimitGuard } from './feedback-rate-limit.guard';
import { AdminActor, FeedbackService } from './feedback.service';

@Controller('feedback')
export class PublicFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(FeedbackRateLimitGuard)
  submitFeedback(
    @Body() dto: CreateCitizenFeedbackDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.feedbackService.submitPublicFeedback(dto, idempotencyKey);
  }
}

@Controller('admin/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.HANDLER,
    AdminRole.EDITOR,
    AdminRole.REVIEWER,
    AdminRole.COUNTER_STAFF,
  )
  listFeedback(
    @Query() query: QueryAdminFeedbackDto,
    @CurrentUser() user: AdminActor,
  ) {
    return this.feedbackService.listAdminFeedback(query, user);
  }

  @Get('export')
  @Roles(AdminRole.SUPER_ADMIN)
  async exportFeedbackExcel(
    @Query() query: ExportAdminFeedbackDto,
    @CurrentUser() user: AdminActor,
    @Res() res: Response,
  ) {
    const { fileName, buffer } = await this.feedbackService.exportAdminFeedbackExcel(
      query,
      user,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  @Get(':id')
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.HANDLER,
    AdminRole.EDITOR,
    AdminRole.REVIEWER,
    AdminRole.COUNTER_STAFF,
  )
  getFeedbackDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AdminActor,
  ) {
    return this.feedbackService.getAdminFeedbackDetail(id, user);
  }
}
