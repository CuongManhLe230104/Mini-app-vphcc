# Kế hoạch đơn giản hóa đặt lịch và cấp số online

**Dự án:** Zalo Mini App Trung tâm Phục vụ hành chính công xã Nghĩa Thành  
**Ngày cập nhật:** 13/11/2026  
**Đối tượng thực hiện:** Antigravity hoặc AI phụ trách code  
**Trạng thái:** Kế hoạch triển khai theo hướng người dùng vừa thống nhất.

> Kế hoạch này thay thế phương án cấp số sau khi cán bộ xác nhận có mặt. Đặt lịch thành công phải có phiếu hẹn và số gọi ngay. Không có bước tra cứu rồi bấm “Đã đến” để người dân được đưa vào danh sách gọi.

## 1. Mục tiêu

Đơn giản hóa cả ba phía:
- Người dân: chọn lĩnh vực → chọn ngày/khung giờ → xác nhận và nhận phiếu.
- Cán bộ: xem lịch hôm nay của quầy → gọi số → tiếp nhận → hoàn tất hoặc đánh dấu vắng.
- Admin: quản lý lịch làm việc, quầy, số chỗ online và ngày nghỉ.

Một lượt đăng ký dùng xuyên suốt từ đặt lịch tới kết thúc tiếp nhận. Không tạo một lịch hẹn và một lượt bốc số độc lập bắt người dân thực hiện hai lần.

Chưa tự thay đổi hệ thống đang vận hành hoặc triển khai công khai. Thực hiện và kiểm thử trước khi chuyển đổi.

## 2. Quyết định nghiệp vụ đã chốt

1. Người dân đặt lịch qua Mini App.
2. Hệ thống tự xác định quầy từ lĩnh vực đã chọn.
3. Người dân chọn ngày và khung giờ còn chỗ.
4. Đặt thành công: cấp mã hẹn và số gọi, chuyển ngay tới màn hình phiếu xác nhận.
5. Khi đến, người dân trình phiếu cho cán bộ trực quầy và chờ gọi.
6. Không yêu cầu người dân hoặc cán bộ bấm “Đã đến”.
7. Cán bộ gọi theo lịch và số trong khung giờ đang phục vụ.
8. Người được gọi có mặt thì cán bộ bấm “Tiếp nhận” để bắt đầu làm việc.
9. Gọi không có người thì đánh dấu “Vắng mặt” và chuyển lượt.
10. Cấu hình online có giới hạn tối đa theo quầy/buổi, không nhận vô hạn.

Phân biệt:
- “Đã xác nhận đặt lịch” nghĩa là hệ thống đã giữ chỗ, không chứng minh người dân đã có mặt.
- “Tiếp nhận” là bắt đầu phục vụ tại quầy, không phải bước check-in riêng.
- “Hoàn tất” là kết thúc lượt tiếp nhận, không có nghĩa hồ sơ hành chính đã giải quyết xong.
- Khung giờ là thời gian dự kiến tiếp nhận, không cam kết kết thúc thủ tục đúng phút.

## 3. Thông tin quầy đã được xác nhận

| Quầy | Lĩnh vực |
|---|---|
| 1 | Tư pháp – hộ tịch |
| 2 | Giấy phép kinh doanh, bao gồm đăng ký hộ kinh doanh – môi trường |
| 3 | Đất đai – quy hoạch |
| 4 | Văn hóa – giáo dục – y tế – thương binh và xã hội |

Thời lượng dự kiến: **30 phút/lượt**. Đây là giá trị mặc định phục vụ xếp lịch, không phải thời hạn giải quyết hồ sơ.

Không tự gán các lĩnh vực chưa xác định vào một quầy. Cho phép quản trị chỉnh danh mục và quan hệ lĩnh vực–quầy theo nghiệp vụ đã xác nhận.

## 4. Những thông tin còn cần xác nhận

AI không tự coi các giá trị thử là quy định vận hành chính thức.

