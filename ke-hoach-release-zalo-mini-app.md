# Kế hoạch triển khai và phát hành Zalo Mini App

**Dự án:** Trung tâm Phục vụ hành chính công xã Nghĩa Thành  
**Ngày lập:** 16/11/2026  
**Phiên bản:** 2 — phương án tiết kiệm, một VPS RAM 2 GB  
**Đối tượng sử dụng:** chủ dự án, cán bộ vận hành, Antigravity và đơn vị triển khai.

> Đây là kế hoạch triển khai, không phải báo cáo nghiệm thu. Chưa kiểm tra lại mã nguồn và môi trường chạy thực tế trong lần lập tài liệu này. Tất cả ô công việc để trống cho đến khi có bằng chứng hoàn thành.

## 1. Mục tiêu và kiến trúc

Mini App hoạt động trên điện thoại khi máy tính phát triển đã tắt. Admin cập nhật dữ liệu và người dân xem được nội dung qua cùng backend chính thức.

```text
Mini App trên Zalo ── HTTPS ── VPS duy nhất
                              ├── Caddy/Nginx: HTTPS và trang admin
                              ├── Backend NestJS
                              ├── MySQL (mạng Docker nội bộ)
                              └── Ảnh upload (thư mục bền vững)
                                      │
                                      └── Sao lưu ra nơi khác ngoài VPS
```

- Phương án đã chọn: một VPS chạy backend, MySQL và admin; ảnh lưu trên ổ VPS.
- Zalo lưu và phân phối giao diện Mini App. Không thuê App Platform, Managed MySQL hoặc kho ảnh riêng trong giai đoạn đầu.
- Cấu hình khởi điểm: 1 CPU, RAM 2 GB, SSD khoảng 50 GB. Đây là cấu hình cần kiểm thử, không bảo đảm một số người dùng đồng thời cụ thể.
- Một máy chủ gặp sự cố có thể làm gián đoạn cả API, admin và database. Chấp nhận mô hình này cần có người vận hành và bản sao lưu phục hồi được.
- Deploy giao diện lên Zalo không tự triển khai backend và database.
- Xác thực Mini App, gửi xét duyệt phiên bản và phát hành là những bước riêng.

## 2. Phân công và công cụ

| Người phụ trách | Công việc |
|---|---|
| Chủ dự án/Trung tâm | Chốt phạm vi, nhà cung cấp, ngân sách, dữ liệu công khai, người vận hành và phát hành |
| Antigravity/lập trình viên | Kiểm tra mã nguồn, chuẩn bị cấu hình, sửa lưu ảnh, triển khai và kiểm thử |
| Cán bộ nghiệp vụ | Kiểm tra nội dung, lịch làm việc, quy trình tiếp nhận và quyền cán bộ |
| Đơn vị IT/nhà cung cấp | Hỗ trợ mạng, máy chủ, sao lưu, phục hồi và xử lý sự cố theo hợp đồng |

| Công cụ | Mục đích |
|---|---|
| Git và GitHub | Lưu mã nguồn và đánh dấu bản phát hành |
| Antigravity hoặc VS Code | Chuẩn bị mã nguồn và cấu hình |
| Zalo Mini App Extension | Đóng gói, deploy bản Testing, lấy QR thử nghiệm |
| Trang quản lý Zalo Mini App | Quản lý phiên bản, gửi xét duyệt, Publish |
| Cloud console | Quản lý backend, MySQL, lưu trữ và hóa đơn |
| Docker Engine và Docker Compose | Chạy backend, MySQL và web server trên cùng VPS |
| Caddy hoặc Nginx | HTTPS, phục vụ admin và chuyển yêu cầu đến backend |
| SSH/SFTP | Quản trị máy chủ và chuyển tệp an toàn |
| Prisma | Quản lý cấu trúc database và migration |
| Công cụ MySQL | Sao lưu, nhập dữ liệu và kiểm tra phục hồi |
| Công cụ kiểm tra API và nhật ký | Kiểm tra kết nối, phân quyền và lỗi |
| Điện thoại Android/iPhone | Kiểm tra trải nghiệm thực trong Zalo |

## 3. Bước 1 — Chốt phạm vi bản phát hành

**Thực hiện trước khi mua hạ tầng.**

