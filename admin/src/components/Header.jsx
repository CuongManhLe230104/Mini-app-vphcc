import { useLocation } from "react-router-dom";

const PAGE_TITLES = {
  "/":            "Tổng quan hệ thống",
  "/queue":       "Đặt lịch & Cấp số",
  "/procedures":  "Thủ tục hành chính",
  "/posts":       "Tin tức & Hướng dẫn",
  "/notices":     "Niêm yết công khai",
  "/faqs":        "Câu hỏi thường gặp",
  "/center":      "Thông tin trung tâm",
  "/audit":       "Nhật ký thao tác",
};

export default function Header() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? "Quản trị";
  const todayText = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <header className="admin-header">
      <div className="admin-header-inner">
        <h1 className="admin-header-title">{title}</h1>
        <div className="admin-header-right">
          <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", marginRight: 8 }}>
            {todayText}
          </span>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            Mở Mini App
          </a>
        </div>
      </div>
    </header>
  );
}


