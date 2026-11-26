# KẾ HOẠCH TRIỂN KHAI CHỨC NĂNG GỬI GÓP Ý

## 1. Mục tiêu

Triển khai chức năng “Gửi góp ý” trong Zalo Mini App của Trung tâm
Phục vụ hành chính công xã Nghĩa Thành, đồng thời bổ sung chức năng
tiếp nhận và xử lý góp ý trong trang admin.

Hãy đọc dự án, triển khai code và kiểm thử theo kế hoạch này.
Không chỉ trả về đề xuất hoặc code mẫu.

## 2. Yêu cầu đã thống nhất

- Góp ý gửi riêng cho trung tâm, không hiển thị công khai.
- Góp ý có thể liên quan đến trung tâm, Mini App hoặc vấn đề khác.
- Không có đánh giá sao.
- Không bắt buộc đăng nhập.
- Bắt buộc nhập họ tên, số điện thoại và nội dung.
- Không tự lấy tên, ảnh đại diện hoặc số điện thoại từ Zalo.
- Chưa triển khai OTP trong phiên bản này.
- Số điện thoại do người dân nhập phải được ghi nhận là chưa xác thực.
- Không thông báo rằng danh tính người gửi đã được xác minh.
- Không tích hợp gửi SMS hoặc tin nhắn Zalo tự động.
- Không tự deploy lên VPS hoặc publish Mini App.

## 3. Nguyên tắc làm việc

1. Đọc AGENTS.md, package.json, cấu trúc frontend, admin và backend.
2. Kiểm tra database, cơ chế migration, phân quyền và giao diện hiện có.
3. Tái sử dụng thành phần và quy ước đang có trong dự án.
4. Không đổi framework hoặc nâng cấp hàng loạt thư viện.
5. Không thay đổi các chức năng không liên quan.
6. Không reset database, xóa dữ liệu hoặc chạy seed demo trên dữ liệu thật.
7. Không đưa thông tin bí mật vào code frontend, Git hoặc log.
8. Phân quyền phải được kiểm tra ở backend, không chỉ ẩn nút trên giao diện.
9. Kiểm tra trạng thái Git trước khi sửa; giữ nguyên thay đổi đang có của người dùng.

## 4. Bảng triển khai

| Giai đoạn | Công việc | Điều kiện hoàn thành |
|---|---|---|
| 1. Khảo sát | Xác định vị trí menu, cách gọi API, thông báo lỗi, role và migration | Có danh sách file cần sửa và phương án phù hợp dự án |
| 2. Database | Tạo dữ liệu góp ý và lịch sử xử lý bằng migration | Không ảnh hưởng dữ liệu hiện có |
| 3. API người dân | Tiếp nhận, kiểm tra dữ liệu và cấp mã góp ý | Gửi hợp lệ được lưu đúng, dữ liệu sai bị từ chối |
| 4. API admin | Danh sách, chi tiết, phân công và xử lý | Chỉ tài khoản đúng quyền được sử dụng |
| 5. Mini App | Biểu mẫu và thông báo gửi thành công | Gửi được trên điện thoại, lỗi mạng không làm mất nội dung |
| 6. Admin | Danh sách, bộ lọc, chi tiết, trạng thái và ghi chú | Cán bộ xử lý được đầy đủ luồng |
| 7. Bảo vệ dữ liệu | Giới hạn gửi, chống gửi trùng, kiểm soát quyền và log | Không lộ dữ liệu qua API công khai |
| 8. Kiểm thử | Chạy các tình huống nghiệp vụ và kiểm tra build | Có kết quả kiểm tra thực tế |
| 9. Bàn giao | Tài liệu migration, cấu hình, vận hành và giới hạn | Người quản trị biết cách dùng và triển khai |

## 5. Giao diện người dân

### Điểm truy cập

Thêm mục “Gửi góp ý” vào vị trí phù hợp trong giao diện hiện tại.
Không tạo nhiều điểm truy cập trùng lặp nếu không cần thiết.