- Giờ làm việc sáng/chiều, các ngày làm việc.
- Số vị trí phục vụ đồng thời ở từng quầy; có thể dùng 1 để thử nhưng phải xác nhận trước vận hành.
- Số lượt online tối đa mỗi quầy mỗi buổi.
- Số ngày được phép đặt trước, thời điểm ngừng nhận đặt cho từng khung.
- Có cho đặt trong ngày hay chỉ ngày tiếp theo.
- Cách dành chỗ và xen lượt cho khách đến trực tiếp.
- Quy tắc xử lý người đến muộn và người bị đánh dấu vắng nhưng quay lại.
- Đối tượng ưu tiên, người có quyền xử lý ưu tiên.
- Giới hạn lịch đang hoạt động của một người và việc đăng ký hộ.
- Thời điểm cuối được tự hủy lịch.

“Tối đa lượt online” được hiểu là giới hạn trên. Không thêm quy tắc phải đủ số người tối thiểu thì mới nhận lịch.

Trong lúc chờ xác nhận, tiếp tục làm phần kỹ thuật độc lập và dùng dữ liệu thử có nhãn rõ.

## 5. Khảo sát hệ thống trước khi sửa

Đọc hướng dẫn dự án, schema, backend, admin và Mini App hiện tại.

Lập bảng:
- Giữ lại.
- Sửa.
- Ẩn/bỏ khỏi giao diện mới.
- Bổ sung.
- Dữ liệu cần chuyển đổi.

Kiểm tra đặc biệt:
- Lịch hẹn và phiếu số hiện đang liên kết thế nào.
- Có bước check-in hoặc cấp số khi đến trong code hay không.
- Cách cấp số, giới hạn chỗ, xử lý đồng thời.
- Các lịch cũ đã có số và lịch chưa có số.
- Quyền người dân, cán bộ quầy, quản trị.
- Cấu hình giờ làm việc, ngày nghỉ và ngoại lệ.
- Thông báo, QR và các đường dẫn OA đang dùng.

Tái sử dụng module và thành phần hiện có. Không tạo hệ thống thứ hai song song để rồi phải đồng bộ hai nơi.

## 6. Giao diện và luồng người dân

### 6.1. Điểm vào

Một mục chính: **“Đặt lịch đến Trung tâm”**.

Nếu ứng dụng cũ có cả “Lấy số online” và “Đặt lịch”, gom hoặc điều hướng về cùng luồng. Không tạo hai lượt khi người dân bấm hai mục khác nhau.

Nút đặt lịch trên OA dẫn vào cùng màn hình Mini App; không có kho lịch riêng của OA.

### 6.2. Ba bước đăng ký

**Bước 1 — Chọn nhu cầu**
- Chọn lĩnh vực.
- Chọn thủ tục nếu danh mục đã có và phù hợp.
- Hiển thị quầy được hệ thống xác định.
- Không bắt buộc biết chính xác tên thủ tục mới được đặt nếu nghiệp vụ cho phép chọn lĩnh vực.

**Bước 2 — Chọn lịch**
- Chọn ngày.
- Chọn khung giờ còn chỗ.
- Hiển thị hết chỗ, ngày nghỉ hoặc ngừng tiếp nhận.
- Không cho chọn thời gian đã qua hoặc ngoài lịch làm việc.
- Nếu không cho đặt trong ngày, giao diện và backend cùng áp dụng.

**Bước 3 — Xác nhận**
- Hiển thị nhu cầu, quầy, ngày giờ, thông tin người đăng ký cần thiết.
- Tận dụng thông tin đã có; chỉ yêu cầu thông tin cần cho tiếp nhận.
- Người dân bấm một lần để hoàn tất.
- Backend kiểm tra chỗ và cấp số trong cùng giao dịch.
- Chỉ báo thành công khi backend đã lưu thành công.

### 6.3. Phiếu xác nhận

