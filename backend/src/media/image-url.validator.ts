import { isURL, ValidateBy } from 'class-validator';

export function isPostImageUrl(value: unknown): boolean {
  return typeof value === 'string' && (
    /^\/api\/v1\/media\/images\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/.test(value) ||
    isURL(value, { protocols: ['https'], require_protocol: true, require_valid_protocol: true })
  );
}
export function IsPostImageUrl() {
  return ValidateBy({ name: 'isPostImageUrl', validator: {
    validate: isPostImageUrl,
    defaultMessage: () => 'Ảnh phải được tải lên hệ thống hoặc là đường dẫn HTTPS hợp lệ',
  } });
}