### Biểu mẫu

| Trường | Quy định |
|---|---|
| Họ và tên | Bắt buộc, 2–100 ký tự sau khi bỏ khoảng trắng đầu/cuối; hỗ trợ tiếng Việt |
| Số điện thoại | Bắt buộc; hỗ trợ định dạng Việt Nam bắt đầu bằng 0 hoặc +84; chuẩn hóa trước khi lưu |
| Góp ý về | Trung tâm / Mini App / Khác; mặc định Trung tâm |
| Nội dung | Bắt buộc, 10–3000 ký tự sau khi bỏ khoảng trắng đầu/cuối |

Các giới hạn trên là giới hạn kỹ thuật ban đầu, đặt thành hằng số
để dễ điều chỉnh.

Không yêu cầu chọn quầy, tải ảnh hoặc nhập địa chỉ trong phiên bản này.
Không chặn tên hợp lệ chỉ vì không khớp biểu thức chỉ cho phép chữ ASCII.

### Thông báo trước khi gửi

“Họ tên và số điện thoại được dùng để tiếp nhận, xử lý và liên hệ
phản hồi góp ý. Thông tin chỉ được cung cấp cho cán bộ có quyền
xử lý, không hiển thị công khai.”

### Nút gửi

- Kiểm tra dữ liệu và hiển thị lỗi tại đúng trường.
- Khi đang gửi: vô hiệu hóa nút và hiển thị trạng thái.
- Khi gửi thất bại: giữ nguyên nội dung để người dân thử lại.
- Chỉ thông báo thành công sau khi backend xác nhận đã lưu.
- Không tự động lưu họ tên, số điện thoại và nội dung vào bộ nhớ
  lâu dài trên thiết bị trong phiên bản này.

### Sau khi gửi

Hiển thị:

“Trung tâm đã tiếp nhận góp ý của bạn.
Mã góp ý: [mã do backend trả về].
Vui lòng lưu mã này để tiện liên hệ với trung tâm.”

Không hứa thời hạn phản hồi cụ thể khi trung tâm chưa thống nhất.
Không khẳng định sẽ có tin nhắn tự động.

## 6. Dữ liệu

Thiết kế tên bảng, enum và quan hệ theo quy ước dự án.

### Bản ghi góp ý

- ID nội bộ.
- Mã góp ý duy nhất.
- Họ tên.
- Số điện thoại đã chuẩn hóa.
- Trạng thái xác thực số điện thoại: UNVERIFIED.
- Nhóm góp ý: CENTER / MINI_APP / OTHER.
- Nội dung.
- Trạng thái xử lý: NEW / IN_PROGRESS / RESOLVED.
- Người được phân công, có thể để trống.
- Kết quả xử lý, có thể để trống.
- Thời gian tạo, cập nhật và hoàn tất.
- Khóa chống tạo trùng theo thiết kế tiếp nhận.

### Lịch sử xử lý

- Góp ý liên quan.
- Người thực hiện.
- Hành động.
- Trạng thái trước và sau nếu có.
- Ghi chú nội bộ.
- Thời gian thực hiện.

Lịch sử phải được ghi bởi backend và không cho sửa tùy ý qua giao diện.
Thay đổi trạng thái và ghi lịch sử cần thực hiện nhất quán trong transaction.

Không tạo quan hệ bắt buộc với tài khoản người dân vì luồng này
không yêu cầu đăng nhập.

Mã góp ý không được xem là mật khẩu hay bằng chứng sở hữu.
Không tạo API công khai cho phép nhập mã rồi đọc họ tên, số điện thoại,
nội dung hoặc ghi chú nội bộ.

## 7. API

Đường dẫn dưới đây là đề xuất. Điều chỉnh theo quy ước dự án,
tránh xung đột với route hiện có.

