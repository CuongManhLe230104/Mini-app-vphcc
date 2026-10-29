import { ForbiddenException, Injectable } from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { auditedWrite } from '../audit/audited-write';
import {
  ACTIVE_TICKET_STATUSES,
  CounterConfig,
  displayNumber,
  evaluateReadiness,
  generateLookupCode,
  HELD_APPOINTMENT_STATUSES,
  IDEMPOTENCY_KEY_RE,
  LOOKUP_CODE_RE,
  maskPhone,
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

  async createAppointment(citizenId: string, dto: CreateAppointmentDto, rawIdempotencyKey?: string, now: Date = new Date()) {
    const idemKey = this.normalizeIdempotencyKey('c', citizenId, rawIdempotencyKey);
    if (idemKey) {
      const existing = await this.prisma.appointment.findUnique({
        where: { idempotencyKey: idemKey },
        include: { counter: true },
      });
      if (existing) return appointmentView(existing, existing.counter, { idempotentReplay: true });
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
          const dup = await tx.appointment.findUnique({ where: { idempotencyKey: idemKey } });
          if (dup) return appointmentView(dup, counter, { idempotentReplay: true });
        }

        await lockCounterDay(tx, counter.id, dto.date);

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

        await recordEvent(tx, {
          counterId: counter.id,
          appointmentId: appt.id,
          type: 'APPOINTMENT_CREATED',
          actor: { type: 'CITIZEN', id: citizenId },
          detail: { serviceDate: dto.date, slot: dto.slot, slotSeat: freeSeat },
        });

        return appointmentView(appt, counter, { fieldLabel: mapping.field.label });
      }, TX_OPTIONS),
    );
  }

  async getMyItems(citizenId: string, now: Date = new Date()) {
    const todayDate = parseDateOnly(vnToday(now));
    const [tickets, appointments] = await Promise.all([
      this.prisma.queueTicket.findMany({
        where: { citizenId, serviceDate: { gte: todayDate } },
        orderBy: [{ serviceDate: 'desc' }, { sequence: 'desc' }],
        take: 20,
        include: { counter: true },
      }),
      this.prisma.appointment.findMany({
        where: { citizenId },
        orderBy: [{ serviceDate: 'desc' }, { slotStart: 'asc' }],
        take: 20,
        include: { counter: true, tickets: { select: { id: true, displayNumber: true, status: true, lookupCode: true } } },
      }),
    ]);

    const ticketViews = [];
    for (const t of tickets) {
      const ahead = t.status === 'WAITING' ? await this.aheadCount(this.prisma, t.counterId, t.serviceDate, t.sequence) : 0;
      ticketViews.push(ticketView(t, t.counter, { aheadCount: ahead }));
    }

    return {
      tickets: ticketViews,
      appointments: appointments.map(a =>
        appointmentView(a, a.counter, { ticket: a.tickets[0] ?? null }),
      ),
    };
  }

  async lookupByCode(rawCode: string) {
    const code = String(rawCode ?? '').trim().toUpperCase();
    if (!LOOKUP_CODE_RE.test(code)) {
      throw badRequest('INVALID_LOOKUP_CODE', 'Mã tra cứu không đúng định dạng');
    }

    if (code.startsWith('T')) {
      const t = await this.prisma.queueTicket.findUnique({
        where: { lookupCode: code },
        include: { counter: true },
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
        ticket: ticketView(t, t.counter, { aheadCount: ahead, currentlyServing: calling }),
      };
    }

    const a = await this.prisma.appointment.findUnique({
      where: { lookupCode: code },
      include: { counter: true, tickets: { select: { id: true, displayNumber: true, status: true, lookupCode: true } } },
    });
    if (!a) throw notFound('Không tìm thấy lịch hẹn với mã tra cứu này');
    // Công khai không trả tên đầy đủ hoặc số điện thoại nguyên bản
    return {
      kind: 'APPOINTMENT',
      appointment: {
        id: a.id,
        lookupCode: a.lookupCode,
        status: a.status,
        serviceDate: formatDateOnly(a.serviceDate),
        slot: a.slotStart,
        counter: { id: a.counter.id, code: a.counter.code, name: a.counter.name },
        maskedPhone: maskPhone(a.contactPhone),
        ticket: a.tickets[0] ?? null,
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
      return ticketView(updated, ticket.counter);
    }, TX_OPTIONS);
  }

  async cancelCitizenAppointment(citizenId: string, appointmentId: string, reason?: string) {
    return this.prisma.$transaction(async tx => {
      const appt = await tx.appointment.findUnique({ where: { id: appointmentId }, include: { counter: true } });
      if (!appt || appt.citizenId !== citizenId) throw notFound('Không tìm thấy lịch hẹn của bạn');
      if (appt.status !== 'CONFIRMED') {
        throw conflict('CANNOT_CANCEL_APPOINTMENT', 'Chỉ có thể hủy lịch hẹn khi chưa check-in tại quầy');
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
      include: { counter: { include: { schedules: true } } },
    });
    if (!oldAppt || oldAppt.citizenId !== citizenId) throw notFound('Không tìm thấy lịch hẹn của bạn');
    if (oldAppt.status !== 'CONFIRMED') {
      throw conflict('CANNOT_RESCHEDULE', 'Chỉ có thể đổi lịch khi lịch hẹn đang ở trạng thái đã xác nhận');
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
          const dup = await tx.appointment.findUnique({ where: { idempotencyKey: idemKey } });
          if (dup) return appointmentView(dup, counter, { idempotentReplay: true });
        }

        const oldDateStr = formatDateOnly(oldAppt.serviceDate);
        for (const d of [oldDateStr, dto.date].sort()) {
          await lockCounterDay(tx, counter.id, d);
        }

        const released = await tx.appointment.updateMany({
          where: { id: oldAppt.id, status: 'CONFIRMED', version: oldAppt.version },
          data: { status: 'RESCHEDULED', slotSeat: null, version: { increment: 1 } },
        });
        if (released.count !== 1) throw conflict('CONFLICT', 'Lịch hẹn vừa thay đổi. Vui lòng tải lại.');

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

        await recordEvent(tx, {
          counterId: counter.id,
          appointmentId: created.id,
          type: 'APPOINTMENT_RESCHEDULED',
          actor: { type: 'CITIZEN', id: citizenId },
          detail: { fromAppointmentId: oldAppt.id, toDate: dto.date, toSlot: dto.slot },
        });

        return appointmentView(created, counter, { rescheduledFromId: oldAppt.id });
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

    return counters.map(c => ({
      ...c,
      closures: c.closures.map(cl => ({ ...cl, date: formatDateOnly(cl.date) })),
      readiness: evaluateReadiness(c, c.fields.length, c.schedules.length),
    }));
  }

  async getCounterBoard(admin: { id: string; role: AdminRole }, counterId: string, query: BoardQueryDto, now: Date = new Date()) {
    await this.assertCounterAccess(admin, counterId);
    const dateStr = query.date || vnToday(now);
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

    const [tickets, appointments, totalUsed] = await Promise.all([
      this.prisma.queueTicket.findMany({
        where: { counterId, serviceDate },
        orderBy: { sequence: 'asc' },
        include: { procedure: { select: { id: true, name: true } } },
      }),
      this.prisma.appointment.findMany({
        where: { counterId, serviceDate },
        orderBy: [{ slotStart: 'asc' }, { createdAt: 'asc' }],
        include: {
          procedure: { select: { id: true, name: true } },
          tickets: { select: { id: true, displayNumber: true, status: true, sequence: true } },
        },
      }),
      this.countDailyUsed(this.prisma, counterId, serviceDate),
    ]);

    const isSuper = admin.role === AdminRole.SUPER_ADMIN;
    return {
      date: dateStr,
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
        fields: counter.fields.map(f => f.field),
        readiness: evaluateReadiness(counter, counter.fields.length, counter.schedules.length),
        closedToday: counter.closures.length > 0,
        closureNote: counter.closures[0]?.note ?? null,
      },
      summary: {
        totalUsed,
        waiting: tickets.filter(t => t.status === 'WAITING').length,
        calling: tickets.filter(t => t.status === 'CALLING').length,
        serving: tickets.filter(t => t.status === 'SERVING').length,
        completed: tickets.filter(t => t.status === 'COMPLETED').length,
        noShow: tickets.filter(t => t.status === 'NO_SHOW').length,
        appointmentsConfirmed: appointments.filter(a => a.status === 'CONFIRMED').length,
        appointmentsCheckedIn: appointments.filter(a => a.status === 'CHECKED_IN').length,
      },
      tickets: tickets.map(t => ({
        ...ticketView(t, counter),
        procedureName: t.procedure?.name ?? null,
        callCount: t.callCount,
        servingAt: t.servingAt,
        finishedAt: t.finishedAt,
        version: t.version,
      })),
      appointments: appointments.map(a => ({
        id: a.id,
        lookupCode: a.lookupCode,
        slot: a.slotStart,
        slotSeat: a.slotSeat,
        status: a.status,
        contactName: a.contactName,
        contactPhone: isSuper ? a.contactPhone : maskPhone(a.contactPhone),
        procedureName: a.procedure?.name ?? null,
        ticket: a.tickets[0] ?? null,
        version: a.version,
        createdAt: a.createdAt,
      })),
    };
  }

  async lookupAdminByCode(admin: { id: string; role: AdminRole }, rawCode: string) {
    const code = String(rawCode ?? '').trim().toUpperCase();
    if (!LOOKUP_CODE_RE.test(code)) throw badRequest('INVALID_LOOKUP_CODE', 'Mã tra cứu không đúng định dạng');
    const isSuper = admin.role === AdminRole.SUPER_ADMIN;

    if (code.startsWith('T')) {
      const t = await this.prisma.queueTicket.findUnique({
        where: { lookupCode: code },
        include: { counter: true, procedure: { select: { id: true, name: true } } },
      });
      if (!t) throw notFound('Không tìm thấy phiếu số');
      await this.assertCounterAccess(admin, t.counterId);
      return { kind: 'TICKET', ticket: { ...ticketView(t, t.counter), procedureName: t.procedure?.name ?? null, callCount: t.callCount } };
    }

    const a = await this.prisma.appointment.findUnique({
      where: { lookupCode: code },
      include: { counter: true, procedure: { select: { id: true, name: true } }, tickets: true },
    });
    if (!a) throw notFound('Không tìm thấy lịch hẹn');
    await this.assertCounterAccess(admin, a.counterId);
    return {
      kind: 'APPOINTMENT',
      appointment: {
        ...appointmentView(a, a.counter),
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
    const counter = await this.prisma.serviceCounter.findUnique({ where: { id: counterId } });
    if (!counter) throw notFound('Không tìm thấy quầy');

    return this.prisma.$transaction(async tx => {
      await lockCounterDay(tx, counterId, todayStr);
      const nextWaiting = await tx.queueTicket.findFirst({
        where: { counterId, serviceDate: todayDate, status: 'WAITING' },
        orderBy: { sequence: 'asc' },
      });
      if (!nextWaiting) throw conflict('QUEUE_EMPTY', 'Hiện không còn số nào đang chờ trong hàng');

      const updated = await transitionTicket(
        tx,
        nextWaiting,
        'CALLING',
        { type: 'ADMIN', id: admin.id },
        'TICKET_CALLED',
        { callCount: { increment: 1 }, calledAt: now, handledByAdminId: admin.id },
      );
      return ticketView(updated, counter);
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
    const appt = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: { counter: true } });
    if (!appt) throw notFound('Không tìm thấy lịch hẹn');
    await this.assertCounterAccess(admin, appt.counterId);
    if (appt.status !== 'CONFIRMED') {
      throw conflict('INVALID_STATE', 'Lịch hẹn không ở trạng thái chờ check-in');
    }

    const dateStr = formatDateOnly(appt.serviceDate);
    return withRetry(() =>
      this.prisma.$transaction(async tx => {
        const dayLock = await lockCounterDay(tx, appt.counterId, dateStr);
        const res = await tx.appointment.updateMany({
          where: { id: appt.id, status: 'CONFIRMED', version: appt.version },
          data: { status: 'CHECKED_IN', version: { increment: 1 } },
        });
        if (res.count !== 1) throw conflict('CONFLICT', 'Lịch hẹn vừa thay đổi. Vui lòng tải lại.');

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
    const appt = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: { counter: true } });
    if (!appt) throw notFound('Không tìm thấy lịch hẹn');
    await this.assertCounterAccess(admin, appt.counterId);
    if (appt.status !== 'CONFIRMED') {
      throw conflict('INVALID_STATE', 'Chỉ đánh dấu vắng mặt cho lịch hẹn chưa check-in');
    }

    return this.prisma.$transaction(async tx => {
      const res = await tx.appointment.updateMany({
        where: { id: appt.id, status: 'CONFIRMED', version: appt.version },
        data: { status: 'NO_SHOW', cancelReason: reason?.trim() || null, version: { increment: 1 } },
      });
      if (res.count !== 1) throw conflict('CONFLICT', 'Lịch hẹn vừa thay đổi.');
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
    const appt = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: { counter: true } });
    if (!appt) throw notFound('Không tìm thấy lịch hẹn');
    await this.assertCounterAccess(admin, appt.counterId);
    if (appt.status !== 'CONFIRMED') {
      throw conflict('INVALID_STATE', 'Chỉ có thể hủy lịch hẹn khi chưa check-in');
    }

    return this.prisma.$transaction(async tx => {
      const res = await tx.appointment.updateMany({
        where: { id: appt.id, status: 'CONFIRMED', version: appt.version },
        data: { status: 'CANCELLED', slotSeat: null, cancelReason: reason?.trim() || null, version: { increment: 1 } },
      });
      if (res.count !== 1) throw conflict('CONFLICT', 'Lịch hẹn vừa thay đổi.');
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
  // CẤU HÌNH QUẦY (SUPER_ADMIN — CÓ AUDIT LOG)
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

  async updateCounter(adminId: string, counterId: string, dto: UpdateCounterDto) {
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
    return auditedWrite(this.prisma, adminId, 'COUNTER_CLOSURE_ADD', `counter:${counterId}`, tx =>
      tx.counterClosure.upsert({
        where: { counterId_date: { counterId, date: dateObj } },
        update: { note: dto.note?.trim() || null },
        create: { counterId, date: dateObj, note: dto.note?.trim() || null },
      }),
    );
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
}

