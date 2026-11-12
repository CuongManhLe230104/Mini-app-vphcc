# Kế hoạch triển khai hệ thống Niêm yết công khai

**Dự án:** Zalo Mini App Trung tâm Phục vụ hành chính công xã Nghĩa Thành  
**Ngày lập:** 12/11/2026  
**Người thực hiện kỹ thuật:** Antigravity  
**Nguồn đầu vào:** 53 link Google Drive do chủ dự án cung cấp cho Antigravity  
**Trạng thái tài liệu:** Kế hoạch triển khai; không phải báo cáo xác nhận chức năng đã hoàn thành.

## 1. Mục tiêu và phạm vi

Hoàn thiện chức năng Niêm yết công khai trên backend, trang quản trị và Zalo Mini App. Quản trị viên quản lý và duyệt văn bản; người dân tìm kiếm, lọc, xem nội dung và mở tài liệu trên điện thoại trong Zalo.

Hệ thống dùng MySQL và tận dụng kiến trúc hiện có của dự án. Antigravity cần xác minh thư viện, phiên bản, schema và API thực tế trước khi lựa chọn cách triển khai.

Không mặc định 53 link tương ứng 53 bài niêm yết. Một bài có thể gồm văn bản chính, quyết định, danh sách và nhiều phụ lục. File này không chứa danh sách 53 link; sử dụng danh sách đã được cung cấp trong cuộc trò chuyện với Antigravity.

## 2. Nguyên tắc triển khai

- Đọc cấu trúc dự án, hướng dẫn làm việc, kế hoạch, database và module niêm yết hiện có trước khi sửa.
- Tận dụng đăng nhập, phân quyền, quy trình duyệt, phiên bản nội dung, tải file, phân trang và thành phần giao diện đang có.
- Không viết lại toàn bộ hệ thống nếu có thể mở rộng chức năng hiện tại.
- Không làm ảnh hưởng tin tức, thủ tục, bốc số và đặt lịch.
- Không xóa dữ liệu hiện có. Thay đổi database phải có migration, giải thích ảnh hưởng và phương án triển khai.
- Không tự thay đổi quyền chia sẻ Drive, công khai tài liệu, xuất bản bài hoặc triển khai lên môi trường chính thức.
- Không suy đoán số văn bản, ngày ban hành, thời hạn niêm yết hoặc cơ quan ban hành.
- AI chỉ đề xuất tóm tắt, phân loại và nhóm tài liệu; cán bộ kiểm tra trước khi xuất bản.
- Chỉ dùng dữ liệu thử để kiểm thử tự động. Không ghi nội dung nhạy cảm, token hoặc thông tin cá nhân vào log.

## 3. Kiến trúc và luồng tổng thể

```text
53 link Drive / file từ máy
          |
          v
Kiểm kê -> phân nhóm -> kiểm tra thông tin
          |
          v
Admin tạo hoặc nhập bài nháp
          |
          v
Gửi duyệt -> cán bộ kiểm tra -> duyệt / trả lại
          |
          v
Backend kiểm tra trạng thái và quyền hiển thị
          |
          v
Mini App: tìm kiếm -> lọc -> chi tiết -> xem tài liệu
```

MySQL lưu thông tin bài, metadata tài liệu và lịch sử. Nội dung file được lưu tại nơi lưu trữ file bền vững hoặc giữ trên Drive. Không lưu file nhị phân trực tiếp vào bảng bài viết.

## 4. Giai đoạn 1 — Khảo sát và kiểm kê 53 link

### 4.1. Khảo sát dự án

- Xác định module, model, API và trang niêm yết hiện có.
- Kiểm tra cơ chế phân quyền, duyệt nội dung và phiên bản chỉnh sửa.
- Kiểm tra cách lưu file, cấu hình HTTPS, địa chỉ backend và cách mở tài liệu trong Zalo.
- Lập danh sách phần tái sử dụng được, phần cần bổ sung và rủi ro tương thích.

### 4.2. Bảng kiểm kê tài liệu

