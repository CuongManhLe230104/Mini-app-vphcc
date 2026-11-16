# Khảo sát & Thiết kế Đơn giản hóa Đặt lịch và Cấp số Online (Q0 — Q5)

Cập nhật: 13/11/2026  
Tài liệu tham chiếu: `ke-hoach-dat-lich-cap-so-online-don-gian.md`

---

## 1. Bảng phân loại thành phần (Q0): Giữ lại / Sửa / Ẩn / Bổ sung / Chuyển đổi dữ liệu

| Thành phần / Tệp | Hiện trạng trước khi sửa | Hành động | Chi tiết thay đổi trong phạm vi chức năng Đặt lịch & Cấp số |
|---|---|---|---|
| **Backend: Tạo lịch hẹn & cấp số ngay (`backend/src/queue/queue.service.ts`)** | `createAppointment` chỉ tạo bản ghi `Appointment` (`CONFIRMED`); người dân/cán bộ phải bấm `check-in` mới sinh `QueueTicket` (`displayNumber`). | **Sửa** | Trong cùng giao dịch có khóa `CounterDay` (`SELECT ... FOR UPDATE`), khi đặt lịch thành công sẽ đồng thời giữ chỗ khung giờ (`slotSeat`) **và** cấp ngay `QueueTicket` (`source: 'APPOINTMENT'`, `status: 'WAITING'`, `displayNumber` như `Q1-001`). Trả về cả `lookupCode` và `displayNumber` ngay lập tức. |
| **Backend: Thứ tự gọi số (`callNextTicket`, `getCounterBoard`)** | `callNextTicket` lấy vé `WAITING` theo `sequence ASC` trên toàn ngày mà chưa ưu tiên khung giờ (`slotStart`). | **Sửa** | Sắp xếp lượt chờ theo **Khung giờ (`slotStart`) tăng dần trước, sau đó đến Số thứ tự (`sequence`) tăng dần**. Không tự động gọi sớm lượt của khung giờ tương lai khi chưa tới giờ; giữ lại các lượt của khung giờ trước chưa được gọi để cán bộ xử lý (không tự động đánh `NO_SHOW` khi quầy trễ). |
| **Backend: Đồng bộ trạng thái 1-1 (`backend/src/queue/queue-common.ts`, `queue-rules.ts`)** | `transitionTicket` chỉ đồng bộ sang `Appointment` khi `Appointment.status === 'CHECKED_IN'`. | **Sửa** | Đồng bộ trạng thái 1-1 giữa `QueueTicket` và `Appointment` ngay cả khi `Appointment.status === 'CONFIRMED'` (vì không còn bước Check-in trung gian). Khi hủy lịch (`CONFIRMED` + vé `WAITING`), hủy đồng thời cả `Appointment` và `QueueTicket`, giải phóng `slotSeat` nhưng **không đánh lại số gọi của người khác**. |
| **Backend: Bảo vệ cấu hình & Bắt đầu/Tạm dừng nhận lịch (`updateCounter`, `setSchedules`, `addClosure`)** | Cho phép giảm `slotCapacity`/`appointmentQuota` hoặc thêm ngày đóng cửa mà chưa cảnh báo/chặn khi làm vượt số lịch đã đặt. | **Sửa / Bổ sung** | Bổ sung kiểm tra số lịch đã đặt (`CONFIRMED`/`CHECKED_IN`): chặn giảm `slotCapacity` hoặc `appointmentQuota` xuống dưới số lịch đã đặt trong các ngày tới; khi đóng/tạm dừng ngày phục vụ, trả kèm số lịch đã đặt bị ảnh hưởng (`affectedAppointmentsCount`) và **không tự hủy ngầm** lịch đã cấp số. |
| **Backend: Check-in cũ (`POST /appointments/:id/check-in`)** | Tạo vé mới khi bấm Check-in. | **Ẩn khỏi UI / Giữ tương thích API** | Nếu lịch hẹn đã có sẵn `QueueTicket` (được cấp ngay lúc đặt), endpoint trả về luôn vé đó (idempotent), không sinh vé thứ hai. Ẩn hoàn toàn nút Check-in khỏi giao diện người dân và màn hình chính của cán bộ quầy. |
| **Mini App: Điểm vào trang chủ (`src/pages/index.jsx`)** | Tách 2 nút riêng ("Lấy số" và "Đặt lịch"). | **Sửa** | Gộp thành một điểm vào rõ ràng: **"Đặt lịch đến Trung tâm"** (`/queue`). Các đường dẫn cũ (`?tab=ticket`, `?tab=appointment`) đều tự động mở vào cùng luồng đặt lịch thống nhất. |
| **Mini App: Màn hình Đặt lịch & Phiếu xác nhận (`src/pages/queue.jsx`)** | 3 tab ("Lấy số", "Đặt lịch", "Lịch sử/Tra cứu") dễ gây nhầm lẫn tạo 2 lượt đăng ký. | **Sửa** | Thu gọn còn 2 tab chính: **"Đặt lịch đến Trung tâm"** (luồng 3 bước: *Bước 1 Chọn nhu cầu -> Bước 2 Chọn lịch -> Bước 3 Xác nhận*) và **"Lịch hẹn của tôi"** (chia 2 mục: *Sắp tới* và *Lịch sử*, kèm tra cứu theo mã). Phiếu xác nhận hiển thị ngay **Số gọi đã cấp** + **Mã hẹn** + hướng dẫn *"Đến đúng khung giờ, trình phiếu tại quầy và chờ gọi số"*. |
| **Admin: Màn hình Cán bộ quầy (`admin/src/pages/QueuePage.jsx`)** | Có nút "Check-in & Cấp số" cho lịch hẹn; chữ nút "Bắt đầu phục vụ". | **Sửa / Ẩn** | Ẩn nút "Check-in & Cấp số". Hiển thị rõ: Quầy, Ngày & Khung giờ hiện tại, Số đang gọi/đang tiếp nhận, 5 nút thao tác (**Gọi tiếp**, **Gọi lại**, **Tiếp nhận**, **Hoàn tất**, **Vắng mặt**), danh sách lịch hôm nay sắp theo **Khung giờ -> Số gọi**, nhóm khung giờ sắp tới và nhóm đã xử lý. |
| **Admin: Màn hình Lịch phục vụ (`admin/src/pages/QueuePage.jsx`)** | Tách tab cấu hình quầy và lịch tuần rời rạc, chưa có bảng tính tự động năng lực phục vụ và 4 quầy mẫu theo lĩnh vực đã chốt. | **Sửa / Bổ sung** | Gộp thành màn hình **"Lịch phục vụ"** gồm: Cấu hình chung, Cấu hình theo 4 quầy (kèm nút khởi tạo nhanh 4 quầy chuẩn theo 4 nhóm lĩnh vực đã xác nhận với nhãn `[CẤU HÌNH THỬ]`), Bảng tính tự động năng lực phục vụ (tổng lượt lý thuyết, trần online, lượt trực tiếp còn lại), và Ngoại lệ theo ngày. |
| **Dữ liệu cũ & Tương thích ngược (`Q5`)** | Có thể tồn tại bản ghi `Appointment` (`CONFIRMED`) tạo trước khi nâng cấp chưa có `QueueTicket` gắn kèm. | **Chuyển đổi dữ liệu (Backfill)** | Tự động kiểm tra/backfill cấp `QueueTicket` (`WAITING`) cho các lịch `CONFIRMED` chưa có vé khi khởi chạy hoặc khi truy vấn/gọi số, đảm bảo không mất lịch cũ và không cần xóa bảng vật lý. |

