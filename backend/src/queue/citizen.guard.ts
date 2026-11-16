import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

const SESSION_KEY_REGEX = /^[a-zA-Z0-9_-]{16,64}$/;

/**
 * Xác thực người dân cho phân hệ Đặt lịch & Cấp số:
 * 1. Ưu tiên JWT công dân (`Authorization: Bearer <jwt>`) đã xác minh qua Zalo Graph API.
 * 2. Khi người dùng từ chối cấp quyền Zalo hoặc chạy trên môi trường Zalo Studio / trình duyệt
 *    (`Authorization: CitizenSession <sessionKey>`), gắn phiên thiết bị ổn định với bản ghi Citizen
 *    để đảm bảo đặt lịch, xem "Lịch hẹn của tôi" và kiểm tra quyền sở hữu hoạt động thông suốt.
 */
@Injectable()
export class CitizenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Nếu đã được guard trước đó gán user
    if (req.user) {
      if (req.user.type !== 'citizen') {
        throw new ForbiddenException('Cần đăng nhập bằng tài khoản người dân');
      }
      return true;
    }

    const authHeader = String(req.headers?.authorization || '').trim();
    if (!authHeader) {
      throw new UnauthorizedException('Vui lòng xác thực phiên người dân trước khi thực hiện thao tác');
    }

    if (/^bearer\s+/i.test(authHeader)) {
      const token = authHeader.replace(/^bearer\s+/i, '').trim();
      if (!token) {
        throw new UnauthorizedException('Token xác thực không hợp lệ');
      }
      let payload: any;
      try {
        payload = await this.jwtService.verifyAsync(token);
      } catch {
        throw new UnauthorizedException('Phiên đăng nhập đã hết hạn hoặc không hợp lệ');
      }
      if (!payload || payload.type !== 'citizen') {
        throw new ForbiddenException('Cần đăng nhập bằng tài khoản người dân');
      }
      const user = await this.authService.validateUser(payload);
      if (!user) {
        throw new UnauthorizedException('Không tìm thấy thông tin người dân');
      }
      req.user = { ...user, type: 'citizen' };
      return true;
    }

    if (/^citizensession\s+/i.test(authHeader)) {
      const sessionKey = authHeader.replace(/^citizensession\s+/i, '').trim();
      if (!SESSION_KEY_REGEX.test(sessionKey)) {
        throw new UnauthorizedException('Mã phiên thiết bị không hợp lệ');
      }

      const rawName = typeof req.body?.contactName === 'string' ? req.body.contactName.trim().slice(0, 100) : '';
      const rawPhone = typeof req.body?.contactPhone === 'string' ? req.body.contactPhone.trim().slice(0, 20) : '';
      const zaloId = `session:${sessionKey}`;

      const citizen = await this.prisma.citizen.upsert({
        where: { zaloId },
        update: {
          ...(rawName ? { name: rawName } : {}),
          ...(rawPhone ? { phone: rawPhone } : {}),
        },
        create: {
          zaloId,
          name: rawName || 'Người dân',
          phone: rawPhone || null,
        },
        select: { id: true, zaloId: true, name: true, phone: true, avatar: true },
      });

      req.user = { ...citizen, type: 'citizen' };
      return true;
    }

    throw new UnauthorizedException('Phương thức xác thực không được hỗ trợ');
  }
}


