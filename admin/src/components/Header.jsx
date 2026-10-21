import { useLocation } from "react-router-dom";

const PAGE_TITLES = {
  "/":            "Tổng quan",
  "/procedures":  "Thủ tục hành chính",
  "/posts":       "Tin tức & Hướng dẫn",
  "/notices":     "Niêm yết công khai",
  "/faqs":        "Câu hỏi thường gặp",
  "/center":      "Thông tin trung tâm",
};

export default function Header() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? "Quản trị";

  return (
    <header className="admin-header">
      <div className="admin-header-inner">
        <h1 className="admin-header-title">{title}</h1>
        <div className="admin-header-right">
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            👁 Xem Mini App
          </a>
        </div>
      </div>
    </header>
  );
}