| Trường | Nội dung |
|---|---|
| Số thứ tự | Vị trí trong danh sách nguồn |
| Link nguồn | Link đã cung cấp |
| Loại nguồn | File hoặc thư mục |
| Mã file Drive | Dùng đối chiếu và phát hiện trùng |
| Tên tài liệu | Tên thực tế |
| Khả năng truy cập | Truy cập được / yêu cầu quyền / không tồn tại / chưa kiểm tra |
| Định dạng | PDF, ảnh, Word hoặc loại khác |
| Tiêu đề đề xuất | Tên bài niêm yết dễ hiểu |
| Lĩnh vực đề xuất | Dựa trên nội dung |
| Số và ngày văn bản | Chỉ ghi khi đọc được |
| Cơ quan ban hành | Chỉ ghi khi xác minh được |
| Thời hạn niêm yết | Ghi giá trị và nguồn xác định; thiếu thì để trống |
| Nhóm tài liệu | Văn bản chính và phụ lục liên quan |
| Ghi chú | Trùng, thiếu trang, thông tin cá nhân cần kiểm tra… |

### 4.3. Quy tắc xử lý

- Nếu link là thư mục, kiểm kê các file bên trong trong phạm vi được phép truy cập.
- Link khác nhau trỏ cùng mã file Drive được đánh dấu trùng nguồn; không tự xóa tài liệu.
- Không gộp chỉ dựa vào tên gần giống; kiểm tra số văn bản, nội dung và mối quan hệ phụ lục.
- File không đọc được phải ghi nguyên nhân; không tạo nội dung thay thế.
- Kiểm tra khả năng xem bằng người không có quyền quản trị Drive.
- Không tự bật chia sẻ công khai để khắc phục lỗi quyền truy cập.

**Đầu ra:** bảng kiểm kê, danh sách nhóm bài đề xuất và các thông tin cần cán bộ bổ sung. Trong lúc chờ xác nhận nội dung, tiếp tục xây dựng chức năng bằng dữ liệu thử.

## 5. Giai đoạn 2 — Thiết kế dữ liệu

Đối chiếu schema thực tế và chỉ bổ sung phần còn thiếu. Các trường dưới đây mô tả nghiệp vụ, không bắt buộc tên cột cụ thể.

### 5.1. Bài niêm yết

- ID, tiêu đề, tóm tắt, nội dung.
- Lĩnh vực, loại niêm yết.
- Số văn bản, ngày ban hành, cơ quan ban hành.
- Ngày bắt đầu và ngày kết thúc niêm yết, cho phép thiếu khi chưa xác định.
- Đầu mối tiếp nhận ý kiến nếu có.
- Đánh dấu ưu tiên.
- Trạng thái duyệt.
- Người tạo, người cập nhật, người duyệt.
- Thời điểm tạo, cập nhật, duyệt và xuất bản.
- Thông tin phiên bản hoặc tham chiếu lịch sử theo cơ chế hiện có.

### 5.2. Tài liệu đính kèm

Một bài có nhiều tài liệu:

- ID và ID bài niêm yết.
- Tên hiển thị.
- Nguồn: Google Drive hoặc file tải lên.
- Link nguồn hoặc khóa lưu file; mã file Drive nếu có.
- Loại file, dung lượng nếu xác định được.
- Vai trò: văn bản chính hoặc phụ lục.
- Thứ tự hiển thị.
- Kết quả và thời điểm kiểm tra truy cập.

### 5.3. Danh mục lĩnh vực ban đầu

1. Tư pháp – hộ tịch.
2. Kinh doanh – môi trường.
3. Đất đai – quy hoạch.
4. Văn hóa – giáo dục – y tế – thương binh và xã hội.
5. Thông tin chung.

Cho phép điều chỉnh danh mục; không gắn cứng toàn bộ vào mã giao diện. Lĩnh vực và loại niêm yết là hai thuộc tính riêng.

### 5.4. Hai loại trạng thái độc lập