| API | Mục đích | Quyền |
|---|---|---|
| POST /api/v1/feedback | Gửi góp ý | Công khai, có giới hạn tần suất |
| GET /api/v1/admin/feedback | Danh sách có phân trang và bộ lọc | Người được cấp quyền |
| GET /api/v1/admin/feedback/:id | Xem chi tiết | Người được cấp quyền theo phạm vi |
| PATCH /api/v1/admin/feedback/:id/assignment | Phân công người xử lý | Quản trị viên |
| PATCH /api/v1/admin/feedback/:id/status | Cập nhật trạng thái, kết quả | Người được cấp quyền theo phạm vi |
| POST /api/v1/admin/feedback/:id/notes | Thêm ghi chú nội bộ | Người được cấp quyền theo phạm vi |

Yêu cầu:

- Validate toàn bộ dữ liệu tại backend.
- Chặn client tự đặt trạng thái, người xử lý hoặc trạng thái xác thực.
- API gửi thành công chỉ trả thông tin xác nhận cần thiết, như mã góp ý
  và thời gian tiếp nhận.
- Không trả lại toàn bộ bản ghi chứa dữ liệu cá nhân qua API công khai.
- Danh sách admin có phân trang, giới hạn số lượng bản ghi mỗi trang.
- Xử lý rõ trường hợp không có quyền hoặc bản ghi không tồn tại.
- Cập nhật phân công và trạng thái phải kiểm tra quyền trên từng bản ghi.

## 8. Chống spam và gửi trùng

- Giới hạn tần suất tại backend, không chỉ phía giao diện.
- Ngưỡng ban đầu đề xuất: 5 yêu cầu/phút/IP, cho phép cấu hình.
- Không coi địa chỉ IP là danh tính vì nhiều người có thể dùng chung Wi-Fi.
- Không khóa cứng người dân chỉ dựa trên số điện thoại tự nhập:
  người khác có thể nhập số đó để gây cản trở.
- Dùng khóa gửi duy nhất cho một lần gửi để yêu cầu lặp do nhấn nút
  hoặc mạng chập chờn không tạo nhiều bản ghi.
- Cùng khóa và cùng dữ liệu phải trả về kết quả đã tạo;
  cùng khóa nhưng dữ liệu khác phải bị từ chối.
- Khi chạy sau proxy trên VPS, cấu hình nhận diện IP đúng và chỉ tin
  các proxy được cấu hình.
- Không thêm Redis hoặc CAPTCHA mặc định nếu hạ tầng hiện tại chưa cần.
- Ghi rõ giới hạn của cơ chế chống spam khi bàn giao.

## 9. Giao diện admin

### Danh sách

Hiển thị:

- Mã góp ý.
- Họ tên.
- Số điện thoại được che một phần ở danh sách.
- Nhóm góp ý.
- Nội dung rút gọn.
- Thời gian gửi.
- Trạng thái.
- Người được phân công.
- Nút xem chi tiết.

Bộ lọc:

- Khoảng ngày.
- Nhóm góp ý.
- Trạng thái.
- Người được phân công.
- Tìm theo mã góp ý.

Không cần tìm bằng số điện thoại hoặc xuất Excel trong bản đầu tiên.

### Chi tiết

Hiển thị đầy đủ thông tin cho người có quyền:

- Họ tên và số điện thoại.
- Nhãn “Thông tin do người gửi cung cấp — Số điện thoại chưa xác thực”.
- Nội dung góp ý.
- Ngày giờ gửi.
- Người được phân công.
- Trạng thái.
- Ghi chú, kết quả và lịch sử xử lý.

Nội dung người dân nhập phải được hiển thị như văn bản an toàn,
không thực thi HTML hoặc script.

### Quy trình trạng thái

NEW → IN_PROGRESS → RESOLVED

- Bắt đầu xử lý: chuyển sang IN_PROGRESS.
- Hoàn tất: yêu cầu nhập kết quả xử lý trước khi chuyển RESOLVED.
- Quản trị viên được mở lại: RESOLVED → IN_PROGRESS, bắt buộc ghi lý do.
- Ghi nhận người thực hiện và thời gian cho từng thay đổi.
- “Đã xử lý” không tự động có nghĩa là đã liên hệ người dân.
  Kết quả xử lý phải mô tả đúng việc đã thực hiện.

