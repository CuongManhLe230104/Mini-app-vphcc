# Hướng dẫn cấu hình và sử dụng chức năng Gửi góp ý & Tổng hợp Excel

Đơn vị: Trung tâm Phục vụ hành chính công xã Nghĩa Thành  
Cập nhật: 26/11/2026

---

## 1. Luồng nghiệp vụ tinh gọn

1. **Trên Zalo Mini App (`/feedback`)**:
   - Người dân vào mục **Gửi góp ý** tại Trang chủ và chỉ cần nhập 3 thông tin bắt buộc:
     - **Họ và tên** (`2–100` ký tự, tiếng Việt Unicode).
     - **Số điện thoại** (định dạng Việt Nam bắt đầu bằng `0` hoặc `+84`, chuẩn hóa về `0xxxxxxxxx`, trạng thái `UNVERIFIED`).
     - **Nội dung góp ý** (`10–3000` ký tự — góp ý chung về Trung tâm, Mini App hoặc bất kỳ nội dung nào cần hoàn thiện).
   - Hệ thống cấp **Mã góp ý (`GY-...`)** ngay sau khi lưu thành công.
2. **Trên Trang Quản trị Admin (`/feedback`)**:
   - **Tất cả chuyên viên, công chức, cán bộ** có tài khoản đang hoạt động trên trang Admin đều xem được danh sách và chi tiết nội dung góp ý để nắm bắt và chủ động điều chỉnh, cải thiện.
   - **Quản trị viên (`SUPER_ADMIN`)** có thêm chức năng **Tổng hợp & Xuất file Excel (`.xlsx`)** toàn bộ góp ý hoặc theo khoảng ngày (`Từ ngày` — `Đến ngày`) mà không cần cài thêm phần mềm phụ trợ.

---

## 2. API

| API | Mục đích | Quyền truy cập |
|---|---|---|
| `POST /api/v1/feedback` | Người dân gửi góp ý mới | Công khai (giới hạn `5 lần/phút/IP`, chống gửi trùng `Idempotency-Key`) |
| `GET /api/v1/admin/feedback` | Danh sách phân trang + số liệu tổng hợp (`totalAll`, `todayCount`, `last7DaysCount`, `thisMonthCount`) | Cán bộ, chuyên viên, quản trị viên đã đăng nhập |
| `GET /api/v1/admin/feedback/:id` | Xem chi tiết nội dung góp ý | Cán bộ, chuyên viên, quản trị viên đã đăng nhập |
| `GET /api/v1/admin/feedback/export` | Xuất báo cáo tổng hợp định dạng Excel `.xlsx` | Chỉ `SUPER_ADMIN` |

---

## 3. Bảo vệ dữ liệu & An toàn file Excel

- Số điện thoại ở bảng danh sách được che một phần (`093****147`), khi mở chi tiết gắn nhãn rõ: *“Thông tin do người gửi cung cấp — Số điện thoại chưa xác thực”*.
- File `.xlsx` xuất ra tự động vô hiệu hóa các chuỗi mở đầu bằng `=`, `+`, `-`, `@` để chống lỗi thực thi công thức độc hại (Spreadsheet Formula Injection) khi mở trên Microsoft Excel.
- Không ghi họ tên, số điện thoại hay nội dung góp ý vào nhật ký hệ thống (`AuditLog` hoặc console log).