**Trạng thái nội dung:** Nháp → Chờ duyệt → Đã đăng → Thu hồi. Trả lại bài về trạng thái chỉnh sửa theo quy trình hiện có, kèm lý do.

**Trạng thái thời hạn:** Sắp niêm yết / Đang niêm yết / Đã hết thời hạn / Chưa xác định thời hạn.

- Tính thời hạn từ đồng hồ máy chủ theo múi giờ Việt Nam.
- Không tự đặt thời hạn mặc định.
- Ngày kết thúc dạng ngày được hiểu là hết ngày đó; nên triển khai điều kiện nhỏ hơn đầu ngày kế tiếp để tránh lỗi độ chính xác thời gian.
- Ngày kết thúc không được trước ngày bắt đầu.
- Khi thiếu mốc thời gian, hiển thị mốc đã biết và trạng thái chưa xác định phù hợp; không tự điền phần thiếu.
- Bài hết hạn vẫn có thể tra cứu trong kho lưu trữ, không tự xóa.
- Bài thu hồi không được trả qua API công khai, kể cả đường dẫn chi tiết.
- Xác định rõ việc bài đã đăng nhưng chưa đến ngày bắt đầu được hiển thị ở nhóm “Sắp niêm yết” hay chờ tới ngày bắt đầu. Ghi lựa chọn vào tài liệu nghiệp vụ trước khi nghiệm thu; không đồng nhất thời điểm đăng với thời điểm bắt đầu niêm yết.

## 6. Giai đoạn 3 — Backend và API

Mở rộng API hiện có và thống nhất quy ước tên, cấu trúc phản hồi, lỗi và phân trang với dự án.

### 6.1. API công khai

- Danh sách có phân trang.
- Tìm kiếm theo tiêu đề và số văn bản.
- Lọc lĩnh vực, loại niêm yết và thời hạn.
- Chi tiết bài cùng danh sách tài liệu.
- Chỉ trả nội dung đã duyệt và đủ điều kiện hiển thị.
- Kiểm tra quyền công khai tại endpoint phục vụ file, không chỉ ở trang danh sách.

### 6.2. API quản trị

- Tạo, sửa, xem trước bài.
- Gửi duyệt, duyệt, trả lại và thu hồi.
- Thêm, sửa, sắp xếp và gỡ tài liệu.
- Nhập hàng loạt có bước kiểm tra trước khi lưu.
- Lịch sử thay đổi.
- Kiểm tra tình trạng truy cập tài liệu.

### 6.3. Yêu cầu kỹ thuật

- Thực thi quyền ở backend cho mọi thao tác; không chỉ ẩn nút ở giao diện.
- Tận dụng phiên bản nội dung: chỉnh sửa bài đã đăng không được tự bỏ qua bước duyệt.
- Cập nhật bài và quan hệ tài liệu bằng transaction khi cần để tránh lưu dở dang.
- Link sai định dạng phải có thông báo rõ.
- Nếu backend kiểm tra URL, chỉ cho phép nguồn xác định, chặn mạng nội bộ và kiểm tra lại mọi chuyển hướng; có giới hạn thời gian và kích thước phản hồi.
- Không coi HTTP 200 là chắc chắn tài liệu xem được: trang đăng nhập hoặc trang yêu cầu quyền cũng có thể trả 200.
- Chống tạo trùng khi gửi lại cùng đợt nhập; báo rõ dòng trùng thay vì ghi đè tự động.
- Kiểm tra tìm kiếm tiếng Việt có dấu và không dấu với collation thực tế của MySQL.
- Phân trang có thứ tự ổn định, có khóa phụ để tránh lặp hoặc bỏ sót bài khi bằng ngày.

## 7. Giai đoạn 4 — Drive và tải file từ máy

### 7.1. Link Google Drive

- Nhập link và tên tài liệu, giữ link nguồn.
- Kiểm tra và thông báo nếu cần quyền truy cập.
- Không phụ thuộc tài khoản Google đang đăng nhập của quản trị viên.
- Không tự chuyển mọi link thành link tải trực tiếp.
- Khi không xem được bên trong Zalo, cung cấp cách mở bên ngoài phù hợp với SDK đang dùng.
- Kiểm tra file và thư mục là các trường hợp khác nhau; không coi link thư mục là một file PDF.

