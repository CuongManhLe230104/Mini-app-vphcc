# Kế hoạch V2 — Niêm yết văn bản và liên kết thủ tục hành chính

**Dự án:** Zalo Mini App Trung tâm Phục vụ hành chính công xã Nghĩa Thành  
**Cập nhật:** 13/11/2026  
**Đầu vào:** 53 link Drive do người dùng cung cấp  
**Bản này thay thế định hướng của kế hoạch ngày 12/11/2026.**

## 1. Cơ sở điều chỉnh và phạm vi đã kiểm tra

Đã lấy được văn bản trích xuất từ 53/53 file, tất cả được kết nối Drive nhận diện là PDF. Đã rà soát phần thông báo, tiêu đề quyết định, các trích đoạn Điều 1 và đối chiếu sâu hơn một số điểm bất thường. Có 53 mã file khác nhau.

Không tuyên bố đã thẩm định pháp lý hoặc đọc kỹ toàn bộ mọi phụ lục. Chưa kiểm tra chữ ký, số trang thực tế, quyền xem ẩn danh hoặc mở file trong Zalo. Những bước này cần tiếp tục khi nghiệm thu dữ liệu.

Tài liệu kèm theo:
- [Kiểm kê 53 nguồn, trích yếu và điểm cần xử lý](kiem-ke-53-link-niem-yet.md).
- [Dữ liệu kiểm kê JSON để Antigravity tham khảo](output/niem-yet-53-nguon/kiem-ke-53-nguon.json). Đây là dữ liệu kiểm kê, không phải seed được phép xuất bản.

### 1.1. Bản chất nguồn thực tế

| Nhóm theo nội dung tiêu đề | Số nguồn | Cách sử dụng |
|---|---:|---|
| Công bố TTHC hoặc danh mục TTHC | 41 | Lưu hồ sơ niêm yết; chọn lọc liên kết tới module Thủ tục |
| Phê duyệt quy trình nội bộ/điện tử giải quyết TTHC | 10 | Lưu văn bản quy trình; không tự biến thành hướng dẫn nộp hồ sơ |
| Công bố TTHC nội bộ trong hệ thống hành chính nhà nước | 2 | Tách loại nội dung, không tạo nút đặt lịch/nộp hồ sơ cho người dân |
| Tổng | 53 | Tính theo nguồn, chưa loại trùng và chưa chốt hồ sơ hợp lệ |

Một PDF thường là một bộ tài liệu đã ghép: thông báo niêm yết của Trung tâm → công văn triển khai của xã → quyết định thành phố → danh mục/phụ lục. Không tách thành nhiều bài chỉ vì một file có nhiều văn bản.

Ví dụ:
- Nguồn 8: Quyết định 5083/QĐ-UBND, Điều 1 nêu danh mục 07 TTHC sửa đổi, bổ sung về hộ kinh doanh.
- Nguồn 3: Quyết định 6544/QĐ-UBND, Điều 1 nêu 55 TTHC nội bộ của Sở Tài chính.
- Nguồn 21: Quyết định 6327/QĐ-UBND, Điều 1 nêu 60 quy trình nội bộ/điện tử.
- Nguồn 1 có cả TTHC cấp tỉnh và cấp xã trong cùng bộ tài liệu.

Các số lượng trên mô tả văn bản nguồn; không phải số thủ tục đang có hiệu lực hoặc đang được Trung tâm tiếp nhận.

### 1.2. Các thay đổi bắt buộc so với kế hoạch cũ