Không thêm nút xóa vĩnh viễn góp ý trong bản đầu tiên.

## 10. Phân quyền

- Quản trị viên: xem toàn bộ, phân công, xử lý và mở lại góp ý.
- Cán bộ xử lý: xem và xử lý các góp ý được giao.
- Tài khoản chỉ đăng bài: không tự động được xem góp ý.
- Người chưa đăng nhập: chỉ được gửi, không được đọc danh sách hoặc chi tiết.

Kiểm tra hệ thống role hiện tại trước khi triển khai.
Tái sử dụng role cán bộ xử lý nếu ý nghĩa phù hợp; không tự mở quyền
cho toàn bộ editor hoặc reviewer.

Ghi rõ ánh xạ quyền cuối cùng trong tài liệu bàn giao.

## 11. Bảo vệ thông tin

- Không đưa nội dung, số điện thoại hoặc họ tên vào log truy cập,
  thông báo lỗi hoặc công cụ thống kê.
- Không ghi toàn bộ request body của API góp ý.
- API admin phải có xác thực và kiểm tra quyền.
- Khi triển khai thực tế phải dùng HTTPS.
- Thông báo rõ mục đích thu thập trên biểu mẫu.
- Chưa tự động xóa dữ liệu khi đơn vị chưa chốt thời hạn lưu.
- Ghi thời hạn lưu dữ liệu là nội dung cần trung tâm quyết định
  trước khi vận hành chính thức.

## 12. Kiểm thử bắt buộc

| Tình huống | Kết quả mong đợi |
|---|---|
| Gửi đủ thông tin | Lưu một góp ý, trả mã duy nhất |
| Thiếu họ tên, số điện thoại hoặc nội dung | Không lưu, báo lỗi rõ ràng |
| Trường chỉ chứa khoảng trắng | Bị từ chối |
| Số điện thoại sai định dạng | Bị từ chối |
| Nhập số hợp lệ dạng 0 và +84 | Chuẩn hóa đúng theo quy tắc đã chọn |
| Nội dung vượt giới hạn | Bị từ chối ở backend |
| Nhấn gửi liên tục hoặc thử lại cùng khóa | Không tạo bản ghi trùng |
| Lỗi mạng | Giữ nội dung, không báo thành công giả |
| Gửi vượt ngưỡng | Thông báo giới hạn phù hợp |
| Chưa đăng nhập gọi API admin | Bị từ chối |
| Editor không có quyền truy cập góp ý | Bị từ chối |
| Cán bộ mở góp ý không được giao | Bị từ chối |
| Client tự gửi trạng thái RESOLVED | Không được áp dụng |
| Hoàn tất nhưng thiếu kết quả xử lý | Bị từ chối |
| Chuyển trạng thái hợp lệ | Lưu trạng thái và lịch sử nhất quán |
| Nội dung chứa HTML hoặc script | Hiển thị an toàn, không thực thi |
| Kiểm tra màn hình điện thoại | Không tràn bố cục, thao tác thuận tiện |

Chạy test phù hợp và build frontend, admin, backend theo script dự án.
Báo rõ phần đã kiểm tra thực tế và phần chưa thể kiểm tra.

## 13. Bàn giao

Sau khi hoàn thành, báo cáo:

1. Những chức năng đã triển khai.
2. Các file được thêm hoặc sửa.
3. Migration và cách chạy trên môi trường phù hợp.
4. Các cấu hình mới và giá trị mặc định.
5. Quyền của từng nhóm tài khoản.
6. Kết quả test và build.
7. Các điểm còn hạn chế hoặc cần trung tâm quyết định.
8. Cách kiểm tra thủ công một lượt gửi và xử lý góp ý.

Tạo tài liệu hướng dẫn trong thư mục docs theo quy ước dự án.
Chưa tự deploy lên VPS hoặc publish Zalo.