### 7.2. Tải file từ máy

- Giai đoạn đầu hỗ trợ PDF, JPG, PNG và WebP.
- Giới hạn dung lượng cấu hình được; đề xuất khởi đầu 10 MB/file.
- Backend kiểm tra loại file thực tế, không chỉ phần mở rộng hoặc MIME do trình duyệt gửi.
- Hiển thị tiến trình tải, lỗi, khả năng thử lại và tên file sau khi tải.
- Lưu file tại nơi truy cập được từ điện thoại qua HTTPS.
- Có lưu trữ bền vững, cấu hình volume nếu dùng Docker và phương án sao lưu.
- Không dùng nguyên bộ xử lý ảnh đại diện để xử lý PDF.
- Tên lưu file do hệ thống tạo, không dùng đường dẫn do người dùng gửi.
- Tài liệu nháp cần kiểm soát truy cập; không tự tạo đường dẫn công khai không bảo vệ.
- Khi gỡ file khỏi một bài, kiểm tra tham chiếu từ bài hoặc phiên bản khác trước khi xóa vật lý. Giai đoạn đầu không tự xóa file còn chưa xác định được tham chiếu.

### 7.3. Thu hồi tài liệu

Với file do hệ thống quản lý, quyền truy cập phải theo trạng thái bài và các tham chiếu hợp lệ. Chú ý cache không làm tài liệu nháp hoặc thu hồi tiếp tục lộ ngoài ý muốn.

Với link Drive đã công khai từ trước, thu hồi bài trên ứng dụng không tự thu hồi link nguồn. Hướng dẫn quản trị phải nêu rõ giới hạn này.

Chưa cần tự động tải toàn bộ 53 tài liệu từ Drive về máy chủ trong giai đoạn đầu.

## 8. Giai đoạn 5 — Trang quản trị

### 8.1. Danh sách

- Tìm kiếm và lọc lĩnh vực, trạng thái duyệt, thời hạn.
- Hiển thị tiêu đề, số văn bản, lĩnh vực, thời gian, số file và trạng thái.
- Thao tác theo quyền: xem, sửa, gửi duyệt, duyệt, trả lại và thu hồi.
- Cảnh báo tài liệu lỗi hoặc cần kiểm tra quyền truy cập.

### 8.2. Tạo và chỉnh sửa

- Các trường của bài niêm yết.
- Thêm nhiều file bằng Drive hoặc tải từ máy.
- Đặt tên hiển thị dễ hiểu.
- Chọn văn bản chính, sắp xếp phụ lục.
- Cảnh báo thông tin thiếu; cho phép lưu nháp khi chưa hoàn thiện.
- Xem trước nội dung.
- Không bắt buộc ảnh đại diện.
- Khi gửi duyệt, kiểm tra các trường bắt buộc theo nghiệp vụ đã xác nhận.

### 8.3. Nhập hàng loạt

1. Cung cấp mẫu Excel hoặc CSV phù hợp thư viện hiện có, có quy tắc biểu diễn nhiều tài liệu trên một bài.
2. Đọc và kiểm tra dữ liệu.
3. Hiển thị dòng hợp lệ, trùng và lỗi.
4. Cho người quản trị xác nhận các dòng sẽ nhập.
5. Chỉ tạo bài nháp.
6. Xuất báo cáo kết quả từng dòng.

Không tự gửi duyệt hoặc xuất bản ngay sau khi nhập. Khi xuất báo cáo CSV/Excel, xử lý dữ liệu có thể bị hiểu là công thức.

## 9. Giai đoạn 6 — Mini App cho người dân

### 9.1. Trang danh sách

