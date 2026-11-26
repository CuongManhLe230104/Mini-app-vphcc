import { createHash, randomInt } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { CitizenFeedbackTarget } from '@prisma/client';

/**
 * Các giới hạn kỹ thuật ban đầu cho chức năng Gửi góp ý.
 * Tập trung thành hằng số để dễ điều chỉnh khi Trung tâm thay đổi quy định.
 */
export const FEEDBACK_LIMITS = {
  FULL_NAME_MIN: 2,
  FULL_NAME_MAX: 100,
  CONTENT_MIN: 10,
  CONTENT_MAX: 3000,
  NOTE_MIN: 2,
  NOTE_MAX: 2000,
  RESOLUTION_MIN: 5,
  RESOLUTION_MAX: 2000,
  REOPEN_REASON_MIN: 5,
  REOPEN_REASON_MAX: 1000,
  IDEMPOTENCY_KEY_MIN: 8,
  IDEMPOTENCY_KEY_MAX: 128,
  EXCERPT_MAX_LENGTH: 120,
  DEFAULT_PAGE_SIZE: 15,
  MAX_PAGE_SIZE: 50,
  DEFAULT_RATE_LIMIT_PER_MIN: 5,
  DEFAULT_RATE_WINDOW_MS: 60_000,
} as const;

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9._:-]{8,128}$/;
const CONTROL_CHARS_NO_NEWLINE = /[\u0000-\u001F\u007F]/;
const CONTROL_CHARS_WITH_NEWLINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/**
 * Chuẩn hóa và kiểm tra họ tên người gửi:
 * - Bỏ khoảng trắng đầu/cuối, gộp khoảng trắng liên tiếp.
 * - Hỗ trợ đầy đủ tiếng Việt Unicode (không chặn bằng biểu thức chỉ cho phép ASCII).
 * - Độ dài sau chuẩn hóa: 2–100 ký tự, phải có ít nhất một chữ cái.
 */
export function validateAndNormalizeFullName(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new BadRequestException({ field: 'fullName', message: 'Vui lòng nhập họ và tên.' });
  }
  const normalized = raw.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new BadRequestException({ field: 'fullName', message: 'Vui lòng nhập họ và tên.' });
  }
  if (CONTROL_CHARS_NO_NEWLINE.test(normalized)) {
    throw new BadRequestException({ field: 'fullName', message: 'Họ và tên chứa ký tự không hợp lệ.' });
  }
  if (
    normalized.length < FEEDBACK_LIMITS.FULL_NAME_MIN ||
    normalized.length > FEEDBACK_LIMITS.FULL_NAME_MAX
  ) {
    throw new BadRequestException({
      field: 'fullName',
      message: `Họ và tên cần từ ${FEEDBACK_LIMITS.FULL_NAME_MIN} đến ${FEEDBACK_LIMITS.FULL_NAME_MAX} ký tự.`,
    });
  }
  if (!/\p{L}/u.test(normalized)) {
    throw new BadRequestException({
      field: 'fullName',
      message: 'Họ và tên phải chứa chữ cái hợp lệ.',
    });
  }
  return normalized;
}

/**
 * Chuẩn hóa số điện thoại Việt Nam:
 * - Bỏ khoảng trắng, dấu chấm, dấu gạch ngang, ngoặc đơn.
 * - Hỗ trợ đầu số 0... hoặc +84... (quy đổi thống nhất về 0...).
 * - Chấp nhận số di động 10 số (03, 05, 07, 08, 09) và số cố định Việt Nam (02... 10–11 số).
 */
export function normalizeVietnamesePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let cleaned = raw.trim().replace(/[\s.\-()]/g, '');
  if (!cleaned) return null;

  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  }

  const isMobile = /^0[35789]\d{8}$/.test(cleaned);
  const isLandline = /^02\d{8,9}$/.test(cleaned);
  if (!isMobile && !isLandline) {
    return null;
  }
  return cleaned;
}

