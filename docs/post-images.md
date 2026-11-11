# Ảnh đại diện bài viết

- Admin/biên tập viên chọn ảnh từ máy trong form soạn bài, xem trước, thay hoặc gỡ ảnh; bấm Lưu nháp rồi gửi duyệt như trước.
- API `POST /api/v1/media/images` nhận multipart với trường `file`, yêu cầu JWT admin và vai trò SUPER_ADMIN hoặc EDITOR.
- Tối đa 5 MB; chỉ ảnh tĩnh JPEG, PNG, WebP. Backend giải mã nội dung thực, giới hạn 40 megapixel, tự xoay theo EXIF, thu nhỏ tối đa 1600 × 1600 và chuyển WebP. Metadata ảnh không được giữ lại.
- Tệp nằm trong `UPLOAD_DIR/images` (mặc định `backend/uploads/images` khi chạy từ backend). MySQL chỉ lưu đường dẫn `/api/v1/media/images/<uuid>.webp` trong `thumbnail`; không cần migration.
- `GET /api/v1/media/images/:filename` phục vụ ảnh công khai bằng mã ngẫu nhiên, không có danh sách tệp. Không tải tài liệu riêng tư vào chức năng này.
- Mini App ghép đường dẫn ảnh với origin API đã cấu hình bằng `VITE_API_BASE_URL`; ảnh HTTPS cũ vẫn được hỗ trợ.
- Khi deploy backend, giữ thư mục UPLOAD_DIR trên ổ lưu trữ bền vững hoặc volume Docker; sao lưu thư mục này cùng MySQL. Nếu chạy nhiều bản backend, cần dùng chung kho ảnh.
- Reverse proxy phải chuyển `/api/v1/media/images` tới backend, cho phép multipart tối thiểu 6 MB và phục vụ qua HTTPS. Giữ backend hoạt động để ảnh truy cập được từ điện thoại.
- Ảnh tải lên trước khi lưu nháp. Hủy form/gỡ ảnh/thay ảnh không xóa tệp cũ vì bài đang công khai hoặc bản sửa có thể vẫn tham chiếu. Hiện chưa có tác vụ dọn ảnh không còn được sử dụng.
- Phạm vi hiện tại: một ảnh đại diện mỗi bài; chưa có trình soạn thảo chèn nhiều ảnh giữa nội dung.