1. Trọng tâm là **thư viện hồ sơ niêm yết quyết định về TTHC**, không phải bảng thông báo có ngày hết hạn là chính.
2. Không ép mọi tài liệu vào bốn quầy tiếp dân. Lĩnh vực pháp lý, cơ quan quản lý và quầy phục vụ là ba khái niệm riêng.
3. Một hồ sơ có thể chứa nhiều lĩnh vực; cần quan hệ nhiều-nhiều.
4. Tách niêm yết văn bản với hướng dẫn thực hiện từng thủ tục. Hai module liên kết tới nhau, không sao chép toàn bộ PDF thành bài dài.
5. Theo dõi thay thế, sửa đổi và bãi bỏ ở đúng phạm vi; không tự gán cả văn bản hết hiệu lực vì có từ “bãi bỏ”.
6. Giữ Drive làm nguồn ở giai đoạn đầu, ưu tiên làm sạch dữ liệu và tra cứu trước tính năng tải file nâng cao.

## 2. Xử lý chất lượng dữ liệu trước khi công bố

### 2.1. Nguồn cần kiểm tra đặc biệt

| Nguồn | Quan sát từ văn bản trích xuất | Hướng xử lý |
|---|---|---|
| 22 | Đầu file ghi 4811, nội dung sau là 5116 về Đo đạc và bản đồ | Giữ trạng thái cần đối chiếu; không gộp với nguồn 24, không tự sửa PDF |
| 24 | Nội dung phần quyết định phù hợp 4811, 32 quy trình nhiều lĩnh vực | Giữ riêng; đối chiếu bản gốc trước duyệt |
| 42 và 43 | Toàn bộ văn bản trích xuất giống nhau, cùng 3504 | Đánh dấu trùng văn bản; so sánh PDF/chữ ký trước khi chọn nguồn chính; giữ cả hai nguồn |
| 31 | Dòng đầu thông báo ghi tháng 6 nhưng dẫn quyết định tháng 7 và công văn tháng 8 | Đối chiếu hình ảnh và bản đã ban hành; chưa chốt ngày thông báo |
| 1 | Thông báo dẫn ngày 15/7, phần quyết định có cụm số/ngày rời “3826 30 6” | Không tự chốt ngày quyết định từ bản trích xuất |

Nhiều số/ngày bị tách vị trí trong quá trình trích xuất. Không kết luận tài liệu chưa ký hoặc tự ghép số/ngày bằng suy đoán.

### 2.2. Quy tắc nhập

- Lưu đủ 53 nguồn vào bảng kiểm kê trước.
- Tạo hồ sơ nháp ứng viên theo bộ thông báo và quyết định, không tạo ngay 53 bài công khai.
- Không gộp hai quyết định chỉ vì cùng lĩnh vực hoặc gần ngày.
- Nguồn 42/43 là ứng viên gộp; nguồn 22 là xung đột nội dung, không phải cặp trùng với 24.
- Không chốt số hồ sơ cuối cùng cho đến khi xử lý trùng và xung đột.
- Tách trạng thái “đọc được qua kết nối Drive” và “người dân xem không cần đăng nhập”.
- Mỗi metadata cần nguồn chứng minh, vị trí/trích đoạn, trạng thái kiểm tra, người xác nhận.
- Không lấy ngày tạo file Drive làm ngày ban hành hoặc bắt đầu niêm yết.
- Không sửa bản gốc, chia sẻ lại Drive hoặc công khai bài trong quá trình kiểm kê.

## 3. Trải nghiệm người dân

### 3.1. Mục Niêm yết công khai

Giao diện chính:
- Tìm theo tên, số thông báo, số quyết định hoặc từ khóa lĩnh vực.
- Lọc theo lĩnh vực, cơ quan quản lý, loại văn bản và năm.
- Phân trang 10–20 hồ sơ; API không trả nội dung PDF ở danh sách.
- Mỗi thẻ có tên ngắn, số quyết định, ngày đã xác nhận, lĩnh vực và loại tài liệu.
- Nhãn pháp lý chỉ hiển thị khi cán bộ đã xác nhận; không mặc định “Còn hiệu lực”.
- Không bắt buộc ảnh đại diện; dùng biểu tượng PDF/văn bản.

Ba nhóm nội dung:
1. Công bố thủ tục hành chính.
2. Quy trình giải quyết thủ tục.
3. Thủ tục hành chính nội bộ.