Hiển thị:
- “Đặt lịch thành công”.
- Mã hẹn.
- **Số gọi đã được cấp**.
- Ngày và khung giờ dự kiến.
- Quầy.
- Lĩnh vực/thủ tục.
- Trạng thái.
- QR hoặc mã tra cứu nếu hệ thống đang hỗ trợ.
- Hướng dẫn: “Đến đúng khung giờ, trình phiếu tại quầy và chờ gọi số”.
- Nút xem lại trong lịch của tôi; nút hủy khi còn được phép.

Không có nút “Xác nhận có mặt”. Không hướng dẫn bốc thêm số khác.

### 6.4. Lịch hẹn của tôi

Hai phần:
- Sắp tới.
- Lịch sử.

Có thể mở lại phiếu khi đóng/mở ứng dụng. Chỉ người sở hữu hoặc người được ủy quyền hợp lệ mới xem được thông tin cá nhân.

Bản đầu chưa cần đổi lịch tự động. Khi hủy rồi đặt lại phải thông báo rằng chỗ mới không được giữ cho đến khi đăng ký mới thành công.

## 7. Màn hình cán bộ quầy

Sau đăng nhập, vào quầy được phân công. Người được phân nhiều quầy chọn trong phạm vi được cấp quyền.

Màn hình chính:
- Quầy, ngày và khung giờ hiện tại.
- Số đang gọi hoặc lượt đang phục vụ.
- Danh sách lịch trong ngày, sắp theo khung giờ rồi thứ tự số.
- Nhóm lịch sắp tới.
- Nhóm vắng/đã hủy/hoàn tất để tra cứu khi cần.
- Nút xử lý khách trực tiếp nếu nghiệp vụ này đã được cấu hình.

### 7.1. Các nút chính

| Nút | Hành vi |
|---|---|
| Gọi tiếp | Lấy lượt đủ điều kiện tiếp theo tại quầy |
| Gọi lại | Gọi lại cùng số, không tạo lượt mới |
| Tiếp nhận | Người được gọi có mặt, bắt đầu tiếp nhận |
| Hoàn tất | Kết thúc lượt đang phục vụ |
| Vắng mặt | Đã gọi nhưng không có người |

Không có màn hình hoặc thao tác “Đã đến” trước hàng chờ.

### 7.2. Quy tắc gọi

- Danh sách này là **lịch đã đặt**, không được gắn nhãn tất cả là “người đang chờ tại Trung tâm”.
- Chỉ gọi các lượt trong khung giờ đủ điều kiện, không tự gọi sớm lịch ở khung sau.
- Trong cùng khung giờ, gọi theo thứ tự số đã cấp.
- Một vị trí phục vụ không có hai lượt đang phục vụ đồng thời.
- Hai thiết bị bấm “Gọi tiếp” cùng lúc không được nhận hai lượt khác nhau cho cùng vị trí.
- Khi khung giờ đã qua mà còn lượt chưa gọi, hiển thị để cán bộ xử lý; không tự đánh dấu người dân vắng vì quầy bị chậm.
- Không tự đổi số hoặc đẩy người đến muộn lên đầu.
- Khôi phục lượt vắng cần quyền và lý do; cách xếp lại chờ xác nhận nghiệp vụ.
- Cuối ngày, lượt chưa xử lý phải được ghi nhận rõ; không tự chuyển lịch sang hôm sau.

Chưa triển khai ưu tiên tự động phức tạp. Nếu có ngoại lệ ưu tiên, yêu cầu quyền phù hợp, lý do và nhật ký.

## 8. Cấp số ngay khi đặt lịch

### 8.1. Phân biệt mã

- Mã hẹn là định danh duy nhất của lượt.
- Số gọi là mã dễ đọc để cán bộ gọi.
- Số phải kèm ngữ cảnh ngày, quầy và khung giờ trên phiếu.

Vì người dân có thể đặt khung chiều trước khung sáng, không được sắp hàng theo thời điểm tạo lịch trên toàn ngày rồi bỏ qua khung giờ.

