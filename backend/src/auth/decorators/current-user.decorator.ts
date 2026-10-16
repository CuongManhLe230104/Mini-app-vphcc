import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator lấy user hiện tại từ request (đã qua JWT verify).
 *
 * Sử dụng: @CurrentUser() user: JwtPayload
 * Hoặc:   @CurrentUser('sub') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
