# Kế hoạch phát triển Zalo Mini App Nghĩa Thành

Ngày lập: 13/10/2026

Đơn vị: Trung tâm Phục vụ hành chính công xã Nghĩa Thành.

Trạng thái: Kế hoạch đề xuất, chưa xác nhận các kết nối hệ thống bên ngoài. Các công nghệ và phiên bản phải được kiểm tra với dự án hiện tại trước khi triển khai.

## 1. Mục tiêu và phạm vi

Xây dựng Mini App cho người dân, website quản trị cho cán bộ và backend lưu dữ liệu, kết nối dịch vụ. Giữ dự án React/Vite hiện có và cấu hình Zalo đã chạy được.

| Nhóm chức năng | Bản đầu | Mở rộng |
|---|---|---|
| Trang chủ | Banner, tiện ích, tin nổi bật, OA, hotline | Cá nhân hóa khi cần |
| Thủ tục | Tìm kiếm, lọc lĩnh vực, chi tiết, biểu mẫu | Đồng bộ nguồn chính thức khi có API |
| Tin tức và hướng dẫn | Bài viết, video, tìm kiếm | Tích hợp xuất bản OA nếu cần |
| Niêm yết | Nội dung, tài liệu, thời hạn, lưu trữ | Đồng bộ hệ thống khác |
| Tra cứu hồ sơ | Mở cổng chính thức | Tra cứu trong app khi được cấp API |
| Nộp hồ sơ | Mở cổng nộp trực tuyến chính thức | Tích hợp sâu khi có API và thỏa thuận |
| Phản ánh | Chuẩn bị giao diện và phương án kết nối | Tiếp nhận riêng sau khi chốt quy trình |
| Liên hệ | Quan tâm OA, nhắn tin, gọi điện, địa chỉ, lịch làm việc | Thông báo chủ động khi đủ điều kiện |
| Trợ lý hỏi đáp | Câu hỏi và câu trả lời được duyệt | AI trả lời từ tài liệu được phê duyệt |

Không làm giả trạng thái hồ sơ hoặc kết quả gửi phản ánh. Phân biệt tra cứu thủ tục với tra cứu tiến độ hồ sơ cá nhân.

## 2. Công nghệ đề xuất

| Thành phần | Công nghệ | Mục đích |
|---|---|---|
| Mini App | React + Vite | Giữ nền tảng hiện tại |
| Giao diện | ZaUI + Tailwind CSS hiện có | Thành phần phù hợp điện thoại |
| Zalo | zmp-sdk | OA, cuộc gọi, quyền người dùng, chọn ảnh |
| Ngôn ngữ | Giữ JSX, chuyển dần TypeScript | Không buộc đổi toàn bộ trước khi làm chức năng |
| Gọi API | Lớp dịch vụ tập trung dùng fetch | Xử lý lỗi và phiên đăng nhập thống nhất |
| Backend | Node.js + TypeScript + NestJS | Backend module hóa |
| Database | MySQL | Dữ liệu có quan hệ và lịch sử |
| Truy cập dữ liệu | Prisma + migration | Quản lý cấu trúc dữ liệu |
| Quản trị | React + Vite + thư viện giao diện quản trị | Soạn bài, duyệt và xử lý phản ánh |
| Kho tệp | Lưu trữ tương thích S3 | Ảnh, video, tài liệu |
| Đặc tả API | OpenAPI | Hợp đồng frontend/backend |
| Kiểm thử | Vitest, kiểm thử API, Playwright | Nghiệp vụ và luồng web |
| Triển khai backend | Docker trên hạ tầng được đơn vị phê duyệt | Triển khai tái lập |
| CI | GitHub Actions | Kiểm tra PR và build |

Đọc package.json trước khi chọn phiên bản. Không tự nâng hàng loạt thư viện. Bản đầu dùng một backend chia module, chưa cần microservices hay Kubernetes.

## 3. Cấu trúc mã nguồn

```text
/
├── src/
│   ├── pages/
│   ├── components/
│   ├── features/
│   │   ├── procedures/
│   │   ├── posts/
│   │   ├── notices/
│   │   ├── feedback/
│   │   └── account/
│   ├── services/
│   │   ├── api/
│   │   └── zalo/
│   ├── assets/
│   └── mocks/
├── backend/
├── admin/
├── docs/
│   ├── architecture.md
│   ├── data-sources.md
│   ├── permissions.md
│   ├── acceptance-criteria.md
│   └── deployment.md
└── AGENTS.md
```

- services/zalo đóng gói SDK, cấp quyền và khác biệt giữa trình duyệt với Zalo.
- services/api đóng gói backend, phiên đăng nhập và xử lý lỗi mạng.
- Màn hình không gọi SDK/API rải rác theo nhiều cách.
- sources/ trong bản đồng bộ dự án ChatGPT là tài liệu chỉ đọc; không chỉnh sửa, di chuyển hoặc xóa.

## 4. Giao diện

Trang chủ: nhận diện trung tâm → tin nổi bật/hotline → dịch vụ công → niêm yết → OA → tiện ích. Các nút trùng chức năng cùng dẫn đến một màn hình.

| Hạng mục | Quy tắc |
|---|---|
| Nhận diện | Logo, banner và thông tin Nghĩa Thành |
| Màu | Xanh dương chủ đạo, màu phụ phân biệt tiện ích |
| Chữ | Nội dung chính khoảng 16px trở lên |
| Vùng bấm | Khoảng 44 × 44px trở lên |
| Điều hướng | Trang chủ, Thủ tục, Tin tức, Của tôi |
| Khung Zalo | Chừa khoảng an toàn, không vẽ lại nút đóng/menu hệ thống |
| Biểu mẫu | Nhãn rõ, trường bắt buộc, lỗi cạnh trường |
| Trạng thái | Đang tải, rỗng, lỗi, mất mạng, thành công |
| Tài liệu | Ưu tiên đọc nội dung trong app; kiểm thử PDF trên Android/iOS |
| Dữ liệu mẫu | Có nhãn, tách khỏi dữ liệu thật |

Màn hình cần có: trang chủ; danh sách/chi tiết thủ tục; danh sách/chi tiết tin; hướng dẫn và video; niêm yết; liên hệ và lịch làm việc; FAQ; phản ánh và lịch sử nếu tiếp nhận riêng.