AI đề xuất cách hiển thị số nhất quán, ví dụ theo quầy + khung + thứ tự. Đây là ví dụ kỹ thuật, chưa phải định dạng đã chốt. Nếu dùng số liên tục theo quầy/ngày, cần giải thích rõ danh sách vẫn gọi theo khung giờ trước, số sau; không tự đổi số đã cấp cho người dân.

### 8.2. Tính toàn vẹn

- Cấp chỗ và số trong cùng transaction.
- Có ràng buộc duy nhất phù hợp với phạm vi số.
- Bấm xác nhận nhiều lần hoặc gửi lại do mất mạng vẫn trả cùng lượt nếu cùng yêu cầu.
- Nếu suất cuối đã được người khác đặt, trả thông báo hết chỗ và tải lại lịch.
- Không dùng cách “đếm số dòng rồi cộng 1” không có bảo vệ đồng thời.
- Hủy trả lại sức chứa nhưng không renumber các phiếu khác.
- Ưu tiên không tái sử dụng số đã hủy trong cùng ngày để tránh nhầm phiếu; việc này không làm mất suất trống có thể đặt lại.
- Không tự suy số gọi từ dữ liệu cá nhân.

## 9. Admin: một trang “Lịch phục vụ”

### 9.1. Lịch chung

- Ngày làm việc.
- Giờ sáng/chiều.
- Ngày nghỉ.
- Số ngày được đặt trước.
- Thời điểm đóng nhận lịch.

Admin cấu hình một lần, các quầy kế thừa.

### 9.2. Cấu hình từng quầy

- Tên quầy và lĩnh vực.
- Cán bộ phụ trách.
- Thời lượng dự kiến: 30 phút/lượt.
- Số vị trí phục vụ đồng thời.
- **Số lượt online tối đa mỗi buổi**.
- Bật/tắt nhận lịch.

Hệ thống tự sinh các khung theo lịch và thời lượng. Admin không phải tạo thủ công từng khung giờ.

Hiển thị bản xem trước: mỗi buổi có bao nhiêu chỗ tổng, bao nhiêu chỗ online, còn bao nhiêu cho khách trực tiếp.

### 9.3. Ngoại lệ theo ngày

- Quầy nghỉ hoặc tạm dừng nhận thêm lịch.
- Thay giờ phục vụ.
- Thay số chỗ trong buổi.

Tách “ngừng nhận lịch mới” và “hủy lịch đã đặt”. Thao tác đầu không được tự làm thao tác thứ hai.

Giảm sức chứa xuống thấp hơn số lịch hiện có phải bị chặn hoặc yêu cầu xử lý các lịch bị ảnh hưởng trước. Không âm thầm hủy, đổi giờ, đổi quầy hoặc đổi số.

## 10. Năng lực phục vụ và khách trực tiếp

Dùng thời lượng 30 phút để tính sức chứa dự kiến theo quầy/buổi, sau khi trừ thời gian nghỉ.

Ví dụ thử: 180 phút, một vị trí phục vụ, 30 phút/lượt → 6 lượt dự kiến. Đây không phải giờ làm việc thực tế của Trung tâm.

- Chỗ online là một phần sức chứa.
- Phần còn lại dành cho khách trực tiếp.
- Không tính hai hạn mức độc lập rồi cộng vượt khả năng phục vụ.
- Không tự cấp online toàn bộ sức chứa nếu chưa được thống nhất.
- Trong MVP, có thể phân bổ trước các vị trí theo thời gian cho online và khách trực tiếp; lịch online hiển thị đúng các vị trí được phân bổ.
- Quy tắc phân bổ phải hiển thị được trong bản xem trước cho admin; tránh giấu một thuật toán khó hiểu.
- Cách tạo số trực tiếp phải tương thích hệ thống hiện có, không tạo bộ số trùng với online.
- Nếu Trung tâm có máy bốc số riêng, cần khảo sát khả năng tích hợp trước; không hứa hai hệ thống tự đồng bộ.
- Thứ tự xen khách trực tiếp và lịch online cần xác nhận trước chạy thật.
- Không tự lấp suất online chưa đến bằng người khác rồi làm mất chỗ đã hẹn.

