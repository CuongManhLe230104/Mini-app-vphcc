import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { useToast } from "../contexts/ToastContext";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN");
}

function isActive(notice) {
  const now = new Date();
  return new Date(notice.startDate) <= now && now <= new Date(notice.endDate);
}

// ───── Notice Form Modal ─────
function NoticeFormModal({ item, onClose, onSaved }) {
  const { success: toastOk, error: toastErr } = useToast();
  const isEdit = Boolean(item?.id);
  const toDateInput = (d) => d ? new Date(d).toISOString().substring(0, 10) : "";
  const [form, setForm] = useState({
    title: item?.title ?? "",
    description: item?.description ?? "",
    startDate: toDateInput(item?.startDate),
    endDate: toDateInput(item?.endDate),
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      };
      if (isEdit) await api.updateNotice(item.id, payload);
      else        await api.createNotice(payload);
      toastOk(isEdit ? "Đã cập nhật niêm yết" : "Đã tạo niêm yết mới");
      onSaved();
    } catch (err) { toastErr(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Sửa niêm yết" : "Thêm niêm yết mới"}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Tiêu đề niêm yết</label>
              <input className="form-input" value={form.title} onChange={set("title")} required placeholder="Ví dụ: Niêm yết kết quả giải quyết TTHC tháng 10/2026" />
            </div>
            <div className="form-group">
              <label className="form-label required">Nội dung mô tả</label>
              <textarea className="form-textarea" value={form.description} onChange={set("description")} required rows={4} placeholder="Mô tả nội dung niêm yết..." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label className="form-label required">Ngày bắt đầu</label>
                <input className="form-input" type="date" value={form.startDate} onChange={set("startDate")} required />
              </div>
              <div className="form-group">
                <label className="form-label required">Ngày kết thúc</label>
                <input className="form-input" type="date" value={form.endDate} onChange={set("endDate")} required />
              </div>
            </div>
            <div className="form-hint">
              ℹ Tài liệu đính kèm có thể được thêm sau khi tạo niêm yết.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo niêm yết"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ───── Main ─────
export default function NoticesPage() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modal, setModal] = useState(null);

  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getNotices({ page, limit });
      setNotices(res.data ?? []);
      setTotalPages(res.totalPages ?? 1);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="page-toolbar">
        <div className="page-toolbar-left" />
        <div className="page-toolbar-right">
          <button className="btn btn-primary" onClick={() => setModal({ item: null })}>
            + Thêm niêm yết
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Bắt đầu</th>
                <th>Kết thúc</th>
                <th>Trạng thái</th>
                <th>Tài liệu</th>
                <th style={{ width: 100 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="loading-full"><span className="spinner" /> Đang tải...</div></td></tr>
              ) : notices.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon">📌</div><div>Chưa có niêm yết nào</div></div></td></tr>
              ) : notices.map(n => (
                <tr key={n.id}>
                  <td style={{ maxWidth: 360 }}>
                    <div className="truncate" title={n.title} style={{ fontWeight: 500 }}>{n.title}</div>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: 2 }}
                         className="truncate" title={n.description}>{n.description}</div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(n.startDate)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(n.endDate)}</td>
                  <td>
                    <span className={`badge ${isActive(n) ? "badge-success" : "badge-neutral"}`}>
                      {isActive(n) ? "Đang niêm yết" : "Hết hạn / Chưa hiệu lực"}
                    </span>
                  </td>
                  <td>{Array.isArray(n.documents) ? n.documents.length : 0} tệp</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal({ item: n })}>✏️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="pagination" style={{ padding: "12px 16px" }}>
            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p-1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i+1).map(n => (
              <button key={n} className={`pagination-btn ${n===page?"active":""}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>›</button>
          </div>
        )}
      </div>

      {modal && (
        <NoticeFormModal item={modal.item} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </>
  );
}