Không sao chép số điện thoại, địa chỉ hoặc ảnh trụ sở Ngãi Giao sang Nghĩa Thành.

## 5. Backend và dữ liệu

| Module | Trách nhiệm |
|---|---|
| auth | Xác thực Zalo cho người dân, đăng nhập cán bộ riêng |
| center | Banner, liên hệ, lịch, OA, liên kết |
| procedures | Thủ tục, lĩnh vực, biểu mẫu, nguồn, hiệu lực |
| content | Tin tức, hướng dẫn, video, FAQ |
| notices | Niêm yết và thời hạn công khai |
| feedback | Tiếp nhận, phân công, trả lời, lịch sử |
| files | Kiểm tra tải lên, lưu tệp, cấp quyền truy cập |
| integrations | Zalo và hệ thống hồ sơ bên ngoài |
| audit | Nhật ký thao tác quan trọng |

Thủ tục lưu tên, mã nếu có, lĩnh vực, cơ quan thực hiện, thành phần hồ sơ, cách nộp, thời hạn, phí, nguồn chính thức, ngày rà soát và hiệu lực.

Phản ánh tách dữ liệu người gửi, nội dung, tệp, người phụ trách, câu trả lời và lịch sử trạng thái. Không ghi đè làm mất lịch sử.

Phân quyền cán bộ: quản trị viên, biên tập viên, người duyệt, cán bộ xử lý. Kiểm tra quyền tại backend trên từng tài nguyên.

## 6. API backend đề xuất

Đây là API tự xây dựng, không phải API có sẵn của Zalo. Tất cả danh sách có phân trang; lỗi trả về mã rõ ràng.

| API | Chức năng |
|---|---|
| GET /api/v1/home | Banner, tiện ích, tin nổi bật |
| GET /api/v1/center | Liên hệ, lịch, địa chỉ, OA |
| GET /api/v1/procedures | Tìm kiếm và lọc thủ tục |
| GET /api/v1/procedures/:id | Chi tiết và nguồn |
| GET /api/v1/posts | Tin, hướng dẫn, video |
| GET /api/v1/posts/:id | Chi tiết bài |
| GET /api/v1/notices | Niêm yết và lưu trữ |
| GET /api/v1/faqs | Hỏi đáp được duyệt |
| POST /api/v1/auth/zalo | Xác minh Zalo, tạo phiên |
| POST /api/v1/uploads | Tải tệp hợp lệ |
| POST /api/v1/feedback | Gửi phản ánh |
| GET /api/v1/me/feedback | Phản ánh của người dùng |
| GET /api/v1/me/feedback/:id | Chi tiết và câu trả lời |
| POST /api/v1/case-lookups | Chỉ bật khi có kết nối hồ sơ được cấp |
| POST /api/v1/admin/posts/:id/publish | Đăng bài sau kiểm tra quyền |
| POST /api/v1/admin/feedback/:id/replies | Cán bộ trả lời |

## 7. API Zalo

| Nhu cầu | API | Quy tắc |
|---|---|---|
| Quan tâm OA | followOA | Khi người dân chủ động bấm |
| Nhắn tin | openChat | OA chính thức của trung tâm |
| Hotline | openPhone | Số đã xác nhận |
| Cổng dịch vụ công | openWebview | Liên kết chính thức, phù hợp yêu cầu nền tảng |
| Phiên đăng nhập | getAccessToken | Backend xác minh rồi cấp phiên riêng |
| Tên/ảnh | getUserInfo | Khi thực sự cần, theo quyền |
| Số điện thoại | getPhoneNumber | Token xử lý ở backend |
| Ảnh | openMediaPicker | Backend riêng lưu tệp |
| Quyền | getSetting, authorize | Có luồng khi từ chối |

Không buộc cấp điện thoại, vị trí hoặc quan tâm OA để đọc nội dung công khai. Không dùng Zalo user ID do client tự gửi như bằng chứng xác thực.

Khóa bí mật chỉ nằm ở backend. Một số quyền cần được Zalo cấp trước khi người dùng ngoài nhóm developer/admin sử dụng. Kiểm thử SDK trên Zalo thật, không chỉ localhost.

Thông báo chủ động là hạng mục riêng: chốt kênh, quyền, điều kiện, mẫu và chi phí nếu có trước khi triển khai. Theo dõi OA không đồng nghĩa được gửi mọi thông báo không giới hạn.

## 8. Luồng nghiệp vụ

### 8.1 Nội dung

Cán bộ soạn → nháp → gửi duyệt → duyệt → công khai. Sửa bài đã đăng tạo bản sửa chờ duyệt. Nội dung chưa duyệt không xuất hiện qua API công khai.

Niêm yết có ngày bắt đầu/kết thúc, tài liệu và lịch sử. Hết hạn chuyển lưu trữ, không tự xóa.

### 8.2 Tra cứu và nộp hồ sơ

Bản đầu mở cổng chính thức. Khi được cấp API: người dân nhập thông tin → backend xác minh quyền theo hệ thống nguồn → gọi API → trả kết quả và thời điểm cập nhật.

Không dùng mã hồ sơ dễ đoán làm yếu tố duy nhất để xem dữ liệu cá nhân. Lỗi kết nối phải báo chưa tra cứu được, không tạo kết quả giả hoặc hiển thị dữ liệu cũ như mới.

### 8.3 Phản ánh

Cần chọn một phương án:

- Mở Cổng DVCQG: người dân thao tác tại cổng; hệ thống không tự có bản sao hoặc trạng thái.
- Trung tâm tiếp nhận riêng: cần người phụ trách và quy trình vận hành.

Luồng tiếp nhận riêng: nhập nội dung → xác thực → chọn ảnh → xem lại → gửi → backend lưu và cấp mã → tiếp nhận → phân công → trả lời → người dân xem kết quả.

Trạng thái: Đã gửi → Đã tiếp nhận → Đang xử lý → Đã trả lời → Đóng. Có nhánh Yêu cầu bổ sung/Chuyển đơn vị với lý do và lịch sử.

