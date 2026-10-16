import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ZaloAuthDto } from './dto/zalo-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Đăng nhập Admin (cán bộ)
   */
  async adminLogin(dto: AdminLoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { username: dto.username },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }

    const isMatch = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }

    const payload = {
      sub: admin.id,
      username: admin.username,
      fullName: admin.fullName,
      role: admin.role,
      type: 'admin',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      admin: {
        id: admin.id,
        username: admin.username,
        fullName: admin.fullName,
        role: admin.role,
      },
    };
  }

  /**
   * Xác thực công dân qua Zalo Access Token
   * Backend gọi Zalo Graph API để lấy ID và thông tin thật, không tin client gửi ID
   */
  async zaloAuth(dto: ZaloAuthDto) {
    let zaloProfile: { id: string; name?: string; picture?: { data?: { url?: string } } };
    try {
      const res = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
        headers: { access_token: dto.accessToken },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        throw new Error('Zalo API returned error');
      }
      zaloProfile = await res.json();
    } catch (err) {
      throw new UnauthorizedException('Không thể xác thực token Zalo hoặc token đã hết hạn');
    }

    if (typeof zaloProfile?.id !== 'string' || !zaloProfile.id) {
      throw new UnauthorizedException('Token Zalo không hợp lệ');
    }

    const avatarUrl = zaloProfile.picture?.data?.url;

    // Tìm hoặc tạo Citizen
    const citizen = await this.prisma.citizen.upsert({
      where: { zaloId: zaloProfile.id },
      update: {
        name: zaloProfile.name || undefined,
        avatar: avatarUrl || undefined,
      },
      create: {
        zaloId: zaloProfile.id,
        name: zaloProfile.name || 'Người dân',
        avatar: avatarUrl,
      },
    });

    const payload = {
      sub: citizen.id,
      zaloId: citizen.zaloId,
      name: citizen.name,
      type: 'citizen',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      citizen: {
        id: citizen.id,
        name: citizen.name,
        avatar: citizen.avatar,
      },
    };
  }

  async validateUser(payload: any) {
    if (!payload || typeof payload.sub !== 'string' || !payload.sub.trim()) return null;
    if (payload.type === 'admin') {
      return this.prisma.admin.findFirst({
        where: { id: payload.sub, isActive: true },
        select: { id: true, username: true, fullName: true, role: true, isActive: true },
      });
    }
    if (payload.type === 'citizen') {
      return this.prisma.citizen.findUnique({
        where: { id: payload.sub },
        select: { id: true, zaloId: true, name: true, phone: true, avatar: true },
      });
    }
    return null;
  }
}

