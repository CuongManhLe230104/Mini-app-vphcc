# Triển khai — Mini App Nghĩa Thành

## Môi trường

| Môi trường | Dữ liệu | Quyền hạn |
|---|---|---|
| Local | Dữ liệu mẫu (mock) | Đầy đủ cho dev |
| Staging | Dữ liệu thử | Hạn chế |
| Production | Dữ liệu thật | Chặt chẽ |

## Quy tắc Git

- `main`: bản ổn định
- Nhánh theo việc: `feature/home-page`, `feature/content-api`, `feature/feedback`
- PR nhỏ, xem diff và chạy kiểm tra trước khi merge
- Không để nhiều trợ lý sửa cùng file đồng thời

## Không đưa lên Git

- `.env` và bất kỳ file chứa secret
- `node_modules/`
- Token, API key
- Dữ liệu người dân

## Backend (M2)

- Docker trên hạ tầng được đơn vị phê duyệt
- HTTPS + CORS đúng origin và môi trường
- Hạ tầng/tên miền: **cần chốt với đơn vị trước M2**

## Phát hành Zalo (M5)

- Không tự phát hành nếu chưa được yêu cầu rõ ràng
- Cần: dữ liệu thật, công văn, kiểm thử, duyệt, sao lưu
- Kiểm thử SDK trên Zalo thật, không chỉ localhost

## CI/CD

- GitHub Actions: kiểm tra PR và build

