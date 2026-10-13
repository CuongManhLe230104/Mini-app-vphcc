/**
 * [DỮ LIỆU MẪU] Danh sách thủ tục hành chính
 * Chưa đồng bộ nguồn chính thức — KHÔNG dùng làm thông tin pháp lý
 * Nguồn tham khảo cấu trúc: Cổng dịch vụ công quốc gia
 */

export const PROCEDURE_FIELDS = [
  { id: "all", label: "Tất cả" },
  { id: "civil", label: "Hộ tịch" },
  { id: "residence", label: "Cư trú" },
  { id: "land", label: "Đất đai" },
  { id: "other", label: "Khác" },
];

export const PROCEDURES = [
  {
    id: "1",
    code: "1.000.00.00.H14", // [DỮ LIỆU MẪU]
    name: "Đăng ký khai sinh",
    field: "civil",
    authority: "UBND xã Nghĩa Thành",
    deadline: "15 ngày làm việc", // [DỮ LIỆU MẪU]
    fee: "Miễn phí", // [DỮ LIỆU MẪU]
    components: [
      "Tờ khai đăng ký khai sinh (theo mẫu)",
      "Giấy chứng sinh do cơ sở y tế cấp (hoặc văn bản xác nhận)",
      "Giấy tờ tùy thân của cha, mẹ (bản sao nếu có)",
    ],
    submission:
      "Nộp trực tiếp tại bộ phận một cửa hoặc qua cổng dịch vụ công",
    sourceUrl: "", // TODO: điền nguồn chính thức khi có
    reviewDate: "13/10/2026",
    isValid: true,
  },
  {
    id: "2",
    code: "1.000.00.00.H15", // [DỮ LIỆU MẪU]
    name: "Đăng ký kết hôn",
    field: "civil",
    authority: "UBND xã Nghĩa Thành",
    deadline: "3 ngày làm việc", // [DỮ LIỆU MẪU]
    fee: "Miễn phí", // [DỮ LIỆU MẪU]
    components: [
      "Tờ khai đăng ký kết hôn (theo mẫu)",
      "Giấy xác nhận tình trạng hôn nhân của hai bên",
      "CCCD/Hộ chiếu (bản gốc để đối chiếu)",
    ],
    submission: "Nộp trực tiếp tại bộ phận một cửa",
    sourceUrl: "",
    reviewDate: "13/10/2026",
    isValid: true,
  },
  {
    id: "3",
    code: "1.000.00.00.H16", // [DỮ LIỆU MẪU]
    name: "Đăng ký khai tử",
    field: "civil",
    authority: "UBND xã Nghĩa Thành",
    deadline: "2 ngày làm việc", // [DỮ LIỆU MẪU]
    fee: "Miễn phí", // [DỮ LIỆU MẪU]
    components: [
      "Tờ khai đăng ký khai tử (theo mẫu)",
      "Giấy báo tử hoặc giấy tờ thay thế",
      "CCCD/Hộ chiếu của người đến khai",
    ],
    submission: "Nộp trực tiếp tại bộ phận một cửa",
    sourceUrl: "",
    reviewDate: "13/10/2026",
    isValid: true,
  },
  {
    id: "4",
    code: "2.000.00.00.H14", // [DỮ LIỆU MẪU]
    name: "Đăng ký thường trú",
    field: "residence",
    authority: "Công an xã Nghĩa Thành",
    deadline: "7 ngày làm việc", // [DỮ LIỆU MẪU]
    fee: "Miễn phí", // [DỮ LIỆU MẪU]
    components: [
      "Phiếu báo thay đổi hộ khẩu, nhân khẩu (theo mẫu)",
      "Giấy tờ chứng minh chỗ ở hợp pháp",
      "CCCD/Hộ chiếu",
    ],
    submission: "Nộp trực tiếp hoặc qua cổng dịch vụ công",
    sourceUrl: "",
    reviewDate: "13/10/2026",
    isValid: true,
  },
  {
    id: "5",
    code: "2.000.00.00.H15", // [DỮ LIỆU MẪU]
    name: "Xác nhận tình trạng hôn nhân",
    field: "civil",
    authority: "UBND xã Nghĩa Thành",
    deadline: "3 ngày làm việc", // [DỮ LIỆU MẪU]
    fee: "Miễn phí", // [DỮ LIỆU MẪU]
    components: [
      "Phiếu yêu cầu xác nhận tình trạng hôn nhân (theo mẫu)",
      "CCCD/Hộ chiếu",
      "Sổ hộ khẩu (nếu có)",
    ],
    submission: "Nộp trực tiếp tại bộ phận một cửa",
    sourceUrl: "",
    reviewDate: "13/10/2026",
    isValid: true,
  },
  {
    id: "6",
    code: "2.000.00.00.H16", // [DỮ LIỆU MẪU]
    name: "Đăng ký tạm trú",
    field: "residence",
    authority: "Công an xã Nghĩa Thành",
    deadline: "3 ngày làm việc", // [DỮ LIỆU MẪU]
    fee: "Miễn phí", // [DỮ LIỆU MẪU]
    components: [
      "Phiếu báo tạm trú (theo mẫu)",
      "Giấy tờ tùy thân (CCCD/Hộ chiếu)",
      "Giấy tờ chứng minh chỗ ở hợp pháp",
    ],
    submission: "Nộp trực tiếp hoặc qua cổng dịch vụ công",
    sourceUrl: "",
    reviewDate: "13/10/2026",
    isValid: true,
  },
];