“TTHC nội bộ” là loại nghiệp vụ, không tự đồng nghĩa tài liệu mật. Quyền công khai vẫn do người có thẩm quyền xác nhận; không cho nhóm này nút lấy số/nộp hồ sơ.

### 3.2. Trang chi tiết hồ sơ

Thứ tự:
1. Tiêu đề ngắn và trích yếu đầy đủ.
2. Thông báo Trung tâm: số, ngày, đơn vị ban hành.
3. Quyết định được niêm yết: số, ngày, cơ quan ban hành.
4. Cơ quan quản lý chuyên ngành và các lĩnh vực.
5. Tóm tắt 3–5 dòng, ghi rõ đây là tóm tắt để tra cứu.
6. Nút “Xem toàn bộ văn bản PDF”.
7. Danh mục phần tài liệu nếu đã xác minh vị trí.
8. Thủ tục liên quan đã được duyệt, nếu có.
9. Văn bản liên quan: sửa đổi, bổ sung, thay thế, bãi bỏ theo phạm vi đã xác nhận.

Với PDF đã ghép, bản đầu chỉ cần một nút mở toàn bộ. Không giả lập các file riêng “thông báo”, “quyết định”, “phụ lục” nếu chúng chưa tồn tại. Có thể bổ sung mục lục với khoảng trang sau khi kiểm tra PDF; không hứa nhảy đúng trang khi trình xem Drive trong Zalo chưa hỗ trợ.

### 3.3. Mục Thủ tục

Module Thủ tục tiếp tục phục vụ câu hỏi: chuẩn bị gì, nộp ở đâu, thời hạn, phí, biểu mẫu.

- Chỉ nhập thủ tục phù hợp sau khi kiểm tra phụ lục cụ thể và phạm vi áp dụng.
- Một thủ tục có thể liên quan nhiều văn bản và nhiều lần cập nhật.
- Lưu mã TTHC nếu nguồn có; không dùng tên làm khóa duy nhất.
- Đính kèm căn cứ nguồn và trang/mục đã kiểm tra.
- Không cộng số lượng qua các quyết định để suy ra tổng thủ tục hiện hành.
- Không tự chuyển các hàng “bị bãi bỏ” thành dịch vụ đang tiếp nhận.
- Không tự gán nội dung thiếu thành miễn phí, không cần hồ sơ hoặc xử lý trong 30 phút.

### 3.4. Liên hệ bốn quầy

Thông tin đã được người dùng xác nhận:
- Quầy 1: Tư pháp – hộ tịch.
- Quầy 2: Giấy phép kinh doanh, bao gồm đăng ký hộ kinh doanh – môi trường.
- Quầy 3: Đất đai – quy hoạch.
- Quầy 4: Văn hóa – giáo dục – y tế – thương binh và xã hội.

Chỉ gắn quầy ở mức thủ tục được Trung tâm xác nhận tiếp nhận; mặc định chưa gắn. Thủ tục cấp thành phố, cơ quan chuyên ngành hoặc nội bộ không tự được đưa vào hàng đợi quầy xã.

Thời lượng dự kiến 30 phút/lượt tại quầy không phải thời hạn giải quyết TTHC trong văn bản.

## 4. Phân loại theo nguồn thực tế

Xây danh mục có thể mở rộng, hỗ trợ nhiều lĩnh vực cho mỗi hồ sơ:
- Đất đai; đo đạc và bản đồ; địa chất và khoáng sản; biển và hải đảo.
- Môi trường; trồng trọt; bảo vệ thực vật; thủy sản; chăn nuôi và thú y; chất lượng nông lâm sản.
- Xây dựng; vật liệu xây dựng; quản lý chất lượng công trình; kinh doanh bất động sản.
- Đường bộ; đường sắt; đường thủy nội địa; hàng hải; đăng kiểm.
- Quy hoạch đô thị và nông thôn.
- Hộ kinh doanh; hợp tác xã/tổ hợp tác; đấu thầu; hỗ trợ doanh nghiệp.
- Công thương; xuất nhập khẩu; thương mại quốc tế; điện lực và các lĩnh vực ghi trong từng quyết định.
- An toàn bức xạ và hạt nhân.
- Điện ảnh; báo chí.
- Phòng cháy, chữa cháy và cứu nạn, cứu hộ.
- Nội dung thuộc Ban Quản lý khu chế xuất và công nghiệp: phân loại chi tiết theo phụ lục, không dùng tên cơ quan làm lĩnh vực duy nhất.

