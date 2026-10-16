import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ZaloAuthDto } from './dto/zalo-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Xác thực qua Zalo Access Token */
  @Post('zalo')
  @HttpCode(HttpStatus.OK)
  async zaloAuth(@Body() dto: ZaloAuthDto) {
    return this.authService.zaloAuth(dto);
  }

  /** Đăng nhập cho cán bộ / admin */
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  /** Lấy thông tin tài khoản hiện tại */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return user;
  }
}

