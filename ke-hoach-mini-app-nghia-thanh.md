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