Các nhóm lớn trên là đề xuất giao diện. Lưu tên lĩnh vực nguyên văn riêng để không mất nghĩa pháp lý; chưa có căn cứ thì để chờ phân loại.

## 5. Mô hình dữ liệu đề xuất

Đối chiếu schema đang có trước khi đặt tên bảng hoặc tạo migration. Không yêu cầu viết lại hệ thống.

### 5.1. SourceDocument — nguồn tài liệu

- ID, sourceType, driveFileId, originalUrl, tên file nếu xác minh được, MIME.
- Trạng thái đọc bằng connector và kiểm tra công khai riêng.
- Ngày kiểm kê, ngày kiểm tra link, ghi chú lỗi.
- Trạng thái chất lượng: chưa kiểm tra / phù hợp / trùng ứng viên / xung đột.
- Dấu vân tay văn bản trích xuất để phát hiện trùng; phân biệt với checksum file gốc.
- Đường dẫn file tải lên nếu sử dụng lưu trữ hệ thống.
- Lưu phiên bản nguồn hoặc modifiedTime/checksum khi có; link không đổi không đảm bảo nội dung không đổi.

### 5.2. Notice — hồ sơ niêm yết

- ID, title, summary, noticeNumber, noticeDate, publishingUnit.
- publicationStatus, người tạo/duyệt, thời điểm đăng/thu hồi.
- noticeType: công bố TTHC / quy trình / TTHC nội bộ.
- Quan hệ nhiều nguồn, nhiều lĩnh vực và nhiều văn bản.
- Ngày niêm yết bắt đầu/kết thúc chỉ khi có căn cứ, cho phép null.
- Metadata và tóm tắt có trạng thái xác minh riêng.
- Sửa bản đã đăng phải qua phiên bản/chờ duyệt theo cơ chế hiện có.

### 5.3. LegalDocument — văn bản được niêm yết

- Loại: quyết định / thông báo / công văn / loại khác.
- Số, ngày ban hành, cơ quan ban hành.
- Cơ quan quản lý chuyên ngành là trường riêng.
- Trích yếu, ngày hiệu lực nếu đã xác minh.
- legalStatus: chưa xác minh / còn hiệu lực / hết hiệu lực một phần / hết hiệu lực toàn bộ / trạng thái bổ sung nếu cần.
- Thông tin căn cứ, người xác nhận và ngày xác nhận trạng thái.
- Quan hệ sửa đổi/thay thế/bãi bỏ có phạm vi cụ thể và nguồn chứng minh.

Thông báo xã, công văn triển khai và quyết định thành phố không dùng chung một trường số/ngày.

### 5.4. Liên kết thủ tục

Tận dụng model Procedure hiện có, bổ sung bảng liên kết nếu thiếu:
- noticeId, legalDocumentId, procedureId.
- Tác động: mới ban hành / sửa đổi / bổ sung / thay thế / bãi bỏ.
- Phạm vi và ngày áp dụng đã xác nhận.
- sourceDocumentId, trang/mục, người xác nhận.
- Phân biệt cơ quan tiếp nhận, cơ quan giải quyết và thẩm quyền quyết định.
- Quầy xử lý do cấu hình nghiệp vụ của Trung tâm, cho phép chưa xác định.

### 5.5. Ba trục trạng thái độc lập

