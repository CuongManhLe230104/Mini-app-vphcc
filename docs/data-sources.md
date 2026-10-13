# Nguồn dữ liệu — Mini App Nghĩa Thành

## Trạng thái kết nối

> ⚠️ Chưa xác nhận các kết nối hệ thống bên ngoài. Bản đầu dùng dữ liệu mẫu.

## Nguồn dữ liệu theo chức năng

| Chức năng | Nguồn hiện tại | Kế hoạch |
|---|---|---|
| Thủ tục hành chính | Dữ liệu mẫu (mock) | Đồng bộ nguồn chính thức khi có API |
| Tin tức / Hướng dẫn | Backend nội bộ | Tích hợp xuất bản OA nếu cần |
| Niêm yết | Backend nội bộ | Đồng bộ hệ thống khác nếu có |
| Tra cứu hồ sơ | Mở cổng chính thức | Tra cứu trong app khi được cấp API |
| Nộp hồ sơ | Mở cổng nộp trực tuyến | Tích hợp sâu khi có API và thỏa thuận |
| Phản ánh | Cần chốt phương án | Cổng DVCQG hoặc tiếp nhận riêng |

## Quyết định còn cần chốt

1. Nguồn chính thức cho thủ tục là gì?
2. API tra cứu hồ sơ — đơn vị nào cấp?
3. Phản ánh: Cổng DVCQG hay tiếp nhận riêng?
4. OA ID, hotline, địa chỉ, lịch làm việc chính thức?

## Quy tắc

- Không bịa dữ liệu thủ tục, phí, thời hạn, liên hệ
- Dữ liệu mẫu để trong `src/mocks/` và có nhãn rõ ràng
- Lỗi kết nối nguồn ngoài phải báo "chưa tra cứu được", không trả kết quả giả

