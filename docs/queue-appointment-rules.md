# Lấy số thứ tự và đặt lịch hẹn — quy tắc nghiệp vụ

Nguồn yêu cầu: mục 18 của [`ke-hoach-mini-app-nghia-thanh.md`](../ke-hoach-mini-app-nghia-thanh.md).
Trạng thái tài liệu: **BẢN NHÁP — chờ Trung tâm xác nhận**. Không giá trị nào dưới đây được dùng ở production khi chưa có chữ ký xác nhận.

## 1. Nguyên tắc triển khai

- Một backend, một database cho Mini App, Admin và luồng từ OA. Backend là nơi **duy nhất** cấp số, giữ chỗ, kiểm tra hạn mức, đổi trạng thái.
- Mọi quy tắc nằm trong **cấu hình** (bảng `ServiceCounter` và các bảng liên quan). Một quầy mới tạo luôn ở trạng thái **chưa kích hoạt**; chức năng chỉ mở cho người dân khi đủ cấu hình bắt buộc (mục 3).
- Hệ thống **không** tự đặt giá trị nghiệp vụ. Ô để trống nghĩa là "chưa được duyệt", và chức năng phụ thuộc vào ô đó sẽ không mở.

## 2. Bảng cấu hình (mỗi quầy)

| Nhóm | Trường | Bắt buộc để mở | Ghi chú |
|---|---|---|---|
| Định danh | `code` (≤ 6 ký tự A–Z, 0–9), `name` | — | `code` là tiền tố số hiển thị, ví dụ `A-007` |
| Trạng thái | `isActive`, `ticketEnabled`, `appointmentEnabled` | — | Mặc định tắt cả ba |
| Lĩnh vực → quầy | bảng `CounterField` (một lĩnh vực chỉ thuộc **một** quầy) | Có | Thủ tục thừa hưởng quầy của lĩnh vực |
| Giờ hoạt động | `CounterSchedule`: thứ trong tuần + khoảng `HH:mm–HH:mm`, nhiều khoảng/ngày | Có | Ví dụ ca sáng, ca chiều |
| Ngày nghỉ | `CounterClosure`: ngày + ghi chú | — | Ngày nghỉ chặn cấp số và đặt lịch |
| Sức chứa/ngày | `dailyCapacity` | Không | Nếu đặt, tổng (số online + trực tiếp + lịch giữ chỗ) không vượt mức này |
| Hạn mức lấy số online | `ticketQuota` | Có (để lấy số) | |
| Hạn mức lịch hẹn | `appointmentQuota` | Có (để đặt lịch) | |
| Chỗ trực tiếp | `walkInQuota` | Không | Để trống = không giới hạn lượt cán bộ cấp tại quầy |
| Độ dài khung | `slotMinutes` | Có (để đặt lịch) | |
| Chỗ mỗi khung | `slotCapacity` | Có (để đặt lịch) | |
| Đặt trước tối đa | `bookingMaxDaysAhead` | Có (để đặt lịch) | |
| Đặt trước tối thiểu | `bookingMinLeadMinutes` | Không | Để trống = 0 |
| Giới hạn mỗi người | `maxActiveTicketsPerCitizen`, `maxActiveAppointmentsPerCitizen` | Có | |

Ràng buộc kiểm tra khi lưu: `ticketQuota + appointmentQuota + walkInQuota ≤ dailyCapacity` (ô trống tính 0); khoảng giờ hợp lệ, không chồng nhau.

## 3. Điều kiện "sẵn sàng"

- **Lấy số** mở khi: quầy `isActive` + `ticketEnabled` + có lĩnh vực + có giờ hoạt động + `ticketQuota` + `maxActiveTicketsPerCitizen`.
- **Đặt lịch** mở khi: quầy `isActive` + `appointmentEnabled` + có lĩnh vực + có giờ hoạt động + `appointmentQuota`, `slotMinutes`, `slotCapacity`, `bookingMaxDaysAhead`, `maxActiveAppointmentsPerCitizen`.
- Bật `ticketEnabled`/`appointmentEnabled` khi thiếu trường bắt buộc bị backend từ chối (400, nêu rõ trường thiếu).

