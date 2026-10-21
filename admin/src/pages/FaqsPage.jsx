import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";

// ───── FAQ Form Modal ─────
function FaqModal({ item, onClose, onSaved }) {
  const { success: toastOk, error: toastErr } = useToast();
  const isEdit = Boolean(item?.id);
  const [form, setForm] = useState({
    question: item?.question ?? "",
    answer: item?.answer ?? "",
    category: item?.category ?? "",
    sortOrder: item?.sortOrder ?? 0,
    isPublished: item?.isPublished ?? false,
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setBool = k => e => setForm(p => ({ ...p, [k]: e.target.checked }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) await api.updateFaq(item.id, { ...form, sortOrder: Number(form.sortOrder) });
      else        await api.createFaq({ ...form, sortOrder: Number(form.sortOrder) });
      toastOk(isEdit ? "Đã cập nhật FAQ" : "Đã thêm câu hỏi mới");
      onSaved();
    } catch (err) { toastErr(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Sửa câu hỏi" : "Thêm câu hỏi mới"}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Câu hỏi</label>
              <input className="form-input" value={form.question} onChange={set("question")} required placeholder="Ví dụ: Thủ tục đăng ký khai sinh mất bao lâu?" />
            </div>
            <div className="form-group">
              <label className="form-label required">Câu trả lời</label>
              <textarea className="form-textarea" value={form.answer} onChange={set("answer")} required rows={5} placeholder="Câu trả lời chi tiết..." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Danh mục</label>
                <input className="form-input" value={form.category} onChange={set("category")} placeholder="Ví dụ: Thủ tục hành chính" />
              </div>
              <div className="form-group">
                <label className="form-label">Thứ tự</label>
                <input className="form-input" type="number" value={form.sortOrder} onChange={set("sortOrder")} style={{ width: 80 }} min={0} />
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={form.isPublished} onChange={setBool("isPublished")} style={{ width: 16, height: 16 }} />
                <span>Công khai ngay (hiển thị trên Mini App)</span>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Thêm mới"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDelete({ item, onClose, onDeleted }) {
  const { success: toastOk, error: toastErr } = useToast();
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try { await api.deleteFaq(item.id); toastOk("Đã xóa câu hỏi"); onDeleted(); }
    catch (err) { toastErr(err.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-title">Xác nhận xóa</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="confirm-icon">⚠️</div>
          <div className="confirm-message" style={{ fontWeight: 600 }}>Xóa câu hỏi này?</div>
          <div className="confirm-sub" style={{ marginTop: 8 }}>"{item?.question}"</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-danger" onClick={handle} disabled={loading}>{loading ? "Đang xóa..." : "Xóa"}</button>
        </div>
      </div>
    </div>
  );
}

export default function FaqsPage() {
  const { user } = useAuth();
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const isEditor     = ["SUPER_ADMIN", "EDITOR"].includes(user?.role);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getFaqsAdmin();
      setFaqs(Array.isArray(res) ? res : res?.data ?? []);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="page-toolbar">
        <div className="page-toolbar-left" />
        <div className="page-toolbar-right">
          {isEditor && (
            <button className="btn btn-primary" onClick={() => setModal({ type: "form", item: null })}>
              + Thêm câu hỏi
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>STT</th>
                <th>Câu hỏi</th>
                <th>Danh mục</th>
                <th>Thứ tự</th>
                <th>Trạng thái</th>
                <th style={{ width: 120 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="loading-full"><span className="spinner" /> Đang tải...</div></td></tr>
              ) : faqs.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon">❓</div><div>Chưa có câu hỏi nào</div></div></td></tr>
              ) : faqs.map((f, idx) => (
                <tr key={f.id}>
                  <td style={{ textAlign: "center", color: "var(--text-secondary)" }}>{idx+1}</td>
                  <td style={{ maxWidth: 400 }}>
                    <div className="truncate" title={f.question} style={{ fontWeight: 500 }}>{f.question}</div>
                    <div className="truncate" title={f.answer} style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: 2 }}>
                      {f.answer}
                    </div>
                  </td>
                  <td>{f.category || <span style={{ color: "var(--text-disabled)" }}>—</span>}</td>
                  <td style={{ textAlign: "center" }}>{f.sortOrder}</td>
                  <td>
                    <span className={`badge ${f.isPublished ? "badge-success" : "badge-neutral"}`}>
                      {f.isPublished ? "Công khai" : "Ẩn"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      {isEditor && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: "form", item: f })}>✏️</button>
                      )}
                      {isSuperAdmin && (
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                          onClick={() => setModal({ type: "delete", item: f })}>🗑</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal?.type === "form" && (
        <FaqModal item={modal.item} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "delete" && (
        <ConfirmDelete item={modal.item} onClose={() => setModal(null)} onDeleted={() => { setModal(null); load(); }} />
      )}
    </>
  );
}

