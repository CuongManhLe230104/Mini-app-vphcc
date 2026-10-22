import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.getProcedures({ limit: 1 }),
      api.getPostsAdmin({ limit: 1, status: "PUBLISHED" }),
      api.getPostsAdmin({ limit: 1, status: "PENDING" }),
      api.getNotices({ limit: 1 }),
      api.getFaqsAdmin(),
    ]).then(([procedures, published, pending, notices, faqs]) => {
      setStats({
        procedures: procedures.value?.total ?? "Không tải được",
        published:  published.value?.total ?? "Không tải được",
        pending:    pending.value?.total ?? "Không tải được",
        notices:    notices.value?.meta?.total ?? "Không tải được",
        faqs:       faqs.status === "fulfilled" ? (Array.isArray(faqs.value) ? faqs.value.length : 0) : "Không tải được",
      });
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="loading-full">
      <span className="spinner" />
      <span>Đang tải dữ liệu...</span>
    </div>
  );

  const cards = [
    { icon: "📋", label: "Thủ tục hành chính", value: stats.procedures, bg: "#EBF2FF", color: "#0068FF" },
    { icon: "✅", label: "Bài viết đã đăng",   value: stats.published,  bg: "#E8F8EF", color: "#00B14F" },
    { icon: "⏳", label: "Chờ duyệt",          value: stats.pending,    bg: "#FFF3E8", color: "#FF6B00" },
    { icon: "📌", label: "Niêm yết công khai",  value: stats.notices,   bg: "#F3EEFF", color: "#7C3AED" },
    { icon: "❓", label: "Câu hỏi thường gặp", value: stats.faqs,      bg: "#E8F8EF", color: "#00B14F" },
  ];

  return (
    <>
      {/* Stats */}
      <div className="stats-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-card-icon" style={{ background: c.bg, color: c.color }}>
              {c.icon}
            </div>
            <div className="stat-card-info">
              <div className="stat-card-value">{c.value}</div>
              <div className="stat-card-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Thao tác nhanh</div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { href: "/procedures", label: "Quản lý thủ tục", icon: "📋" },
            { href: "/posts",      label: "Viết bài mới",    icon: "✏️" },
            { href: "/notices",    label: "Tạo niêm yết",    icon: "📌" },
            { href: "/faqs",       label: "Thêm câu hỏi",    icon: "❓" },
            { href: "/center",     label: "Cập nhật TT",      icon: "🏛️" },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className="btn btn-ghost"
              style={{ gap: 8 }}
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Hướng dẫn sử dụng</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["📋 Thủ tục hành chính", "Quản lý các thủ tục theo lĩnh vực. EDITOR+ có thể tạo mới, sửa, xóa (SUPER_ADMIN)."],
            ["📰 Tin tức & Hướng dẫn", "EDITOR soạn bài → gửi duyệt → REVIEWER duyệt/từ chối → xuất bản."],
            ["📌 Niêm yết", "Đăng tải văn bản niêm yết công khai có ngày bắt đầu / kết thúc."],
            ["❓ FAQ", "Câu hỏi thường gặp — hiển thị trong tab Của tôi trên Mini App."],
          ].map(([title, desc]) => (
            <div key={title} style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