- Tiêu đề “Niêm yết công khai”.
- Tìm theo tên hoặc số văn bản.
- Bộ lọc lĩnh vực và thời hạn.
- Thẻ có tiêu đề, cơ quan ban hành, thời gian và số tài liệu.
- Phân trang hoặc “Xem thêm”, thống nhất ứng dụng.
- Các trạng thái đang tải, không có kết quả, lỗi kết nối và thử lại.
- Dùng biểu tượng tài liệu; không phụ thuộc ảnh đại diện.

### 9.2. Trang chi tiết

Thứ tự đề xuất:

1. Tiêu đề và lĩnh vực.
2. Số văn bản, cơ quan ban hành, ngày ban hành.
3. Thời gian và trạng thái niêm yết.
4. Tóm tắt, nội dung.
5. Văn bản chính và phụ lục.
6. Đầu mối tiếp nhận ý kiến nếu có.

Không hiển thị thông tin suy đoán khi trường dữ liệu trống. Ưu tiên nút “Xem tài liệu”. Chỉ có nút “Tải xuống” khi luồng được hỗ trợ và đã kiểm tra trên thiết bị. Đối chiếu tài liệu SDK tương ứng phiên bản đang cài trước khi dùng API mở file.

Chưa triển khai biểu mẫu tiếp nhận phản ánh riêng; chỉ hiển thị đầu mối hoặc liên kết đã được đơn vị xác nhận.

## 10. Giai đoạn 7 — Kiểm thử và nghiệm thu

### 10.1. Nội dung và tài liệu

- [ ] Một bài có một file.
- [ ] Một bài có văn bản chính và nhiều phụ lục đúng thứ tự.
- [ ] Link Drive công khai mở được trên điện thoại khi không có quyền quản trị.
- [ ] Link cần quyền có thông báo phù hợp.
- [ ] File bị xóa, link hỏng hoặc Drive lỗi không làm ứng dụng trắng trang.
- [ ] PDF và ảnh tải từ máy hiển thị được.
- [ ] File quá dung lượng, sai định dạng và giả mạo phần mở rộng bị từ chối.
- [ ] Gỡ một tài liệu không làm mất tài liệu còn được bài khác sử dụng.

### 10.2. Hiển thị và nghiệp vụ

- [ ] Tìm kiếm tiếng Việt, bộ lọc và phân trang đúng.
- [ ] Nháp, chờ duyệt và bài thu hồi không xuất hiện trong API công khai.
- [ ] Không truy cập trực tiếp được file nháp bằng người không đủ quyền.
- [ ] Bài hết hạn tìm thấy trong kho tra cứu.
- [ ] Kiểm tra biên ngày bắt đầu, hết ngày kết thúc và thiếu thời hạn.
- [ ] Chỉnh sửa bài đã đăng tuân thủ quy trình duyệt.
- [ ] Người không đủ quyền không duyệt hoặc thu hồi được bằng API trực tiếp.
- [ ] Nhập lại danh sách không tạo trùng ngoài ý muốn.
- [ ] Sửa bài không làm mất quan hệ tài liệu.
- [ ] Tin tức và các module hiện có vẫn hoạt động.

### 10.3. Thiết bị và môi trường

- Nhập thử 5–10 bài nháp có nhiều loại file và trạng thái.
- Kiểm tra trên trình duyệt máy tính và trong Zalo trên điện thoại.
- Nếu có điều kiện, kiểm tra cả Android và iOS; ghi rõ thiết bị nào chưa thử.
- Backend và file phải truy cập qua HTTPS từ điện thoại.
- Kiểm tra mạng chậm, lỗi mạng và quay lại ứng dụng sau khi mở tài liệu.
- Không dùng kết quả thử trên localhost để khẳng định đã chạy tốt trong Zalo.

## 11. Thứ tự ưu tiên và mốc bàn giao

### Mốc NY1 — Bản dùng thử

- Kiểm kê và nhóm 53 link.
- Schema bài và nhiều tài liệu đính kèm.
- Quản trị tạo, sửa, duyệt.
- Mini App tìm kiếm, lọc và mở Drive.
- Nhập thử 5–10 bài và báo cáo kiểm thử.

### Mốc NY2 — Vận hành đầy đủ