## 4. Hành vi mặc định đang được triển khai (GIẢ ĐỊNH — cần xác nhận)

Đây là quyết định kỹ thuật tối thiểu để hệ thống chạy được. Mỗi mục là một câu hỏi ở mục 5.

| # | Hành vi | Lý do chọn |
|---|---|---|
| G1 | Một hàng phục vụ cho mỗi quầy, thứ tự **theo thứ tự cấp số/check-in (FIFO)**. Lịch hẹn khi check-in nhận số kế tiếp, **không** được ưu tiên hơn người đang chờ | Quy tắc ưu tiên chưa có; FIFO là trung lập nhất |
| G2 | Số thứ tự đánh từ 1 **theo từng ngày và từng quầy**, không dùng lại | Mục 18.1 |
| G3 | Chỉ cấp số online trong khoảng giờ hoạt động của quầy (không có giờ mở/đóng lấy số riêng) | Mặc định chặt, tránh cấp quá |
| G4 | Hủy phiếu hoặc lịch **giải phóng** hạn mức/chỗ. Vắng mặt (`NO_SHOW`) **không** giải phóng | Mục 18.10 |
| G5 | Đặt lịch **xác nhận ngay**, không qua bước cán bộ duyệt | Cấu trúc cho phép thêm bước duyệt sau |
| G6 | Người dân hủy phiếu khi phiếu còn ở trạng thái chờ. Hủy lịch bất kỳ lúc nào trước khi check-in. Không có giờ chốt hủy | Chưa có chính sách |
| G7 | Đổi lịch = hủy lịch cũ (`RESCHEDULED`) + tạo lịch mới trong một giao dịch, giữ liên kết lịch sử | Mục 18.5 |
| G8 | Không tự động chuyển "vắng mặt", không tự xóa lịch. Cán bộ quyết định | Mục 18.4 |
| G9 | Phiếu `NO_SHOW` không tự quay lại hàng chờ; cần cấp số mới | Chưa có quy tắc đến trễ |
| G10 | Chuyển quầy: phiếu cũ → `TRANSFERRED`, tạo phiếu mới ở **cuối** hàng quầy đích, bắt buộc có lý do | Chưa có quy tắc ưu tiên khi chuyển |
| G11 | Một cán bộ có thể gọi nhiều số cùng lúc (nhiều cửa sổ/quầy) | Không giới hạn khi chưa có yêu cầu |
| G12 | Quyền cấu hình (quầy, giờ, hạn mức, ngày nghỉ, phân công cán bộ): **chỉ `SUPER_ADMIN`**. Quyền vận hành quầy: `SUPER_ADMIN` và `COUNTER_STAFF` được phân công | Phân quyền tối thiểu |
| G13 | Cán bộ quầy thấy họ tên và số điện thoại **che bớt** (chỉ 3 số cuối) của lịch hẹn trong quầy mình | Tối thiểu hóa dữ liệu cá nhân |
| G14 | Không hiển thị thời gian chờ ước tính. Chỉ hiển thị "còn N người phía trước" (số thật) | Mục 18.3: chỉ ước tính khi có dữ liệu tin cậy |
| G15 | Giờ áp dụng: múi giờ Việt Nam (UTC+7) | Một Trung tâm duy nhất |

## 5. Câu hỏi cần Trung tâm xác nhận

Mỗi câu trả lời cần người có thẩm quyền ký xác nhận trước pilot.

