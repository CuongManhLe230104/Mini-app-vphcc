# Phân quyền — Mini App Nghĩa Thành

## Người dân (Mini App)

| Quyền | Điều kiện |
|---|---|
| Xem nội dung công khai (thủ tục, tin, niêm yết, FAQ) | Không cần đăng nhập |
| Gửi phản ánh | Xác thực Zalo |
| Xem lịch sử phản ánh của mình | Xác thực Zalo |
| Tra cứu hồ sơ | Xác thực + được cấp quyền khi có API |

## Cán bộ (Admin)

| Vai trò | Quyền |
|---|---|
| Biên tập viên | Soạn bài, tạo nháp |
| Người duyệt | Duyệt và đăng bài |
| Cán bộ xử lý | Tiếp nhận và trả lời phản ánh |
| Quản trị viên | Tất cả quyền trên + quản lý tài khoản |

## Nguyên tắc

- Kiểm tra quyền tại **backend** trên từng tài nguyên — không chỉ ở frontend
- Không tin user ID do client tự khai — backend xác minh qua Zalo access token
- Người A không được xem phản ánh/tệp của người B
- Biên tập viên không tự thực hiện quyền của người duyệt
- Từ chối quyền Zalo vẫn xem được nội dung công khai

## Quyền Zalo cần xin

| Quyền | Khi nào xin |
|---|---|
| Tên/ảnh (getUserInfo) | Khi thực sự cần, không bắt buộc để đọc công khai |
| Số điện thoại (getPhoneNumber) | Khi gửi phản ánh (nếu cần) |
| Ảnh (openMediaPicker) | Khi đính kèm ảnh phản ánh |

- Không buộc cấp điện thoại, vị trí hoặc quan tâm OA để đọc nội dung công khai
- Xử lý luồng khi người dùng từ chối quyền

