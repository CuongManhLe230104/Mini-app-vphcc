# Tiêu chí nghiệm thu — Mini App Nghĩa Thành

Dựa trên mục 13 của kế hoạch.

## Bảo mật & Phân quyền

- [ ] Người A không xem được phản ánh/tệp của người B
- [ ] Biên tập viên không tự thực hiện quyền của người duyệt
- [ ] Từ chối quyền Zalo vẫn xem được nội dung công khai
- [ ] Backend xác minh quyền — không tin client tự khai

## Tính toàn vẹn dữ liệu

- [ ] Gửi nhiều lần không tạo phản ánh trùng (idempotency)
- [ ] Mất mạng không báo gửi thành công
- [ ] Bài chưa duyệt/niêm yết chưa đến hạn không lộ qua API công khai
- [ ] Nguồn tra cứu lỗi không trả kết quả giả

## Vận hành

- [ ] Khôi phục được từ bản sao lưu

## Giao diện & Trải nghiệm

- [ ] Kiểm thử Android và iOS
- [ ] Kiểm thử tài khoản ngoài nhóm developer/admin
- [ ] Kiểm tra điện thoại màn hình nhỏ
- [ ] Kiểm tra chữ dài (overflow)
- [ ] Kiểm tra dữ liệu rỗng (empty state)
- [ ] Kiểm tra tài liệu PDF trên Android/iOS
- [ ] Kiểm tra mạng chậm (loading state)

