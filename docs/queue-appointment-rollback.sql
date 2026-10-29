-- Khôi phục migration 20261029000000_queue_appointment
-- CHỈ chạy khi cần quay lại; sao lưu trước. Thao tác này XÓA dữ liệu phiếu/lịch hẹn đã tạo.
-- Thứ tự: bảng phụ thuộc trước, bảng gốc sau.

DROP TABLE IF EXISTS `QueueEvent`;
DROP TABLE IF EXISTS `QueueTicket`;
DROP TABLE IF EXISTS `Appointment`;
DROP TABLE IF EXISTS `CounterDay`;
DROP TABLE IF EXISTS `CounterStaff`;
DROP TABLE IF EXISTS `CounterClosure`;
DROP TABLE IF EXISTS `CounterSchedule`;
DROP TABLE IF EXISTS `CounterField`;
DROP TABLE IF EXISTS `ServiceCounter`;

-- Chỉ thu hồi giá trị enum khi KHÔNG còn tài khoản COUNTER_STAFF
-- (kiểm tra: SELECT COUNT(*) FROM `Admin` WHERE `role` = 'COUNTER_STAFF';)
-- ALTER TABLE `Admin` MODIFY `role` ENUM('SUPER_ADMIN', 'EDITOR', 'REVIEWER', 'HANDLER') NOT NULL;

-- Sau đó xóa bản ghi migration để Prisma coi như chưa áp dụng:
-- DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261029000000_queue_appointment';

