import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

export default function LoginPage() {
  const { login } = useAuth();
  const { error: toastError } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) return;
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate("/", { replace: true });
    } catch (err) {
      toastError(err.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-header">
          <span className="login-icon">🏛️</span>
          <div className="login-title">Cổng Quản trị</div>
          <div className="login-sub">Trung tâm PVHCC xã Nghĩa Thành</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label required">Tên đăng nhập</label>
            <input
              className="form-input"
              type="text"
              placeholder="Nhập tên đăng nhập"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label required">Mật khẩu</label>
            <input
              className="form-input"
              type="password"
              placeholder="Nhập mật khẩu"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              autoComplete="current-password"
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 8, padding: "12px" }}
            disabled={loading || !form.username || !form.password}
            type="submit"
          >
            {loading ? <><span className="spinner" style={{ width:16,height:16 }} /> Đang đăng nhập...</> : "Đăng nhập"}
          </button>
        </form>
        <p style={{ marginTop: 20, textAlign: "center", fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
          Hệ thống nội bộ — chỉ dành cho cán bộ có thẩm quyền
        </p>
      </div>
    </div>
  );
}

