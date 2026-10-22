import { useState, useEffect } from "react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
const LABELS = { POST_CREATE: "Tạo bản nháp", POST_EDIT: "Sửa bài", POST_SUBMIT: "Gửi duyệt", POST_PUBLISH: "Duyệt đăng", POST_REJECT: "Từ chối", POST_ARCHIVE: "Gỡ bài", CENTER_CREATE: "Tạo thông tin trung tâm", CENTER_UPDATE: "Sửa thông tin trung tâm", PROCEDURE_CREATE: "Thêm thủ tục", PROCEDURE_UPDATE: "Sửa thủ tục", PROCEDURE_HIDE: "Ẩn thủ tục", FAQ_CREATE: "Thêm hỏi đáp", FAQ_UPDATE: "Sửa hỏi đáp", FAQ_DELETE: "Xóa hỏi đáp", NOTICE_CREATE: "Thêm niêm yết", NOTICE_UPDATE: "Sửa niêm yết", NOTICE_DOCUMENT_ADD: "Thêm tài liệu", NOTICE_DOCUMENT_DELETE: "Gỡ tài liệu" };
export default function AuditPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const [state, setState] = useState({ loading: true, data: [], error: "", totalPages: 0 });
  useEffect(() => {
    if (user?.role !== "SUPER_ADMIN") return;
    let active = true;
    setState(s => ({ ...s, loading: true, error: "" }));
    api.getAudit(page).then(data => { if(active) setState({ ...data, loading: false, error: "" }); }).catch(err => { if(active) setState({ data: [], loading: false, error: err.message }); });
    return () => { active = false; };
  }, [page, retry, user?.role]);
  if (user?.role !== "SUPER_ADMIN") return <p>Bạn không có quyền xem nhật ký.</p>;
  return <div className="card">
    <p>Nhật ký ghi người thực hiện, hành động và mã nội dung.</p>
    {state.loading ? <p role="status">Đang tải…</p> : state.error ? <p role="alert">{state.error}<button onClick={() => setRetry(n => n+1)}>Thử lại</button></p> : <>
      <div className="table-container"><table className="table"><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Nội dung</th></tr></thead><tbody>
        {state.data.map(item => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td><td>{item.admin?.fullName || "Hệ thống"}</td><td>{LABELS[item.action] || item.action}</td><td>{item.resource}</td></tr>)}
        {!state.data.length && <tr><td colSpan={4}>Chưa có nhật ký.</td></tr>}
      </tbody></table></div>
      <div className="pagination"><button className="btn btn-ghost" disabled={page<=1} onClick={() => setPage(n=>n-1)}>Trước</button><span>Trang {page}/{Math.max(1, state.totalPages)}</span><button className="btn btn-ghost" disabled={page>=state.totalPages} onClick={() => setPage(n=>n+1)}>Sau</button></div>
    </>}
  </div>;
}
