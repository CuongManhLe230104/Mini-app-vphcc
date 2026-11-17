import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import logoHcc from "../assets/logo_hcc.png";
import "./Sidebar.css";

const NAV_ITEMS = [
  { to: "/",           label: "Tổng quan",             exact: true },
  { to: "/queue",      label: "Đặt lịch & Cấp số",     roles: ["SUPER_ADMIN", "COUNTER_STAFF"] },
  { to: "/procedures", label: "Thủ tục hành chính" },
  { to: "/posts",      label: "Tin tức & Hướng dẫn" },
  { to: "/notices",    label: "Niêm yết công khai" },
  { to: "/faqs",       label: "Câu hỏi thường gặp" },
  { to: "/center",     label: "Thông tin trung tâm" },
  { to: "/audit",      label: "Nhật ký thao tác",      role: "SUPER_ADMIN" },
];

const ROLE_LABELS = {
  SUPER_ADMIN:   { label: "Quản trị viên", color: "#7C3AED" },
  EDITOR:        { label: "Biên tập viên",  color: "#0068FF" },
  REVIEWER:      { label: "Người duyệt",    color: "#00B14F" },
  HANDLER:       { label: "Cán bộ xử lý",  color: "#FF6B00" },
  COUNTER_STAFF: { label: "Cán bộ quầy",    color: "#0D9488" },
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
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <img src={logoHcc} alt="Logo Trung tâm PVHCC" className="sidebar-brand-logo" />
        </div>
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-name">Trung tâm PVHCC</div>
          <div className="sidebar-brand-sub">Xã Nghĩa Thành</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.filter(item => (!item.role || item.role === user?.role) && (!item.roles || item.roles.includes(user?.role))).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
          >
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
          Thoát
        </button>
      </div>
    </aside>
  );
}


