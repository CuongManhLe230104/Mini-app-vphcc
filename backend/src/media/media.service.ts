import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { OutputInfo } from 'sharp';
// Keep the existing CommonJS backend compatible with sharp's dual ESM/CJS package.
const sharp: typeof import('sharp').default = require('sharp');

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_FILENAME = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/;
export interface UploadedImage { buffer: Buffer; size: number; mimetype: string }

@Injectable()
export class MediaService {
  private readonly directory: string;
  constructor(config: ConfigService) {
    this.directory = join(resolve(config.get<string>('UPLOAD_DIR') || './uploads'), 'images');
  }

  async saveImage(file?: UploadedImage) {
    if (!file?.buffer?.length) throw new BadRequestException('Vui lòng chọn một ảnh');
    if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Ảnh phải có dung lượng tối đa 5 MB');
    }
    let output: { data: Buffer; info: OutputInfo };
    try {
      const image = sharp(file.buffer, { limitInputPixels: 40000000, failOn: 'warning' });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) {
        throw new Error('Unsupported format');
      }
      // Decode and re-encode actual image content; do not trust the filename or MIME type.
      // Default output strips EXIF/location metadata; rotation respects camera orientation.
      output = await image.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    } catch {
      throw new BadRequestException('Ảnh không hợp lệ. Chọn ảnh tĩnh JPG, PNG hoặc WebP, tối đa 40 megapixel');
    }
    const filename = randomUUID() + '.webp';
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, filename), output.data, { flag: 'wx' });
    return { url: '/api/v1/media/images/' + filename, width: output.info.width,
      height: output.info.height, size: output.data.length };
  }

  async readImage(filename: string) {
    if (!IMAGE_FILENAME.test(filename)) throw new NotFoundException('Không tìm thấy ảnh');
    try { return await readFile(join(this.directory, filename)); }
    catch (error: any) {
      if (error.code === 'ENOENT') throw new NotFoundException('Không tìm thấy ảnh');
      throw error;
    }
  }
}