- [ ] Lập danh sách chức năng sẽ công khai: tin tức, hướng dẫn, thủ tục, niêm yết, thông tin Trung tâm, liên hệ.
- [ ] Chốt có đưa đặt lịch/lấy số vào bản đầu tiên hay không.
- [ ] Chức năng chưa hoàn thiện được ẩn khỏi điều hướng và không quảng bá là đang hoạt động.
- [ ] Cán bộ duyệt nội dung chính thức, loại bỏ bài thử và dữ liệu giả lập khỏi môi trường phục vụ người dân.
- [ ] Chốt tài khoản quản trị, quyền biên tập và quyền cán bộ quầy.
- [ ] Chốt người quyết định phát hành, người trực hỗ trợ và cách báo sự cố.

Nếu phát hành đặt lịch, phải thống nhất giờ làm việc, ngày nghỉ, số người xử lý đồng thời, hạn mức online và cách phục vụ người đến trực tiếp. Thời lượng 30 phút chỉ là giả định nghiệp vụ đã trao đổi, không tự suy ra chỉ tiêu một ngày khi chưa chốt giờ làm việc.

**Kết quả:** một danh sách chức năng có người xác nhận nghiệm thu.

## 4. Bước 2 — Thuê một VPS và chốt ngân sách

### Cấu hình đã chọn

- 1 CPU, RAM 2 GB, SSD khoảng 50 GB, Linux bản hỗ trợ dài hạn tương thích Docker.
- Backend NestJS và MySQL chạy bằng Docker Compose; admin build thành tệp tĩnh do Caddy/Nginx phục vụ.
- Giữ thư mục ảnh trên ổ VPS, gắn vào container bằng bind mount hoặc volume bền vững.
- Build trên máy phát triển hoặc CI rồi chuyển artifact/image lên VPS để tránh thiếu RAM khi build tại máy production.
- Có thể chọn DigitalOcean Droplet hoặc VPS trong nước cấu hình tương đương. Nhà cung cấp cụ thể chưa được chốt; lấy giá gia hạn và điều kiện hỗ trợ trước khi mua.

### Dự toán tham chiếu DigitalOcean

Giá đã tra cứu ngày 16/11/2026; kiểm tra lại khi đặt mua.

| Hạng mục | Giá/tháng |
|---|---:|
| VPS 1 CPU, RAM 2 GB, SSD 50 GB | 12 USD |
| Backup toàn máy hằng ngày, gói 30% giá VPS | 3,60 USD |
| Backend, MySQL, admin, lưu ảnh | Dùng tài nguyên VPS đã thuê |
| Tổng cơ bản | 15,60 USD |

- Quy đổi minh họa 26.000 đồng/USD: **405.600 đồng/tháng**, **4.867.200 đồng/năm**. Không phải tỷ giá thanh toán được xác nhận.
- Chưa gồm thuế, tên miền, phí thẻ/tỷ giá, vượt hạn mức, công triển khai/vận hành, thông báo trả phí và chỗ lưu bản sao ứng dụng ngoài VPS.
- Tổng thực trả = giá VPS + backup máy chủ + lưu backup ngoài VPS + tên miền phân bổ + thuế/phí + công vận hành nếu thuê.
- Backup toàn máy không thay thế bản xuất MySQL nhất quán và bản sao ảnh. Chốt nơi lưu ngoài VPS trước khi phát hành; có thể tận dụng nơi lưu hiện hữu được đơn vị cho phép, còn dung lượng và có khả năng sao lưu tự động. Nếu phải mua mới, cộng riêng vào dự toán.
- Không mua thêm dịch vụ database hoặc kho ảnh riêng ở giai đoạn này. Không tính khuyến mãi tạm thời vào ngân sách dài hạn.

