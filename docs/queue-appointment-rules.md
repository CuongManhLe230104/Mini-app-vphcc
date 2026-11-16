# Quy tắc Nghiệp vụ: Đặt lịch và Cấp số Online Đơn giản hóa (Q0 — Q5)

Cập nhật: 13/11/2026  
Đơn vị: Trung tâm Phục vụ hành chính công xã Nghĩa Thành  
Tài liệu chuẩn: `ke-hoach-dat-lich-cap-so-online-don-gian.md`

---

## 1. Luồng chuẩn thống nhất (1 luồng đăng ký, không có bước Check-in)

1. **Người dân chọn nhu cầu**: Chọn lĩnh vực (và thủ tục cụ thể nếu biết) trên Zalo Mini App. Hệ thống tự động xác định quầy phục vụ tương ứng.
2. **Người dân chọn lịch**: Chọn ngày làm việc và khung giờ còn nhận lịch (`30 phút/lượt`).
3. **Cấp số gọi ngay khi đặt lịch thành công**:
   - Trong cùng một giao dịch cơ sở dữ liệu có khóa `CounterDay` (`SELECT ... FOR UPDATE`), hệ thống đồng thời giữ chỗ khung giờ (`slotSeat`) trên `Appointment` **và** cấp ngay số gọi (`QueueTicket` với `displayNumber`, ví dụ `Q1-001`, trạng thái `WAITING`).
   - Người dân nhận ngay **Phiếu xác nhận** có cả **Số gọi tại quầy (`displayNumber`)** và **Mã hẹn (`lookupCode`)**.
4. **Đến Trung tâm và chờ gọi số**:
   - Người dân đến đúng khung giờ đã chọn, trình phiếu xác nhận tại quầy và chờ cán bộ gọi số.
   - **Không có bước bấm "Đã đến" / "Check-in"** từ phía người dân lẫn cán bộ quầy.
5. **Cán bộ quầy xử lý trên một màn hình**:
   - 5 thao tác chính: **Gọi tiếp** (`call-next`), **Gọi lại** (`recall`), **Tiếp nhận** (`serve`), **Hoàn tất** (`complete`), **Vắng mặt** (`no-show`).

---

## 2. Danh sách 4 quầy phục vụ theo lĩnh vực đã xác nhận (Mục 3)

| Mã quầy | Tên quầy | Nhóm lĩnh vực phụ trách | Thời lượng mặc định |
|---|---|---|---|
| **Q1** | Quầy 1 — Tư pháp – hộ tịch | Tư pháp – hộ tịch, chứng thực | `30 phút/lượt` |
| **Q2** | Quầy 2 — Kinh doanh – môi trường | Giấy phép kinh doanh, đăng ký hộ kinh doanh – môi trường | `30 phút/lượt` |
| **Q3** | Quầy 3 — Đất đai – quy hoạch | Đất đai – quy hoạch – xây dựng | `30 phút/lượt` |
| **Q4** | Quầy 4 — Văn hóa – giáo dục – y tế – LĐTBXH | Văn hóa – giáo dục – y tế – thương binh và xã hội | `30 phút/lượt` |

- Mỗi lĩnh vực tại một thời điểm chỉ thuộc **một quầy** (`CounterField.fieldId @unique`).
- Quản trị viên (`SUPER_ADMIN`) có thể khởi tạo/đồng bộ nhanh 4 quầy chuẩn qua nút **"⚡ Khởi tạo / Đồng bộ 4 Quầy chuẩn (Q1–Q4)"** trên màn hình **Lịch phục vụ** (`POST /api/v1/queue/admin/setup-standard-counters`).

---

## 3. Quy tắc Sắp hàng, Gọi số và Trạng thái (Mục 7 & Mục 8)

### 3.1. Thứ tự gọi số ưu tiên theo Khung giờ trước, Số gọi sau
- Vì người dân có thể đặt khung giờ buổi chiều trước khi người khác đặt khung giờ buổi sáng trong cùng một ngày, danh sách chờ gọi của quầy luôn sắp xếp theo:
  1. **Khung giờ hẹn (`slotStart`) tăng dần**
  2. **Số thứ tự (`sequence`) tăng dần**
- Nút **Gọi tiếp** (`POST /api/v1/queue/admin/counters/:id/call-next`):
  - Chỉ gọi lượt đang chờ thuộc **khung giờ hiện tại hoặc khung giờ trước chưa được gọi** (`slotStart <= giờ hiện tại`).
  - **Không tự động gọi sớm** lượt của khung giờ tương lai.
  - Nếu khung giờ trước vẫn còn lượt chưa gọi do quầy xử lý chậm hơn dự kiến: giữ các lượt đó ở đầu danh sách chờ xử lý với nhãn cảnh báo **`Chưa được phục vụ`** (`UNSERVED_PAST_SLOT`), **không tự động chuyển sang `Vắng mặt`**.
  - Khóa chống gọi chồng: mỗi vị trí tiếp nhận không thể gọi hai số cùng lúc (`POSITION_BUSY`).

### 3.2. Quy tắc Hủy lịch và Đổi lịch
- Người dân hoặc quản trị viên chỉ được hủy/đổi lịch khi lượt chưa chuyển sang `Đang gọi`, `Đang tiếp nhận` hoặc `Hoàn tất`.
- Khi hủy lịch:
  - Giải phóng chỗ trong khung giờ (`slotSeat = null`) và hoàn lại hạn mức đặt lịch online của ngày/khung giờ đó.
  - Hủy đồng thời phiếu số (`QueueTicket.status = 'CANCELLED'`).
  - **Không đánh lại số gọi của những người dân khác** đã được cấp trong ngày.

---

## 4. Phương án Tương thích ngược, Backfill & Rollback (Q5 — Mục 12)

### 4.1. Giữ nguyên cấu trúc bảng vật lý 1-1
- Giữ nguyên hai bảng `Appointment` và `QueueTicket` với quan hệ 1-1 (`QueueTicket.appointmentId -> Appointment.id`).
- Không xóa bảng, không xóa cột cũ; mọi dữ liệu lịch sử (`QueueEvent`, `AuditLog`, `Appointment`, `QueueTicket`) được bảo toàn.

### 4.2. Tự động Backfill lịch hẹn cũ chưa có số gọi
- Nếu trong cơ sở dữ liệu có các bản ghi `Appointment` (`status = 'CONFIRMED'`) được tạo trước khi nâng cấp và chưa có `QueueTicket` gắn kèm:
  - Hàm `ensureAppointmentTicketsForCounterDate(counterId, dateStr)` tự động chạy trong giao dịch có khóa `CounterDay` khi truy vấn `getCounterBoard`, `callNextTicket`, `getMyItems`, hoặc `lookupByCode`, cấp bổ sung `QueueTicket` (`WAITING`) theo thứ tự `slotStart ASC, createdAt ASC`.
- Endpoint cũ `POST /api/v1/queue/admin/appointments/:id/check-in` vẫn hoạt động tương thích ngược (idempotent): nếu lịch hẹn đã có sẵn `QueueTicket`, trả về luôn vé đó mà không tạo vé thứ hai.

### 4.3. Sao lưu & Khôi phục (Rollback)
- Trước khi cập nhật môi trường thật, sao lưu cơ sở dữ liệu MySQL (`mysqldump mini_app_nghia_thanh > backup_queue_before_q1.sql`).
- Vì không có migration phá hủy (destructive schema change), nếu cần quay lại phiên bản giao diện cũ, toàn bộ bản ghi `Appointment` và `QueueTicket` đã tạo vẫn tương thích hoàn toàn.