1. **Xuất bản:** nháp, chờ duyệt, đã đăng, thu hồi.
2. **Hiệu lực văn bản:** do đối chiếu và cán bộ xác nhận, không suy từ ngày upload hoặc từ khóa.
3. **Thời hạn niêm yết:** tùy chọn, có ngày thì tính theo múi giờ Việt Nam; không có thì không gắn nhãn hết hạn.

Bài hết thời hạn niêm yết không đồng nghĩa quyết định hết hiệu lực. Quyết định mới trong cùng lĩnh vực không tự làm hết hiệu lực toàn bộ quyết định cũ.

## 6. Backend và API

Tận dụng NestJS, Prisma/MySQL, xác thực và phân quyền hiện có; xác minh thực tế trước triển khai.

API công khai:
- Danh sách có tìm kiếm, lọc, phân trang ổn định.
- Chi tiết hồ sơ, các văn bản và tài liệu nguồn.
- Thủ tục liên quan đã duyệt.
- Không trả dữ liệu nháp/thu hồi hoặc ghi chú nội bộ cho người dân.

API quản trị:
- CRUD hồ sơ nháp, tài liệu và danh mục.
- Gửi duyệt/duyệt/trả lại/thu hồi.
- Nhập kiểm kê → xem trước → tạo nháp.
- Xác nhận metadata, trùng nguồn, xung đột nguồn và quan hệ văn bản.
- Audit log và lịch sử thay đổi.

Quy tắc:
- Kiểm tra quyền tại backend, không chỉ ẩn nút.
- Dùng transaction khi cập nhật hồ sơ và liên kết.
- Chống nhập lặp bằng source ID và mã đợt nhập; không ghi đè dữ liệu đã được cán bộ xác nhận.
- Không khóa duy nhất theo số quyết định mà thiếu cơ quan/năm/loại; kiểm tra trùng là bước xem xét, không xóa tự động.
- Chưa dùng full-text PDF để tìm kiếm công khai trong MVP; tìm trong metadata/tóm tắt đã duyệt.
- Không trả toàn bộ text PDF lớn qua API danh sách.
- Nếu kiểm tra URL từ backend: giới hạn nguồn, chặn mạng nội bộ, kiểm tra chuyển hướng, timeout và giới hạn dung lượng.
- Không coi HTTP 200 là đã truy cập đúng tài liệu; có thể là trang đăng nhập.

## 7. Admin và luồng nhập 53 nguồn

### 7.1. Các màn hình

1. **Nguồn tài liệu:** 53 dòng với trạng thái kiểm kê, trùng và xung đột.
2. **Hồ sơ niêm yết:** danh sách bài, lĩnh vực, cơ quan, trạng thái duyệt.
3. **Biên tập/duyệt:** metadata thông báo và quyết định riêng, các nguồn, tóm tắt, lĩnh vực, ghi chú.
4. **Liên kết thủ tục:** chọn thủ tục hiện có hoặc tạo bản nháp có nguồn chứng minh.

### 7.2. Luồng

Nhập danh sách → chuẩn hóa URL → đối chiếu nguồn → đề xuất metadata → xử lý xung đột → cán bộ xác nhận → tạo nháp → xem trước → gửi duyệt → duyệt đăng.

- Dùng bảng kiểm kê kèm theo làm điểm xuất phát, không xuất bản trực tiếp từ JSON.
- Giữ bản đọc ban đầu và giá trị đã sửa để truy vết.
- Nguồn 1, 22, 31 và cặp 42/43 phải có tác vụ kiểm tra rõ ràng.
- Không chặn toàn bộ dự án vì vài nguồn cần kiểm tra: tiếp tục hồ sơ đã đủ điều kiện.
- Không có nút “Xuất bản toàn bộ 53 link” trong bước nhập.
- Tóm tắt không thay thế văn bản gốc.
- Không mặc định số/ngày trống ở bản trích xuất là văn bản chưa ban hành.

## 8. Lưu trữ và mở PDF

### MVP: giữ Drive