Nguồn: [Giá Droplet](https://www.digitalocean.com/pricing/droplets), [Giá backup](https://docs.digitalocean.com/products/backups/details/pricing/).

### Việc cần làm

1. Kiểm tra máy chủ/tên miền có sẵn của đơn vị để tận dụng nếu phù hợp.
2. Chọn khu vực đặt VPS theo yêu cầu đơn vị và độ trễ thực tế.
3. Xác nhận giá gia hạn, ổ đĩa, băng thông, backup, thuế và phí hỗ trợ.
4. Chỉ thuê một VPS ban đầu, không cam kết dài hạn trước khi chạy thử.
5. Giao người cập nhật hệ điều hành, Docker, MySQL và theo dõi sự cố. Nhà cung cấp VPS không mặc nhiên quản trị ứng dụng thay mình.

**Kết quả:** một VPS, ngân sách và người vận hành được chốt.

## 5. Bước 3 — Chuẩn bị tài khoản và tên miền

- [ ] Tạo tài khoản cloud do đơn vị kiểm soát; bật xác thực hai bước và lưu phương án khôi phục.
- [ ] Phân quyền cho kỹ thuật thay vì chia sẻ tài khoản chủ sở hữu.
- [ ] Dùng repository riêng tư phù hợp và cấp quyền tối thiểu cho dịch vụ triển khai.
- [ ] Chọn tên miền của đơn vị hoặc mua tên miền được đơn vị đồng ý.
- [ ] Tạo tên miền con cho API và admin.
- [ ] Đặt cảnh báo chi phí và email nhận hóa đơn.

Ví dụ dưới đây chỉ là mẫu, phải thay bằng tên miền thực:

```text
api.<ten-mien-don-vi>    → Backend
admin.<ten-mien-don-vi>  → Trang quản trị
```

Không lưu mật khẩu, private key, token hoặc DATABASE_URL thật trong tài liệu bàn giao công khai hay GitHub.

## 6. Bước 4 — Kiểm tra mã nguồn trước triển khai

Antigravity cần đọc cấu trúc thực tế, hướng dẫn dự án, package.json, schema Prisma, cấu hình build và biến môi trường trước khi sửa.

- [ ] Xác định thư mục Mini App, backend và admin; không tự giả định lệnh build/start.
- [ ] Xác nhận Prisma đang dùng MySQL và migration tương thích MySQL.
- [ ] Kiểm tra các API thật đang được gọi; không âm thầm thay bằng mock khi API lỗi.
- [ ] Kiểm tra backend xác thực người dùng và kiểm tra quyền trên từng thao tác quản trị.
- [ ] Không tin Zalo user ID do frontend tự khai báo; kiểm tra luồng xác thực backend đang dùng.
- [ ] Không đưa secret vào biến môi trường được đóng gói vào frontend.
- [ ] Backend nhận cổng từ cấu hình môi trường và lắng nghe trên địa chỉ phù hợp với nền tảng cloud.
- [ ] Có API kiểm tra tình trạng dịch vụ; log không chứa mật khẩu hoặc thông tin cá nhân không cần thiết.
- [ ] Có cấu hình production riêng, không commit file chứa secret.
- [ ] Chạy build và các kiểm thử hiện có cho backend, admin, Mini App.
- [ ] Ghi lại commit phát hành và các lỗi còn tồn tại.

**Kết quả:** mã nguồn build được, danh sách biến môi trường và lệnh triển khai được xác nhận.

## 7. Bước 5 — Sao lưu và chuẩn bị chuyển dữ liệu

1. Kiểm kê dữ liệu đang có: bài viết, thủ tục, niêm yết, người quản trị, lịch hẹn và đường dẫn tệp.
2. Xuất bản sao lưu MySQL hiện tại.
3. Sao lưu toàn bộ ảnh/tệp upload hiện tại.
4. Lưu một bản sao ngoài máy chạy ứng dụng, giới hạn quyền truy cập.
5. Thử phục hồi vào database kiểm thử riêng.
6. Đối chiếu số bản ghi, quan hệ, tiếng Việt và các đường dẫn ảnh sau phục hồi.
7. Chọn thời điểm chuyển đổi; thông báo tạm dừng nhập liệu trong lần sao chép cuối cùng để tránh bỏ sót bài mới/lịch hẹn mới.

Không xóa database gốc và không dùng seed dữ liệu mẫu ghi đè dữ liệu thật. Không chạy lệnh reset database trên production.

**Kết quả:** bản sao lưu đã thử phục hồi và danh sách dữ liệu cần chuyển.

## 8. Bước 6 — Chuẩn bị VPS và MySQL nội bộ

1. Tạo VPS theo cấu hình đã chọn, lưu thông tin truy cập ở nơi được bảo vệ.
2. Tạo tài khoản quản trị bằng SSH key; kiểm tra đăng nhập được trước khi hạn chế đăng nhập mật khẩu/root.
3. Cập nhật hệ điều hành, cài Docker Engine và Docker Compose theo tài liệu chính thức tương ứng hệ điều hành.
4. Cấu hình firewall: public HTTP/HTTPS; SSH chỉ từ nguồn quản trị phù hợp. Không publish cổng MySQL 3306 hoặc cổng backend ra Internet. Kiểm tra cả firewall nhà cung cấp và các cổng Docker đã publish.
5. Tạo cấu hình Compose với MySQL phiên bản tương thích dự án, ghim phiên bản image, health check và chính sách tự khởi động lại.
6. Gắn volume bền vững cho MySQL. Lưu secret ngoài Git, giới hạn quyền đọc trên máy chủ.
7. Tạo database và user riêng cho ứng dụng. Backend dùng tên service MySQL trong mạng Compose, không dùng localhost để gọi container khác.
8. Nhập dữ liệu đã sao lưu. Kiểm tra migration/baseline trước khi chạy quy trình migration production; không reset hoặc seed ghi đè.
9. Đối chiếu số bản ghi, tiếng Việt, ngày giờ và quan hệ dữ liệu.
10. Cấu hình xuất MySQL tự động và sao chép ra ngoài VPS theo mục sao lưu bên dưới.

Không chạy lệnh xóa volume như `docker compose down -v` trên production. Không xóa dữ liệu bằng lệnh dọn Docker chưa kiểm tra phạm vi.

**Kết quả:** MySQL chạy trên chính VPS, dữ liệu bền vững và chỉ được truy cập qua mạng nội bộ hoặc kênh quản trị được bảo vệ.

## 9. Bước 7 — Chuyển ảnh và tài liệu sang lưu trữ bền vững

Theo cách upload đã trao đổi trước đây, ảnh nằm ở backend/uploads. Antigravity phải kiểm tra lại mã nguồn để xác nhận đường dẫn thực tế.

1. Tạo thư mục upload bền vững trên host, ví dụ `/srv/zalo-mini-app/uploads`; đây là đường dẫn đề xuất, cần thống nhất với cấu hình thực tế.
2. Gắn thư mục này vào đúng đường dẫn upload trong container backend. Không lưu ảnh chỉ trong filesystem của container hoặc bên trong image build.
3. Cấp quyền đọc/ghi cho tiến trình backend, không dùng quyền toàn quyền cho mọi người để chữa lỗi.
4. Giữ dịch vụ upload hiện có nếu phù hợp; không bắt buộc đổi sang Object Storage.
5. Giữ kiểm tra kích thước, loại tệp, nội dung ảnh và nén ảnh. Chỉ phục vụ công khai các ảnh đã xác định là công khai.
6. Chuyển ảnh cũ vào thư mục mới, giữ đường dẫn API ảnh tương thích và kiểm tra bài cũ.
7. Đưa thư mục ảnh vào lịch backup ngoài VPS; theo dõi dung lượng chung với database và log.
8. Tạo lại container backend rồi kiểm tra ảnh vẫn còn; không chỉ kiểm tra restart cùng container.

Với các PDF Google Drive: có thể giữ liên kết trong giai đoạn đầu nếu phù hợp; kiểm tra quyền xem bằng tài khoản ngoài đơn vị. Không tự thay đổi chia sẻ của toàn bộ 53 tài liệu. Nếu cần chuyển tệp, phải xác nhận quyền công khai từng tài liệu.

**Kết quả:** upload mới và ảnh cũ đều hoạt động sau khi triển khai lại.

## 10. Bước 8 — Deploy backend

### Triển khai bằng Docker Compose trên VPS đã tạo

1. Chuẩn bị image backend đã build từ commit phát hành trên máy phát triển hoặc CI; gắn tag phiên bản cụ thể và giữ bản ổn định trước đó.
2. Bổ sung service backend vào Compose, kết nối mạng MySQL nội bộ và mount thư mục upload.
3. Khai báo kết nối MySQL, khóa xác thực và cấu hình production trong file môi trường được bảo vệ, không đưa vào image hoặc Git.
4. Cấu hình backend lắng nghe cổng container, health check, tự khởi động lại và thử kết nối lại database khi cần.
5. Cấu hình giới hạn log, tài nguyên phù hợp; điều chỉnh MySQL theo RAM thực tế và để lại RAM cho hệ điều hành/backend. Không mặc định dùng cấu hình database dành cho máy lớn.
6. Chạy migration đã kiểm tra như bước triển khai riêng, rồi khởi chạy backend.
7. Thêm Caddy hoặc Nginx: chỉ public 80/443, chuyển yêu cầu API đến backend trong mạng Docker.
8. Trỏ DNS tên miền API/admin về VPS, cấp chứng chỉ HTTPS và cấu hình gia hạn tự động. Nếu dùng Caddy, giữ dữ liệu chứng chỉ trên volume bền vững.
9. Kiểm tra log, health check, API đọc/ghi và khởi động lại VPS để xác nhận dịch vụ tự chạy lại.
10. Thiết lập backup ứng dụng, cảnh báo dung lượng và tài liệu xử lý sự cố.

Không chạy dev server/watch mode trên VPS production. Tối ưu phân trang và cache nội dung công khai; không dùng cache chung cho dữ liệu cá nhân hoặc kết quả đặt lịch.

### Tiêu chí chung

- [ ] API HTTPS truy cập được từ mạng di động.
- [ ] API đọc nội dung trả dữ liệu thật.
- [ ] Người không đăng nhập không gọi được API quản trị.
- [ ] Tài khoản quyền thấp không thực hiện được thao tác ngoài quyền.
- [ ] Có timeout, thông báo lỗi và giới hạn lạm dụng phù hợp.
- [ ] CORS được cấu hình theo origin thực tế của admin/Mini App; không suy đoán từ địa chỉ localhost. Không dùng dấu * với credential để chữa lỗi.
- [ ] Việc ghi dữ liệu và đọc lại thành công.

## 11. Bước 9 — Deploy trang admin

1. Cấu hình địa chỉ API production bằng đúng tên biến môi trường mà dự án đang sử dụng.
2. Build admin trên máy phát triển hoặc CI; đưa đầu ra build tĩnh lên chính VPS và phục vụ bằng Caddy/Nginx. Không chạy Vite dev server, không thuê thêm hosting admin. Giữ bản build trước để có thể khôi phục.
3. Cấu hình điều hướng SPA để mở hoặc tải lại trang con không gặp 404.
4. Gắn tên miền admin và HTTPS.
5. Kiểm tra CORS, đăng nhập, phiên hết hạn và đăng xuất.
6. Kiểm tra đăng/sửa/xóa hoặc ẩn bài theo quyền thực tế.
7. Kiểm tra upload ảnh, niêm yết, thủ tục, thông tin Trung tâm và lịch hẹn nếu có trong phạm vi.
8. Loại bỏ hoặc vô hiệu hóa tài khoản thử; đổi mật khẩu mặc định.

**Kết quả:** cán bộ làm việc trên admin trực tuyến và dữ liệu lưu vào MySQL cloud.

## 12. Bước 10 — Kết nối Mini App với backend chính thức

1. Đổi API base URL sang địa chỉ HTTPS cố định.
2. Kiểm tra bundle phát hành không còn localhost, 127.0.0.1 hoặc trycloudflare tạm cho dịch vụ production.
3. Kiểm tra URL ảnh và tệp cũng truy cập được ngoài mạng nội bộ.
4. Đối chiếu yêu cầu gọi API/domain trong tài liệu Zalo hiện hành và cập nhật phần cấu hình liên quan. Việc khai báo API Domains không thay thế cấu hình kết nối hoặc CORS của backend.
5. Khi mạng/API lỗi, hiển thị trạng thái lỗi và nút thử lại; không giả lập đặt lịch thành công.
6. Kiểm tra làm mới dữ liệu để bài mới từ admin xuất hiện, không bị cache giữ nội dung cũ vô hạn.
7. Build lại Mini App sau khi đổi cấu hình.

**Kết quả:** giao diện lấy dữ liệu từ backend cloud và xử lý lỗi rõ ràng.

## 13. Bước 11 — Deploy bản Testing lên Zalo

1. Mở đúng thư mục dự án Mini App trong công cụ phát triển có Zalo Mini App Extension.
2. Kiểm tra liên kết đúng Mini App ID. ID đã trao đổi: 3708226520121857707; xác nhận lại trên tài khoản sở hữu trước khi deploy.
3. Đăng nhập extension bằng tài khoản có quyền Admin hoặc Developer.
4. Vào tab Deploy, chọn Testing.
5. Nhập mô tả dễ truy vết, ví dụ: Release candidate 1 - API cloud - nội dung và lịch hẹn.
6. Deploy và đợi thông báo thành công.
7. Lưu số phiên bản, commit, thời điểm, môi trường API và QR/deeplink kiểm thử.
8. Cấp quyền thử nghiệm cho đúng người theo cơ chế của Zalo.

Development phục vụ thử nhanh và bị ghi đè; Testing là loại phiên bản để chuẩn bị gửi xét duyệt. Xem [hướng dẫn deploy chính thức](https://docs.zaloplatforms.com/docs/MA/devtools/ext/deploy).

## 14. Bước 12 — Nghiệm thu trên điện thoại

Thử trên Android và iPhone nếu có thiết bị, cả Wi-Fi lẫn 4G/5G.

| Mã | Tình huống | Điều kiện đạt |
|---|---|---|
| T01 | Tắt máy tính phát triển, mở Mini App | App vẫn tải được dữ liệu từ cloud |
| T02 | Admin đăng bài chính thức | Người dùng thấy bài sau thao tác làm mới đã thiết kế |
| T03 | Upload ảnh mới | Ảnh hiện đầy đủ trên điện thoại |
| T04 | Deploy lại backend | Ảnh/tệp và dữ liệu cũ còn nguyên |
| T05 | Mở thủ tục và niêm yết | Nội dung đúng, tệp đính kèm xem được |
| T06 | Mạng yếu hoặc mất mạng | Có thông báo rõ, không báo thành công giả |
| T07 | Truy cập API admin không đăng nhập | Backend từ chối |
| T08 | Người dùng xem dữ liệu của người khác | Backend từ chối thông tin cá nhân không thuộc quyền |
| T09 | Backup và phục hồi thử | Dữ liệu phục hồi được, có biên bản |
| T10 | Khởi động lại dịch vụ | Hệ thống tự hoạt động lại theo cấu hình |

Nếu có đặt lịch/lấy số trong bản phát hành, kiểm tra thêm:

- [ ] Đúng quầy: 1 tư pháp–hộ tịch; 2 kinh doanh–môi trường; 3 đất đai–quy hoạch; 4 văn hóa–giáo dục–y tế–thương binh và xã hội.
- [ ] Không đặt được ngày nghỉ, giờ đóng cửa, khung giờ đã hết chỗ.
- [ ] Nhiều người đặt đồng thời không vượt hạn mức, không trùng số.
- [ ] Bấm nhiều lần hoặc gửi lại yêu cầu do mạng yếu không tạo lịch trùng.
- [ ] Thành công chỉ được hiển thị sau khi backend xác nhận đã lưu.
- [ ] Phiếu xác nhận có mã/số, ngày giờ, quầy, thủ tục và hướng dẫn đến Trung tâm.
- [ ] Không bắt buộc nút Đã đến hoặc bước cán bộ check-in trong luồng đơn giản đã thống nhất.
- [ ] Cán bộ gọi/tiếp nhận/hoàn tất/vắng mặt theo quy tắc đã duyệt; không tự gọi lịch tương lai.
- [ ] Hủy lịch giải phóng chỗ đúng quy tắc, không làm hỏng số đã cấp.
- [ ] Lịch hẹn và số thứ tự không bị hiểu thành hồ sơ hành chính đã giải quyết xong.
- [ ] Ngày giờ đúng múi giờ Việt Nam, kể cả gần thời điểm chuyển ngày.

**Kết quả:** lưu bảng kiểm có người kiểm tra, ngày kiểm tra, kết quả và bằng chứng. Lỗi mất dữ liệu, vượt lịch, sai phân quyền hoặc mất ảnh phải sửa trước phát hành.

## 15. Bước 13 — Chuẩn bị hồ sơ gửi xét duyệt

- [ ] Kiểm tra trạng thái xác thực Mini App hiện tại; không chỉ dựa vào ảnh chụp cũ.
- [ ] Tên, logo, mô tả và danh mục phản ánh đúng chức năng đang cung cấp.
- [ ] Cập nhật thông tin liên hệ và nội dung về quyền riêng tư phù hợp dữ liệu thu thập thực tế.
- [ ] Xin/cấu hình các quyền API cần thiết theo tài liệu Zalo; bỏ yêu cầu quyền không sử dụng.
- [ ] Kiểm tra các liên kết ngoài như Google Drive và cổng dịch vụ công phù hợp chính sách xét duyệt hiện hành.
- [ ] Chuẩn bị hướng dẫn thao tác cho người xét duyệt, tài khoản kiểm thử nếu được yêu cầu; không chia sẻ tài khoản quản trị production.
- [ ] Giữ backend ổn định trong suốt quá trình xét duyệt.

**Kết quả:** phiên bản Testing và thông tin mô tả thống nhất với nhau.

## 16. Bước 14 — Gửi xét duyệt phiên bản

1. Vào trang quản lý Mini App bằng tài khoản có quyền gửi xét duyệt.
2. Mở Danh sách phiên bản.
3. Chọn đúng bản Testing đã nghiệm thu, đối chiếu số phiên bản và mô tả.
4. Chọn Submit for review và điền thông tin theo biểu mẫu hiện hành.
5. Ghi lại ngày gửi và trạng thái.
6. Nếu bị yêu cầu sửa, đọc lý do, sửa đúng phạm vi, kiểm thử và gửi lại bản phù hợp.

Không cam kết thời gian được duyệt. Gửi xét duyệt chưa phải phát hành công khai.

## 17. Bước 15 — Phát hành công khai

1. Khi phiên bản đã được duyệt, xác nhận lại backend, database, ảnh và admin hoạt động.
2. Xác nhận không có thay đổi backend làm hỏng phiên bản vừa được duyệt.
3. Chủ dự án xác nhận thời điểm vận hành và cán bộ hỗ trợ.
4. Chọn Publish cho đúng phiên bản được duyệt.
5. Mở liên kết chính thức bằng tài khoản Zalo không thuộc nhóm quản trị/thử nghiệm.
6. Thử các chức năng chính trên môi trường công khai.
7. Ghi lại phiên bản phát hành và thời điểm; sau đó mới phổ biến QR/link chính thức.

Quy trình chính thức: Testing → chờ xét duyệt → được duyệt → Publish. Nguồn: [Phát hành Mini App](https://docs.zaloplatforms.com/docs/MA/intro/public-mini-program).

## 18. Bước 16 — Theo dõi sau phát hành

Trong ngày đầu và tuần đầu:

- [ ] Theo dõi API lỗi, kết nối MySQL, thời gian phản hồi và tài nguyên sử dụng.
- [ ] Kiểm tra ảnh, liên kết tài liệu và nội dung do cán bộ cập nhật.
- [ ] Theo dõi số lịch hẹn, lỗi đặt trùng, hạn mức và phản hồi tại quầy.
- [ ] Kiểm tra backup thật sự tạo thành công.
- [ ] Kiểm tra hóa đơn/cảnh báo dung lượng và băng thông.
- [ ] Có người nhận phản ánh và ghi lại sự cố.

Định kỳ: cập nhật bảo mật, rà soát tài khoản, kiểm tra khôi phục backup và đánh giá nâng cấu hình dựa trên số liệu thực.

### Sao lưu trên mô hình một VPS

- Xuất MySQL bằng công cụ phù hợp để có bản sao nhất quán; không chỉ nén thư mục dữ liệu MySQL đang chạy.
- Sao lưu ảnh upload và cấu hình triển khai cần thiết; mã hóa bản sao chứa dữ liệu cá nhân hoặc secret.
- Tự động chuyển bản sao ra nơi lưu khác ngoài VPS. Bản sao nằm cùng ổ chỉ là bản tạm, không bảo vệ khi mất máy chủ.
- Mức khởi điểm cho dữ liệu nội dung: backup ứng dụng hằng ngày, giữ 7 bản ngày và 4 bản tuần nếu dung lượng cho phép. Giữ bản trước migration/deploy ảnh hưởng dữ liệu.
- Backup hằng ngày có thể mất tối đa khoảng một ngày cập nhật nếu sự cố xảy ra giữa hai lần sao lưu. Nếu bật lịch hẹn, phải chốt mức mất dữ liệu chấp nhận được và tăng tần suất hoặc bổ sung phục hồi theo thời điểm trước khi vận hành thật.
- Cảnh báo khi backup lỗi; kiểm tra dung lượng và thử phục hồi vào môi trường riêng trước phát hành, sau đó định kỳ.
- Backup toàn máy của nhà cung cấp là lớp bổ sung; không mặc định thời gian lưu của nhà cung cấp giống lịch backup ứng dụng trên.

### Khi nào nâng cấp

- Theo dõi RAM, CPU, ổ đĩa, thời gian phản hồi, lỗi timeout và tiến trình bị dừng do thiếu RAM.
- Ngưỡng cảnh báo ban đầu đề xuất: ổ đĩa trên 75%, RAM thường xuyên trên 80%, CPU cao kéo dài đi kèm phản hồi chậm. Điều chỉnh theo số liệu thực; không nâng máy chỉ vì một lần tăng tải ngắn.
- Ưu tiên phân trang, tối ưu truy vấn, nén ảnh, giới hạn log và build ngoài VPS.
- Nếu vẫn thiếu tài nguyên, nâng RAM lên 4 GB. Khi yêu cầu hoạt động liên tục hoặc lịch hẹn trở nên quan trọng, đánh giá tách MySQL và dự phòng.
- Chuyển ảnh sang kho tệp riêng khi ổ đĩa/băng thông tăng đáng kể; chưa cần mua ngay.

## 19. Phương án khi phát hành gặp lỗi

1. Nếu chỉ lỗi chức năng đặt lịch: tạm ngừng nhận lịch mới, giữ nguyên lịch đã xác nhận và thông báo cách liên hệ; không xóa lịch để chữa lỗi.
2. Nếu lỗi backend sau deploy: quay về bản backend ổn định đã lưu nếu tương thích database hiện tại.
3. Migration nên ưu tiên bổ sung, tương thích với phiên bản trước. Không tự chạy migration ngược làm mất dữ liệu.
4. Nếu cần sửa Mini App: tạo bản sửa và thực hiện quy trình của Zalo. Kiểm tra khả năng quay lại phiên bản trong giao diện hiện hành, không giả định luôn có nút rollback tức thì.
5. Nếu cần phục hồi database: xác định thời điểm backup, chốt dữ liệu mới có nguy cơ mất và xin quyết định của người phụ trách trước khi ghi đè.
6. Nếu mất toàn bộ VPS: tạo máy mới, phục hồi cấu hình Compose, MySQL và ảnh từ bản sao ngoài VPS; kiểm tra trước khi đổi DNS. Thời gian phục hồi phụ thuộc bản sao, dung lượng và người trực, không cam kết tự chuyển máy tức thì.
7. Lưu nhật ký sự cố, nguyên nhân và biện pháp tránh lặp lại.

## 20. Checklist quyết định phát hành

- [ ] Chốt nhà cung cấp, ngân sách và người vận hành.
- [ ] Backend HTTPS cố định, không phụ thuộc máy cá nhân.
- [ ] Database thật đã chuyển và kiểm tra.
- [ ] Backup ngoài VPS đã thử khôi phục; xác nhận mức mất dữ liệu chấp nhận được.
- [ ] MySQL không mở cổng Internet, dịch vụ tự chạy sau khi khởi động lại VPS.
- [ ] Database và upload có volume bền vững, log có giới hạn dung lượng.
- [ ] Ảnh/tệp tồn tại sau deploy lại.
- [ ] Admin đăng nhập và phân quyền đúng.
- [ ] Nội dung thử nghiệm được loại khỏi bản phục vụ người dân.
- [ ] Mini App dùng API production, không fallback dữ liệu giả.
- [ ] Kiểm thử 4G/5G khi máy tính phát triển đã tắt.
- [ ] Đặt lịch được nghiệm thu hoặc được ẩn khỏi bản phát hành.
- [ ] Bản Testing đã kiểm thử đầy đủ.
- [ ] Thông tin xét duyệt và quyền cần thiết đã chuẩn bị.
- [ ] Phiên bản được Zalo duyệt.
- [ ] Người phụ trách xác nhận phát hành.
- [ ] Kiểm tra tài khoản người dùng thông thường sau Publish.

## 21. Hướng dẫn giao việc cho Antigravity

Thực hiện từng bước theo tài liệu này, bắt đầu bằng đọc repository và báo cáo hiện trạng. Phương án đã chốt là một VPS RAM 2 GB; không tự đổi sang dịch vụ database quản lý hoặc nhiều nền tảng trả phí. Không đánh dấu hoàn thành từ suy đoán hoặc từ việc build thành công đơn thuần.

Hồ sơ kỹ thuật cần chuẩn bị (đường dẫn theo cấu trúc thực tế của repository):

- Dockerfile production và cách build ngoài VPS.
- File Docker Compose cho MySQL, backend và Caddy/Nginx; volume và mạng nội bộ rõ ràng.
- File môi trường mẫu không chứa secret, cấu hình web/HTTPS và hướng dẫn DNS.
- Quy trình migration, chuyển dữ liệu, backup/restore ngoài VPS và cập nhật phiên bản.
- Biên bản kiểm thử, cách xem log, theo dõi tài nguyên và quay về bản ổn định.

Mỗi bước cần bàn giao:

1. Những file/cấu hình đã thay đổi.
2. Cách kiểm tra và kết quả thực tế.
3. Những việc còn thiếu hoặc phụ thuộc chủ dự án.
4. Cách khôi phục nếu thay đổi gây lỗi.

Được chuẩn bị mã nguồn, cấu hình mẫu và kiểm thử trước. Mua dịch vụ, phát sinh phí, thay đổi dữ liệu production, gửi xét duyệt và Publish cần nằm trong phạm vi chủ dự án đã cho phép. Không yêu cầu gửi secret vào cuộc trò chuyện; hướng dẫn khai báo trên VPS bằng file/cơ chế secret được bảo vệ và không commit vào Git.

## 22. Tài liệu tham khảo

- [Zalo — Deploy bằng Extension](https://docs.zaloplatforms.com/docs/MA/devtools/ext/deploy)
- [Zalo — Phát hành Mini App](https://docs.zaloplatforms.com/docs/MA/intro/public-mini-program)
- [DigitalOcean — Giá VPS Droplet](https://www.digitalocean.com/pricing/droplets)
- [DigitalOcean — Giá sao lưu máy chủ](https://docs.digitalocean.com/products/backups/details/pricing/)
- [Docker — Cài Docker Engine](https://docs.docker.com/engine/install/)
- [Docker — Docker Compose](https://docs.docker.com/compose/)
- [Caddy — Tài liệu](https://caddyserver.com/docs/)

Các mốc giao diện, giá và quy định có thể thay đổi; kiểm tra tài liệu hiện hành khi thực hiện từng bước.
