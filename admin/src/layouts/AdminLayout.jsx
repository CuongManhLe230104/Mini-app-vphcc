import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { useAuth } from "../contexts/AuthContext";

export default function AdminLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-full" style={{ minHeight: "100vh" }}>
        <span className="spinner" />
        <span>Đang tải...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header />
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

