import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** Chỉ cho người dân đã xác thực Zalo (JWT type=citizen). Luôn dùng sau JwtAuthGuard. */
@Injectable()
export class CitizenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user || user.type !== 'citizen') throw new ForbiddenException('Cần đăng nhập bằng tài khoản Zalo');
    return true;
  }
}

