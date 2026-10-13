/**
 * [DỮ LIỆU MẪU] Danh sách tin tức, hướng dẫn, video
 * Nội dung mẫu — chưa qua quy trình duyệt, không dùng làm thông tin chính thức
 */

export const POST_TYPES = [
  { id: "all", label: "Tất cả" },
  { id: "news", label: "Tin tức" },
  { id: "guide", label: "Hướng dẫn" },
  { id: "video", label: "Video" },
];

export const POSTS = [
  {
    id: "1",
    type: "news",
    title: "Thông báo lịch tiếp công dân tháng 10/2026",
    summary:
      "Trung tâm PVHCC xã Nghĩa Thành thông báo lịch tiếp công dân định kỳ tháng 10 năm 2026.",
    content:
      "[DỮ LIỆU MẪU] Nội dung chi tiết sẽ được cập nhật sau khi qua quy trình soạn – duyệt – đăng chính thức.",
    publishedAt: "2026-10-10T08:00:00",
    isHighlighted: true,
    thumbnail: null,
    tags: ["thông báo", "tiếp công dân"],
  },
  {
    id: "2",
    type: "guide",
    title: "Hướng dẫn đăng ký khai sinh trực tuyến",
    summary:
      "Hướng dẫn các bước thực hiện thủ tục đăng ký khai sinh qua cổng dịch vụ công trực tuyến.",
    content:
      "[DỮ LIỆU MẪU] Nội dung hướng dẫn chi tiết sẽ được cập nhật sau khi qua quy trình duyệt chính thức.",
    publishedAt: "2026-10-08T09:00:00",
    isHighlighted: true,
    thumbnail: null,
    tags: ["hướng dẫn", "khai sinh", "trực tuyến"],
  },
  {
    id: "3",
    type: "news",
    title: "Triển khai dịch vụ hành chính công mức độ 4",
    summary:
      "UBND xã Nghĩa Thành đẩy mạnh triển khai dịch vụ hành chính công mức độ 4 trên địa bàn.",
    content:
      "[DỮ LIỆU MẪU] Nội dung chi tiết sẽ được cập nhật sau khi qua quy trình duyệt chính thức.",
    publishedAt: "2026-10-05T10:00:00",
    isHighlighted: true,
    thumbnail: null,
    tags: ["dịch vụ công", "trực tuyến"],
  },
  {
    id: "4",
    type: "video",
    title: "Video hướng dẫn sử dụng Mini App Nghĩa Thành",
    summary:
      "Video giới thiệu các tính năng và cách sử dụng Mini App của Trung tâm PVHCC xã Nghĩa Thành.",
    content:
      "[DỮ LIỆU MẪU] Video sẽ được cập nhật sau khi hoàn thiện sản xuất.",
    publishedAt: "2026-10-01T14:00:00",
    isHighlighted: false,
    thumbnail: null,
    videoUrl: null, // TODO: điền URL video chính thức
    tags: ["video", "hướng dẫn", "mini app"],
  },
  {
    id: "5",
    type: "guide",
    title: "Hướng dẫn đăng ký kết hôn tại UBND xã",
    summary:
      "Các bước và giấy tờ cần chuẩn bị khi đến đăng ký kết hôn tại UBND xã Nghĩa Thành.",
    content:
      "[DỮ LIỆU MẪU] Nội dung hướng dẫn sẽ được cập nhật sau khi qua quy trình duyệt chính thức.",
    publishedAt: "2026-09-28T09:00:00",
    isHighlighted: false,
    thumbnail: null,
    tags: ["hướng dẫn", "kết hôn"],
  },
];