Có thể hoàn thiện luồng online bằng dữ liệu thử trước khi chốt việc tích hợp số trực tiếp, nhưng chưa coi hệ thống sẵn sàng vận hành toàn Trung tâm.

## 11. Trạng thái tối giản

| Trạng thái | Ý nghĩa |
|---|---|
| Đã đặt lịch | Có chỗ và số gọi, chưa được gọi |
| Đang gọi | Cán bộ đã gọi số |
| Đang tiếp nhận | Người dân có mặt và cán bộ bắt đầu làm việc |
| Hoàn tất | Kết thúc lượt |
| Đã hủy | Lượt bị hủy |
| Vắng mặt | Đã gọi nhưng không có người |
| Chưa được phục vụ | Lượt còn lại khi kết thúc ngày, cần xử lý theo quy định |

Không thêm trạng thái check-in bắt buộc.

Luồng chính:
Đã đặt lịch → Đang gọi → Đang tiếp nhận → Hoàn tất.

Nhánh:
- Đã đặt lịch → Đã hủy nếu còn được phép.
- Đang gọi → Vắng mặt.
- Khôi phục/điều chỉnh chỉ theo quyền và quy tắc đã xác nhận.

“Gọi lại” là sự kiện trên cùng lượt, không phải lịch mới. Phải chặn chuyển trạng thái sai, ví dụ hoàn tất một lượt đã hủy.

## 12. Backend, dữ liệu và API

### 12.1. Dữ liệu logic

Tận dụng schema đang có; không bắt buộc đúng tên bảng dưới đây:
- Lượt đăng ký: người đăng ký, lĩnh vực/thủ tục, quầy, ngày, khung, nguồn online/trực tiếp, trạng thái.
- Mã hẹn, số gọi và thời điểm cấp.
- Lịch phục vụ chung, cấu hình quầy và ngoại lệ.
- Sức chứa theo khung/buổi và số lượt đã chiếm.
- Nhật ký gọi số, tiếp nhận, hủy, hoàn tất và xử lý ngoại lệ.

Nếu hiện có hai bảng appointment/ticket, giữ quan hệ một-một cho một lượt và cấp cả hai ngay khi đặt thành công nếu cần. Không bắt buộc gộp bảng vật lý để có trải nghiệm thống nhất.

### 12.2. API

Người dân:
- Lĩnh vực/quầy.
- Ngày, khung giờ và số chỗ còn lại.
- Đặt lịch và cấp số.
- Xem lịch của mình, chi tiết phiếu, hủy.

Cán bộ:
- Lịch hôm nay và lượt hiện tại của quầy.
- Gọi tiếp, gọi lại, tiếp nhận, hoàn tất, vắng mặt.
- Xử lý lượt trực tiếp/ngoại lệ theo quyền khi nghiệp vụ đã chốt.

Admin:
- Đọc/sửa lịch chung.
- Cấu hình quầy.
- Ngoại lệ ngày.
- Xem trước tác động thay đổi lên các lịch đã đặt.

### 12.3. Quy tắc kỹ thuật

- Backend kiểm tra quyền sở hữu, phân quyền quầy và trạng thái.
- Tính giờ theo máy chủ, múi giờ Việt Nam.
- Chống đặt trùng, vượt chỗ, trùng số và gọi trùng bằng ràng buộc/transaction/khóa phù hợp.
- Cơ chế idempotency cho đặt lịch và các thao tác có thể gửi lại.
- Không công khai thông tin cá nhân của người khác.
- QR chỉ mang định danh an toàn, không chứa dữ liệu cá nhân nhạy cảm; tra cứu chi tiết vẫn cần kiểm tra quyền.
- Có log nghiệp vụ, không log token hoặc thông tin nhạy cảm không cần thiết.
- Không dựa vào nút bị vô hiệu hóa ở frontend để bảo vệ dữ liệu.
- Tách thời hạn tiếp nhận dự kiến khỏi thời hạn giải quyết hồ sơ.

