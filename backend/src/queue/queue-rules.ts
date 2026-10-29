import { randomInt } from 'node:crypto';
import { AppointmentStatus, TicketStatus } from '@prisma/client';

/** Các trường cấu hình quầy mà Trung tâm phải duyệt. NULL = chưa duyệt. */
export interface CounterConfig {
  isActive: boolean;
  ticketEnabled: boolean;
  appointmentEnabled: boolean;
  dailyCapacity: number | null;
  ticketQuota: number | null;
  appointmentQuota: number | null;
  walkInQuota: number | null;
  slotMinutes: number | null;
  slotCapacity: number | null;
  bookingMinLeadMinutes: number | null;
  bookingMaxDaysAhead: number | null;
  maxActiveTicketsPerCitizen: number | null;
  maxActiveAppointmentsPerCitizen: number | null;
}

export const TICKET_REQUIRED: (keyof CounterConfig)[] = ['ticketQuota', 'maxActiveTicketsPerCitizen'];
export const APPOINTMENT_REQUIRED: (keyof CounterConfig)[] = [
  'appointmentQuota', 'slotMinutes', 'slotCapacity', 'bookingMaxDaysAhead', 'maxActiveAppointmentsPerCitizen',
];

const FIELD_LABELS: Record<string, string> = {
  ticketQuota: 'hạn mức lấy số online', maxActiveTicketsPerCitizen: 'giới hạn số đang chờ mỗi người',
  appointmentQuota: 'hạn mức lịch hẹn', slotMinutes: 'độ dài khung giờ', slotCapacity: 'số chỗ mỗi khung',
  bookingMaxDaysAhead: 'số ngày đặt trước tối đa', maxActiveAppointmentsPerCitizen: 'giới hạn lịch hẹn mỗi người',
};

export function missingFields(config: CounterConfig, required: (keyof CounterConfig)[]): string[] {
  return required.filter(key => config[key] === null || config[key] === undefined);
}

export interface Readiness {
  ticket: { ready: boolean; missing: string[] };
  appointment: { ready: boolean; missing: string[] };
}

/** Chức năng chỉ mở khi quầy đã kích hoạt, có lĩnh vực, có giờ hoạt động và đủ cấu hình bắt buộc. */
export function evaluateReadiness(config: CounterConfig, fieldCount: number, scheduleCount: number): Readiness {
  const base: string[] = [];
  if (!config.isActive) base.push('Quầy chưa được kích hoạt');
  if (fieldCount === 0) base.push('Chưa gán lĩnh vực');
  if (scheduleCount === 0) base.push('Chưa cấu hình giờ hoạt động');
  const ticketMissing = missingFields(config, TICKET_REQUIRED).map(k => 'Thiếu ' + FIELD_LABELS[k]);
  const apptMissing = missingFields(config, APPOINTMENT_REQUIRED).map(k => 'Thiếu ' + FIELD_LABELS[k]);
  const ticket = [...base, ...(config.ticketEnabled ? [] : ['Chưa bật lấy số']), ...ticketMissing];
  const appointment = [...base, ...(config.appointmentEnabled ? [] : ['Chưa bật đặt lịch']), ...apptMissing];
  return { ticket: { ready: ticket.length === 0, missing: ticket }, appointment: { ready: appointment.length === 0, missing: appointment } };
}

/** Lỗi cấu hình trước khi lưu (trả về thông báo hoặc null). */
export function validateCounterConfig(c: CounterConfig): string | null {
  if (c.ticketEnabled) {
    const m = missingFields(c, TICKET_REQUIRED);
    if (m.length) return 'Không thể bật lấy số khi thiếu: ' + m.map(k => FIELD_LABELS[k]).join(', ');
  }
  if (c.appointmentEnabled) {
    const m = missingFields(c, APPOINTMENT_REQUIRED);
    if (m.length) return 'Không thể bật đặt lịch khi thiếu: ' + m.map(k => FIELD_LABELS[k]).join(', ');
  }
  if (c.dailyCapacity !== null) {
    const total = (c.ticketQuota ?? 0) + (c.appointmentQuota ?? 0) + (c.walkInQuota ?? 0);
    if (total > c.dailyCapacity) return 'Tổng hạn mức (online + lịch hẹn + trực tiếp) vượt sức chứa ngày';
  }
  for (const key of ['slotMinutes', 'slotCapacity', 'maxActiveTicketsPerCitizen', 'maxActiveAppointmentsPerCitizen'] as const) {
    if (c[key] !== null && c[key]! < 1) return FIELD_LABELS[key] + ' phải từ 1 trở lên';
  }
  if (c.slotMinutes !== null && c.slotMinutes > 480) return 'Độ dài khung giờ tối đa 480 phút';
  return null;
}

/** Bảng chuyển trạng thái số thứ tự. Mọi chuyển trạng thái phải đi qua bảng này. */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  WAITING: ['CALLING', 'CANCELLED', 'TRANSFERRED'],
  CALLING: ['CALLING', 'SERVING', 'NO_SHOW', 'CANCELLED', 'TRANSFERRED'],
  SERVING: ['COMPLETED', 'TRANSFERRED'],
  COMPLETED: [], CANCELLED: [], NO_SHOW: [], TRANSFERRED: [],
};
export const ACTIVE_TICKET_STATUSES: TicketStatus[] = ['WAITING', 'CALLING', 'SERVING'];

export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'],
  CHECKED_IN: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [], CANCELLED: [], RESCHEDULED: [], NO_SHOW: [],
};
/** Lịch còn giữ chỗ/hạn mức (hủy và đổi lịch giải phóng; vắng mặt không giải phóng). */
export const HELD_APPOINTMENT_STATUSES: AppointmentStatus[] = ['CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW'];

export function canTransitionTicket(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_TRANSITIONS[from].includes(to);
}
export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}

// Bỏ các ký tự dễ nhầm (0/O, 1/I/L). 31 ký tự × 10 vị trí ≈ 49 bit.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LOOKUP_CODE_RE = /^[TA][A-HJKMNP-Z2-9]{10}$/;

/** Mã tra cứu ngẫu nhiên: 'T' = số thứ tự, 'A' = lịch hẹn. Không chứa dữ liệu cá nhân. */
export function generateLookupCode(kind: 'T' | 'A'): string {
  let out = kind as string;
  for (let i = 0; i < 10; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export function displayNumber(counterCode: string, sequence: number): string {
  return counterCode + '-' + String(sequence).padStart(3, '0');
}

/** Che số điện thoại, chỉ giữ 3 số cuối. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length <= 3 ? '***' : '*'.repeat(digits.length - 3) + digits.slice(-3);
}

export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** Khóa idempotency gắn với người thao tác để khóa của người này không va chạm với người khác. */
export function scopedIdempotencyKey(actorType: 'c' | 'a', actorId: string, key: string): string {
  return actorType + ':' + actorId + ':' + key;
}

