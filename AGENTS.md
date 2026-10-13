# AGENTS.md — Quy tắc cho trợ lý lập trình

Dự án: Zalo Mini App Nghĩa Thành  
Đơn vị: Trung tâm Phục vụ hành chính công xã Nghĩa Thành  
Cập nhật: 13/10/2026

## Quy tắc bắt buộc

1. Đọc `package.json` và cấu trúc thư mục trước khi sửa bất kỳ file nào.
2. Giữ nguyên cấu hình Zalo; không tự đổi framework hoặc nâng hàng loạt thư viện.
3. Tiếng Việt rõ ràng trong giao diện, ưu tiên trải nghiệm trên điện thoại.
4. Không bịa thủ tục, phí, thời hạn, liên hệ hoặc trạng thái hồ sơ — chỉ dùng dữ liệu được cung cấp hoặc dữ liệu mẫu có nhãn.
5. Dữ liệu mẫu (mock) phải tách riêng trong `src/mocks/` và có nhãn `[DỮ LIỆU MẪU]` rõ ràng.
6. Không đưa khóa bí mật, token dịch vụ, mật khẩu vào frontend hoặc Git (`.env` không được commit).
7. Backend xác minh danh tính người dùng; không tin user ID do client tự khai.
8. Kiểm tra quyền tại backend trên từng tài nguyên cá nhân và thao tác quản trị.
9. Chỉ báo gửi thành công khi backend đã xác nhận lưu — không giả lập thành công.
10. Không tự tạo API giả mạo cổng dịch vụ công hoặc hệ thống hồ sơ bên ngoài.
11. Bài viết/nội dung công khai phải qua quy trình duyệt thống nhất; nội dung chưa duyệt không lộ qua API công khai.
12. Xin quyền Zalo đúng thời điểm (khi thực sự cần); xử lý luồng khi người dùng từ chối quyền.
13. Không ghi secrets, nội dung phản ánh và thông tin cá nhân vào log thông thường.
14. Không sửa việc ngoài phạm vi được giao; không chỉnh sửa, di chuyển hoặc xóa tài liệu trong `sources/`.
15. Không tự push, merge, deploy production hoặc phát hành lên Zalo nếu chưa được yêu cầu rõ ràng.
16. Báo cáo rõ: thay đổi đã thực hiện, kiểm tra đã chạy và giới hạn chưa kiểm tra được.

## Cấu trúc thư mục

```
src/
├── pages/          # Màn hình (route)
├── components/     # Component dùng chung
├── features/       # Logic và UI theo nghiệp vụ
│   ├── procedures/ # Thủ tục hành chính
│   ├── posts/      # Tin tức, hướng dẫn, video
│   ├── notices/    # Niêm yết
│   ├── feedback/   # Phản ánh kiến nghị
│   └── account/    # Của tôi
├── services/
│   ├── api/        # Gọi backend — fetch tập trung, xử lý lỗi thống nhất
│   └── zalo/       # Đóng gói zmp-sdk, phân biệt browser/Zalo
├── assets/         # Hình ảnh, icon tĩnh
└── mocks/          # Dữ liệu mẫu có nhãn, tách khỏi dữ liệu thật
backend/            # NestJS backend (M2)
admin/              # Trang quản trị (M2)
docs/               # Tài liệu kiến trúc và quy trình
```

## Lộ trình

| Mốc | Nội dung |
|---|---|
| M0 | Cấu trúc, rule, môi trường ✅ |
| M1 | Trang chủ và các màn hình (mock data) |
| M2 | Backend, database, quản trị nội dung |
| M3 | SDK Zalo (OA, gọi điện, xác thực) |
| M4 | Phản ánh riêng (nếu được chọn) |
| M5 | Phát hành |
| M6 | Hồ sơ API, AI hỏi đáp, thông báo |

## Lưu ý kỹ thuật

- Gọi API tập trung qua `services/api/` — không gọi `fetch` rải rác trong component.
- Zalo SDK đóng gói qua `services/zalo/` — không gọi `zmp-sdk` trực tiếp trong màn hình.
- Màn hình phải có đủ trạng thái: đang tải, rỗng, lỗi, mất mạng, thành công.
- Vùng bấm tối thiểu 44×44px; chữ nội dung tối thiểu 16px.
- Kiểm thử thực tế trên Zalo thật (Android/iOS), không chỉ localhost.