- Lưu metadata và URL nguồn; PDF được mở khi người dân bấm.
- Kiểm tra quyền xem công khai bằng tài khoản không có đặc quyền hoặc phiên không đăng nhập.
- Thử trong Zalo Android/iOS nếu có thiết bị.
- Có thông báo file không mở được và phương án mở ngoài phù hợp SDK.
- Không nhúng tải sẵn tất cả PDF; đặc biệt có nguồn dài.
- Không tự chuyển link thành link tải trực tiếp.
- Không yêu cầu người dân đăng nhập tài khoản Google của cán bộ.
- Việc connector đọc được 53 file không chứng minh 53 file công khai cho mọi người.

### Giai đoạn sau: file từ máy

- Hỗ trợ PDF/JPG/PNG/WebP, giới hạn dung lượng cấu hình theo tài liệu thực tế.
- Kiểm tra MIME/nội dung thật, tên lưu do hệ thống tạo.
- File có quyền truy cập theo bài; nháp không có URL công khai không kiểm soát.
- Có volume/lưu trữ bền vững, sao lưu và khôi phục.
- Không dùng bộ nén ảnh để xử lý PDF.
- Không tự xóa nguồn gốc hoặc file còn được hồ sơ/phiên bản khác tham chiếu.
- Thu hồi bài không tự thu hồi quyền link Drive đã công khai trước đó; hướng dẫn quản trị phải ghi rõ.

## 9. Lộ trình triển khai cho Antigravity

| Mốc | Việc làm | Điều kiện hoàn thành |
|---|---|---|
| NY0 — Chốt dữ liệu | Kiểm tra lại bảng kiểm kê, đối chiếu PDF các nguồn bất thường, xác nhận phân nhóm | 53 nguồn có trạng thái; chưa xác minh được ghi rõ, không bị bỏ qua |
| NY1 — Thư viện Drive | Schema tối thiểu, Admin nháp/duyệt, danh mục nhiều lĩnh vực, Mini App tìm/lọc/chi tiết/mở file | 5–10 hồ sơ đã kiểm tra chạy được trên điện thoại |
| NY2 — Nhập nguồn còn lại | Xử lý trùng/xung đột, nhập có chống lặp, audit, duyệt có chọn lọc | Mọi nguồn có hồ sơ hoặc lý do chờ; không có dữ liệu tự xuất bản |
| NY3 — Liên kết Thủ tục | Ưu tiên hộ kinh doanh, đất đai, quy hoạch và thủ tục được Trung tâm xác nhận; đối chiếu phụ lục | Thủ tục liên kết đúng nguồn, đúng thẩm quyền và không chứa mục bãi bỏ như dịch vụ đang nhận |
| NY4 — Vận hành | Tải file, giám sát link, lịch sử phiên bản nguồn, sao lưu và phục hồi | Kiểm thử lỗi và quyền đạt yêu cầu |

Các mốc NY là riêng chức năng này, không thay đổi tên M0/M1/M2 của kế hoạch toàn dự án.

Gợi ý chọn bài thử: nguồn 8 (hộ kinh doanh), 13 (PCCC), 15 (môi trường), 30 (quy hoạch), 3 (TTHC nội bộ) và 21 (quy trình nhiều lĩnh vực). Đây là mẫu kiểm thử khác loại, không phải xác nhận đủ điều kiện công bố hoặc còn hiệu lực. Các nguồn bất thường dùng kiểm thử chặn duyệt, không dùng làm bài công khai đầu tiên.

## 10. Kiểm thử và tiêu chí nghiệm thu

### Dữ liệu

- [ ] Nhập đủ 53 mã nguồn, đúng thứ tự và URL đã chuẩn hóa.
- [ ] Nhập lại không tạo bản sao.
- [ ] 42/43 báo trùng văn bản, không tự xóa một PDF.
- [ ] 22 báo xung đột 4811/5116; không gộp với 24.
- [ ] 1/31 có cảnh báo ngày cần xác minh.
- [ ] Một hồ sơ hỗ trợ nhiều lĩnh vực, nhiều loại văn bản và nhiều nguồn.
- [ ] Số thông báo, số công văn, số quyết định và các ngày không ghi đè nhau.

