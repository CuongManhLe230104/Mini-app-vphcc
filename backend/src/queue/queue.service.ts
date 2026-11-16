import { ForbiddenException, Injectable } from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { auditedWrite } from '../audit/audited-write';
import {
  ACTIVE_TICKET_STATUSES,
  calculateCounterCapacitySummary,
  CONFIRMED_FOUR_COUNTERS_PRESET,
  CounterConfig,
  displayNumber,
  evaluateReadiness,
  generateLookupCode,
  HELD_APPOINTMENT_STATUSES,
  IDEMPOTENCY_KEY_RE,
  LOOKUP_CODE_RE,
  maskPhone,
  resolveUnifiedTurnStatus,
  scopedIdempotencyKey,
  validateCounterConfig,
} from './queue-rules';
import {
  addDays,
  daysBetween,
  formatDateOnly,
  generateSlots,
  isValidDateString,
  isWithinWindows,
  parseDateOnly,
  timeToMinutes,
  validateScheduleWindows,
  vnMinutesOfDay,
  vnToday,
  weekdayOf,
} from './queue-time';
import { lockCounterDay, nextSequence, TX_OPTIONS, withRetry } from './queue-lock';
import {
  Actor,
  appointmentView,
  badRequest,
  conflict,
  formatSlotRange,
  notFound,
  recordEvent,
  ticketView,
  transitionTicket,
} from './queue-common';
import {
  AvailabilityQueryDto,
  BoardQueryDto,
  CreateAppointmentDto,
  CreateClosureDto,
  CreateCounterDto,
  EventsQueryDto,
  IssueTicketDto,
  RescheduleAppointmentDto,
  SetSchedulesDto,
  SetStaffDto,
  TransferTicketDto,
  UpdateCounterDto,
  WalkInTicketDto,
} from './queue.dto';

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeIdempotencyKey(actorType: 'c' | 'a', actorId: string, raw?: string): string | undefined {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!IDEMPOTENCY_KEY_RE.test(trimmed)) {
      throw badRequest('INVALID_IDEMPOTENCY_KEY', 'Khóa chống gửi trùng (Idempotency-Key) cần từ 8–64 ký tự chữ/số');
    }
    return scopedIdempotencyKey(actorType, actorId, trimmed);
  }

  private async assertCounterAccess(admin: { id: string; role: AdminRole }, counterId: string) {
    if (admin.role === AdminRole.SUPER_ADMIN) return;
    if (admin.role !== AdminRole.COUNTER_STAFF) {
      throw new ForbiddenException('Chỉ cán bộ được phân công quầy hoặc Quản trị viên mới được thao tác');
    }
    const assigned = await this.prisma.counterStaff.findUnique({
      where: { counterId_adminId: { counterId, adminId: admin.id } },
    });
    if (!assigned) {
      throw new ForbiddenException('Bạn chưa được phân công phụ trách quầy này');
    }
  }

  private async aheadCount(tx: Prisma.TransactionClient | PrismaService, counterId: string, serviceDate: Date, sequence: number) {
    return tx.queueTicket.count({
      where: {
        counterId,
        serviceDate,
        status: 'WAITING',
        sequence: { lt: sequence },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // CÔNG KHAI & NGƯỜI DÂN
  // ─────────────────────────────────────────────────────────────

  async getPublicCatalog(now: Date = new Date()) {
    const todayStr = vnToday(now);
    const todayDate = parseDateOnly(todayStr);
    const weekday = weekdayOf(todayStr);
    const minutesNow = vnMinutesOfDay(now);

    const counters = await this.prisma.serviceCounter.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      include: {
        fields: {
          include: {
            field: {
              include: {
                procedures: {
                  where: { isValid: true },
                  orderBy: { sortOrder: 'asc' },
                  select: { id: true, code: true, name: true, deadline: true, fee: true },
                },
              },
            },
          },
        },
        schedules: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
        closures: { where: { date: todayDate } },
      },
    });

    const result = [];
    for (const c of counters) {
      const readiness = evaluateReadiness(c, c.fields.length, c.schedules.length);
      const todayWindows = c.schedules
        .filter(s => s.weekday === weekday)
        .map(s => ({ startTime: s.startTime, endTime: s.endTime }));
      const isClosedToday = c.closures.length > 0 || todayWindows.length === 0;
      const isOpenNow = !isClosedToday && isWithinWindows(todayWindows, minutesNow);

      const [waitingCount, callingTickets, onlineIssuedToday, totalUsedToday] = await Promise.all([
        this.prisma.queueTicket.count({
          where: { counterId: c.id, serviceDate: todayDate, status: 'WAITING' },
        }),
        this.prisma.queueTicket.findMany({
          where: { counterId: c.id, serviceDate: todayDate, status: { in: ['CALLING', 'SERVING'] } },
          orderBy: { sequence: 'asc' },
          select: { displayNumber: true, status: true },
        }),
        this.prisma.queueTicket.count({
          where: { counterId: c.id, serviceDate: todayDate, source: 'ONLINE', status: { not: 'CANCELLED' } },
        }),
        this.countDailyUsed(this.prisma, c.id, todayDate),
      ]);

      const remainingOnlineQuota =
        c.ticketQuota === null
          ? null
          : Math.max(
              0,
              Math.min(
                c.ticketQuota - onlineIssuedToday,
                c.dailyCapacity === null ? Number.MAX_SAFE_INTEGER : c.dailyCapacity - totalUsedToday,
              ),
            );

      result.push({
        id: c.id,
        code: c.code,
        name: c.name,
        description: c.description,
        readiness,
        today: {
          date: todayStr,
          windows: todayWindows,
          isClosedToday,
          closureNote: c.closures[0]?.note ?? null,
          isOpenNow,
          waitingCount,
          currentlyServing: callingTickets,
          remainingOnlineQuota,
        },
        bookingConfig: readiness.appointment.ready
          ? {
              slotMinutes: c.slotMinutes,
              bookingMaxDaysAhead: c.bookingMaxDaysAhead,
              bookingMinLeadMinutes: c.bookingMinLeadMinutes ?? 0,
            }
          : null,
        fields: c.fields.map(cf => ({
          id: cf.field.id,
          slug: cf.field.slug,
          label: cf.field.label,
          procedures: cf.field.procedures,
        })),
      });
    }

    return { serverTime: now.toISOString(), today: todayStr, counters: result };
  }

  private async countDailyUsed(tx: Prisma.TransactionClient | PrismaService, counterId: string, serviceDate: Date): Promise<number> {
    const [nonApptTickets, heldAppointments] = await Promise.all([
      tx.queueTicket.count({
        where: {
          counterId,
          serviceDate,
          source: { not: 'APPOINTMENT' },
          status: { not: 'CANCELLED' },
        },
      }),
      tx.appointment.count({
        where: {
          counterId,
          serviceDate,
          status: { in: HELD_APPOINTMENT_STATUSES },
        },
      }),
    ]);
    return nonApptTickets + heldAppointments;
  }

  async getAvailability(query: AvailabilityQueryDto, now: Date = new Date()) {
    const mapping = await this.prisma.counterField.findUnique({
      where: { fieldId: query.fieldId },
      include: {
        field: { select: { id: true, label: true, slug: true } },
        counter: { include: { schedules: true, closures: true } },
      },
    });
    if (!mapping) throw notFound('Lĩnh vực này chưa được phân công quầy phụ trách');

    const c = mapping.counter;
    const readiness = evaluateReadiness(c, 1, c.schedules.length);
    if (!readiness.appointment.ready) {
      throw conflict('APPOINTMENT_NOT_READY', 'Quầy hiện chưa mở đặt lịch hẹn: ' + readiness.appointment.missing.join('; '));
    }

    const todayStr = vnToday(now);
    const startStr = query.from && daysBetween(todayStr, query.from) >= 0 ? query.from : todayStr;
    const maxDays = c.bookingMaxDaysAhead!;
    const daysCount = Math.min(query.days ?? Math.min(maxDays + 1, 14), 31);
    const minLead = c.bookingMinLeadMinutes ?? 0;
    const minutesNow = vnMinutesOfDay(now);

    const closureMap = new Map<string, string | null>();
    for (const cl of c.closures) closureMap.set(formatDateOnly(cl.date), cl.note ?? null);

    const days = [];
    for (let i = 0; i < daysCount; i++) {
      const dateStr = addDays(startStr, i);
      const diff = daysBetween(todayStr, dateStr);
      if (diff < 0 || diff > maxDays) continue;

      const dateObj = parseDateOnly(dateStr);
      const weekday = weekdayOf(dateStr);
      const windows = c.schedules
        .filter(s => s.weekday === weekday)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map(s => ({ startTime: s.startTime, endTime: s.endTime }));

      if (closureMap.has(dateStr) || windows.length === 0) {
        days.push({
          date: dateStr,
          weekday,
          closed: true,
          closureNote: closureMap.get(dateStr) ?? 'Ngày nghỉ theo lịch làm việc',
          slots: [],
        });
        continue;
      }

      const [heldCount, dailyUsed, bookedBySlot] = await Promise.all([
        this.prisma.appointment.count({
          where: { counterId: c.id, serviceDate: dateObj, status: { in: HELD_APPOINTMENT_STATUSES } },
        }),
        this.countDailyUsed(this.prisma, c.id, dateObj),
        this.prisma.appointment.groupBy({
          by: ['slotStart'],
          where: { counterId: c.id, serviceDate: dateObj, slotSeat: { not: null } },
          _count: { _all: true },
        }),
      ]);

      const dayApptRemaining = Math.max(
        0,
        Math.min(
          c.appointmentQuota! - heldCount,
          c.dailyCapacity === null ? Number.MAX_SAFE_INTEGER : c.dailyCapacity - dailyUsed,
        ),
      );
      const slotUsedMap = new Map<string, number>();
      for (const row of bookedBySlot) slotUsedMap.set(row.slotStart, row._count._all);

      const allSlots = generateSlots(windows, c.slotMinutes!);
      const slots = allSlots.map(slot => {
        const used = slotUsedMap.get(slot) ?? 0;
        const pastOrTooSoon = diff === 0 && timeToMinutes(slot) < minutesNow + minLead;
        const remaining = pastOrTooSoon ? 0 : Math.max(0, Math.min(c.slotCapacity! - used, dayApptRemaining));
        return {
          slot,
          capacity: c.slotCapacity!,
          remaining,
          available: remaining > 0,
        };
      });

      days.push({
        date: dateStr,
        weekday,
        closed: false,
        closureNote: null,
        remainingDayQuota: dayApptRemaining,
        slots,
      });
    }

    return {
      counter: { id: c.id, code: c.code, name: c.name },
      field: mapping.field,
      slotMinutes: c.slotMinutes,
      days,
    };
  }

  async issueOnlineTicket(citizenId: string, dto: IssueTicketDto, rawIdempotencyKey?: string, now: Date = new Date()) {
    const idemKey = this.normalizeIdempotencyKey('c', citizenId, rawIdempotencyKey);
    if (idemKey) {
      const existing = await this.prisma.queueTicket.findUnique({
        where: { idempotencyKey: idemKey },
        include: { counter: true },
      });
      if (existing) {
        const ahead = await this.aheadCount(this.prisma, existing.counterId, existing.serviceDate, existing.sequence);
        return ticketView(existing, existing.counter, { aheadCount: ahead, idempotentReplay: true });
      }
    }

    const mapping = await this.prisma.counterField.findUnique({
      where: { fieldId: dto.fieldId },
      include: { counter: { include: { schedules: true } }, field: true },
    });
    if (!mapping) throw notFound('Lĩnh vực này chưa được phân công quầy phụ trách');

    if (dto.procedureId) {
      const proc = await this.prisma.procedure.findFirst({
        where: { id: dto.procedureId, fieldId: dto.fieldId, isValid: true },
      });
      if (!proc) throw badRequest('INVALID_PROCEDURE', 'Thủ tục không thuộc lĩnh vực đã chọn');
    }

    const counter = mapping.counter;
    const readiness = evaluateReadiness(counter, 1, counter.schedules.length);
    if (!readiness.ticket.ready) {
      throw conflict('TICKET_NOT_READY', 'Quầy hiện chưa mở lấy số trực tuyến: ' + readiness.ticket.missing.join('; '));
    }

    const todayStr = vnToday(now);
    const todayDate = parseDateOnly(todayStr);
    const weekday = weekdayOf(todayStr);
    const windows = counter.schedules
      .filter(s => s.weekday === weekday)
      .map(s => ({ startTime: s.startTime, endTime: s.endTime }));

    const closure = await this.prisma.counterClosure.findUnique({
      where: { counterId_date: { counterId: counter.id, date: todayDate } },
    });
    if (closure || windows.length === 0) {
      throw conflict('COUNTER_CLOSED_TODAY', closure?.note ? `Quầy nghỉ hôm nay: ${closure.note}` : 'Quầy không làm việc hôm nay');
    }
    if (!isWithinWindows(windows, vnMinutesOfDay(now))) {
      const hoursText = windows.map(w => `${w.startTime}–${w.endTime}`).join(', ');
      throw conflict('OUTSIDE_OPERATING_HOURS', `Chỉ nhận lấy số trong giờ hoạt động của quầy (${hoursText})`);
    }

    return withRetry(() =>
      this.prisma.$transaction(async tx => {
        if (idemKey) {
          const dup = await tx.queueTicket.findUnique({ where: { idempotencyKey: idemKey } });
          if (dup) {
            const ahead = await this.aheadCount(tx, dup.counterId, dup.serviceDate, dup.sequence);
            return ticketView(dup, counter, { aheadCount: ahead, idempotentReplay: true });
          }
        }

        const dayLock = await lockCounterDay(tx, counter.id, todayStr);

        const activeCitizenTickets = await tx.queueTicket.count({
          where: {
            citizenId,
            serviceDate: todayDate,
            status: { in: ACTIVE_TICKET_STATUSES },
          },
        });
        if (activeCitizenTickets >= counter.maxActiveTicketsPerCitizen!) {
          throw conflict('CITIZEN_TICKET_LIMIT', 'Bạn đang có phiếu số thứ tự chưa hoàn tất trong hôm nay');
        }

        const onlineIssued = await tx.queueTicket.count({
          where: { counterId: counter.id, serviceDate: todayDate, source: 'ONLINE', status: { not: 'CANCELLED' } },
        });
        if (onlineIssued >= counter.ticketQuota!) {
          throw conflict('TICKET_QUOTA_FULL', 'Quầy đã hết hạn mức lấy số trực tuyến trong hôm nay');
        }

        if (counter.dailyCapacity !== null) {
          const used = await this.countDailyUsed(tx, counter.id, todayDate);
          if (used >= counter.dailyCapacity) {
            throw conflict('DAILY_CAPACITY_FULL', 'Quầy đã hết sức chứa phục vụ trong hôm nay');
          }
        }

        const seq = await nextSequence(tx, dayLock.id, dayLock.lastSequence);
        const ticket = await tx.queueTicket.create({
          data: {
            counterId: counter.id,
            serviceDate: todayDate,
            sequence: seq,
            displayNumber: displayNumber(counter.code, seq),
            source: 'ONLINE',
            status: 'WAITING',
            lookupCode: generateLookupCode('T'),
            idempotencyKey: idemKey,
            citizenId,
            fieldId: dto.fieldId,
            procedureId: dto.procedureId,
          },
        });

        await recordEvent(tx, {
          counterId: counter.id,
          ticketId: ticket.id,
          type: 'TICKET_ISSUED_ONLINE',
          actor: { type: 'CITIZEN', id: citizenId },
          detail: { sequence: seq, displayNumber: ticket.displayNumber },
        });

        const ahead = await this.aheadCount(tx, counter.id, todayDate, seq);
        return ticketView(ticket, counter, { fieldLabel: mapping.field.label, aheadCount: ahead });
      }, TX_OPTIONS),
    );
  }

  /**
   * Đảm bảo các lịch hẹn CONFIRMED cũ (trước khi nâng cấp luồng gộp) đều được cấp 1-1 QueueTicket WAITING.
   */
  async ensureAppointmentTicketsForCounterDate(counterId: string, dateStr: string) {
    const serviceDate = parseDateOnly(dateStr);
    const missing = await this.prisma.appointment.findMany({
      where: {
        counterId,
        serviceDate,
        status: 'CONFIRMED',
        tickets: { none: {} },
      },
      include: { counter: true },
      orderBy: [{ slotStart: 'asc' }, { createdAt: 'asc' }],
    });
    if (!missing.length) return 0;

    return withRetry(() =>
      this.prisma.$transaction(async tx => {
        const dayLock = await lockCounterDay(tx, counterId, dateStr);
        let currentSeq = dayLock.lastSequence;
        let issued = 0;

        for (const appt of missing) {
          const already = await tx.queueTicket.findFirst({ where: { appointmentId: appt.id } });
          if (already) continue;
          const seq = await nextSequence(tx, dayLock.id, currentSeq);
          currentSeq = seq;
          const ticket = await tx.queueTicket.create({
            data: {
              counterId: appt.counterId,
              serviceDate: appt.serviceDate,
              sequence: seq,
              displayNumber: displayNumber(appt.counter.code, seq),
              source: 'APPOINTMENT',
              status: 'WAITING',
              lookupCode: generateLookupCode('T'),
              citizenId: appt.citizenId,
              fieldId: appt.fieldId,
              procedureId: appt.procedureId,
              appointmentId: appt.id,
            },
          });
          await recordEvent(tx, {
            counterId: appt.counterId,
            ticketId: ticket.id,
            appointmentId: appt.id,
            type: 'APPOINTMENT_TICKET_BACKFILLED',
            actor: { type: 'SYSTEM' },
            detail: { sequence: seq, displayNumber: ticket.displayNumber, slot: appt.slotStart },
          });
          issued++;
        }
        return issued;
      }, TX_OPTIONS),
    );
  }

  async createAppointment(citizenId: string, dto: CreateAppointmentDto, rawIdempotencyKey?: string, now: Date = new Date()) {
    const idemKey = this.normalizeIdempotencyKey('c', citizenId, rawIdempotencyKey);
    if (idemKey) {
      const existing = await this.prisma.appointment.findUnique({
        where: { idempotencyKey: idemKey },
        include: { counter: true, procedure: { select: { id: true, name: true } }, tickets: true },
      });
      if (existing) {
        const existingTicket = existing.tickets[0] ? ticketView(existing.tickets[0], existing.counter) : null;
        return appointmentView(existing, existing.counter, {
          procedureName: existing.procedure?.name ?? null,
          ticket: existingTicket,
          idempotentReplay: true,
        });
      }
    }

    const mapping = await this.prisma.counterField.findUnique({
      where: { fieldId: dto.fieldId },
      include: { counter: { include: { schedules: true } }, field: true },
    });
    if (!mapping) throw notFound('Lĩnh vực này chưa được phân công quầy phụ trách');

    let procName: string | null = null;
    if (dto.procedureId) {
      const proc = await this.prisma.procedure.findFirst({
        where: { id: dto.procedureId, fieldId: dto.fieldId, isValid: true },
      });
      if (!proc) throw badRequest('INVALID_PROCEDURE', 'Thủ tục không thuộc lĩnh vực đã chọn');
      procName = proc.name;
    }

    const counter = mapping.counter;
    const readiness = evaluateReadiness(counter, 1, counter.schedules.length);
    if (!readiness.appointment.ready) {
      throw conflict('APPOINTMENT_NOT_READY', 'Quầy hiện chưa mở đặt lịch hẹn: ' + readiness.appointment.missing.join('; '));
    }

    if (!isValidDateString(dto.date)) throw badRequest('INVALID_DATE', 'Ngày đặt lịch không hợp lệ');
    const todayStr = vnToday(now);
    const diffDays = daysBetween(todayStr, dto.date);
    if (diffDays < 0 || diffDays > counter.bookingMaxDaysAhead!) {
      throw conflict('DATE_OUT_OF_RANGE', `Chỉ được đặt lịch trong phạm vi ${counter.bookingMaxDaysAhead} ngày tới`);
    }

    const serviceDate = parseDateOnly(dto.date);
    const weekday = weekdayOf(dto.date);
    const windows = counter.schedules
      .filter(s => s.weekday === weekday)
      .map(s => ({ startTime: s.startTime, endTime: s.endTime }));
    const closure = await this.prisma.counterClosure.findUnique({
      where: { counterId_date: { counterId: counter.id, date: serviceDate } },
    });
    if (closure || windows.length === 0) {
      throw conflict('COUNTER_CLOSED_DATE', closure?.note ? `Quầy nghỉ ngày ${dto.date}: ${closure.note}` : 'Quầy không làm việc vào ngày đã chọn');
    }

    const validSlots = generateSlots(windows, counter.slotMinutes!);
    if (!validSlots.includes(dto.slot)) {
      throw badRequest('INVALID_SLOT', 'Khung giờ không nằm trong lịch hoạt động của quầy');
    }
    const minLead = counter.bookingMinLeadMinutes ?? 0;
    if (diffDays === 0 && timeToMinutes(dto.slot) < vnMinutesOfDay(now) + minLead) {
      throw conflict('SLOT_TOO_SOON', 'Khung giờ này đã qua hoặc quá sát giờ hiện tại');
    }

    return withRetry(() =>
      this.prisma.$transaction(async tx => {
        if (idemKey) {
          const dup = await tx.appointment.findUnique({
            where: { idempotencyKey: idemKey },
            include: { tickets: true },
          });
          if (dup) {
            const dupTicket = dup.tickets[0] ? ticketView(dup.tickets[0], counter) : null;
            return appointmentView(dup, counter, {
              fieldLabel: mapping.field.label,
              procedureName: procName,
              ticket: dupTicket,
              idempotentReplay: true,
            });
          }
        }

        const dayLock = await lockCounterDay(tx, counter.id, dto.date);

        const activeAppts = await tx.appointment.count({
          where: {
            citizenId,
            status: 'CONFIRMED',
            serviceDate: { gte: parseDateOnly(todayStr) },
          },
        });
        if (activeAppts >= counter.maxActiveAppointmentsPerCitizen!) {
          throw conflict('CITIZEN_APPOINTMENT_LIMIT', 'Bạn đã đạt giới hạn lịch hẹn đang chờ');
        }

        const heldCount = await tx.appointment.count({
          where: { counterId: counter.id, serviceDate, status: { in: HELD_APPOINTMENT_STATUSES } },
        });
        if (heldCount >= counter.appointmentQuota!) {
          throw conflict('APPOINTMENT_QUOTA_FULL', 'Quầy đã hết hạn mức đặt lịch trong ngày đã chọn');
        }

        if (counter.dailyCapacity !== null) {
          const used = await this.countDailyUsed(tx, counter.id, serviceDate);
          if (used >= counter.dailyCapacity) {
            throw conflict('DAILY_CAPACITY_FULL', 'Quầy đã hết sức chứa phục vụ trong ngày đã chọn');
          }
        }

        const takenSeats = await tx.appointment.findMany({
          where: { counterId: counter.id, serviceDate, slotStart: dto.slot, slotSeat: { not: null } },
          select: { slotSeat: true },
        });
        const usedSet = new Set(takenSeats.map(s => s.slotSeat!));
        let freeSeat: number | null = null;
        for (let seat = 1; seat <= counter.slotCapacity!; seat++) {
          if (!usedSet.has(seat)) {
            freeSeat = seat;
            break;
          }
        }
        if (freeSeat === null) {
          throw conflict('SLOT_FULL', 'Khung giờ bạn chọn vừa hết chỗ. Vui lòng chọn khung giờ khác.');
        }

        const appt = await tx.appointment.create({
          data: {
            counterId: counter.id,
            serviceDate,
            slotStart: dto.slot,
            slotSeat: freeSeat,
            status: 'CONFIRMED',
            lookupCode: generateLookupCode('A'),
            idempotencyKey: idemKey,
            citizenId,
            fieldId: dto.fieldId,
            procedureId: dto.procedureId,
            contactName: dto.contactName.trim(),
            contactPhone: dto.contactPhone?.trim() || null,
          },
        });

        // Cấp số gọi ngay khi đặt lịch thành công trong cùng giao dịch (Mục 1.1 & Mục 8.1)
        const seq = await nextSequence(tx, dayLock.id, dayLock.lastSequence);
        const ticket = await tx.queueTicket.create({
          data: {
            counterId: counter.id,
            serviceDate,
            sequence: seq,
            displayNumber: displayNumber(counter.code, seq),
            source: 'APPOINTMENT',
            status: 'WAITING',
            lookupCode: generateLookupCode('T'),
            citizenId,
            fieldId: dto.fieldId,
            procedureId: dto.procedureId,
            appointmentId: appt.id,
          },
        });

        await recordEvent(tx, {
          counterId: counter.id,
          ticketId: ticket.id,
          appointmentId: appt.id,
          type: 'APPOINTMENT_CREATED',
          actor: { type: 'CITIZEN', id: citizenId },
          detail: {
            serviceDate: dto.date,
            slot: dto.slot,
            slotSeat: freeSeat,
            sequence: seq,
            displayNumber: ticket.displayNumber,
          },
        });

        return appointmentView(appt, counter, {
          fieldLabel: mapping.field.label,
          procedureName: procName,
          ticket: ticketView(ticket, counter),
        });
      }, TX_OPTIONS),
    );
  }

  async getMyItems(citizenId: string, now: Date = new Date()) {
    const todayStr = vnToday(now);
    const todayDate = parseDateOnly(todayStr);
    const minutesNow = vnMinutesOfDay(now);

    const legacyMissing = await this.prisma.appointment.findMany({
      where: { citizenId, status: 'CONFIRMED', tickets: { none: {} } },
      select: { counterId: true, serviceDate: true },
    });
    const seenPairs = new Set<string>();
    for (const item of legacyMissing) {
      const ds = formatDateOnly(item.serviceDate);
      const key = `${item.counterId}:${ds}`;
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        await this.ensureAppointmentTicketsForCounterDate(item.counterId, ds);
      }
    }

    const [tickets, appointments, fields] = await Promise.all([
      this.prisma.queueTicket.findMany({
        where: { citizenId, serviceDate: { gte: todayDate } },
        orderBy: [{ serviceDate: 'desc' }, { sequence: 'desc' }],
        take: 20,
        include: { counter: true, procedure: { select: { id: true, name: true } } },
      }),
      this.prisma.appointment.findMany({
        where: { citizenId },
        orderBy: [{ serviceDate: 'desc' }, { slotStart: 'asc' }],
        take: 30,
        include: {
          counter: true,
          procedure: { select: { id: true, name: true } },
          tickets: { select: { id: true, displayNumber: true, sequence: true, status: true, lookupCode: true, callCount: true } },
        },
      }),
      this.prisma.procedureField.findMany({ select: { id: true, label: true } }),
    ]);

    const fieldMap = new Map(fields.map(f => [f.id, f.label]));

    const ticketViews = [];
    for (const t of tickets) {
      const ahead = t.status === 'WAITING' ? await this.aheadCount(this.prisma, t.counterId, t.serviceDate, t.sequence) : 0;
      ticketViews.push(
        ticketView(t, t.counter, {
          aheadCount: ahead,
          fieldLabel: t.fieldId ? (fieldMap.get(t.fieldId) ?? null) : null,
          procedureName: t.procedure?.name ?? null,
        }),
      );
    }

    const allAppointments = appointments.map(a => {
      const dateStr = formatDateOnly(a.serviceDate);
      const duration = a.counter.slotMinutes ?? 30;
      const isPastSlot =
        dateStr < todayStr ||
        (dateStr === todayStr && timeToMinutes(a.slotStart) + duration <= minutesNow);
      const t = a.tickets[0] ?? null;
      const view = appointmentView(a, a.counter, {
        fieldLabel: fieldMap.get(a.fieldId) ?? null,
        procedureName: a.procedure?.name ?? null,
        ticket: t,
        isPastSlot,
      });
      const isActiveStatus =
        (a.status === 'CONFIRMED' || a.status === 'CHECKED_IN') &&
        (!t || ['WAITING', 'CALLING', 'SERVING'].includes(t.status));
      const isUpcoming = isActiveStatus && dateStr >= todayStr;
      return { ...view, isUpcoming };
    });

    const upcomingAppointments = allAppointments
      .filter(a => a.isUpcoming)
      .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate) || a.slot.localeCompare(b.slot));
    const historyAppointments = allAppointments.filter(a => !a.isUpcoming);

    return {
      tickets: ticketViews,
      appointments: allAppointments,
      upcomingAppointments,
      historyAppointments,
    };
  }

  async lookupByCode(rawCode: string, now: Date = new Date()) {
    const code = String(rawCode ?? '').trim().toUpperCase();
    if (!LOOKUP_CODE_RE.test(code)) {
      throw badRequest('INVALID_LOOKUP_CODE', 'Mã tra cứu không đúng định dạng');
    }
    const todayStr = vnToday(now);
    const minutesNow = vnMinutesOfDay(now);

    if (code.startsWith('T')) {
      const t = await this.prisma.queueTicket.findUnique({
        where: { lookupCode: code },
        include: {
          counter: true,
          procedure: { select: { id: true, name: true } },
          appointment: true,
        },
      });
      if (!t) throw notFound('Không tìm thấy phiếu số với mã tra cứu này');
      const ahead = t.status === 'WAITING' ? await this.aheadCount(this.prisma, t.counterId, t.serviceDate, t.sequence) : 0;
      const calling = await this.prisma.queueTicket.findFirst({
        where: { counterId: t.counterId, serviceDate: t.serviceDate, status: { in: ['CALLING', 'SERVING'] } },
        orderBy: { sequence: 'desc' },
        select: { displayNumber: true, status: true },
      });
      return {
        kind: 'TICKET',
        ticket: ticketView(t, t.counter, {
          aheadCount: ahead,
          currentlyServing: calling,
          procedureName: t.procedure?.name ?? null,
          slot: t.appointment?.slotStart ?? null,
          slotRange: t.appointment ? formatSlotRange(t.appointment.slotStart, t.counter.slotMinutes) : null,
          appointmentLookupCode: t.appointment?.lookupCode ?? null,
        }),
      };
    }

    let a = await this.prisma.appointment.findUnique({
      where: { lookupCode: code },
      include: {
        counter: true,
        procedure: { select: { id: true, name: true } },
        tickets: { select: { id: true, displayNumber: true, sequence: true, status: true, lookupCode: true, callCount: true } },
      },
    });
    if (!a) throw notFound('Không tìm thấy lịch hẹn với mã tra cứu này');
    if (a.status === 'CONFIRMED' && a.tickets.length === 0) {
      await this.ensureAppointmentTicketsForCounterDate(a.counterId, formatDateOnly(a.serviceDate));
      a = await this.prisma.appointment.findUniqueOrThrow({
        where: { lookupCode: code },
        include: {
          counter: true,
          procedure: { select: { id: true, name: true } },
          tickets: { select: { id: true, displayNumber: true, sequence: true, status: true, lookupCode: true, callCount: true } },
        },
      });
    }

    const dateStr = formatDateOnly(a.serviceDate);
    const duration = a.counter.slotMinutes ?? 30;
    const isPastSlot =
      dateStr < todayStr ||
      (dateStr === todayStr && timeToMinutes(a.slotStart) + duration <= minutesNow);
    const t = a.tickets[0] ?? null;
    const unified = resolveUnifiedTurnStatus({
      appointmentStatus: a.status,
      ticketStatus: t?.status ?? null,
      isPastSlot,
    });

    // Công khai không trả tên đầy đủ hoặc số điện thoại nguyên bản
    return {
      kind: 'APPOINTMENT',
      appointment: {
        id: a.id,
        lookupCode: a.lookupCode,
        status: a.status,
        unifiedStatus: unified.status,
        unifiedStatusLabel: unified.label,
        displayNumber: t?.displayNumber ?? null,
        sequence: t?.sequence ?? null,
        serviceDate: dateStr,
        slot: a.slotStart,
        slotRange: formatSlotRange(a.slotStart, a.counter.slotMinutes),
        counter: { id: a.counter.id, code: a.counter.code, name: a.counter.name },
        procedureName: a.procedure?.name ?? null,
        maskedPhone: maskPhone(a.contactPhone),
        ticket: t,
        createdAt: a.createdAt,
      },
    };
  }

  async cancelCitizenTicket(citizenId: string, ticketId: string, reason?: string) {
    return this.prisma.$transaction(async tx => {
      const ticket = await tx.queueTicket.findUnique({ where: { id: ticketId }, include: { counter: true } });
      if (!ticket || ticket.citizenId !== citizenId) throw notFound('Không tìm thấy phiếu số của bạn');
      if (ticket.status !== 'WAITING') {
        throw conflict('CANNOT_CANCEL_TICKET', 'Chỉ có thể hủy phiếu khi đang ở trạng thái chờ');
      }
      const updated = await transitionTicket(
        tx,
        ticket,
        'CANCELLED',
        { type: 'CITIZEN', id: citizenId },
        'TICKET_CANCELLED_BY_CITIZEN',
        { finishedAt: new Date() },
        reason ? { reason } : undefined,
      );
      if (ticket.appointmentId) {
        await tx.appointment.updateMany({
          where: { id: ticket.appointmentId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
          data: { status: 'CANCELLED', slotSeat: null, cancelReason: reason?.trim() || null, version: { increment: 1 } },
        });
      }
      return ticketView(updated, ticket.counter);
    }, TX_OPTIONS);
  }

  async cancelCitizenAppointment(citizenId: string, appointmentId: string, reason?: string) {
    return this.prisma.$transaction(async tx => {
      const appt = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { counter: true, tickets: true },
      });
      if (!appt || appt.citizenId !== citizenId) throw notFound('Không tìm thấy lịch hẹn của bạn');
      if (appt.status !== 'CONFIRMED') {
        throw conflict('CANNOT_CANCEL_APPOINTMENT', 'Chỉ có thể hủy lịch hẹn khi chưa được tiếp nhận tại quầy');
      }
      const activeCalled = appt.tickets.find(t => ['CALLING', 'SERVING', 'COMPLETED'].includes(t.status));
      if (activeCalled) {
        throw conflict('CANNOT_CANCEL_APPOINTMENT', 'Lịch hẹn đang được gọi hoặc đã tiếp nhận tại quầy, không thể hủy');
      }
      const res = await tx.appointment.updateMany({
        where: { id: appt.id, status: 'CONFIRMED', version: appt.version },
        data: {
          status: 'CANCELLED',
          slotSeat: null,
          cancelReason: reason?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (res.count !== 1) throw conflict('CONFLICT', 'Lịch hẹn vừa thay đổi. Vui lòng tải lại.');

      for (const linkedTicket of appt.tickets) {
        if (linkedTicket.status === 'WAITING') {
          await transitionTicket(
            tx,
            linkedTicket,
            'CANCELLED',
            { type: 'CITIZEN', id: citizenId },
            'TICKET_CANCELLED_WITH_APPOINTMENT',
            { finishedAt: new Date() },
            reason ? { reason } : undefined,
          );
        }
      }

      await recordEvent(tx, {
        counterId: appt.counterId,
        appointmentId: appt.id,
        type: 'APPOINTMENT_CANCELLED_BY_CITIZEN',
        actor: { type: 'CITIZEN', id: citizenId },
        detail: reason ? { reason } : undefined,
      });
      const updated = await tx.appointment.findUniqueOrThrow({ where: { id: appt.id } });
      return appointmentView(updated, appt.counter);
    }, TX_OPTIONS);
  }

  async rescheduleCitizenAppointment(
    citizenId: string,
    appointmentId: string,
    dto: RescheduleAppointmentDto,
    rawIdempotencyKey?: string,
    now: Date = new Date(),
  ) {
    const oldAppt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { counter: { include: { schedules: true } }, tickets: true },
    });
    if (!oldAppt || oldAppt.citizenId !== citizenId) throw notFound('Không tìm thấy lịch hẹn của bạn');
    if (oldAppt.status !== 'CONFIRMED') {
      throw conflict('CANNOT_RESCHEDULE', 'Chỉ có thể đổi lịch khi lịch hẹn đang ở trạng thái đã đặt lịch');
    }
    if (oldAppt.tickets.some(t => ['CALLING', 'SERVING', 'COMPLETED'].includes(t.status))) {
      throw conflict('CANNOT_RESCHEDULE', 'Lịch hẹn đang được gọi hoặc đã tiếp nhận, không thể đổi lịch');
    }

    const counter = oldAppt.counter;
    const readiness = evaluateReadiness(counter, 1, counter.schedules.length);
    if (!readiness.appointment.ready) {
      throw conflict('APPOINTMENT_NOT_READY', 'Quầy hiện không nhận đổi lịch');
    }

    const todayStr = vnToday(now);
    const diffDays = daysBetween(todayStr, dto.date);
    if (diffDays < 0 || diffDays > counter.bookingMaxDaysAhead!) {
      throw conflict('DATE_OUT_OF_RANGE', `Chỉ được đổi lịch trong phạm vi ${counter.bookingMaxDaysAhead} ngày tới`);
    }
    const newDate = parseDateOnly(dto.date);
    const weekday = weekdayOf(dto.date);
    const windows = counter.schedules
      .filter(s => s.weekday === weekday)
      .map(s => ({ startTime: s.startTime, endTime: s.endTime }));
    const closure = await this.prisma.counterClosure.findUnique({
      where: { counterId_date: { counterId: counter.id, date: newDate } },
    });
    if (closure || windows.length === 0) {
      throw conflict('COUNTER_CLOSED_DATE', 'Quầy không làm việc vào ngày bạn chọn');
    }
    const validSlots = generateSlots(windows, counter.slotMinutes!);
    if (!validSlots.includes(dto.slot)) {
      throw badRequest('INVALID_SLOT', 'Khung giờ không nằm trong lịch hoạt động của quầy');
    }
    const minLead = counter.bookingMinLeadMinutes ?? 0;
    if (diffDays === 0 && timeToMinutes(dto.slot) < vnMinutesOfDay(now) + minLead) {
      throw conflict('SLOT_TOO_SOON', 'Khung giờ này đã qua hoặc quá sát giờ hiện tại');
    }

    const idemKey = this.normalizeIdempotencyKey('c', citizenId, rawIdempotencyKey);

    return withRetry(() =>
      this.prisma.$transaction(async tx => {
        if (idemKey) {
          const dup = await tx.appointment.findUnique({
            where: { idempotencyKey: idemKey },
            include: { tickets: true },
          });
          if (dup) {
            return appointmentView(dup, counter, {
              ticket: dup.tickets[0] ? ticketView(dup.tickets[0], counter) : null,
              idempotentReplay: true,
            });
          }
        }

        const oldDateStr = formatDateOnly(oldAppt.serviceDate);
        const locks = new Map<string, { id: string; lastSequence: number }>();
        for (const d of Array.from(new Set([oldDateStr, dto.date])).sort()) {
          locks.set(d, await lockCounterDay(tx, counter.id, d));
        }

        const released = await tx.appointment.updateMany({
          where: { id: oldAppt.id, status: 'CONFIRMED', version: oldAppt.version },
          data: { status: 'RESCHEDULED', slotSeat: null, version: { increment: 1 } },
        });
        if (released.count !== 1) throw conflict('CONFLICT', 'Lịch hẹn vừa thay đổi. Vui lòng tải lại.');

        for (const oldTicket of oldAppt.tickets) {
          if (oldTicket.status === 'WAITING') {
            await transitionTicket(
              tx,
              oldTicket,
              'CANCELLED',
              { type: 'CITIZEN', id: citizenId },
              'TICKET_CANCELLED_ON_RESCHEDULE',
              { finishedAt: new Date() },
            );
          }
        }

        const heldCount = await tx.appointment.count({
          where: { counterId: counter.id, serviceDate: newDate, status: { in: HELD_APPOINTMENT_STATUSES } },
        });
        if (heldCount >= counter.appointmentQuota!) {
          throw conflict('APPOINTMENT_QUOTA_FULL', 'Ngày mới đã hết hạn mức đặt lịch');
        }
        if (counter.dailyCapacity !== null) {
          const used = await this.countDailyUsed(tx, counter.id, newDate);
          if (used >= counter.dailyCapacity) {
            throw conflict('DAILY_CAPACITY_FULL', 'Ngày mới đã hết sức chứa phục vụ');
          }
        }

        const takenSeats = await tx.appointment.findMany({
          where: { counterId: counter.id, serviceDate: newDate, slotStart: dto.slot, slotSeat: { not: null } },
          select: { slotSeat: true },
        });
        const usedSet = new Set(takenSeats.map(s => s.slotSeat!));
        let freeSeat: number | null = null;
        for (let seat = 1; seat <= counter.slotCapacity!; seat++) {
          if (!usedSet.has(seat)) {
            freeSeat = seat;
            break;
          }
        }
        if (freeSeat === null) throw conflict('SLOT_FULL', 'Khung giờ mới vừa hết chỗ');

        const created = await tx.appointment.create({
          data: {
            counterId: counter.id,
            serviceDate: newDate,
            slotStart: dto.slot,
            slotSeat: freeSeat,
            status: 'CONFIRMED',
            lookupCode: generateLookupCode('A'),
            idempotencyKey: idemKey,
            citizenId,
            fieldId: oldAppt.fieldId,
            procedureId: oldAppt.procedureId,
            contactName: oldAppt.contactName,
            contactPhone: oldAppt.contactPhone,
            rescheduledFromId: oldAppt.id,
          },
        });

        const newDayLock = locks.get(dto.date)!;
        const seq = await nextSequence(tx, newDayLock.id, newDayLock.lastSequence);
        const newTicket = await tx.queueTicket.create({
          data: {
            counterId: counter.id,
            serviceDate: newDate,
            sequence: seq,
            displayNumber: displayNumber(counter.code, seq),
            source: 'APPOINTMENT',
            status: 'WAITING',
            lookupCode: generateLookupCode('T'),
            citizenId,
            fieldId: oldAppt.fieldId,
            procedureId: oldAppt.procedureId,
            appointmentId: created.id,
          },
        });

        await recordEvent(tx, {
          counterId: counter.id,
          ticketId: newTicket.id,
          appointmentId: created.id,
          type: 'APPOINTMENT_RESCHEDULED',
          actor: { type: 'CITIZEN', id: citizenId },
          detail: {
            fromAppointmentId: oldAppt.id,
            toDate: dto.date,
            toSlot: dto.slot,
            sequence: seq,
            displayNumber: newTicket.displayNumber,
          },
        });

        return appointmentView(created, counter, {
          rescheduledFromId: oldAppt.id,
          ticket: ticketView(newTicket, counter),
        });
      }, TX_OPTIONS),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // CÁN BỘ VẬN HÀNH TẠI QUẦY
  // ─────────────────────────────────────────────────────────────

  async getAdminCounters(admin: { id: string; role: AdminRole }) {
    const where: Prisma.ServiceCounterWhereInput =
      admin.role === AdminRole.SUPER_ADMIN
        ? {}
        : { staff: { some: { adminId: admin.id } } };

    const counters = await this.prisma.serviceCounter.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        fields: { include: { field: true } },
        schedules: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
        closures: { orderBy: { date: 'asc' } },
        staff: { include: { admin: { select: { id: true, username: true, fullName: true, role: true } } } },
      },
    });

    return counters.map(c => {
      const sampleWeekday = c.schedules.find(s => s.weekday >= 1 && s.weekday <= 5)?.weekday ?? c.schedules[0]?.weekday ?? 1;
      const sampleWindows = c.schedules
        .filter(s => s.weekday === sampleWeekday)
        .map(s => ({ startTime: s.startTime, endTime: s.endTime }));
      const slotCountPerDay = generateSlots(sampleWindows, c.slotMinutes ?? 30).length;
      const capacitySummary = calculateCounterCapacitySummary({
        slotCountPerDay,
        slotMinutes: c.slotMinutes,
        slotCapacity: c.slotCapacity,
        appointmentQuota: c.appointmentQuota,
        dailyCapacity: c.dailyCapacity,
      });
      return {
        ...c,
        closures: c.closures.map(cl => ({ ...cl, date: formatDateOnly(cl.date) })),
        readiness: evaluateReadiness(c, c.fields.length, c.schedules.length),
        capacitySummary,
      };
    });
  }

  async getCounterBoard(admin: { id: string; role: AdminRole }, counterId: string, query: BoardQueryDto, now: Date = new Date()) {
    await this.assertCounterAccess(admin, counterId);
    const todayStr = vnToday(now);
    const minutesNow = vnMinutesOfDay(now);
    const dateStr = query.date || todayStr;
    const serviceDate = parseDateOnly(dateStr);

    const counter = await this.prisma.serviceCounter.findUnique({
      where: { id: counterId },
      include: {
        fields: { include: { field: true } },
        schedules: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
        closures: { where: { date: serviceDate } },
      },
    });
    if (!counter) throw notFound('Không tìm thấy quầy phục vụ');

    await this.ensureAppointmentTicketsForCounterDate(counterId, dateStr);

    const [tickets, appointments, totalUsed] = await Promise.all([
      this.prisma.queueTicket.findMany({
        where: { counterId, serviceDate },
        orderBy: { sequence: 'asc' },
        include: {
          procedure: { select: { id: true, name: true } },
          appointment: {
            select: {
              id: true,
              lookupCode: true,
              slotStart: true,
              slotSeat: true,
              status: true,
              contactName: true,
              contactPhone: true,
            },
          },
        },
      }),
      this.prisma.appointment.findMany({
        where: { counterId, serviceDate },
        orderBy: [{ slotStart: 'asc' }, { createdAt: 'asc' }],
        include: {
          procedure: { select: { id: true, name: true } },
          tickets: {
            select: {
              id: true,
              displayNumber: true,
              status: true,
              sequence: true,
              lookupCode: true,
              callCount: true,
              calledAt: true,
              servingAt: true,
              finishedAt: true,
            },
          },
        },
      }),
      this.countDailyUsed(this.prisma, counterId, serviceDate),
    ]);

    const slotMinutes = counter.slotMinutes ?? 30;
    const weekday = weekdayOf(dateStr);
    const dayWindows = counter.schedules
      .filter(s => s.weekday === weekday)
      .map(s => ({ startTime: s.startTime, endTime: s.endTime }));
    const daySlots = generateSlots(dayWindows, slotMinutes);
    const currentSlot =
      dateStr === todayStr
        ? daySlots.find(s => {
            const st = timeToMinutes(s);
            return minutesNow >= st && minutesNow < st + slotMinutes;
          }) ?? null
        : null;

    const isSuper = admin.role === AdminRole.SUPER_ADMIN;

    // Sắp xếp lượt theo Khung giờ trước, sau đó theo Số thứ tự trong khung giờ (Mục 7.1 & 8.1)
    const enrichedTickets = tickets
      .map(t => {
        const slot = t.appointment?.slotStart ?? null;
        const isPastSlot =
          dateStr < todayStr ||
          (dateStr === todayStr && slot !== null && timeToMinutes(slot) + slotMinutes <= minutesNow);
        const isCurrentSlot =
          dateStr === todayStr &&
          slot !== null &&
          timeToMinutes(slot) <= minutesNow &&
          minutesNow < timeToMinutes(slot) + slotMinutes;
        const isFutureSlot =
          dateStr > todayStr ||
          (dateStr === todayStr && slot !== null && timeToMinutes(slot) > minutesNow);
        const unified = resolveUnifiedTurnStatus({
          appointmentStatus: t.appointment?.status ?? null,
          ticketStatus: t.status,
          isPastSlot,
        });
        return {
          ...ticketView(t, counter),
          unifiedStatus: unified.status,
          unifiedStatusLabel: unified.label,
          slot,
          slotRange: slot ? formatSlotRange(slot, slotMinutes) : null,
          isPastSlot,
          isCurrentSlot,
          isFutureSlot,
          appointmentId: t.appointment?.id ?? null,
          appointmentLookupCode: t.appointment?.lookupCode ?? null,
          contactName: t.appointment?.contactName ?? null,
          contactPhone: t.appointment ? (isSuper ? t.appointment.contactPhone : maskPhone(t.appointment.contactPhone)) : null,
          procedureName: t.procedure?.name ?? null,
          callCount: t.callCount,
          servingAt: t.servingAt,
          finishedAt: t.finishedAt,
          version: t.version,
        };
      })
      .sort((a, b) => {
        const slotA = a.slot ?? '00:00';
        const slotB = b.slot ?? '00:00';
        return slotA.localeCompare(slotB) || a.sequence - b.sequence;
      });

    const enrichedAppointments = appointments
      .map(a => {
        const t = a.tickets[0] ?? null;
        const isPastSlot =
          dateStr < todayStr ||
          (dateStr === todayStr && timeToMinutes(a.slotStart) + slotMinutes <= minutesNow);
        const isCurrentSlot =
          dateStr === todayStr &&
          timeToMinutes(a.slotStart) <= minutesNow &&
          minutesNow < timeToMinutes(a.slotStart) + slotMinutes;
        const isFutureSlot =
          dateStr > todayStr ||
          (dateStr === todayStr && timeToMinutes(a.slotStart) > minutesNow);
        const unified = resolveUnifiedTurnStatus({
          appointmentStatus: a.status,
          ticketStatus: t?.status ?? null,
          isPastSlot,
        });
        return {
          id: a.id,
          lookupCode: a.lookupCode,
          displayNumber: t?.displayNumber ?? null,
          sequence: t?.sequence ?? null,
          slot: a.slotStart,
          slotRange: formatSlotRange(a.slotStart, slotMinutes),
          slotSeat: a.slotSeat,
          status: a.status,
          unifiedStatus: unified.status,
          unifiedStatusLabel: unified.label,
          isPastSlot,
          isCurrentSlot,
          isFutureSlot,
          contactName: a.contactName,
          contactPhone: isSuper ? a.contactPhone : maskPhone(a.contactPhone),
          procedureName: a.procedure?.name ?? null,
          ticket: t,
          version: a.version,
          createdAt: a.createdAt,
        };
      })
      .sort((a, b) => a.slot.localeCompare(b.slot) || (a.sequence ?? 999999) - (b.sequence ?? 999999));

    return {
      date: dateStr,
      serverTime: now.toISOString(),
      currentSlot,
      currentSlotRange: currentSlot ? formatSlotRange(currentSlot, slotMinutes) : null,
      counter: {
        id: counter.id,
        code: counter.code,
        name: counter.name,
        isActive: counter.isActive,
        ticketEnabled: counter.ticketEnabled,
        appointmentEnabled: counter.appointmentEnabled,
        dailyCapacity: counter.dailyCapacity,
        ticketQuota: counter.ticketQuota,
        appointmentQuota: counter.appointmentQuota,
        walkInQuota: counter.walkInQuota,
        slotMinutes,
        slotCapacity: counter.slotCapacity ?? 1,
        fields: counter.fields.map(f => f.field),
        readiness: evaluateReadiness(counter, counter.fields.length, counter.schedules.length),
        closedToday: counter.closures.length > 0,
        closureNote: counter.closures[0]?.note ?? null,
      },
      summary: {
        totalUsed,
        waiting: enrichedTickets.filter(t => t.status === 'WAITING').length,
        calling: enrichedTickets.filter(t => t.status === 'CALLING').length,
        serving: enrichedTickets.filter(t => t.status === 'SERVING').length,
        completed: enrichedTickets.filter(t => t.status === 'COMPLETED').length,
        noShow: enrichedTickets.filter(t => t.status === 'NO_SHOW').length,
        unservedPastSlots: enrichedTickets.filter(t => t.unifiedStatus === 'UNSERVED_PAST_SLOT').length,
        appointmentsConfirmed: appointments.filter(a => a.status === 'CONFIRMED').length,
        appointmentsCheckedIn: appointments.filter(a => a.status === 'CHECKED_IN').length,
      },
      tickets: enrichedTickets,
      appointments: enrichedAppointments,
    };
  }

  async lookupAdminByCode(admin: { id: string; role: AdminRole }, rawCode: string) {
    const code = String(rawCode ?? '').trim().toUpperCase();
    if (!LOOKUP_CODE_RE.test(code)) throw badRequest('INVALID_LOOKUP_CODE', 'Mã tra cứu không đúng định dạng');
    const isSuper = admin.role === AdminRole.SUPER_ADMIN;

    if (code.startsWith('T')) {
      const t = await this.prisma.queueTicket.findUnique({
        where: { lookupCode: code },
        include: {
          counter: true,
          procedure: { select: { id: true, name: true } },
          appointment: true,
        },
      });
      if (!t) throw notFound('Không tìm thấy phiếu số');
      await this.assertCounterAccess(admin, t.counterId);
      return {
        kind: 'TICKET',
        ticket: {
          ...ticketView(t, t.counter),
          procedureName: t.procedure?.name ?? null,
          callCount: t.callCount,
          slot: t.appointment?.slotStart ?? null,
          slotRange: t.appointment ? formatSlotRange(t.appointment.slotStart, t.counter.slotMinutes) : null,
          appointmentLookupCode: t.appointment?.lookupCode ?? null,
          contactName: t.appointment?.contactName ?? null,
          contactPhone: t.appointment ? (isSuper ? t.appointment.contactPhone : maskPhone(t.appointment.contactPhone)) : null,
        },
      };
    }

    let a = await this.prisma.appointment.findUnique({
      where: { lookupCode: code },
      include: { counter: true, procedure: { select: { id: true, name: true } }, tickets: true },
    });
    if (!a) throw notFound('Không tìm thấy lịch hẹn');
    await this.assertCounterAccess(admin, a.counterId);
    if (a.status === 'CONFIRMED' && a.tickets.length === 0) {
      await this.ensureAppointmentTicketsForCounterDate(a.counterId, formatDateOnly(a.serviceDate));
      a = await this.prisma.appointment.findUniqueOrThrow({
        where: { lookupCode: code },
        include: { counter: true, procedure: { select: { id: true, name: true } }, tickets: true },
      });
    }
    return {
      kind: 'APPOINTMENT',
      appointment: {
        ...appointmentView(a, a.counter, { ticket: a.tickets[0] ?? null }),
        contactPhone: isSuper ? a.contactPhone : maskPhone(a.contactPhone),
        procedureName: a.procedure?.name ?? null,
        ticket: a.tickets[0] ?? null,
      },
    };
  }

  async issueWalkInTicket(
    admin: { id: string; role: AdminRole },
    counterId: string,
    dto: WalkInTicketDto,
    rawIdempotencyKey?: string,
    now: Date = new Date(),
  ) {
    await this.assertCounterAccess(admin, counterId);
    const idemKey = this.normalizeIdempotencyKey('a', admin.id, rawIdempotencyKey);
    const counter = await this.prisma.serviceCounter.findUnique({ where: { id: counterId } });
    if (!counter) throw notFound('Không tìm thấy quầy');
    if (!counter.isActive) throw conflict('COUNTER_INACTIVE', 'Quầy chưa được kích hoạt');

    const todayStr = vnToday(now);
    const todayDate = parseDateOnly(todayStr);
    const closure = await this.prisma.counterClosure.findUnique({
      where: { counterId_date: { counterId, date: todayDate } },
    });
    if (closure) throw conflict('COUNTER_CLOSED_TODAY', 'Quầy đang đóng hôm nay');

    return withRetry(() =>
      this.prisma.$transaction(async tx => {
        if (idemKey) {
          const dup = await tx.queueTicket.findUnique({ where: { idempotencyKey: idemKey } });
          if (dup) return ticketView(dup, counter, { idempotentReplay: true });
        }
        const dayLock = await lockCounterDay(tx, counter.id, todayStr);

        if (counter.walkInQuota !== null) {
          const walkIns = await tx.queueTicket.count({
            where: { counterId: counter.id, serviceDate: todayDate, source: 'WALK_IN', status: { not: 'CANCELLED' } },
          });
          if (walkIns >= counter.walkInQuota) {
            throw conflict('WALK_IN_QUOTA_FULL', 'Quầy đã hết hạn mức cấp số trực tiếp hôm nay');
          }
        }
        if (counter.dailyCapacity !== null) {
          const used = await this.countDailyUsed(tx, counter.id, todayDate);
          if (used >= counter.dailyCapacity) {
            throw conflict('DAILY_CAPACITY_FULL', 'Quầy đã đạt sức chứa tối đa trong ngày');
          }
        }

        const seq = await nextSequence(tx, dayLock.id, dayLock.lastSequence);
        const ticket = await tx.queueTicket.create({
          data: {
            counterId: counter.id,
            serviceDate: todayDate,
            sequence: seq,
            displayNumber: displayNumber(counter.code, seq),
            source: 'WALK_IN',
            status: 'WAITING',
            lookupCode: generateLookupCode('T'),
            idempotencyKey: idemKey,
            fieldId: dto.fieldId,
            procedureId: dto.procedureId,
            handledByAdminId: admin.id,
          },
        });

        await recordEvent(tx, {
          counterId: counter.id,
          ticketId: ticket.id,
          type: 'TICKET_ISSUED_WALK_IN',
          actor: { type: 'ADMIN', id: admin.id },
          detail: { sequence: seq, displayNumber: ticket.displayNumber },
        });
        return ticketView(ticket, counter);
      }, TX_OPTIONS),
    );
  }

  async callNextTicket(admin: { id: string; role: AdminRole }, counterId: string, now: Date = new Date()) {
    await this.assertCounterAccess(admin, counterId);
    const todayStr = vnToday(now);
    const todayDate = parseDateOnly(todayStr);
    const minutesNow = vnMinutesOfDay(now);
    const counter = await this.prisma.serviceCounter.findUnique({ where: { id: counterId } });
    if (!counter) throw notFound('Không tìm thấy quầy');

    await this.ensureAppointmentTicketsForCounterDate(counterId, todayStr);

    return this.prisma.$transaction(async tx => {
      await lockCounterDay(tx, counterId, todayStr);

      // Không cho phép cùng 1 vị trí tiếp nhận đang gọi 2 số cùng lúc (Mục 7.2 & 10.2)
      const activeCallingOrServing = await tx.queueTicket.findMany({
        where: { counterId, serviceDate: todayDate, status: { in: ['CALLING', 'SERVING'] } },
        select: { id: true, displayNumber: true, status: true, handledByAdminId: true },
      });
      const maxPositions = Math.max(1, counter.slotCapacity ?? 1);
      const sameAdminCalling = activeCallingOrServing.find(
        t => t.handledByAdminId === admin.id && t.status === 'CALLING',
      );
      if (sameAdminCalling || activeCallingOrServing.length >= maxPositions) {
        const busyTicket = sameAdminCalling ?? activeCallingOrServing[0];
        throw conflict(
          'POSITION_BUSY',
          `Quầy đang xử lý số ${busyTicket.displayNumber} (${busyTicket.status === 'CALLING' ? 'Đang gọi' : 'Đang tiếp nhận'}). Vui lòng Tiếp nhận, Hoàn tất hoặc đánh dấu Vắng mặt trước khi gọi số tiếp theo.`,
        );
      }

      const waitingTickets = await tx.queueTicket.findMany({
        where: { counterId, serviceDate: todayDate, status: 'WAITING' },
        include: { appointment: true },
      });
      if (!waitingTickets.length) {
        throw conflict('QUEUE_EMPTY', 'Hiện không còn số nào đang chờ trong hàng');
      }

      // Lọc các lượt thuộc khung giờ hợp lệ (khung giờ hiện tại hoặc khung giờ trước chưa được gọi),
      // không tự động gọi sớm lượt của khung giờ tương lai (Mục 7.2 & Mục 8.1)
      const eligible = waitingTickets.filter(t => {
        if (!t.appointment) return true;
        return timeToMinutes(t.appointment.slotStart) <= minutesNow;
      });

      if (!eligible.length) {
        const sortedFuture = [...waitingTickets].sort(
          (a, b) =>
            (a.appointment?.slotStart ?? '99:99').localeCompare(b.appointment?.slotStart ?? '99:99') ||
            a.sequence - b.sequence,
        );
        const nextSlot = sortedFuture[0]?.appointment?.slotStart ?? '';
        throw conflict(
          'FUTURE_SLOT_NOT_STARTED',
          `Chưa đến khung giờ hẹn tiếp theo (${nextSlot}). Hệ thống không tự động gọi sớm lượt của khung giờ tương lai.`,
        );
      }

      // Thứ tự gọi ưu tiên theo khung giờ (slotStart) trước, sau đó theo thứ tự số (sequence) trong khung giờ
      eligible.sort((a, b) => {
        const slotA = a.appointment?.slotStart ?? '00:00';
        const slotB = b.appointment?.slotStart ?? '00:00';
        return slotA.localeCompare(slotB) || a.sequence - b.sequence;
      });

      const nextWaiting = eligible[0];
      const updated = await transitionTicket(
        tx,
        nextWaiting,
        'CALLING',
        { type: 'ADMIN', id: admin.id },
        'TICKET_CALLED',
        { callCount: { increment: 1 }, calledAt: now, handledByAdminId: admin.id },
      );
      return ticketView(updated, counter, {
        slot: nextWaiting.appointment?.slotStart ?? null,
        slotRange: nextWaiting.appointment ? formatSlotRange(nextWaiting.appointment.slotStart, counter.slotMinutes) : null,
        appointmentLookupCode: nextWaiting.appointment?.lookupCode ?? null,
      });
    }, TX_OPTIONS);
  }

  async recallTicket(admin: { id: string; role: AdminRole }, ticketId: string, now: Date = new Date()) {
    const ticket = await this.prisma.queueTicket.findUnique({ where: { id: ticketId }, include: { counter: true } });
    if (!ticket) throw notFound('Không tìm thấy phiếu số');
    await this.assertCounterAccess(admin, ticket.counterId);

    return this.prisma.$transaction(async tx => {
      const updated = await transitionTicket(
        tx,
        ticket,
        'CALLING',
        { type: 'ADMIN', id: admin.id },
        'TICKET_RECALLED',
        { callCount: { increment: 1 }, calledAt: now, handledByAdminId: admin.id },
      );
      return ticketView(updated, ticket.counter);
    }, TX_OPTIONS);
  }

  async startServingTicket(admin: { id: string; role: AdminRole }, ticketId: string, now: Date = new Date()) {
    const ticket = await this.prisma.queueTicket.findUnique({ where: { id: ticketId }, include: { counter: true } });
    if (!ticket) throw notFound('Không tìm thấy phiếu số');
    await this.assertCounterAccess(admin, ticket.counterId);

    return this.prisma.$transaction(async tx => {
      const updated = await transitionTicket(
        tx,
        ticket,
        'SERVING',
        { type: 'ADMIN', id: admin.id },
        'TICKET_SERVING',
        { servingAt: now, handledByAdminId: admin.id },
      );
      return ticketView(updated, ticket.counter);
    }, TX_OPTIONS);
  }

  async completeTicket(admin: { id: string; role: AdminRole }, ticketId: string, now: Date = new Date()) {
    const ticket = await this.prisma.queueTicket.findUnique({ where: { id: ticketId }, include: { counter: true } });
    if (!ticket) throw notFound('Không tìm thấy phiếu số');
    await this.assertCounterAccess(admin, ticket.counterId);

    return this.prisma.$transaction(async tx => {
      const updated = await transitionTicket(
        tx,
        ticket,
        'COMPLETED',
        { type: 'ADMIN', id: admin.id },
        'TICKET_COMPLETED',
        { finishedAt: now, handledByAdminId: admin.id },
      );
      return ticketView(updated, ticket.counter);
    }, TX_OPTIONS);
  }

  async markNoShowTicket(admin: { id: string; role: AdminRole }, ticketId: string, reason?: string, now: Date = new Date()) {
    const ticket = await this.prisma.queueTicket.findUnique({ where: { id: ticketId }, include: { counter: true } });
    if (!ticket) throw notFound('Không tìm thấy phiếu số');
    await this.assertCounterAccess(admin, ticket.counterId);

    return this.prisma.$transaction(async tx => {
      const updated = await transitionTicket(
        tx,
        ticket,
        'NO_SHOW',
        { type: 'ADMIN', id: admin.id },
        'TICKET_NO_SHOW',
        { finishedAt: now, handledByAdminId: admin.id },
        reason ? { reason } : undefined,
      );
      return ticketView(updated, ticket.counter);
    }, TX_OPTIONS);
  }

  async transferTicket(admin: { id: string; role: AdminRole }, ticketId: string, dto: TransferTicketDto, now: Date = new Date()) {
    const ticket = await this.prisma.queueTicket.findUnique({ where: { id: ticketId }, include: { counter: true } });
    if (!ticket) throw notFound('Không tìm thấy phiếu số');
    await this.assertCounterAccess(admin, ticket.counterId);
    if (ticket.counterId === dto.toCounterId) {
      throw badRequest('SAME_COUNTER', 'Quầy chuyển đến phải khác quầy hiện tại');
    }

    const toCounter = await this.prisma.serviceCounter.findUnique({ where: { id: dto.toCounterId } });
    if (!toCounter || !toCounter.isActive) throw conflict('TARGET_COUNTER_INACTIVE', 'Quầy đích không tồn tại hoặc chưa kích hoạt');

    const dateStr = formatDateOnly(ticket.serviceDate);

    return withRetry(() =>
      this.prisma.$transaction(async tx => {
        const orderedIds = [ticket.counterId, toCounter.id].sort();
        const locks = new Map<string, { id: string; lastSequence: number }>();
        for (const cid of orderedIds) {
          locks.set(cid, await lockCounterDay(tx, cid, dateStr));
        }

        await transitionTicket(
          tx,
          ticket,
          'TRANSFERRED',
          { type: 'ADMIN', id: admin.id },
          'TICKET_TRANSFERRED_OUT',
          { finishedAt: now, handledByAdminId: admin.id },
          { toCounterId: toCounter.id, reason: dto.reason },
        );

        const targetLock = locks.get(toCounter.id)!;
        const seq = await nextSequence(tx, targetLock.id, targetLock.lastSequence);
        const newTicket = await tx.queueTicket.create({
          data: {
            counterId: toCounter.id,
            serviceDate: ticket.serviceDate,
            sequence: seq,
            displayNumber: displayNumber(toCounter.code, seq),
            source: 'TRANSFER',
            status: 'WAITING',
            lookupCode: generateLookupCode('T'),
            citizenId: ticket.citizenId,
            fieldId: ticket.fieldId,
            procedureId: ticket.procedureId,
            appointmentId: ticket.appointmentId,
            transferredFromId: ticket.id,
            handledByAdminId: admin.id,
          },
        });

        await recordEvent(tx, {
          counterId: toCounter.id,
          ticketId: newTicket.id,
          type: 'TICKET_TRANSFERRED_IN',
          actor: { type: 'ADMIN', id: admin.id },
          detail: { fromTicketId: ticket.id, fromCounterId: ticket.counterId, reason: dto.reason },
        });

        return ticketView(newTicket, toCounter, { transferredFromId: ticket.id });
      }, TX_OPTIONS),
    );
  }

  async checkInAppointment(admin: { id: string; role: AdminRole }, appointmentId: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { counter: true, tickets: true },
    });
    if (!appt) throw notFound('Không tìm thấy lịch hẹn');
    await this.assertCounterAccess(admin, appt.counterId);

    // Tương thích ngược: nếu lịch hẹn đã có sẵn số gọi (luồng gộp mới), trả về luôn phiếu đó, không cấp số thứ hai
    if (appt.tickets.length > 0) {
      return ticketView(appt.tickets[0], appt.counter, {
        appointmentId: appt.id,
        idempotentReplay: true,
      });
    }

    if (appt.status !== 'CONFIRMED') {
      throw conflict('INVALID_STATE', 'Lịch hẹn không ở trạng thái chờ cấp số');
    }

    const dateStr = formatDateOnly(appt.serviceDate);
    return withRetry(() =>
      this.prisma.$transaction(async tx => {
        const dayLock = await lockCounterDay(tx, appt.counterId, dateStr);
        const existingTicket = await tx.queueTicket.findFirst({ where: { appointmentId: appt.id } });
        if (existingTicket) {
          return ticketView(existingTicket, appt.counter, { appointmentId: appt.id, idempotentReplay: true });
        }

        const seq = await nextSequence(tx, dayLock.id, dayLock.lastSequence);
        const ticket = await tx.queueTicket.create({
          data: {
            counterId: appt.counterId,
            serviceDate: appt.serviceDate,
            sequence: seq,
            displayNumber: displayNumber(appt.counter.code, seq),
            source: 'APPOINTMENT',
            status: 'WAITING',
            lookupCode: generateLookupCode('T'),
            citizenId: appt.citizenId,
            fieldId: appt.fieldId,
            procedureId: appt.procedureId,
            appointmentId: appt.id,
            handledByAdminId: admin.id,
          },
        });

        await recordEvent(tx, {
          counterId: appt.counterId,
          ticketId: ticket.id,
          appointmentId: appt.id,
          type: 'APPOINTMENT_CHECKED_IN',
          actor: { type: 'ADMIN', id: admin.id },
          detail: { sequence: seq, displayNumber: ticket.displayNumber },
        });

        return ticketView(ticket, appt.counter, { appointmentId: appt.id });
      }, TX_OPTIONS),
    );
  }

  async markNoShowAppointment(admin: { id: string; role: AdminRole }, appointmentId: string, reason?: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { counter: true, tickets: true },
    });
    if (!appt) throw notFound('Không tìm thấy lịch hẹn');
    await this.assertCounterAccess(admin, appt.counterId);
    if (appt.status !== 'CONFIRMED' && appt.status !== 'CHECKED_IN') {
      throw conflict('INVALID_STATE', 'Lịch hẹn không ở trạng thái có thể đánh dấu vắng mặt');
    }

    return this.prisma.$transaction(async tx => {
      const res = await tx.appointment.updateMany({
        where: { id: appt.id, status: appt.status, version: appt.version },
        data: { status: 'NO_SHOW', cancelReason: reason?.trim() || null, version: { increment: 1 } },
      });
      if (res.count !== 1) throw conflict('CONFLICT', 'Lịch hẹn vừa thay đổi.');

      for (const t of appt.tickets) {
        if (t.status === 'WAITING' || t.status === 'CALLING') {
          await tx.queueTicket.updateMany({
            where: { id: t.id, status: t.status, version: t.version },
            data: { status: 'NO_SHOW', finishedAt: new Date(), handledByAdminId: admin.id, version: { increment: 1 } },
          });
        }
      }

      await recordEvent(tx, {
        counterId: appt.counterId,
        appointmentId: appt.id,
        type: 'APPOINTMENT_NO_SHOW',
        actor: { type: 'ADMIN', id: admin.id },
        detail: reason ? { reason } : undefined,
      });
      const updated = await tx.appointment.findUniqueOrThrow({ where: { id: appt.id } });
      return appointmentView(updated, appt.counter);
    }, TX_OPTIONS);
  }

  async cancelAdminAppointment(admin: { id: string; role: AdminRole }, appointmentId: string, reason?: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { counter: true, tickets: true },
    });
    if (!appt) throw notFound('Không tìm thấy lịch hẹn');
    await this.assertCounterAccess(admin, appt.counterId);
    if (appt.status !== 'CONFIRMED') {
      throw conflict('INVALID_STATE', 'Chỉ có thể hủy lịch hẹn khi chưa được tiếp nhận');
    }
    if (appt.tickets.some(t => ['CALLING', 'SERVING', 'COMPLETED'].includes(t.status))) {
      throw conflict('INVALID_STATE', 'Lịch hẹn đang được gọi hoặc đã tiếp nhận, không thể hủy');
    }

    return this.prisma.$transaction(async tx => {
      const res = await tx.appointment.updateMany({
        where: { id: appt.id, status: 'CONFIRMED', version: appt.version },
        data: { status: 'CANCELLED', slotSeat: null, cancelReason: reason?.trim() || null, version: { increment: 1 } },
      });
      if (res.count !== 1) throw conflict('CONFLICT', 'Lịch hẹn vừa thay đổi.');

      for (const linkedTicket of appt.tickets) {
        if (linkedTicket.status === 'WAITING') {
          await transitionTicket(
            tx,
            linkedTicket,
            'CANCELLED',
            { type: 'ADMIN', id: admin.id },
            'TICKET_CANCELLED_WITH_APPOINTMENT',
            { finishedAt: new Date(), handledByAdminId: admin.id },
            reason ? { reason } : undefined,
          );
        }
      }

      await recordEvent(tx, {
        counterId: appt.counterId,
        appointmentId: appt.id,
        type: 'APPOINTMENT_CANCELLED_BY_ADMIN',
        actor: { type: 'ADMIN', id: admin.id },
        detail: reason ? { reason } : undefined,
      });
      const updated = await tx.appointment.findUniqueOrThrow({ where: { id: appt.id } });
      return appointmentView(updated, appt.counter);
    }, TX_OPTIONS);
  }

  async getCounterEvents(admin: { id: string; role: AdminRole }, counterId: string, query: EventsQueryDto) {
    await this.assertCounterAccess(admin, counterId);
    const where: Prisma.QueueEventWhereInput = { counterId };
    if (query.date) {
      const start = parseDateOnly(query.date);
      const end = new Date(start.getTime() + 86400000);
      where.createdAt = { gte: start, lt: end };
    }
    return this.prisma.queueEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // CẤU HÌNH QUẦY & LỊCH PHỤC VỤ (SUPER_ADMIN — CÓ AUDIT LOG)
  // ─────────────────────────────────────────────────────────────

  async createCounter(adminId: string, dto: CreateCounterDto) {
    const exists = await this.prisma.serviceCounter.findUnique({ where: { code: dto.code } });
    if (exists) throw conflict('DUPLICATE_COUNTER_CODE', `Mã quầy ${dto.code} đã tồn tại`);

    return auditedWrite(this.prisma, adminId, 'COUNTER_CREATE', 'counter', tx =>
      tx.serviceCounter.create({
        data: { code: dto.code, name: dto.name.trim(), description: dto.description?.trim() || null },
      }),
    );
  }

  async updateCounter(adminId: string, counterId: string, dto: UpdateCounterDto, now: Date = new Date()) {
    const current = await this.prisma.serviceCounter.findUnique({
      where: { id: counterId },
      include: { fields: true, schedules: true },
    });
    if (!current) throw notFound('Không tìm thấy quầy');

    const pick = <K extends keyof CounterConfig>(key: K, incoming: CounterConfig[K] | undefined): CounterConfig[K] =>
      incoming !== undefined ? incoming : current[key];

    const merged: CounterConfig = {
      isActive: pick('isActive', dto.isActive),
      ticketEnabled: pick('ticketEnabled', dto.ticketEnabled),
      appointmentEnabled: pick('appointmentEnabled', dto.appointmentEnabled),
      dailyCapacity: pick('dailyCapacity', dto.dailyCapacity),
      ticketQuota: pick('ticketQuota', dto.ticketQuota),
      appointmentQuota: pick('appointmentQuota', dto.appointmentQuota),
      walkInQuota: pick('walkInQuota', dto.walkInQuota),
      slotMinutes: pick('slotMinutes', dto.slotMinutes),
      slotCapacity: pick('slotCapacity', dto.slotCapacity),
      bookingMinLeadMinutes: pick('bookingMinLeadMinutes', dto.bookingMinLeadMinutes),
      bookingMaxDaysAhead: pick('bookingMaxDaysAhead', dto.bookingMaxDaysAhead),
      maxActiveTicketsPerCitizen: pick('maxActiveTicketsPerCitizen', dto.maxActiveTicketsPerCitizen),
      maxActiveAppointmentsPerCitizen: pick('maxActiveAppointmentsPerCitizen', dto.maxActiveAppointmentsPerCitizen),
    };

    const configErr = validateCounterConfig(merged);
    if (configErr) throw badRequest('INVALID_COUNTER_CONFIG', configErr);

    const fieldCount = dto.fieldIds !== undefined ? dto.fieldIds.length : current.fields.length;
    if ((merged.ticketEnabled || merged.appointmentEnabled) && fieldCount === 0) {
      throw badRequest('MISSING_FIELDS', 'Cần gán ít nhất một lĩnh vực cho quầy trước khi bật lấy số/đặt lịch');
    }
    if ((merged.ticketEnabled || merged.appointmentEnabled) && current.schedules.length === 0) {
      throw badRequest('MISSING_SCHEDULES', 'Cần cấu hình giờ hoạt động trước khi bật lấy số/đặt lịch');
    }

    // Kiểm tra bảo vệ lịch đã đặt: không cho giảm hạn mức/số chỗ xuống thấp hơn số lịch đã đặt (Mục 9.3)
    const todayDate = parseDateOnly(vnToday(now));
    if (merged.appointmentQuota !== null) {
      const groupedByDate = await this.prisma.appointment.groupBy({
        by: ['serviceDate'],
        where: {
          counterId,
          serviceDate: { gte: todayDate },
          status: { in: HELD_APPOINTMENT_STATUSES },
        },
        _count: { _all: true },
      });
      const overDay = groupedByDate.find(row => row._count._all > merged.appointmentQuota!);
      if (overDay) {
        throw conflict(
          'QUOTA_BELOW_BOOKED',
          `Ngày ${formatDateOnly(overDay.serviceDate)} đã có ${overDay._count._all} lịch hẹn đã cấp số. Không thể giảm hạn mức lịch hẹn xuống ${merged.appointmentQuota}.`,
        );
      }
    }

    if (merged.slotCapacity !== null) {
      const groupedBySlot = await this.prisma.appointment.groupBy({
        by: ['serviceDate', 'slotStart'],
        where: {
          counterId,
          serviceDate: { gte: todayDate },
          slotSeat: { not: null },
        },
        _count: { _all: true },
      });
      const overSlot = groupedBySlot.find(row => row._count._all > merged.slotCapacity!);
      if (overSlot) {
        throw conflict(
          'CAPACITY_BELOW_BOOKED',
          `Khung giờ ${overSlot.slotStart} ngày ${formatDateOnly(overSlot.serviceDate)} đã có ${overSlot._count._all} lịch hẹn. Không thể giảm số vị trí tiếp nhận xuống ${merged.slotCapacity}.`,
        );
      }
    }

    if (dto.fieldIds !== undefined) {
      const taken = await this.prisma.counterField.findMany({
        where: { fieldId: { in: dto.fieldIds }, counterId: { not: counterId } },
        include: { field: true, counter: true },
      });
      if (taken.length) {
        throw conflict(
          'FIELD_ALREADY_ASSIGNED',
          `Lĩnh vực "${taken[0].field.label}" đang thuộc quầy ${taken[0].counter.code}`,
        );
      }
    }

    return auditedWrite(this.prisma, adminId, 'COUNTER_UPDATE', `counter:${counterId}`, async tx => {
      if (dto.fieldIds !== undefined) {
        await tx.counterField.deleteMany({ where: { counterId } });
        if (dto.fieldIds.length) {
          await tx.counterField.createMany({
            data: dto.fieldIds.map(fieldId => ({ counterId, fieldId })),
          });
        }
      }
      return tx.serviceCounter.update({
        where: { id: counterId },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          description: dto.description !== undefined ? dto.description.trim() || null : undefined,
          ...merged,
        },
        include: { fields: { include: { field: true } }, schedules: true, closures: true },
      });
    });
  }

  async setSchedules(adminId: string, counterId: string, dto: SetSchedulesDto) {
    const counter = await this.prisma.serviceCounter.findUnique({ where: { id: counterId } });
    if (!counter) throw notFound('Không tìm thấy quầy');
    const err = validateScheduleWindows(dto.windows);
    if (err) throw badRequest('INVALID_SCHEDULES', err);
    if ((counter.ticketEnabled || counter.appointmentEnabled) && dto.windows.length === 0) {
      throw badRequest('INVALID_SCHEDULES', 'Không thể xóa hết giờ hoạt động khi quầy đang bật lấy số/đặt lịch');
    }

    return auditedWrite(this.prisma, adminId, 'COUNTER_SCHEDULE_SET', `counter:${counterId}`, async tx => {
      await tx.counterSchedule.deleteMany({ where: { counterId } });
      if (dto.windows.length) {
        await tx.counterSchedule.createMany({
          data: dto.windows.map(w => ({ counterId, weekday: w.weekday, startTime: w.startTime, endTime: w.endTime })),
        });
      }
      return tx.counterSchedule.findMany({
        where: { counterId },
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      });
    });
  }

  async addClosure(adminId: string, counterId: string, dto: CreateClosureDto) {
    if (!isValidDateString(dto.date)) throw badRequest('INVALID_DATE', 'Ngày nghỉ không hợp lệ');
    const dateObj = parseDateOnly(dto.date);
    const affectedAppointmentsCount = await this.prisma.appointment.count({
      where: {
        counterId,
        serviceDate: dateObj,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
    });
    const saved = await auditedWrite(this.prisma, adminId, 'COUNTER_CLOSURE_ADD', `counter:${counterId}`, tx =>
      tx.counterClosure.upsert({
        where: { counterId_date: { counterId, date: dateObj } },
        update: { note: dto.note?.trim() || null },
        create: { counterId, date: dateObj, note: dto.note?.trim() || null },
      }),
    );
    return {
      ...saved,
      date: dto.date,
      affectedAppointmentsCount,
      warning:
        affectedAppointmentsCount > 0
          ? `Lưu ý: Ngày ${dto.date} đã có ${affectedAppointmentsCount} lịch hẹn đã được cấp số. Hệ thống đã khóa nhận lịch mới nhưng KHÔNG tự động hủy các lịch đã đặt.`
          : null,
    };
  }

  async removeClosure(adminId: string, counterId: string, closureId: string) {
    const closure = await this.prisma.counterClosure.findFirst({ where: { id: closureId, counterId } });
    if (!closure) throw notFound('Không tìm thấy ngày nghỉ');
    return auditedWrite(this.prisma, adminId, 'COUNTER_CLOSURE_REMOVE', `counter:${counterId}`, tx =>
      tx.counterClosure.delete({ where: { id: closureId } }),
    );
  }

  async setStaff(adminId: string, counterId: string, dto: SetStaffDto) {
    const counter = await this.prisma.serviceCounter.findUnique({ where: { id: counterId } });
    if (!counter) throw notFound('Không tìm thấy quầy');
    return auditedWrite(this.prisma, adminId, 'COUNTER_STAFF_SET', `counter:${counterId}`, async tx => {
      await tx.counterStaff.deleteMany({ where: { counterId } });
      if (dto.adminIds.length) {
        await tx.counterStaff.createMany({
          data: Array.from(new Set(dto.adminIds)).map(aid => ({ counterId, adminId: aid })),
        });
      }
      return tx.counterStaff.findMany({
        where: { counterId },
        include: { admin: { select: { id: true, username: true, fullName: true, role: true } } },
      });
    });
  }

  async getStaffCandidates() {
    return this.prisma.admin.findMany({
      where: { isActive: true, role: { in: [AdminRole.SUPER_ADMIN, AdminRole.COUNTER_STAFF] } },
      select: { id: true, username: true, fullName: true, role: true },
      orderBy: { username: 'asc' },
    });
  }

  /**
   * Khởi tạo / cập nhật nhanh 4 quầy chuẩn theo 4 nhóm lĩnh vực đã xác nhận của Trung tâm (Mục 3)
   * với khung giờ 30 phút/lượt và thông số vận hành gắn nhãn [CẤU HÌNH THỬ].
   */
  async setupStandardCounters(adminId: string) {
    const allFields = await this.prisma.procedureField.findMany({
      include: { counterMapping: true },
    });

    const defaultWindows = [1, 2, 3, 4, 5].flatMap(weekday => [
      { weekday, startTime: '07:30', endTime: '11:30' },
      { weekday, startTime: '13:30', endTime: '17:00' },
    ]);

    return auditedWrite(this.prisma, adminId, 'COUNTER_STANDARD_SETUP', 'counter:Q1-Q4', async tx => {
      const results = [];
      for (const preset of CONFIRMED_FOUR_COUNTERS_PRESET) {
        let counter = await tx.serviceCounter.findUnique({
          where: { code: preset.code },
          include: { fields: true, schedules: true },
        });

        // Tìm các lĩnh vực khớp từ khóa chưa gán cho quầy khác
        const matchedFieldIds = allFields
          .filter(f => {
            if (f.counterMapping && (!counter || f.counterMapping.counterId !== counter.id)) return false;
            const hay = `${f.slug} ${f.label}`.toLowerCase();
            return preset.fieldKeywords.some(kw => hay.includes(kw.trim().toLowerCase()));
          })
          .map(f => f.id);

        if (!counter) {
          counter = await tx.serviceCounter.create({
            data: {
              code: preset.code,
              name: preset.name,
              description: preset.description,
              slotMinutes: 30,
              slotCapacity: 1,
              dailyCapacity: 15,
              appointmentQuota: 10,
              ticketQuota: 0,
              walkInQuota: 5,
              bookingMinLeadMinutes: 30,
              bookingMaxDaysAhead: 7,
              maxActiveTicketsPerCitizen: 1,
              maxActiveAppointmentsPerCitizen: 2,
              isActive: matchedFieldIds.length > 0,
              appointmentEnabled: matchedFieldIds.length > 0,
              ticketEnabled: false,
            },
            include: { fields: true, schedules: true },
          });
        } else {
          const totalFieldsAfter = Math.max(counter.fields.length, matchedFieldIds.length);
          counter = await tx.serviceCounter.update({
            where: { id: counter.id },
            data: {
              name: counter.name || preset.name,
              description: counter.description || preset.description,
              slotMinutes: counter.slotMinutes ?? 30,
              slotCapacity: counter.slotCapacity ?? 1,
              dailyCapacity: counter.dailyCapacity ?? 15,
              appointmentQuota: counter.appointmentQuota ?? 10,
              ticketQuota: 0,
              walkInQuota: counter.walkInQuota ?? 5,
              bookingMinLeadMinutes: counter.bookingMinLeadMinutes ?? 30,
              bookingMaxDaysAhead: counter.bookingMaxDaysAhead ?? 7,
              maxActiveTicketsPerCitizen: counter.maxActiveTicketsPerCitizen ?? 1,
              maxActiveAppointmentsPerCitizen: counter.maxActiveAppointmentsPerCitizen ?? 2,
              isActive: totalFieldsAfter > 0 ? true : counter.isActive,
              appointmentEnabled: totalFieldsAfter > 0 ? true : counter.appointmentEnabled,
              ticketEnabled: false,
            },
            include: { fields: true, schedules: true },
          });
        }

        if (counter.schedules.length === 0) {
          await tx.counterSchedule.createMany({
            data: defaultWindows.map(w => ({ counterId: counter!.id, ...w })),
          });
        }

        for (const fid of matchedFieldIds) {
          const exists = await tx.counterField.findUnique({ where: { fieldId: fid } });
          if (!exists) {
            await tx.counterField.create({ data: { counterId: counter.id, fieldId: fid } });
          }
        }

        const refreshed = await tx.serviceCounter.findUniqueOrThrow({
          where: { id: counter.id },
          include: { fields: { include: { field: true } }, schedules: true },
        });
        results.push(refreshed);
      }
      return results;
    });
  }
}