---

## 2. Bảng ánh xạ trạng thái hiển thị thống nhất (Mục 8.2)

| Trạng thái hiển thị cho Người dân & Cán bộ | Trạng thái kỹ thuật (`Appointment.status` + `QueueTicket.status`) | Ý nghĩa nghiệp vụ |
|---|---|---|
| **Đã đặt lịch** | `Appointment: CONFIRMED` + `Ticket: WAITING` | Đã giữ khung giờ và đã có số gọi ngay khi đặt lịch. |
| **Đang gọi** | `Appointment: CONFIRMED/CHECKED_IN` + `Ticket: CALLING` | Cán bộ đang gọi số tại quầy (`callCount >= 1`). |
| **Đang tiếp nhận** | `Appointment: CHECKED_IN` + `Ticket: SERVING` | Người dân đã có mặt, cán bộ đang tiếp nhận và xử lý hồ sơ. |
| **Hoàn tất** | `Appointment: COMPLETED` + `Ticket: COMPLETED` | Đã phục vụ xong lượt. |
| **Đã hủy** | `Appointment: CANCELLED` + `Ticket: CANCELLED` | Người dân hủy trước giờ hẹn hoặc quản trị hủy có lý do (giải phóng chỗ trống khung giờ, không đổi số của người khác). |
| **Vắng mặt** | `Appointment: NO_SHOW` + `Ticket: NO_SHOW` | Đã gọi tại quầy nhưng người dân không có mặt khi cán bộ xác nhận vắng mặt. |
| **Chưa được phục vụ** *(nhãn cảnh báo khi quá khung giờ)* | `Appointment: CONFIRMED` + `Ticket: WAITING` (khung giờ `slotStart` đã qua) | Quầy đang xử lý chậm hơn dự kiến; lượt vẫn giữ nguyên trong danh sách chờ ưu tiên gọi tiếp, **không tự động chuyển sang Vắng mặt**. |

---

## 3. Cấu hình 4 quầy đã xác nhận & Các thông số chờ Trung tâm chốt chính thức (Mục 3 & Mục 4)

### 3.1. Danh sách 4 quầy đã xác nhận
1. **Quầy 1 (`Q1`)**: Tư pháp – hộ tịch (`30 phút/lượt`)
2. **Quầy 2 (`Q2`)**: Giấy phép kinh doanh, bao gồm đăng ký hộ kinh doanh – môi trường (`30 phút/lượt`)
3. **Quầy 3 (`Q3`)**: Đất đai – quy hoạch (`30 phút/lượt`)
4. **Quầy 4 (`Q4`)**: Văn hóa – giáo dục – y tế – thương binh và xã hội (`30 phút/lượt`)

### 3.2. Các thông số vận hành cấu hình linh hoạt (đang gắn nhãn `[CẤU HÌNH THỬ]` cho tới khi Trung tâm chốt)
- Giờ bắt đầu/kết thúc buổi sáng và buổi chiều nhận lịch online (mặc định thử nghiệm: Sáng `07:30–11:30`, Chiều `13:30–17:00`).
- Các ngày làm việc nhận lịch trong tuần (mặc định thử nghiệm: Thứ 2 đến Thứ 6, sáng Thứ 7 tùy cấu hình).
- Số vị trí/cán bộ tiếp nhận đồng thời của từng quầy (`slotCapacity`, mặc định `1`).
- Số lượt đặt online tối đa cho mỗi quầy trong một buổi/ngày (`appointmentQuota`, cấu hình giữ lại tỷ lệ cho người dân đến trực tiếp).
- Đặt trước tối đa bao nhiêu ngày (`maxAdvanceDays`, mặc định `7` ngày) và khóa đặt trước giờ hẹn bao nhiêu phút (`leadMinutes`, mặc định `30` phút).
- Quy định gọi lại bao nhiêu lần trước khi đánh dấu `Vắng mặt`.
