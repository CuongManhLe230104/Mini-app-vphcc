import { Controller, Get, Header, Param, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MediaService, MAX_IMAGE_BYTES, UploadedImage } from './media.service';

@Controller('media/images')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.EDITOR)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 2 },
  }))
  upload(@UploadedFile() file?: UploadedImage) { return this.media.saveImage(file); }

  @Get(':filename')
  @Header('X-Content-Type-Options', 'nosniff')
  async read(@Param('filename') filename: string) {
    return new StreamableFile(await this.media.readImage(filename), { type: 'image/webp' });
  }
}