### Nghiệp vụ

- [ ] Nháp/chờ duyệt/thu hồi không được trả qua API công khai.
- [ ] Người không đủ quyền không gọi được API duyệt.
- [ ] Từ khóa “bãi bỏ” không tự làm cả văn bản hết hiệu lực.
- [ ] Thay đổi thời hạn niêm yết không đổi trạng thái pháp lý.
- [ ] TTHC nội bộ không xuất hiện thành dịch vụ đặt lịch/lấy số.
- [ ] Thủ tục cấp tỉnh không tự gắn vào quầy xã.
- [ ] Thời gian tiếp dân 30 phút không thay thời hạn giải quyết trong nguồn.
- [ ] Sửa bài đang đăng phải qua quy trình phiên bản/duyệt.

### Hiển thị và mở file

- [ ] Tìm số quyết định và từ khóa tiếng Việt được.
- [ ] Bộ lọc nhiều lĩnh vực và phân trang đúng.
- [ ] Không tải PDF ở danh sách.
- [ ] Link hỏng/thu hồi quyền có thông báo, không trắng trang.
- [ ] Đọc được qua Drive connector và xem công khai là hai kết quả riêng.
- [ ] Có kết quả thử Zalo trên điện thoại, ghi rõ thiết bị và phiên bản.
- [ ] Các module tin tức, thủ tục, lấy số và đặt lịch không bị lỗi hồi quy.

## 11. Chưa thuộc phạm vi bản đầu

- Chép toàn bộ mọi trang PDF thành nội dung bài viết.
- OCR và trích xuất tự động toàn bộ thủ tục thành dữ liệu đang hoạt động.
- AI tự quyết định hiệu lực hoặc tự cập nhật dữ liệu pháp lý công khai.
- Chatbot trả lời thủ tục từ các nguồn chưa xác minh.
- Đồng bộ/xuất bản tự động khi file Drive đổi nội dung.
- Gửi thông báo OA hàng loạt.
- Tạo mới biểu mẫu tiếp nhận phản ánh.

## 12. Báo cáo bàn giao

Sau mỗi mốc, báo cáo:
- Chức năng đã thực hiện, file và schema thay đổi.
- Số nguồn đã xử lý, số hồ sơ đã tạo, số bài đã duyệt; không đánh đồng các con số.
- Kiểm thử thực tế và giới hạn còn lại.
- Các điểm cần cán bộ xác nhận.
- Bước tiếp theo và hướng dẫn sử dụng.

Không tuyên bố đã đọc chi tiết toàn bộ phụ lục hoặc xác nhận hiệu lực nếu chưa làm được. Kế hoạch này không thay thế thẩm định nội dung của cán bộ chuyên môn.

## 13. Lệnh giao việc cho Antigravity

> Đọc kế hoạch V2 và bảng kiểm kê 53 nguồn kèm theo. Khảo sát module Niêm yết/Thủ tục đang có, rồi triển khai NY0 và NY1 trước. Giữ mô hình hồ sơ niêm yết gồm nhiều văn bản và nguồn PDF; phân loại riêng công bố TTHC, quy trình nội bộ/điện tử và TTHC nội bộ. Không tự gắn tất cả tài liệu vào bốn quầy xã. Xử lý nguồn 22 xung đột 4811/5116, nguồn 42/43 trùng phần text, và các ngày cần kiểm tra ở nguồn 1/31. Tách trạng thái xuất bản, hiệu lực văn bản và thời hạn niêm yết. Dữ liệu nhập chỉ ở dạng nháp; tiếp tục các phần kỹ thuật độc lập bằng dữ liệu thử. Không thay đổi quyền Drive hoặc xuất bản hàng loạt. Báo cáo kiểm thử trước khi chuyển mốc.

