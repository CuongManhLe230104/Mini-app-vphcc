import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CitizenGuard } from './citizen.guard';
import { RateLimit, RateLimitGuard } from './rate-limit.guard';
import {
  AvailabilityQueryDto,
  BoardQueryDto,
  CreateAppointmentDto,
  CreateClosureDto,
  CreateCounterDto,
  EventsQueryDto,
  IssueTicketDto,
  ReasonDto,
  RescheduleAppointmentDto,
  SetSchedulesDto,
  SetStaffDto,
  TransferTicketDto,
  UpdateCounterDto,
  WalkInTicketDto,
} from './queue.dto';
import { QueueService } from './queue.service';

@Controller('queue')
@UseGuards(RateLimitGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  // ───────── CÔNG KHAI ─────────

  @Get('catalog')
  getCatalog() {
    return this.queueService.getPublicCatalog();
  }

  @Get('availability')
  getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.queueService.getAvailability(query);
  }

  @Get('lookup/:code')
  @RateLimit({ limit: 20, windowMs: 60000 })
  lookup(@Param('code') code: string) {
    return this.queueService.lookupByCode(code);
  }

  // ───────── NGƯỜI DÂN (XÁC THỰC ZALO) ─────────

  @Get('mine')
  @UseGuards(JwtAuthGuard, CitizenGuard)
  getMine(@CurrentUser() user: any) {
    return this.queueService.getMyItems(user.id);
  }

  @Post('tickets')
  @UseGuards(JwtAuthGuard, CitizenGuard)
  @RateLimit({ limit: 10, windowMs: 60000, by: 'user' })
  issueTicket(
    @CurrentUser() user: any,
    @Body() dto: IssueTicketDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.queueService.issueOnlineTicket(user.id, dto, idempotencyKey);
  }

  @Post('tickets/:id/cancel')
  @UseGuards(JwtAuthGuard, CitizenGuard)
  cancelTicket(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.queueService.cancelCitizenTicket(user.id, id, dto.reason);
  }

  @Post('appointments')
  @UseGuards(JwtAuthGuard, CitizenGuard)
  @RateLimit({ limit: 10, windowMs: 60000, by: 'user' })
  createAppointment(
    @CurrentUser() user: any,
    @Body() dto: CreateAppointmentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.queueService.createAppointment(user.id, dto, idempotencyKey);
  }

  @Post('appointments/:id/cancel')
  @UseGuards(JwtAuthGuard, CitizenGuard)
  cancelAppointment(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.queueService.cancelCitizenAppointment(user.id, id, dto.reason);
  }

  @Post('appointments/:id/reschedule')
  @UseGuards(JwtAuthGuard, CitizenGuard)
  @RateLimit({ limit: 10, windowMs: 60000, by: 'user' })
  rescheduleAppointment(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.queueService.rescheduleCitizenAppointment(user.id, id, dto, idempotencyKey);
  }

  // ───────── CÁN BỘ VẬN HÀNH QUẦY ─────────

  @Get('admin/counters')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  getAdminCounters(@CurrentUser() user: any) {
    return this.queueService.getAdminCounters(user);
  }

  @Get('admin/counters/:id/board')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  getBoard(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: BoardQueryDto,
  ) {
    return this.queueService.getCounterBoard(user, id, query);
  }

  @Get('admin/counters/:id/events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  getEvents(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: EventsQueryDto,
  ) {
    return this.queueService.getCounterEvents(user, id, query);
  }

  @Get('admin/lookup/:code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  lookupAdmin(@CurrentUser() user: any, @Param('code') code: string) {
    return this.queueService.lookupAdminByCode(user, code);
  }

  @Post('admin/counters/:id/walk-in')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  issueWalkIn(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WalkInTicketDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.queueService.issueWalkInTicket(user, id, dto, idempotencyKey);
  }

  @Post('admin/counters/:id/call-next')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  callNext(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.callNextTicket(user, id);
  }

  @Post('admin/tickets/:id/recall')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  recall(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.recallTicket(user, id);
  }

  @Post('admin/tickets/:id/serve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  serve(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.startServingTicket(user, id);
  }

  @Post('admin/tickets/:id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  complete(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.completeTicket(user, id);
  }

  @Post('admin/tickets/:id/no-show')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  noShowTicket(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.queueService.markNoShowTicket(user, id, dto.reason);
  }

  @Post('admin/tickets/:id/transfer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  transfer(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferTicketDto,
  ) {
    return this.queueService.transferTicket(user, id, dto);
  }

  @Post('admin/appointments/:id/check-in')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  checkIn(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.checkInAppointment(user, id);
  }

  @Post('admin/appointments/:id/no-show')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  noShowAppointment(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.queueService.markNoShowAppointment(user, id, dto.reason);
  }

  @Post('admin/appointments/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF)
  cancelAdminAppointment(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.queueService.cancelAdminAppointment(user, id, dto.reason);
  }

  // ───────── CẤU HÌNH QUẦY (SUPER_ADMIN) ─────────

  @Get('admin/staff-candidates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  getStaffCandidates() {
    return this.queueService.getStaffCandidates();
  }

  @Post('admin/counters')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  createCounter(@CurrentUser() user: any, @Body() dto: CreateCounterDto) {
    return this.queueService.createCounter(user.id, dto);
  }

  @Patch('admin/counters/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  updateCounter(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCounterDto,
  ) {
    return this.queueService.updateCounter(user.id, id, dto);
  }

  @Put('admin/counters/:id/schedules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  setSchedules(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSchedulesDto,
  ) {
    return this.queueService.setSchedules(user.id, id, dto);
  }

  @Post('admin/counters/:id/closures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  addClosure(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClosureDto,
  ) {
    return this.queueService.addClosure(user.id, id, dto);
  }

  @Delete('admin/counters/:id/closures/:closureId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  removeClosure(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closureId', ParseUUIDPipe) closureId: string,
  ) {
    return this.queueService.removeClosure(user.id, id, closureId);
  }

  @Put('admin/counters/:id/staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  setStaff(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStaffDto,
  ) {
    return this.queueService.setStaff(user.id, id, dto);
  }
}

