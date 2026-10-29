import AuditPage from "./pages/AuditPage";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import AdminLayout from "./layouts/AdminLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProceduresPage from "./pages/ProceduresPage";
import PostsPage from "./pages/PostsPage";
import NoticesPage from "./pages/NoticesPage";
import FaqsPage from "./pages/FaqsPage";
import CenterPage from "./pages/CenterPage";
import QueuePage from "./pages/QueuePage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="queue" element={<QueuePage />} />
              <Route path="procedures" element={<ProceduresPage />} />
              <Route path="posts" element={<PostsPage />} />
              <Route path="notices" element={<NoticesPage />} />
              <Route path="faqs" element={<FaqsPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="center" element={<CenterPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

