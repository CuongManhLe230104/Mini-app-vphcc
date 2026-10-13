# Kiến trúc hệ thống — Mini App Nghĩa Thành

## Tổng quan

Mini App Zalo cho Trung tâm Phục vụ hành chính công xã Nghĩa Thành.

## Sơ đồ lớp

```
[Zalo App] ←→ [Mini App React/Vite] ←→ [Backend NestJS] ←→ [PostgreSQL]
                                                          ←→ [S3 Storage]
                                                          ←→ [Hệ thống hồ sơ ngoài] (M6)
```

## Các thành phần

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Mini App | React 18 + Vite + ZaUI + Tailwind | Giữ nguyên nền tảng hiện có |
| Backend | Node.js + TypeScript + NestJS | Module hóa theo nghiệp vụ |
| Database | PostgreSQL + Prisma | Migration bảo toàn dữ liệu |
| File storage | S3-compatible | Ảnh, video, tài liệu |
| Admin | React + Vite | Trang quản trị cán bộ |

## Module backend

- `auth` — Xác thực Zalo người dân, đăng nhập cán bộ
- `center` — Banner, liên hệ, lịch làm việc, OA
- `procedures` — Thủ tục, lĩnh vực, biểu mẫu
- `content` — Tin tức, hướng dẫn, video, FAQ
- `notices` — Niêm yết và thời hạn công khai
- `feedback` — Tiếp nhận, phân công, trả lời
- `files` — Kiểm tra tải lên, lưu tệp, phân quyền
- `integrations` — Zalo và hệ thống hồ sơ bên ngoài
- `audit` — Nhật ký thao tác quan trọng

## Nguyên tắc thiết kế

- API tự xây dựng, không phải API Zalo có sẵn
- Tất cả danh sách có phân trang
- Lỗi trả về mã rõ ràng
- HTTPS + CORS đúng origin
- Bản đầu: một backend chia module (không microservices)