## 13. Cập nhật giao diện và thông báo

- Tải lại trạng thái khi người dân/cán bộ quay lại màn hình.
- Tận dụng cơ chế cập nhật trực tiếp hiện có; nếu chưa có, polling khi màn hình đang mở có thể đủ cho MVP.
- Có thời điểm cập nhật gần nhất, thông báo mất mạng và nút thử lại.
- Không báo thao tác thành công khi chưa lưu trên máy chủ.
- Người dân luôn mở lại được phiếu trong Mini App; không phụ thuộc việc tin OA gửi thành công.
- Chưa cần thông báo OA tự động để hoàn thành bản đầu.
- Phân biệt nút đổi trạng thái trong admin với âm thanh/màn hình gọi số: khảo sát hệ thống loa/màn hình hiện có; không coi thao tác API là đã phát loa nếu chưa tích hợp.

## 14. Chuyển đổi từ luồng cũ

- Lập bảng ánh xạ trạng thái check-in/appointment/ticket cũ sang luồng mới.
- Giữ lịch đã đặt, số đã cấp và lịch sử.
- Không tự cấp số mới làm vô hiệu phiếu người dân đang giữ.
- Với lịch tương lai chưa có số, có bước chuyển đổi được kiểm tra chống trùng; thống kê các trường hợp xung đột.
- Duy trì khả năng mở phiếu cũ hoặc chuyển hướng rõ ràng.
- Kiểm tra mọi API/frontend còn phụ thuộc check-in trước khi bỏ bước đó.
- Thử migration trên dữ liệu thử hoặc bản sao phù hợp.
- Sao lưu và có phương án quay lại trước khi chuyển thật.
- Không tự chạy chuyển đổi trên dữ liệu vận hành trong phạm vi nhiệm vụ lập trình thử.

## 15. Lộ trình

| Mốc | Công việc | Điều kiện hoàn thành |
|---|---|---|
| Q0 | Khảo sát code và chốt mô hình chuyển đổi | Bảng giữ/sửa/bổ sung, các quyết định còn thiếu |
| Q1 | Đặt lịch cấp số ngay, hạn mức và trạng thái | Test suất cuối, gửi lặp, số duy nhất, hủy hoàn chỗ |
| Q2 | Mini App ba bước và phiếu chung | Không check-in, không bốc số lần hai, mở lại phiếu được |
| Q3 | Cán bộ gọi số và admin lịch phục vụ | Quyền đúng, gọi đồng thời an toàn, cấu hình có xem trước |
| Q4 | Kiểm thử bốn quầy, trực tiếp/online và ngoại lệ | Báo cáo nghiệm thu, giới hạn còn lại, hướng dẫn |
| Q5 | Chuẩn bị chuyển đổi | Kế hoạch dữ liệu cũ, sao lưu, xác nhận cấu hình thật trước vận hành |

Không dùng các mốc này để thay đổi tên module trong kế hoạch tổng thể của dự án.

## 16. Kiểm thử nghiệm thu

### Người dân
- [ ] Chọn lĩnh vực tự ra đúng quầy.
- [ ] Chọn được ngày/khung còn chỗ; không đặt ngoài lịch.
- [ ] Đặt thành công nhận số ngay.
- [ ] Không có bước “Đã đến” hoặc yêu cầu bốc lại số.
- [ ] Mở lại phiếu sau khi đóng ứng dụng.
- [ ] Hủy theo điều kiện, chỗ được trả đúng một lần.
- [ ] Không xem được lịch riêng của người khác.