export function validateAndNormalizePhone(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new BadRequestException({
      field: 'phone',
      message: 'Vui lòng nhập số điện thoại liên hệ.',
    });
  }
  const normalized = normalizeVietnamesePhone(raw);
  if (!normalized) {
    throw new BadRequestException({
      field: 'phone',
      message: 'Số điện thoại không đúng định dạng Việt Nam (bắt đầu bằng 0 hoặc +84).',
    });
  }
  return normalized;
}

/**
 * Kiểm tra và chuẩn hóa nội dung góp ý (10–3000 ký tự sau khi bỏ khoảng trắng đầu/cuối).
 */
export function validateAndNormalizeContent(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new BadRequestException({
      field: 'content',
      message: 'Vui lòng nhập nội dung góp ý.',
    });
  }
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    throw new BadRequestException({
      field: 'content',
      message: 'Vui lòng nhập nội dung góp ý.',
    });
  }
  if (CONTROL_CHARS_WITH_NEWLINE.test(normalized)) {
    throw new BadRequestException({
      field: 'content',
      message: 'Nội dung góp ý chứa ký tự điều khiển không hợp lệ.',
    });
  }
  if (
    normalized.length < FEEDBACK_LIMITS.CONTENT_MIN ||
    normalized.length > FEEDBACK_LIMITS.CONTENT_MAX
  ) {
    throw new BadRequestException({
      field: 'content',
      message: `Nội dung góp ý cần từ ${FEEDBACK_LIMITS.CONTENT_MIN} đến ${FEEDBACK_LIMITS.CONTENT_MAX} ký tự.`,
    });
  }
  return normalized;
}

export function validateOptionalIdempotencyKey(raw?: string): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw new BadRequestException('Khóa chống gửi trùng (Idempotency-Key) không hợp lệ.');
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!IDEMPOTENCY_KEY_REGEX.test(trimmed)) {
    throw new BadRequestException(
      `Khóa chống gửi trùng cần từ ${FEEDBACK_LIMITS.IDEMPOTENCY_KEY_MIN}–${FEEDBACK_LIMITS.IDEMPOTENCY_KEY_MAX} ký tự chữ/số hợp lệ.`,
    );
  }
  return trimmed;
}

export function computeFeedbackPayloadHash(payload: {
  fullName: string;
  phoneNormalized: string;
  target: CitizenFeedbackTarget;
  content: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        fullName: payload.fullName,
        phoneNormalized: payload.phoneNormalized,
        target: payload.target,
        content: payload.content,
      }),
    )
    .digest('hex');
}

/**
 * Sinh mã góp ý duy nhất dạng GY-YYMMDD-XXXXXX (ngẫu nhiên an toàn, không suy ra dữ liệu cá nhân).
 */
export function generateFeedbackCode(now: Date = new Date()): string {
  const vnTime = new Date(now.getTime() + 7 * 3600_000);
  const yy = String(vnTime.getUTCFullYear()).slice(-2);
  const mm = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vnTime.getUTCDate()).padStart(2, '0');
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `GY-${yy}${mm}${dd}-${rand}`;
}

/**
 * Che một phần số điện thoại khi hiển thị ở danh sách Admin (VD: 0912345678 -> 091****678).
 */
export function maskFeedbackPhone(phone: string): string {
  if (!phone || phone.length < 7) return '***';
  const prefix = phone.slice(0, 3);
  const suffix = phone.slice(-3);
  const hiddenCount = Math.max(3, phone.length - 6);
  return `${prefix}${'*'.repeat(hiddenCount)}${suffix}`;
}

/**
 * Rút gọn nội dung góp ý để hiển thị trên danh sách Admin.
 */
export function excerptFeedbackContent(
  content: string,
  maxLength: number = FEEDBACK_LIMITS.EXCERPT_MAX_LENGTH,
): string {
  const singleLine = String(content || '').replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLength) return singleLine;
  return singleLine.slice(0, maxLength).trimEnd() + '…';
}
