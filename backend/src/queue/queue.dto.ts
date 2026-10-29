import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^(\+84|84|0)\d{8,10}$/;
const DATE_MSG = 'Ngày phải có dạng YYYY-MM-DD';
const TIME_MSG = 'Giờ phải có dạng HH:mm';

// ───────── Người dân ─────────

export class IssueTicketDto {
  @IsUUID() fieldId!: string;
  @IsOptional() @IsUUID() procedureId?: string;
}

export class AvailabilityQueryDto {
  @IsUUID() fieldId!: string;
  @IsOptional() @Matches(DATE, { message: DATE_MSG }) from?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) days?: number;
}

export class CreateAppointmentDto {
  @IsUUID() fieldId!: string;
  @IsOptional() @IsUUID() procedureId?: string;
  @Matches(DATE, { message: DATE_MSG }) date!: string;
  @Matches(TIME, { message: TIME_MSG }) slot!: string;
  @IsString() @Length(2, 100) contactName!: string;
  @IsOptional() @Matches(PHONE, { message: 'Số điện thoại không hợp lệ' }) contactPhone?: string;
}

export class RescheduleAppointmentDto {
  @Matches(DATE, { message: DATE_MSG }) date!: string;
  @Matches(TIME, { message: TIME_MSG }) slot!: string;
}

export class ReasonDto {
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

// ───────── Cán bộ vận hành ─────────

export class BoardQueryDto {
  @IsOptional() @Matches(DATE, { message: DATE_MSG }) date?: string;
}

export class EventsQueryDto {
  @IsOptional() @Matches(DATE, { message: DATE_MSG }) date?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class WalkInTicketDto {
  @IsOptional() @IsUUID() fieldId?: string;
  @IsOptional() @IsUUID() procedureId?: string;
}

export class TransferTicketDto {
  @IsUUID() toCounterId!: string;
  @IsString() @Length(1, 200) reason!: string;
}

// ───────── Cấu hình (SUPER_ADMIN) ─────────

export class CreateCounterDto {
  @Matches(/^[A-Z0-9]{1,6}$/, { message: 'Mã quầy gồm 1–6 ký tự A–Z hoặc 0–9' }) code!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

/** Số có thể đặt null để bỏ cấu hình (chưa duyệt): IsOptional bỏ qua cả null lẫn undefined. */
function Opt(max: number): PropertyDecorator {
  return (target, key) => { IsOptional()(target, key); IsInt()(target, key); Min(0)(target, key); Max(max)(target, key); };
}

export class UpdateCounterDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() ticketEnabled?: boolean;
  @IsOptional() @IsBoolean() appointmentEnabled?: boolean;
  @Opt(100000) dailyCapacity?: number | null;
  @Opt(100000) ticketQuota?: number | null;
  @Opt(100000) appointmentQuota?: number | null;
  @Opt(100000) walkInQuota?: number | null;
  @Opt(480) slotMinutes?: number | null;
  @Opt(1000) slotCapacity?: number | null;
  @Opt(100000) bookingMinLeadMinutes?: number | null;
  @Opt(365) bookingMaxDaysAhead?: number | null;
  @Opt(100) maxActiveTicketsPerCitizen?: number | null;
  @Opt(100) maxActiveAppointmentsPerCitizen?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) fieldIds?: string[];
}

export class ScheduleWindowDto {
  @IsInt() @Min(0) @Max(6) weekday!: number;
  @Matches(TIME, { message: TIME_MSG }) startTime!: string;
  @Matches(TIME, { message: TIME_MSG }) endTime!: string;
}

export class SetSchedulesDto {
  @IsArray() @ArrayMaxSize(70) @ValidateNested({ each: true }) @Type(() => ScheduleWindowDto) windows!: ScheduleWindowDto[];
}

export class CreateClosureDto {
  @Matches(DATE, { message: DATE_MSG }) date!: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class SetStaffDto {
  @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) adminIds!: string[];
}
