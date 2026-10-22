import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Sidebar.css";

const NAV_ITEMS = [
  { to: "/audit", label: "Nhật ký thao tác", icon: "🕒", role: "SUPER_ADMIN" },
  { to: "/",           label: "Tổng quan",       icon: "📊", exact: true },
  { to: "/procedures", label: "Thủ tục HC",      icon: "📋" },
  { to: "/posts",      label: "Tin tức & Hướng dẫn", icon: "📰" },
  { to: "/notices",    label: "Niêm yết",         icon: "📌" },
  { to: "/faqs",       label: "Câu hỏi thường gặp", icon: "❓" },
  { to: "/center",     label: "Thông tin trung tâm", icon: "🏛️" },
];

const ROLE_LABELS = {
  SUPER_ADMIN: { label: "Quản trị viên", color: "#7C3AED" },
  EDITOR:      { label: "Biên tập viên",  color: "#0068FF" },
  REVIEWER:    { label: "Người duyệt",    color: "#00B14F" },
  HANDLER:     { label: "Cán bộ xử lý",  color: "#FF6B00" },
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleInfo = ROLE_LABELS[user?.role] || { label: user?.role || "", color: "#7A7E8B" };

  return (
    <aside className="sidebar">
      {/* Logo / Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">🏛️</div>
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-name">Trung tâm phục vụ hành chính công</div>
          <div className="sidebar-brand-sub">xã Nghĩa Thành</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.filter(item => !item.role || item.role === user?.role).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {(user?.fullName || user?.username || "A")[0].toUpperCase()}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name truncate">{user?.fullName || user?.username}</div>
          <div className="sidebar-user-role" style={{ color: roleInfo.color }}>
            {roleInfo.label}
          </div>
        </div>
        <button className="sidebar-logout-btn" onClick={handleLogout} title="Đăng xuất">
          ⎋
        </button>
      </div>
    </aside>
  );
}