Chống gửi lặp bằng khóa idempotency; chỉ báo thành công sau khi lưu. Phản ánh và ảnh riêng tư chỉ người gửi/cán bộ có quyền xem. Công khai cần duyệt và loại thông tin cá nhân.

### 8.4 Hỏi đáp

Bản đầu tìm trong FAQ được duyệt. AI bổ sung sau phải truy xuất tài liệu được phép, dẫn nguồn và chuyển cán bộ khi thiếu căn cứ. Không tự xác nhận hồ sơ hợp lệ hoặc quyết định kết quả hành chính. Nội dung người dùng/tài liệu không được coi là lệnh gọi công cụ quản trị.

## 9. Skill đề xuất cho trợ lý lập trình

Đây là các skill cần viết, chưa phải skill đã cài. Mỗi skill có: điều kiện áp dụng, đầu vào, quy trình, kiểm tra, kết quả bàn giao.

| Skill | Phạm vi | Kiểm tra bắt buộc |
|---|---|---|
| miniapp-ui | Màn hình | Thành phần chung, đủ trạng thái, màn hình nhỏ |
| zalo-integration | SDK | Tài liệu chính thức, phiên bản, quyền, từ chối, thiết bị |
| backend-api | API | Hợp đồng, validation, xác thực, quyền, lỗi |
| content-workflow | Nội dung | Nguồn, duyệt, hiệu lực, lịch sử |
| feedback-workflow | Phản ánh | Quyền sở hữu, trạng thái, phân công, chống trùng |
| database-migration | Database | Migration bảo toàn dữ liệu, khôi phục |
| release-check | Phát hành | Build, secrets, quyền, dữ liệu mẫu, môi trường |

## 10. Rule chung cho AGENTS.md

1. Đọc package.json và cấu trúc trước khi sửa.
2. Giữ cấu hình Zalo; không tự đổi framework hoặc nâng hàng loạt thư viện.
3. Tiếng Việt rõ ràng, ưu tiên điện thoại.
4. Không bịa thủ tục, phí, thời hạn, liên hệ hoặc trạng thái hồ sơ.
5. Dữ liệu mẫu tách riêng và có nhãn.
6. Không đưa khóa bí mật, token dịch vụ, mật khẩu vào frontend/Git.
7. Backend xác minh danh tính, không tin user ID do client tự khai.
8. Kiểm tra quyền trên từng dữ liệu cá nhân và thao tác quản trị.
9. Chỉ báo gửi thành công khi backend xác nhận lưu.
10. Không tự tạo API giả của cổng dịch vụ công.
11. Bài công khai qua quy trình duyệt thống nhất.
12. Xin quyền Zalo đúng lúc; xử lý khi từ chối.
13. Không ghi secrets, nội dung phản ánh và thông tin cá nhân vào log thông thường.
14. Không sửa việc ngoài phạm vi hoặc tài liệu sources/ chỉ đọc.
15. Không tự push, merge, deploy production hoặc phát hành Zalo nếu chưa được yêu cầu.
16. Báo thay đổi, kiểm tra đã thực hiện và giới hạn chưa kiểm tra.

Đảm bảo công cụ AI thực sự đọc AGENTS.md; nếu không tự nạp, cấu hình quy tắc công cụ để yêu cầu đọc. Các ràng buộc dữ liệu và bảo mật phải được triển khai bằng mã, không chỉ bằng lời nhắc.

## 11. Vận hành và bảo vệ dữ liệu

- API dùng HTTPS, CORS đúng origin và môi trường.
- Tệp có giới hạn dung lượng, kiểm tra loại tệp, quyền truy cập; tệp riêng không dùng URL công khai cố định.
- Tài khoản cán bộ riêng; không cung cấp quyền chỉnh sửa công khai.
- Giới hạn tần suất gửi phản ánh và tra cứu.
- Có chính sách lưu giữ dữ liệu do đơn vị quyết định.
- Sao lưu database/kho tệp, kiểm thử khôi phục.
- Ghi audit thao tác quản trị, không ghi dư dữ liệu nhạy cảm.
- Quy định người phụ trách nội dung, xử lý phản ánh, hạ tầng và sự cố trước khi phát hành.

## 12. Git và môi trường

- main: bản ổn định.
- Nhánh theo việc: feature/home-page, feature/content-api, feature/feedback.
- PR nhỏ, xem diff và chạy kiểm tra phù hợp.
- Không để nhiều trợ lý sửa cùng file đồng thời.
- Local: dữ liệu mẫu; staging: dữ liệu thử; production: dữ liệu thật, quyền hạn chặt chẽ.
- Không đưa .env, node_modules, token hoặc dữ liệu người dân lên Git.

## 13. Kiểm thử nghiệm thu

- Người A không xem được phản ánh/tệp của người B.
- Biên tập viên không tự thực hiện quyền của người duyệt.
- Từ chối quyền Zalo vẫn xem được nội dung công khai.
- Gửi nhiều lần không tạo phản ánh trùng.
- Mất mạng không báo gửi thành công.
- Bài chưa duyệt/niêm yết chưa đến hạn không lộ qua API công khai.
- Nguồn tra cứu lỗi không trả kết quả giả.
- Khôi phục được từ bản sao lưu.
- Kiểm thử Android/iOS và tài khoản ngoài nhóm developer/admin.
- Kiểm tra điện thoại nhỏ, chữ dài, dữ liệu rỗng, tài liệu PDF và mạng chậm.

## 14. Lộ trình

| Mốc | Việc làm | Điều kiện hoàn thành |
|---|---|---|
| M0 | Đọc dự án, thư viện, Git, rule, môi trường | Build được, không có secrets trong Git |
| M1 | Trang chủ và các màn hình | Điều hướng đúng, tốt trên điện thoại |
| M2 | Backend, database, quản trị nội dung | Soạn–duyệt–đăng–đọc hoàn chỉnh |
| M3 | SDK Zalo | OA, gọi điện, xác thực/quyền thử trên thiết bị |
| M4 | Phản ánh riêng nếu được chọn | Gửi–tiếp nhận–trả lời đúng phân quyền |
| M5 | Phát hành | Dữ liệu thật, công văn, kiểm thử, duyệt, sao lưu |
| M6 | Hồ sơ API, AI, thông báo | Có dữ liệu, quyền và quy trình rõ ràng |

