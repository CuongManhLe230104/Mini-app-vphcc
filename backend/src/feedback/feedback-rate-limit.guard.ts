import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FEEDBACK_LIMITS } from './feedback-rules';

/**
 * Giới hạn tần suất gửi góp ý theo địa chỉ IP trong bộ nhớ tiến trình.
 * - Ngưỡng mặc định: 5 yêu cầu / phút / IP (cấu hình qua FEEDBACK_RATE_LIMIT_PER_MIN, FEEDBACK_RATE_WINDOW_MS).
 * - Không khóa cứng theo số điện thoại do người gửi tự nhập để tránh người khác cố tình nhập SĐT gây cản trở.
 * - Trên VPS chạy sau reverse proxy (Nginx / Cloudflare), cấu hình TRUST_PROXY để req.ip phản ánh đúng IP nguồn.
 */
@Injectable()
export class FeedbackRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();
  private lastSweep = Date.now();

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const rawLimit = Number(
      this.config.get<string>('FEEDBACK_RATE_LIMIT_PER_MIN') ??
        FEEDBACK_LIMITS.DEFAULT_RATE_LIMIT_PER_MIN,
    );
    const rawWindow = Number(
      this.config.get<string>('FEEDBACK_RATE_WINDOW_MS') ??
        FEEDBACK_LIMITS.DEFAULT_RATE_WINDOW_MS,
    );
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.trunc(rawLimit) : FEEDBACK_LIMITS.DEFAULT_RATE_LIMIT_PER_MIN;
    const windowMs = Number.isFinite(rawWindow) && rawWindow >= 1000 ? Math.trunc(rawWindow) : FEEDBACK_LIMITS.DEFAULT_RATE_WINDOW_MS;

    const clientIp = String(req.ip || req.socket?.remoteAddress || 'unknown').trim();
    const now = Date.now();
    this.sweep(now, windowMs);

    const recent = (this.hits.get(clientIp) ?? []).filter(ts => now - ts < windowMs);
    if (recent.length >= limit) {
      this.hits.set(clientIp, recent);
      throw new HttpException(
        {
          code: 'FEEDBACK_RATE_LIMITED',
          message:
            'Bạn đã gửi yêu cầu vượt quá giới hạn tạm thời. Vui lòng đợi khoảng 1 phút rồi thử lại.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.hits.set(clientIp, recent);
    return true;
  }

  private sweep(now: number, windowMs: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [ip, timestamps] of this.hits.entries()) {
      if (!timestamps.some(ts => now - ts < windowMs * 2)) {
        this.hits.delete(ip);
      }
    }
  }
}
