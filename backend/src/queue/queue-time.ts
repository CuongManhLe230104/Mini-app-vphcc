/**
 * Tiện ích ngày/giờ cho hàng chờ. Trung tâm hoạt động theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè).
 * Ngày phục vụ là chuỗi "YYYY-MM-DD"; giờ trong ngày là "HH:mm".
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function isValidTimeString(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

/** Ngày hiện tại theo giờ Việt Nam. */
export function vnToday(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Số phút kể từ 00:00 giờ Việt Nam. */
export function vnMinutesOfDay(now: Date = new Date()): number {
  const d = new Date(now.getTime() + VN_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function parseDateOnly(value: string): Date {
  if (!isValidDateString(value)) throw new Error('Ngày không hợp lệ');
  return new Date(value + 'T00:00:00.000Z');
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 0 = Chủ nhật … 6 = Thứ bảy. */
export function weekdayOf(dateStr: string): number {
  return parseDateOnly(dateStr).getUTCDay();
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateOnly(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}

export function daysBetween(fromStr: string, toStr: string): number {
  return Math.round((parseDateOnly(toStr).getTime() - parseDateOnly(fromStr).getTime()) / 86400000);
}

export function timeToMinutes(value: string): number {
  if (!isValidTimeString(value)) throw new Error('Giờ không hợp lệ');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

export function minutesToTime(minutes: number): string {
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

export interface TimeWindow { startTime: string; endTime: string }

/** Giờ hiện tại có nằm trong một khoảng hoạt động (bao gồm đầu, loại trừ cuối) không. */
export function isWithinWindows(windows: TimeWindow[], minutesOfDay: number): boolean {
  return windows.some(w => minutesOfDay >= timeToMinutes(w.startTime) && minutesOfDay < timeToMinutes(w.endTime));
}

/** Các giờ bắt đầu khung. Mỗi khung phải nằm trọn trong một khoảng hoạt động. */
export function generateSlots(windows: TimeWindow[], slotMinutes: number): string[] {
  if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) return [];
  const starts = new Set<number>();
  for (const w of windows) {
    const end = timeToMinutes(w.endTime);
    for (let t = timeToMinutes(w.startTime); t + slotMinutes <= end; t += slotMinutes) starts.add(t);
  }
  return [...starts].sort((a, b) => a - b).map(minutesToTime);
}

/** Kiểm tra danh sách khoảng giờ: hợp lệ, đầu < cuối, không chồng nhau trong cùng một thứ. */
export function validateScheduleWindows(windows: { weekday: number; startTime: string; endTime: string }[]): string | null {
  const byDay = new Map<number, [number, number][]>();
  for (const w of windows) {
    if (!Number.isInteger(w.weekday) || w.weekday < 0 || w.weekday > 6) return 'Thứ trong tuần phải từ 0 (Chủ nhật) đến 6 (Thứ bảy)';
    if (!isValidTimeString(w.startTime) || !isValidTimeString(w.endTime)) return 'Giờ phải có dạng HH:mm';
    const s = timeToMinutes(w.startTime), e = timeToMinutes(w.endTime);
    if (s >= e) return 'Giờ bắt đầu phải trước giờ kết thúc';
    const list = byDay.get(w.weekday) ?? [];
    if (list.some(([a, b]) => s < b && a < e)) return 'Các khoảng giờ trong cùng một ngày không được chồng nhau';
    list.push([s, e]);
    byDay.set(w.weekday, list);
  }
  return null;
}