- Tải PDF và ảnh từ máy.
- Nhập hàng loạt có kiểm tra và chống trùng.
- Lịch sử chỉnh sửa.
- Theo dõi thời hạn và link lỗi.
- Kiểm tra quyền, lưu trữ bền vững và sao lưu.
- Nhập phần còn lại thành bản nháp sau khi cán bộ xác nhận cách nhóm.

NY1 và NY2 là tên mốc riêng của chức năng này, không thay thế các module M0, M1, M2… trong kế hoạch tổng thể.

### Chưa thuộc phạm vi ban đầu

- OCR toàn bộ tài liệu.
- Chatbot giải thích văn bản.
- AI tự xuất bản tóm tắt.
- Tự đồng bộ mọi thay đổi trên Drive.
- Gửi thông báo hàng loạt qua OA.
- Biểu mẫu tiếp nhận phản ánh riêng.

## 12. Công cụ và tài liệu bàn giao

Ưu tiên công cụ dự án đang dùng:

| Công việc | Công cụ hoặc thành phần |
|---|---|
| Quản lý thay đổi | Git, nhánh chức năng riêng theo quy trình dự án |
| Backend | NestJS và cơ chế xác thực/phân quyền hiện có |
| Dữ liệu | Prisma và MySQL; xác minh schema trước migration |
| Admin | React và các thành phần biểu mẫu, bảng, tải file hiện có |
| Mini App | React, ZMP UI, Zalo SDK theo phiên bản thực tế |
| Kiểm kê | Markdown và Excel/CSV |
| File | Google Drive và nơi lưu file bền vững của hệ thống |
| Kiểm thử | Bộ test hiện có, trình duyệt và Zalo trên thiết bị thật |

Không thêm thư viện hoặc dịch vụ trả phí nếu chức năng hiện có đáp ứng được. Nếu cần phụ thuộc mới, nêu mục đích và ảnh hưởng trước khi lựa chọn.

Đề xuất tài liệu bàn giao trong dự án:

- `docs/public-notices/inventory.csv`: kiểm kê nguồn.
- `docs/public-notices/grouping-proposal.md`: đề xuất nhóm bài và vấn đề cần xác nhận.
- `docs/public-notices/architecture.md`: schema, API, quyền và luồng file.
- `docs/public-notices/import-guide.md`: mẫu nhập và hướng dẫn.
- `docs/public-notices/admin-guide.md`: hướng dẫn cán bộ.
- `docs/public-notices/test-report.md`: kết quả kiểm thử, giới hạn còn lại.

Các đường dẫn trên là đề xuất, chưa xác nhận đã tồn tại trong repository.

## 13. Báo cáo sau mỗi giai đoạn

Antigravity báo cáo:

1. Chức năng đã hoàn thành.
2. File, schema và dữ liệu đã thay đổi.
3. Kiểm thử đã chạy và kết quả thực tế.
4. Phần chưa kiểm tra hoặc chưa hoàn thành.
5. Nội dung cần cán bộ xác nhận.
6. Bước tiếp theo.

Không khẳng định đã đọc, đã nhập, đã kiểm thử hoặc đã triển khai tài liệu nếu chưa thực hiện được.

## 14. Yêu cầu bắt đầu dành cho Antigravity

> Hãy đọc kế hoạch này và khảo sát module niêm yết hiện có. Lập bảng kiểm kê 53 link Drive đã được cung cấp, đề xuất cách nhóm tài liệu và chỉ ra những thông tin thiếu. Đồng thời triển khai phần kỹ thuật không phụ thuộc việc duyệt nội dung bằng dữ liệu thử, theo thứ tự NY1 rồi NY2. Tận dụng cấu trúc dự án và giữ nguyên hoạt động các module khác. Không tự thay đổi quyền Drive, công khai tài liệu hoặc xuất bản bài. Báo cáo bằng chứng kiểm thử sau mỗi giai đoạn; các tài liệu thật được nhập ở trạng thái nháp để cán bộ kiểm tra trước khi duyệt.
