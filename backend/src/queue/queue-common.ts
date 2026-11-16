import { HttpException, HttpStatus } from '@nestjs/common';
import { Appointment, AppointmentStatus, Prisma, QueueTicket, ServiceCounter, TicketStatus } from '@prisma/client';
import { canTransitionTicket, resolveUnifiedTurnStatus } from './queue-rules';
import { formatDateOnly, minutesToTime, timeToMinutes } from './queue-time';

export type Actor = { type: 'ADMIN' | 'CITIZEN' | 'SYSTEM'; id?: string };

/** Lỗi nghiệp vụ có mã máy đọc được để Mini App/Admin hiển thị hướng dẫn rõ ràng. */
export function appError(status: number, code: string, message: string) {
  return new HttpException({ code, message }, status);
}
export const conflict = (code: string, message: string) => appError(HttpStatus.CONFLICT, code, message);
export const badRequest = (code: string, message: string) => appError(HttpStatus.BAD_REQUEST, code, message);
export const notFound = (message = 'Không tìm thấy') => appError(HttpStatus.NOT_FOUND, 'NOT_FOUND', message);

export async function recordEvent(tx: Prisma.TransactionClient, p: {
  counterId: string; ticketId?: string; appointmentId?: string; type: string; actor: Actor; detail?: Record<string, unknown>;
}) {
  await tx.queueEvent.create({ data: {
    counterId: p.counterId, ticketId: p.ticketId, appointmentId: p.appointmentId, type: p.type,
    actorType: p.actor.type, actorId: p.actor.id,
    detail: p.detail ? (p.detail as Prisma.InputJsonValue) : undefined,
  } });
}

/**
 * Chuyển trạng thái phiếu: kiểm tra bảng chuyển, khóa lạc quan theo (status, version), ghi sự kiện,
 * đồng bộ lịch hẹn liên quan (1-1). Mọi nơi đổi trạng thái phiếu phải đi qua hàm này.
 */
export async function transitionTicket(tx: Prisma.TransactionClient, ticket: QueueTicket, to: TicketStatus, actor: Actor,
  eventType: string, data: Prisma.QueueTicketUncheckedUpdateManyInput = {}, detail?: Record<string, unknown>): Promise<QueueTicket> {
  if (!canTransitionTicket(ticket.status, to)) {
    throw conflict('INVALID_STATE', 'Không thể thực hiện thao tác này ở trạng thái hiện tại của số thứ tự');
  }
  const res = await tx.queueTicket.updateMany({
    where: { id: ticket.id, status: ticket.status, version: ticket.version },
    data: { ...data, status: to, version: { increment: 1 } },
  });
  if (res.count !== 1) throw conflict('CONFLICT', 'Số thứ tự vừa được thay đổi bởi thao tác khác. Vui lòng tải lại.');

  if (ticket.appointmentId) {
    if (to === 'SERVING') {
      await tx.appointment.updateMany({
        where: { id: ticket.appointmentId, status: 'CONFIRMED' },
        data: { status: 'CHECKED_IN', version: { increment: 1 } },
      });
    } else if (to === 'COMPLETED' || to === 'NO_SHOW' || to === 'CANCELLED') {
      const mapped: AppointmentStatus = to === 'COMPLETED' ? 'COMPLETED' : to === 'NO_SHOW' ? 'NO_SHOW' : 'CANCELLED';
      await tx.appointment.updateMany({
        where: { id: ticket.appointmentId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
        data: { status: mapped, slotSeat: mapped === 'CANCELLED' ? null : undefined, version: { increment: 1 } },
      });
    }
  }
  await recordEvent(tx, { counterId: ticket.counterId, ticketId: ticket.id, appointmentId: ticket.appointmentId ?? undefined, type: eventType, actor, detail });
  return tx.queueTicket.findUniqueOrThrow({ where: { id: ticket.id } });
}

type CounterLite = Pick<ServiceCounter, 'id' | 'code' | 'name'> & { slotMinutes?: number | null };

export function formatSlotRange(slotStart: string, slotMinutes?: number | null): string {
  const duration = slotMinutes && slotMinutes > 0 ? slotMinutes : 30;
  const startMin = timeToMinutes(slotStart);
  const endMin = Math.min(24 * 60 - 1, startMin + duration);
  return `${slotStart} – ${minutesToTime(endMin)}`;
}

export function ticketView(t: QueueTicket, counter: CounterLite, extra: Record<string, unknown> = {}) {
  const unified = resolveUnifiedTurnStatus({ ticketStatus: t.status });
  return {
    id: t.id, lookupCode: t.lookupCode, displayNumber: t.displayNumber, sequence: t.sequence,
    status: t.status, unifiedStatus: unified.status, unifiedStatusLabel: unified.label,
    source: t.source, serviceDate: formatDateOnly(t.serviceDate),
    counter: { id: counter.id, code: counter.code, name: counter.name },
    createdAt: t.createdAt, calledAt: t.calledAt, ...extra,
  };
}

export function appointmentView(a: Appointment, counter: CounterLite, extra: Record<string, unknown> = {}) {
  const ticketObj = (extra.ticket as { displayNumber?: string; sequence?: number; status?: TicketStatus; lookupCode?: string } | null | undefined) ?? null;
  const unified = resolveUnifiedTurnStatus({
    appointmentStatus: a.status,
    ticketStatus: ticketObj?.status ?? null,
    isPastSlot: Boolean(extra.isPastSlot),
  });
  return {
    id: a.id, lookupCode: a.lookupCode, status: a.status,
    unifiedStatus: unified.status, unifiedStatusLabel: unified.label,
    displayNumber: (extra.displayNumber as string | null | undefined) ?? ticketObj?.displayNumber ?? null,
    sequence: (extra.sequence as number | null | undefined) ?? ticketObj?.sequence ?? null,
    serviceDate: formatDateOnly(a.serviceDate),
    slot: a.slotStart,
    slotRange: formatSlotRange(a.slotStart, counter.slotMinutes),
    counter: { id: counter.id, code: counter.code, name: counter.name },
    contactName: a.contactName, contactPhone: a.contactPhone, createdAt: a.createdAt, ...extra,
  };
}

