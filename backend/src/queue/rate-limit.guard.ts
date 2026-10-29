import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export interface RateLimitOptions { limit: number; windowMs: number; by?: 'ip' | 'user' }
const KEY = 'queue:rate-limit';
export const RateLimit = (options: RateLimitOptions) => SetMetadata(KEY, options);

/**
 * Giới hạn tần suất trong bộ nhớ của một tiến trình backend.
 * Giới hạn: nếu chạy nhiều bản backend, mỗi bản đếm riêng; khi mở rộng cần kho dùng chung (Redis).
 * Đặt TRUST_PROXY=true khi backend đứng sau reverse proxy/tunnel để lấy đúng IP người dùng.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private hits = new Map<string, number[]>();
  private lastSweep = Date.now();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(KEY, [context.getHandler(), context.getClass()]);
    if (!options) return true;
    const req = context.switchToHttp().getRequest();
    const who = options.by === 'user' && req.user?.id ? 'u:' + req.user.id : 'ip:' + (req.ip || 'unknown');
    const key = who + '|' + context.getClass().name + '.' + context.getHandler().name;
    const now = Date.now();
    this.sweep(now, options.windowMs);
    const recent = (this.hits.get(key) ?? []).filter(t => now - t < options.windowMs);
    if (recent.length >= options.limit) {
      this.hits.set(key, recent);
      throw new HttpException({ code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  private sweep(now: number, windowMs: number) {
    if (now - this.lastSweep < 60000) return;
    this.lastSweep = now;
    for (const [k, v] of this.hits) if (!v.some(t => now - t < windowMs * 2)) this.hits.delete(k);
  }
}