Bắt đầu với M0 và M1, không làm toàn bộ chức năng trong một yêu cầu AI.

## 15. Các quyết định còn cần chốt

1. Phản ánh chuyển Cổng DVCQG hay trung tâm tiếp nhận riêng?
2. Nguồn chính thức cho thủ tục, tra cứu hồ sơ và nộp trực tuyến là gì?
3. Hạ tầng/tên miền nào được đơn vị cho phép sử dụng?
4. OA ID, hotline, địa chỉ và lịch làm việc đã xác nhận?
5. Ai soạn, ai duyệt, ai xử lý phản ánh và quản trị hệ thống?
6. Chế độ lưu giữ dữ liệu, sao lưu và thông báo nào được áp dụng?

Chốt hạ tầng trước M2, chốt quy trình phản ánh trước M4. Không coi chưa có câu trả lời là đã đồng ý phương án.

## 16. Tài liệu tham khảo

- [Tài liệu Zalo Mini App](https://docs.zaloplatforms.com/mini-app-platform)
- [Cấp quyền người dùng](https://docs.zaloplatforms.com/docs/MA/api/user/authorization/authorize)
- [Quan tâm OA](https://docs.zaloplatforms.com/docs/MA/api/zalo/followOA)
- [Nhắn tin OA](https://docs.zaloplatforms.com/docs/MA/api/zalo/openChat)
- [Gọi điện](https://docs.zaloplatforms.com/docs/MA/api/device/contact/openPhone)
- [Lưu ý kỹ thuật, backend và kiểm thử](https://docs.zaloplatforms.com/docs/MA/intro/getting-started/frequently-solved-issues)
- [Phát hành Mini App](https://docs.zaloplatforms.com/docs/MA/intro/public-mini-program)

Đối chiếu tài liệu và phiên bản SDK thực tế khi triển khai từng tính năng.

## 17. Kế hoạch triển khai và phát hành công khai (M5)

### 17.1. Hiểu đúng các trạng thái

- Mini App **đã xác thực** chỉ đủ điều kiện gửi phiên bản xét duyệt, chưa đồng nghĩa đã công khai.
- **Development** dùng phát triển nhanh. **Testing** là phiên bản được lưu trong Quản lý phiên bản và có thể gửi xét duyệt. Zalo chuyển phiên bản qua **Chờ xét duyệt** và **Đã duyệt**; chỉ phiên bản Đã duyệt mới chọn **Publish** để phân phối tới người dùng.
- Bản Testing hiện có và URL Quick Tunnel dạng trycloudflare.com chỉ chứng minh khả năng thử nghiệm. Quick Tunnel phụ thuộc tiến trình/máy đang chạy, địa chỉ có thể đổi; không dùng làm API production.
- Kế hoạch bên dưới là việc **cần làm**, không xác nhận dự án hiện đã sẵn sàng hoặc đã Publish.

### 17.2. Công cụ và người phụ trách

| Việc | Công cụ | Kết quả |
|---|---|---|
| Quản lý mã | Git, GitHub, PR, tag | Chốt chính xác commit của Mini App, backend và admin; có điểm quay lại |
| Kiểm tra | Node.js/npm, test/build của ba phần; GitHub Actions nếu triển khai CI | Báo cáo đạt và danh sách lỗi còn mở |
| Hạ tầng | Máy chủ được đơn vị phê duyệt, Docker/Compose nếu phù hợp, DNS, HTTPS qua Caddy/Nginx hoặc dịch vụ tương đương | API và admin chạy ổn định qua tên miền chính thức |
| Dữ liệu | MySQL, Prisma migration, sao lưu và thử khôi phục | Dữ liệu thật bền vững, không phụ thuộc máy cá nhân |
| Quan sát | Uptime, log đã lọc dữ liệu nhạy cảm, cảnh báo lỗi/dung lượng/TLS | Có người nhận và xử lý sự cố |
| Zalo | VS Code + Zalo Mini App Extension hoặc CLI; trang Quản lý Zalo Mini App | Testing, xét duyệt, Publish đúng phiên bản |
| Nghiệm thu | Zalo Android/iOS, DevTools, tài khoản thử | Bằng chứng luồng chính hoạt động trên điện thoại |

Phân công tối thiểu: người xác nhận nội dung/dữ liệu chính thức, người vận hành hạ tầng, người có quyền Admin/Developer Mini App, người chấp thuận phát hành, người trực sự cố. Lưu danh sách người phụ trách và cửa sổ phát hành trong biên bản nội bộ, không đưa thông tin nhạy cảm lên Git.

### 17.3. Quy trình từng bước

**Bước 0 — Chốt phạm vi đợt phát hành.**

1. Liệt kê các màn hình/chức năng sẽ công khai: tin tức, hướng dẫn, thủ tục, niêm yết, OA, hotline, tra cứu, phản ánh... Chỉ đưa chức năng có nguồn dữ liệu chính thức và backend thật; hoàn thiện hoặc ẩn phần chưa đạt.
2. Chốt M4 (phản ánh riêng) có nằm trong đợt đầu không. Nếu có, nghiệm thu quyền truy cập, xác thực và cách xử lý dữ liệu cá nhân.
3. Xác nhận tên, logo, mô tả, danh mục Mini App, nội dung, liên kết ngoài, nguồn dữ liệu, hotline/địa chỉ/giờ làm việc và quyền sử dụng hình ảnh. Không dùng dữ liệu mock như dữ liệu thật.
4. Chỉ định người soạn, duyệt, đăng, vận hành và xử lý sự cố.

**Bước 1 — Chuẩn bị hạ tầng production.**

1. Chốt tên miền API và admin do đơn vị phê duyệt; cấu hình DNS, chứng chỉ HTTPS hợp lệ, reverse proxy hoặc HTTPS ingress.
2. Chạy NestJS backend trên máy chủ/dịch vụ ổn định; build và phục vụ trang admin qua HTTPS. Route /api/v1 của admin phải đi đến **cùng backend production** vì admin/src/services/api.js hiện gọi URL tương đối /api/v1.
3. Dựng MySQL production với lưu trữ bền vững, giới hạn mạng, tài khoản riêng cho backend. backend/compose.yaml hiện **chỉ dựng MySQL local**, công bố cổng 127.0.0.1:3307; không coi đó là cấu hình production hoàn chỉnh.
4. Chọn kho upload bền vững, sao lưu database và tệp cùng nhau; kiểm tra quyền truy cập tệp. Thiết lập theo dõi uptime, lỗi API, dung lượng đĩa, TLS hết hạn. Thử khởi động lại và khôi phục từ sao lưu.

**Bước 2 — Cấu hình production và domain Zalo.**

1. Tạo biến môi trường dựa trên .env.example và backend/.env.example, lưu bí mật ở nơi quản lý cấu hình của máy chủ. Xác minh DATABASE_URL, JWT_SECRET, ZALO_APP_ID, ZALO_APP_SECRET, ZALO_OA_SECRET_KEY, CORS_ORIGIN, UPLOAD_DIR. Không commit file .env; không đặt secret trong biến VITE_ vì frontend sẽ chứa giá trị này.
2. Trước khi build Mini App, đặt VITE_API_BASE_URL thành URL HTTPS đầy đủ tới /api/v1 của backend chính thức. Mã src/services/api/index.js chỉ dùng localhost:3001 khi chạy ở localhost; trên Zalo dùng URL được đóng gói lúc build.
3. Cấu hình VITE_ZALO_OA_ID và VITE_HOTLINE bằng giá trị đã xác nhận. Kiểm tra không còn request nào đến localhost hoặc trycloudflare.com trong bản định phát hành.
4. Rà soát CORS ở backend/src/main.ts với origin thực tế của admin và Zalo; kiểm tra bằng Zalo thật. Không mở toàn bộ origin. API và tệp cần HTTPS.
5. Trên trang Quản lý Mini App → Cấu hình API Domains, thêm tên miền API HTTPS ổn định theo định dạng giao diện Zalo yêu cầu, bật trạng thái cần thiết và lưu. Kiểm tra lại request từ bản Testing. Nếu tải hình/tệp từ domain riêng, kiểm tra cấu hình và quyền tương ứng.

**Bước 3 — Kiểm tra mã, dữ liệu và admin.**

1. Khóa commit phát hành, kiểm tra diff và secret. Ở thư mục gốc chạy npm ci, npm test, npm run build. Ở backend chạy npm ci, npm run typecheck, npm test, npm run build. Ở admin chạy npm ci, npm run build. Chỉ đánh dấu đạt nếu lệnh chạy thành công.
2. Sao lưu production trước thay đổi schema. Xác nhận DATABASE_URL đang trỏ đúng production rồi chạy npm run prisma:deploy từ backend. Không dùng prisma migrate dev hoặc seed dữ liệu mẫu trên production.
3. Triển khai backend và admin, kiểm tra API từ mạng ngoài: HTTPS, dữ liệu công khai, quyền 401/403, nội dung nháp không lộ, upload/tệp, đăng nhập và phân quyền admin. Nếu cần giám sát tự động, bổ sung endpoint kiểm tra sức khỏe; không mặc định coi dự án đã có endpoint này.
4. Đăng và duyệt một bài thử theo quy trình trên admin, xác nhận bản Mini App dùng **cùng database production** rồi thu hồi bài thử theo quy trình nội dung.

**Bước 4 — Deploy Testing và nghiệm thu trên điện thoại.**

1. Trong Zalo Mini App Extension, đăng nhập tài khoản Admin/Developer, xác nhận đúng Mini App ID, chọn **Testing**, viết mô tả phiên bản rồi Deploy. Dự án cũng có lệnh npm run deploy nếu CLI đã cấu hình đúng; đối chiếu môi trường/ID trước khi thực hiện.
2. Ghi số phiên bản, commit, cấu hình API, thời điểm, QR/deep link và các thay đổi. Mở bằng Zalo trên Android và iOS, thử Wi-Fi/4G, mạng chậm/mất mạng, dữ liệu rỗng và lỗi backend.
3. Thử trang chủ → danh sách → chi tiết bài/thủ tục/niêm yết, OA, hotline, liên kết ngoài; xin quyền Zalo đúng lúc và thử từ chối. Duyệt một bài trên admin rồi xác nhận bài xuất hiện trên điện thoại sau khi làm mới.
4. Với dữ liệu cá nhân, dùng hai tài khoản thử khác nhau để chứng minh không xem/sửa chéo. Kiểm tra vai trò biên tập, duyệt và quản trị trên admin.
5. Ghi lỗi kèm thiết bị, phiên bản Zalo, bước tái hiện, request API, ảnh đã che dữ liệu nhạy cảm. Sửa rồi tạo Testing mới, nghiệm thu lại. Tài khoản thường chỉ kiểm chứng khả năng truy cập công khai sau Publish.

**Bước 5 — Gửi xét duyệt phiên bản.**

1. Vào Trang Quản lý Zalo Mini App → Quản lý phiên bản / Danh sách phiên bản, chọn đúng bản **Testing** đã nghiệm thu, nhấn **Submit for review**.
2. Điền mô tả/hướng dẫn kiểm thử mà cổng yêu cầu. Đảm bảo tên, logo, danh mục, chức năng, liên kết và quyền Zalo khớp khai báo; cung cấp luồng/tài khoản thử nếu giao diện yêu cầu.
3. Theo dõi trạng thái **Chờ xét duyệt**. Nếu Zalo yêu cầu sửa, ghi phản hồi, sửa, deploy Testing mới và gửi lại. Không nhầm “Đã xác thực Mini App” với “Đã duyệt phiên bản”.

**Bước 6 — Publish sau khi được duyệt.**

1. Điều kiện quyết định: phiên bản **Đã duyệt**; backend/admin và domain ổn định; sao lưu khôi phục được; nội dung được đơn vị xác nhận; có người trực và chấp thuận phát hành.
2. Đối chiếu số phiên bản, ghi chú, commit; chọn **Publish** đúng bản Đã duyệt. Ghi thời điểm và người thao tác.
3. Mở Mini App bằng tài khoản Zalo **ngoài nhóm Admin/Developer** để xác nhận truy cập, bài mới, chi tiết, liên kết và API. Chỉ truyền thông/đặt QR công khai sau kiểm tra thực tế.
4. Theo dõi lỗi và phản hồi trong 24–72 giờ đầu.

**Bước 7 — Vận hành và phương án quay lại.**

1. Theo dõi API/MySQL, log lỗi đã lọc, thời gian tải, dung lượng và sao lưu; kiểm thử khôi phục định kỳ.
2. Mỗi thay đổi code Mini App: build với URL production → Testing → nghiệm thu → xét duyệt → Publish bản Đã duyệt. Bài viết mới đi qua admin/API/database và quy trình duyệt nội dung, thông thường không cần deploy lại gói Mini App.
3. Giữ tag/build/cấu hình bản ổn định trước. Khi sự cố, khôi phục backend ổn định và chọn lại phiên bản Zalo đã duyệt nếu cổng cho phép. Kiểm tra tương thích schema; không tự hoàn tác migration hoặc ghi đè database khi chưa có kế hoạch và sao lưu đã thử.

### 17.4. Checklist sẵn sàng công khai

- [ ] Tên miền, hạ tầng, người phụ trách và phạm vi phát hành được đơn vị phê duyệt.
- [ ] API/admin production có HTTPS, hoạt động từ mạng ngoài; API domain được cấu hình trong Zalo.
- [ ] MySQL/upload bền vững, sao lưu và khôi phục thử thành công.
- [ ] Secret nằm ngoài Git/frontend; quyền backend, CORS và dữ liệu cá nhân được kiểm thử.
- [ ] Không còn mock, localhost hoặc Quick Tunnel trong bản Zalo phát hành; nội dung là dữ liệu đã xác nhận.
- [ ] Test/build Mini App, backend, admin đạt; không còn lỗi nghiêm trọng.
- [ ] Admin đăng/duyệt bài và Zalo Android/iOS nhận được dữ liệu thật; luồng lỗi/mất mạng đúng.
- [ ] Tên, logo, mô tả, danh mục, liên kết, quyền Zalo khớp hồ sơ xét duyệt.
- [ ] Đúng phiên bản Testing có trạng thái **Đã duyệt**.
- [ ] Người có thẩm quyền chấp thuận Publish; có người trực và phương án quay lại.
- [ ] Đã Publish; tài khoản Zalo thông thường mở được ứng dụng và dữ liệu production.

**Tài liệu chính thức để đối chiếu khi thao tác:** [Phát hành Zalo Mini App](https://docs.zaloplatforms.com/docs/MA/intro/public-mini-program), [Deploy bằng VS Code Extension](https://docs.zaloplatforms.com/docs/MA/devtools/ext/deploy). Nhãn nút và quy trình cổng quản lý có thể thay đổi; đối chiếu giao diện/tài liệu Zalo tại ngày phát hành.

## 18. Kế hoạch chức năng lấy số thứ tự và đặt lịch hẹn

### 18.1. Mục tiêu và phạm vi

Xây dựng hai cách phục vụ qua các kênh người dân đang dùng:

- **Mini App — lấy số trong ngày:** người dân chọn lĩnh vực/thủ tục, hệ thống xác định quầy, cấp số duy nhất theo ngày và quầy, cho xem trạng thái hàng chờ.
- **Zalo Official Account (OA) — đặt lịch trước:** người dân bắt đầu từ OA và đặt lịch cho lĩnh vực/quầy, ngày và khung giờ còn chỗ. OA có thể mở Mini App để hoàn tất biểu mẫu; backend dự án vẫn là nguồn dữ liệu và quy tắc chính. Không giả định OA tự có hệ thống giữ lịch nếu chưa tích hợp/kiểm chứng API hoặc cơ chế biểu mẫu cụ thể.
- **Admin/quầy — vận hành:** cán bộ quản lý lĩnh vực, giờ làm, hạn mức, xem danh sách, gọi lượt và cập nhật trạng thái lịch hẹn/số thứ tự.

Hai luồng phải dùng **cùng backend và database** để nhìn được tổng tải của từng quầy, tránh vượt năng lực phục vụ. Không cấp số hoặc giữ chỗ chỉ bằng logic trên điện thoại/OA.

### 18.2. Quy tắc nghiệp vụ cần xác nhận

Trước khi code, lập biên bản xác nhận các mục dưới đây; chưa có số liệu thì không tự đặt mặc định trong production:

1. Mã và tên lĩnh vực; thủ tục nào thuộc lĩnh vực/quầy nào; người chịu trách nhiệm cập nhật danh mục khi phân công quầy thay đổi.
2. Giờ hoạt động, ngày nghỉ/lịch đặc biệt, thời điểm mở và đóng lấy số/đặt lịch, múi giờ áp dụng.
3. Sức chứa theo quầy/ngày/khung giờ; phần chỗ dành cho lịch hẹn, lấy số trong ngày và người đến trực tiếp; quy tắc điều chuyển chỗ chưa dùng giữa các nhóm.
4. Đặt lịch xác nhận ngay hay chờ cán bộ duyệt; khoảng thời gian được đặt trước; độ dài khung giờ; số lịch mỗi khung.
5. Số thứ tự đánh lại theo ngày hay theo quầy; có hàng chờ riêng theo quầy không; số ưu tiên theo quy định/quy trình địa phương và cách cán bộ nhập số tại chỗ.
6. Quy tắc đến trễ, không đến, hủy/đổi lịch, gọi lại, chuyển quầy, hồ sơ thiếu, mất điện/mạng và đóng quầy đột xuất.
7. Thông tin tối thiểu cần nhận từ người dân, có cần xác minh số điện thoại không, ai được xem, thời hạn lưu và cách xử lý yêu cầu xóa/đính chính.
8. Cách OA bắt đầu đặt lịch: menu/nút dẫn đến Mini App, liên kết sâu theo lĩnh vực, hay API/biểu mẫu OA được nền tảng hỗ trợ. Xác minh quyền, điều kiện gửi tin nhắc và chi phí/quota trước khi đưa vào phạm vi.

### 18.3. Luồng người dân

**Lấy số trong ngày trên Mini App**

1. Chọn “Lấy số” → chọn lĩnh vực hoặc thủ tục; nếu chọn thủ tục thì hiển thị quầy theo danh mục chính thức.
2. Hiển thị quầy, giờ nhận, tình trạng còn nhận số và ước tính chờ nếu có dữ liệu đáng tin cậy.
3. Người dân xác nhận; backend kiểm tra giờ hoạt động, trạng thái quầy, hạn mức, giới hạn mỗi người và yêu cầu lặp.
4. Backend cấp mã/số duy nhất trong một giao dịch, lưu vào hàng chờ ngày/quầy và trả biên nhận có số, lĩnh vực/quầy, thời gian cấp, hướng dẫn đến quầy và cách tra cứu.
5. Màn hình “Số của tôi” hiển thị trạng thái và số đang được phục vụ. Cho phép hủy theo thời hạn/quy tắc đã duyệt.
6. Khi đến lượt, hiển thị lời nhắc trong app nếu app đang mở; không cam kết thông báo đẩy/OA cho đến khi xác minh quyền và chi phí.

**Đặt lịch từ Zalo OA**

1. Người dân bấm nút đặt lịch tại OA; OA mở Mini App vào luồng đặt lịch hoặc cơ chế khác đã được xác nhận hỗ trợ.
2. Chọn lĩnh vực/thủ tục → ngày còn chỗ → khung giờ → điền dữ liệu tối thiểu → xem lại và xác nhận.
3. Backend giữ chỗ ngắn hạn trong lúc xác nhận nếu quy trình có nhiều màn hình; chỗ giữ hết hạn được giải phóng. Khi xác nhận thành công, tạo lịch với mã tra cứu và hướng dẫn chuẩn bị.
4. OA gửi đường dẫn bắt đầu luồng và/hoặc thông báo xác nhận chỉ khi cơ chế này được cấu hình, cấp quyền và chính sách cho phép; luôn có màn hình tra cứu trong Mini App làm kênh dự phòng.
5. Khi đến Trung tâm, cán bộ tra lịch bằng mã/QR hoặc danh sách trong Admin; xác nhận có mặt và đưa vào hàng phục vụ theo quy tắc ưu tiên đã thống nhất. Không tự giả định lịch hẹn được phục vụ trước mọi số đang chờ.

### 18.4. Ghép lịch hẹn với hàng chờ

- Mỗi quầy có cấu hình năng lực theo ngày/khung; tổng chỗ đã giữ cho lịch + số đã cấp online + phần dự phòng tiếp dân không vượt mức được duyệt.
- Trung tâm cần chọn mô hình phục vụ:
  - **Hai nguồn hạn mức, một hàng phục vụ:** lịch hẹn có giờ đến; khi check-in được nhập vào thứ tự phục vụ chung theo quy tắc đã công bố.
  - **Hai hàng phục vụ có quy tắc ưu tiên:** cán bộ gọi từ danh sách lịch và danh sách bốc số theo tỷ lệ/quy tắc được phê duyệt.
- Đề xuất khởi đầu với hạn mức lịch hẹn riêng, hạn mức lấy số trong ngày riêng và phần lượt trực tiếp. Cán bộ được quyền điều chỉnh hạn mức tương lai theo phân quyền; thay đổi phải có audit log.
- Định nghĩa thời gian ân hạn của lịch; sau đó chuyển trạng thái “Vắng mặt” hoặc cho check-in muộn theo quyết định nghiệp vụ. Không tự động xóa lịch.
- Hàng chờ công khai chỉ dùng mã/số và thông tin không nhận dạng cá nhân. Danh sách có tên/điện thoại chỉ cho cán bộ đúng quyền.

### 18.5. Trạng thái và thao tác

**Số thứ tự:** Đã cấp → Đang chờ → Đang gọi → Đang phục vụ → Hoàn tất. Nhánh ngoại lệ: Đã hủy, Vắng mặt, Đã chuyển quầy. Thống nhất có cần trạng thái “Gọi lại” hay ghi thành sự kiện gọi lại.

**Lịch hẹn:** Chờ duyệt (chỉ nếu quy trình yêu cầu) → Đã xác nhận → Đã check-in → Đang phục vụ → Hoàn tất. Nhánh ngoại lệ: Đã hủy, Đổi lịch, Vắng mặt, Từ chối. Mỗi lần đổi lịch tạo lịch sử, không ghi đè dấu vết cũ.

Mỗi thao tác đổi trạng thái phải kiểm tra quyền ở backend, trạng thái hiện tại, lưu người thao tác/thời điểm/lý do cần thiết; thao tác không hợp lệ phải trả lỗi rõ ràng.

### 18.6. Dữ liệu và API cần thiết

Thiết kế Prisma/MySQL và API sau khi nghiệp vụ được ký xác nhận. Nhóm thực thể dự kiến:

- **ServiceField/ServiceCategory:** lĩnh vực/thủ tục, quầy phụ trách, trạng thái công khai.
- **Counter:** mã quầy, tên, lĩnh vực, trạng thái hoạt động.
- **CounterSchedule:** ngày/khung giờ, sức chứa, số chỗ dành cho lịch, bốc số, trực tiếp; ngày nghỉ/ngoại lệ.
- **QueueTicket:** ngày phục vụ, quầy, số hiển thị, mã tra cứu khó đoán, người tạo nếu đã định danh, trạng thái và thời điểm.
- **Appointment:** quầy/lĩnh vực, khung giờ, mã tra cứu, thông tin tối thiểu, trạng thái, lịch sử đổi/hủy.
- **QueueEvent/AuditLog:** gọi, gọi lại, bỏ qua, check-in, chuyển quầy, hoàn tất và người thực hiện.

Nhóm API dự kiến:

- Công khai: danh sách lĩnh vực/quầy đang mở; lịch còn chỗ; tạo số; tra cứu mã; tạo/hủy/đổi lịch theo xác thực.
- Admin: cấu hình giờ và hạn mức; xem hàng chờ/lịch theo ngày-quầy; cấp số trực tiếp; gọi/gọi lại/bỏ qua/chuyển/hoàn tất; check-in, duyệt/hủy/đổi lịch; xem audit.
- Không đưa API key/secret OA vào Mini App. Nếu dùng OA webhook/API, kiểm tra chữ ký ở backend và chống xử lý lặp. Không tin userId, vai trò hoặc trạng thái do client tự gửi.

### 18.7. Đồng thời, chống trùng và bảo mật

- Tạo số và đặt lịch phải dùng transaction/khóa phù hợp và ràng buộc duy nhất trong database, ví dụ số theo ngày-quầy và một chỗ của slot chỉ được nhận một lần. Không đọc số kế tiếp rồi tự tăng ở frontend.
- Dùng khóa idempotency cho yêu cầu tạo số/đặt lịch để gửi lại khi mất mạng không tạo yêu cầu thứ hai.
- Backend kiểm tra giờ nhận, quầy còn mở, lịch còn chỗ, giới hạn mỗi người và quyền cán bộ; giới hạn tần suất và chống dò mã tra cứu.
- QR chỉ chứa mã ngẫu nhiên/định danh tra cứu tối thiểu, không chứa tên, số điện thoại hoặc dữ liệu hồ sơ dạng đọc được.
- Thu thập tối thiểu dữ liệu cá nhân; nêu mục đích, thời hạn lưu và phân quyền. Không ghi nội dung cá nhân hoặc token vào log thường.
- Chốt thời hạn lưu dữ liệu với đơn vị và người phụ trách dữ liệu trước khi chạy thật.

### 18.8. Màn hình cần bổ sung

**Mini App:** chọn lĩnh vực/thủ tục; xác nhận lấy số; biên nhận và “Số của tôi”; hàng chờ/số đang gọi; chọn ngày và khung giờ; xác nhận lịch; tra cứu/hủy/đổi lịch; hướng dẫn giấy tờ và trạng thái đang tải/rỗng/lỗi/mất mạng.

**Trang quản trị:** cấu hình quầy/lĩnh vực/giờ/ngày nghỉ/hạn mức; bảng hàng chờ theo quầy; điều khiển gọi số; danh sách lịch theo ngày/khung; tìm theo mã tra cứu; check-in và xử lý vắng/đổi/hủy; lịch sử thao tác. Tách quyền xem dữ liệu cá nhân khỏi quyền gọi số nếu nghiệp vụ cần.

**OA:** mục/nút đặt lịch và đường dẫn Mini App có tham số điều hướng được kiểm tra an toàn. Không hiển thị hoặc gửi thông tin cá nhân trong hội thoại/log nếu không cần.

### 18.9. Lộ trình triển khai

1. **Chốt nghiệp vụ và prototype:** xác nhận quy tắc tại mục 18.2, lập sơ đồ lĩnh vực-quầy, bảng công suất, chính sách riêng tư; duyệt prototype với cán bộ.
2. **Làm hàng chờ:** migration, cấu hình quầy/giờ/hạn mức, cấp số an toàn khi nhiều người thao tác đồng thời, trang Admin gọi số và Mini App nhận/tra số. Thử nội bộ tại một quầy.
3. **Làm đặt lịch:** khung giờ theo năng lực quầy, giữ chỗ/chống trùng, tạo/tra/hủy/đổi lịch, Admin check-in và cập nhật trạng thái.
4. **Kết nối OA:** trước hết thêm nút OA dẫn vào Mini App; chỉ thêm webhook, xác nhận/nhắc tin sau khi xác minh tài liệu, quyền, hạn mức và chi phí. OA không là database thứ hai.
5. **Pilot:** triển khai một hoặc hai lĩnh vực đã chọn trong Testing; cán bộ ghi nhận cả lượt trực tiếp; so sánh với vận hành thực tế, điều chỉnh hạn mức/quy tắc.
6. **Mở rộng:** đào tạo các quầy, chuẩn bị hỗ trợ sự cố, nghiệm thu và phát hành theo quy trình M5. Thay đổi gói Mini App phải qua Testing, xét duyệt và Publish theo trạng thái Zalo yêu cầu.

### 18.10. Kiểm thử nghiệm thu

- Hai yêu cầu lấy số đồng thời không nhận cùng số; hai người không chiếm cùng chỗ cuối của một khung giờ.
- Gửi lặp do timeout chỉ tạo một ticket/lịch; rời màn hình không giữ chỗ vô thời hạn.
- Đóng quầy/ngày nghỉ/hết hạn mức thì không cấp số/không nhận lịch; lỗi có hướng dẫn rõ.
- Lịch từ OA/Mini App và số tại quầy cùng cập nhật vào một nguồn dữ liệu; tổng lượt không vượt cấu hình.
- Nhân viên chỉ thao tác đúng quầy/role; mọi chuyển trạng thái có audit; người dân không xem dữ liệu người khác bằng cách đổi ID.
- Hủy/đổi/đến trễ/vắng mặt/gọi lại/chuyển quầy/mất mạng/khôi phục dịch vụ đúng quy trình đã duyệt.
- Thử Android/iOS trên Zalo thật, tài khoản thử nghiệm; kiểm tra tải đồng thời và backup/restore.
- Nghiệm thu nội dung thông báo, QR, thời gian chờ và hướng dẫn để không hứa thời điểm phục vụ chính xác khi hệ thống chỉ có ước tính.

### 18.11. Điều kiện hoàn thành

- [ ] Trung tâm duyệt bảng lĩnh vực-quầy, giờ, sức chứa, ưu tiên, quy tắc trễ/vắng/hủy và phương án mất mạng.
- [ ] Mini App cấp số và đặt lịch không trùng; Admin vận hành được hàng chờ/lịch.
- [ ] OA dẫn đúng vào luồng đã chọn; notification chỉ bật khi quyền/quota/chi phí được xác nhận.
- [ ] Dữ liệu nghiệp vụ dùng backend/database staging hoặc production; không dùng mock khi nghiệm thu nghiệp vụ.
- [ ] Phân quyền, riêng tư, audit, sao lưu và khôi phục đạt kiểm thử.
- [ ] Pilot tại quầy được cán bộ nghiệm thu; có hướng dẫn người dân và tài liệu vận hành.
- [ ] Deploy Testing, thử Zalo thật, xét duyệt và Publish theo mục M5 trước khi mở công khai.