### Đồng thời và dữ liệu
- [ ] Hai người tranh suất cuối: chỉ một lượt thành công.
- [ ] Gửi lại cùng yêu cầu không tạo thêm lịch/số.
- [ ] Hủy không đổi số các phiếu đã cấp.
- [ ] Đặt khung chiều trước khung sáng không làm sai thứ tự phục vụ theo giờ.
- [ ] Mất mạng sau khi lưu có thể tra lại kết quả, không nhân đôi.
- [ ] Hai thiết bị gọi tiếp không chiếm hai lượt cho cùng vị trí.

### Cán bộ
- [ ] Chỉ thao tác quầy được phân công.
- [ ] Gọi lại giữ nguyên lượt.
- [ ] Tiếp nhận chỉ bắt đầu khi người được gọi có mặt.
- [ ] Vắng mặt chuyển lượt đúng, không bắt check-in.
- [ ] Không tự gọi sớm lịch khung tiếp theo.
- [ ] Quầy chậm không tự biến người chưa được gọi thành người vắng.
- [ ] Hoàn tất lượt không thay trạng thái hồ sơ hành chính ngoài phạm vi.

### Admin
- [ ] Tạo khung tự động từ lịch chung.
- [ ] Giới hạn online không vượt sức chứa.
- [ ] Có phần dành cho khách trực tiếp theo cấu hình đã duyệt.
- [ ] Đóng nhận mới không hủy lịch cũ.
- [ ] Đổi giờ/giảm chỗ có cảnh báo lịch bị ảnh hưởng.
- [ ] Cấu hình thử không bị hiểu là lịch chính thức.

### Hồi quy và vận hành
- [ ] Lịch/phiếu cũ không mất hoặc bị đổi số ngoài ý muốn.
- [ ] Tin tức, niêm yết và thủ tục vẫn hoạt động.
- [ ] Kiểm tra trong Zalo trên điện thoại, ghi rõ thiết bị.
- [ ] Kiểm tra lỗi mạng, quay lại ứng dụng, ngày nghỉ và chuyển ngày.
- [ ] Xác nhận rõ hệ thống gọi số trực tiếp/loa/màn hình nào đã hoặc chưa tích hợp.

## 17. Những việc chưa làm trong bản đầu

- Check-in người dân hoặc cán bộ trước danh sách gọi.
- Hai hệ thống đặt lịch riêng cho OA và Mini App.
- Đổi lịch tự động phức tạp.
- Tự động ưu tiên/xen lượt bằng nhiều công thức.
- AI tự quyết định cấu hình nghiệp vụ còn thiếu.
- Tự gửi OA hàng loạt.
- Tự công khai hoặc triển khai lên production.

## 18. Báo cáo và chỉ dẫn giao việc cho AI

Sau mỗi mốc, báo cáo:
1. Đã sửa gì, tại những file/module nào.
2. Dữ liệu hoặc migration bị ảnh hưởng.
3. Kiểm thử đã chạy và kết quả thực tế.
4. Phần chưa kiểm thử và quyết định cần Trung tâm xác nhận.
5. Bước tiếp theo.

### Prompt bắt đầu

> Đọc kế hoạch này, khảo sát hệ thống đặt lịch/lấy số hiện có rồi thực hiện từ Q0. Mục tiêu mới là đặt lịch thành công cấp số ngay, người dân trình phiếu tại quầy và chờ gọi; bỏ bước xác nhận có mặt trước danh sách gọi. Tái sử dụng code/schema đang có, không xóa dữ liệu và không tạo luồng đặt lịch thứ hai. Đơn giản hóa Mini App còn ba bước; cán bộ dùng Gọi tiếp, Gọi lại, Tiếp nhận, Hoàn tất, Vắng mặt; admin dùng một trang Lịch phục vụ. Giữ thứ tự theo khung giờ rồi số, chống trùng số/vượt chỗ/gửi lặp. Các giới hạn, giờ làm việc, cách xen khách trực tiếp và xử lý đến muộn chưa chốt phải được ghi rõ, không tự coi dữ liệu thử là quy định chính thức. Kiểm thử từng mốc và báo cáo trước khi chuyển đổi dữ liệu vận hành.