1. **Danh mục quầy**: có bao nhiêu quầy, tên, phụ trách. Lĩnh vực nào thuộc quầy nào. Có thủ tục nào cần quầy khác với lĩnh vực của nó không.
2. **Giờ hoạt động** từng quầy theo thứ trong tuần; ngày nghỉ lễ đã biết; giờ mở/đóng lấy số có khác giờ làm việc không.
3. **Sức chứa**: mỗi quầy/ngày phục vụ tối đa bao nhiêu lượt; chia bao nhiêu cho lấy số online, đặt lịch, khách trực tiếp; chỗ chưa dùng có được chuyển giữa các nhóm không.
4. **Đặt lịch**: xác nhận ngay hay cần cán bộ duyệt; đặt trước tối đa mấy ngày, tối thiểu bao lâu; độ dài khung giờ; số lịch tối đa mỗi khung.
5. **Số thứ tự**: đánh lại theo ngày hay liên tục; có hàng riêng cho từng quầy không; **có ưu tiên** (lịch hẹn, người cao tuổi, người khuyết tật…) không và theo quy định nào; cán bộ nhập số cho khách trực tiếp thế nào.
6. **Chính sách ngoại lệ**: đến trễ bao lâu thì xem là vắng; vắng mấy lần thì hạn chế; thời hạn chót hủy/đổi lịch; khi gọi mà không có mặt thì gọi lại mấy lần; quy tắc chuyển quầy; hồ sơ thiếu; đóng quầy đột xuất.
7. **Dữ liệu cá nhân**: có bắt buộc số điện thoại không; ai được xem; **thời hạn lưu** (hiện hệ thống chưa tự xóa dữ liệu); quy trình xử lý yêu cầu xóa/đính chính.
8. **OA**: dùng nút/menu dẫn vào Mini App (đang làm) hay muốn gửi tin nhắc/xác nhận (cần xác minh quyền, quota, chi phí).
9. **Mất mạng/mất điện**: quy trình giấy tạm thời và cách nhập bù vào hệ thống (xem mục 7).

## 6. Dữ liệu cá nhân thu thập

| Dữ liệu | Mục đích | Ai xem | Lưu |
|---|---|---|---|
| Zalo ID (qua xác thực Zalo, không do client tự khai) | Gắn phiếu/lịch với đúng người, chống xem dữ liệu người khác | Chỉ backend | *Chờ xác nhận* |
| Họ tên (người dân nhập) | Cán bộ gọi và đối chiếu | Người dân; cán bộ quầy; quản trị viên | *Chờ xác nhận* |
| Số điện thoại (tùy chọn) | Liên hệ khi cần | Người dân; cán bộ quầy thấy 3 số cuối | *Chờ xác nhận* |

- Mã tra cứu là chuỗi ngẫu nhiên; không chứa dữ liệu cá nhân.
- Bảng công khai (số đang gọi, số người chờ) chỉ có số và số lượng.
- Log thông thường không ghi họ tên, số điện thoại, token, mã tra cứu.

## 7. Mất mạng hoặc mất điện (bản nháp)

Chờ Trung tâm duyệt. Đề xuất để thảo luận:
1. Khi hệ thống không truy cập được, cán bộ cấp số giấy theo mẫu của quầy, ghi giờ.
2. Khi hệ thống phục hồi, cán bộ cấp số trực tiếp (`WALK_IN`) cho người còn chờ theo thứ tự giấy.
3. Người dân đã có phiếu/lịch trên Mini App xuất trình mã tra cứu; cán bộ tra bằng mã.
4. Backend không tự suy đoán trạng thái đã mất; mọi chuyển trạng thái ghi `QueueEvent` kèm thời điểm thực tế của máy chủ.

## 8. Áp dụng migration và khôi phục

- Migration `20261029000000_queue_appointment` chỉ **thêm** bảng/giá trị enum, không xóa hay sửa dữ liệu hiện có.
- Trước khi áp dụng: sao lưu `mysqldump` (xem [`deployment.md`](deployment.md)).
- Áp dụng: `cd backend && npm run prisma:deploy`.
- Khôi phục: chạy [`queue-appointment-rollback.sql`](queue-appointment-rollback.sql) (xóa các bảng mới theo thứ tự ngược; chỉ thu hồi giá trị enum `COUNTER_STAFF` khi không còn tài khoản dùng) rồi `DELETE FROM _prisma_migrations WHERE migration_name = '20261029000000_queue_appointment'`; hoặc khôi phục từ bản sao lưu.

