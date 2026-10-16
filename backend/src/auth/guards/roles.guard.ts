import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard kiểm tra vai trò cán bộ (AdminRole).
 *
 * - Nếu route không gắn @Roles() → cho qua (chỉ cần JWT hợp lệ).
 * - Nếu route gắn @Roles(...) → yêu cầu user.type === 'admin' và
 *   user.role nằm trong danh sách cho phép.
 *
 * Luôn sử dụng kèm JwtAuthGuard:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Không gắn @Roles() → không cần kiểm tra role
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || user.type !== 'admin') {
      throw new ForbiddenException('Chỉ cán bộ mới có quyền truy cập');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này',
      );
    }

    return true;
  }
}
