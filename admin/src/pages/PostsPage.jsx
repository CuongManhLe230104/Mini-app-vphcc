import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";

const STATUS_MAP = {
  DRAFT:     { label: "Nháp",       cls: "badge-neutral" },
  PENDING:   { label: "Chờ duyệt",  cls: "badge-warning" },
  PUBLISHED: { label: "Đã đăng",    cls: "badge-success" },
  REJECTED:  { label: "Từ chối",    cls: "badge-danger"  },
  ARCHIVED:  { label: "Lưu trữ",    cls: "badge-neutral" },
};

const TYPE_MAP = {
  NEWS:  { label: "Tin tức",    icon: "📰" },
  GUIDE: { label: "Hướng dẫn", icon: "📖" },
  VIDEO: { label: "Video",     icon: "🎬" },
};

function PostBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, cls: "badge-neutral" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

// ───── Post Form Modal ─────
function PostFormModal({ item, onClose, onSaved }) {
  const { success: toastOk, error: toastErr } = useToast();
  const isEdit = Boolean(item?.id);
  const [form, setForm] = useState({
    type: item?.type ?? "NEWS",
    title: item?.title ?? "",
    summary: item?.summary ?? "",
    content: item?.content ?? "",
    thumbnail: item?.thumbnail ?? "",
    videoUrl: item?.videoUrl ?? "",
    tags: Array.isArray(item?.tags) ? item.tags.join(", ") : "",
    isHighlighted: item?.isHighlighted ?? false,
  });
  const [saving, setSaving] = useState(false);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setBool = k => e => setForm(p => ({ ...p, [k]: e.target.checked }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      };
      if (isEdit) {
        // No dedicated update endpoint yet — just create new draft
        await api.createDraft(payload);
        toastOk("Đã tạo bản nháp mới");
      } else {
        await api.createDraft(payload);
        toastOk("Đã lưu nháp");
      }
      onSaved();
    } catch (err) { toastErr(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Xem / Soạn lại bài viết" : "Soạn bài mới"}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
          <div className="modal-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label className="form-label required">Loại bài</label>
                <select className="form-select" value={form.type} onChange={set("type")}>
                  {Object.entries(TYPE_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Thẻ (tags)</label>
                <input className="form-input" value={form.tags} onChange={set("tags")} placeholder="tag1, tag2, ..." />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label required">Tiêu đề</label>
                <input className="form-input" value={form.title} onChange={set("title")} required placeholder="Tiêu đề bài viết" />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Tóm tắt</label>
                <textarea className="form-textarea" value={form.summary} onChange={set("summary")} rows={2} placeholder="Mô tả ngắn hiển thị ở danh sách" />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label required">Nội dung</label>
                <textarea className="form-textarea" value={form.content} onChange={set("content")} required rows={8} placeholder="Nội dung bài viết..." />
              </div>
              <div className="form-group">
                <label className="form-label">URL ảnh thumbnail</label>
                <input className="form-input" value={form.thumbnail} onChange={set("thumbnail")} placeholder="https://..." type="url" />
              </div>
              {form.type === "VIDEO" && (
                <div className="form-group">
                  <label className="form-label">URL video</label>
                  <input className="form-input" value={form.videoUrl} onChange={set("videoUrl")} placeholder="https://youtube.com/..." type="url" />
                </div>
              )}
              <div className="form-group">
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.isHighlighted} onChange={setBool("isHighlighted")} style={{ width: 16, height: 16 }} />
                  <span className="form-label" style={{ margin: 0 }}>Bài nổi bật (hiển thị đầu trang chủ)</span>
                </label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu nháp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ───── Reject Modal ─────
function RejectModal({ item, onClose, onDone }) {
  const { success: toastOk, error: toastErr } = useToast();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try {
      await api.rejectPost(item.id, note);
      toastOk("Đã từ chối bài viết");
      onDone();
    } catch (err) { toastErr(err.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-title">Từ chối bài viết</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Lý do từ chối</label>
            <textarea className="form-textarea" value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="Nhập lý do từ chối..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-danger" onClick={handle} disabled={loading}>
            {loading ? "Đang xử lý..." : "Từ chối"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───── Main ─────
export default function PostsPage() {
  const { user } = useAuth();
  const { success: toastOk, error: toastErr } = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const limit = 10;
  const isReviewer = ["SUPER_ADMIN", "REVIEWER"].includes(user?.role);
  const isEditor   = ["SUPER_ADMIN", "EDITOR"].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPostsAdmin({ page, limit, status: statusFilter || undefined, type: typeFilter || undefined });
      if (page > 1 && page > Math.max(1, res.totalPages ?? 1)) {
        setPage(Math.max(1, res.totalPages ?? 1));
        return;
      }
      setPosts(res.data ?? []);
      setTotalPages(res.totalPages ?? 1);
    } catch (err) { toastErr(err.message); }
    finally { setLoading(false); }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const action = async (fn, successMsg) => {
    try { await fn(); toastOk(successMsg); load(); }
    catch (err) { toastErr(err.message); }
  };

  const removePost = async () => {
    if (deleting || !modal?.item) return;
    setDeleting(true);
    try {
      await api.deletePost(modal.item.id);
      toastOk('Đã xóa bài khỏi Mini App và chuyển vào Lưu trữ');
      setModal(null);
      await load();
    } catch (err) { toastErr(err.message); }
    finally { setDeleting(false); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

  return (
    <>
      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Đang quản lý (chưa xóa)</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="form-select" style={{ width: 150 }} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">Tất cả loại</option>
            {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div className="page-toolbar-right">
          {isEditor && (
            <button className="btn btn-primary" onClick={() => setModal({ type: "form", item: null })}>
              + Soạn bài mới
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Loại</th>
                <th>Trạng thái</th>
                <th>Tác giả</th>
                <th>Ngày tạo</th>
                <th style={{ width: 200 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="loading-full"><span className="spinner" /> Đang tải...</div></td></tr>
              ) : posts.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon">📰</div><div>Chưa có bài viết nào</div></div></td></tr>
              ) : posts.map(p => (
                <tr key={p.id}>
                  <td style={{ maxWidth: 300 }}>
                    <div className="truncate" title={p.title} style={{ fontWeight: 500 }}>{p.title}</div>
                    {p.isHighlighted && <span className="badge badge-primary" style={{ marginTop: 4 }}>⭐ Nổi bật</span>}
                  </td>
                  <td>{TYPE_MAP[p.type]?.icon} {TYPE_MAP[p.type]?.label}</td>
                  <td><PostBadge status={p.status} /></td>
                  <td style={{ fontSize: "var(--font-size-sm)" }}>{p.author?.fullName || "—"}</td>
                  <td style={{ fontSize: "var(--font-size-sm)", whiteSpace: "nowrap" }}>{fmtDate(p.createdAt)}</td>
                  <td>
                    <div className="table-actions">
                      {isEditor && p.status === "DRAFT" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => action(() => api.submitPost(p.id), "Đã gửi duyệt")}>
                          📨 Gửi duyệt
                        </button>
                      )}
                      {isReviewer && p.status === "PENDING" && <>
                        <button className="btn btn-success btn-sm" onClick={() => action(() => api.publishPost(p.id), "Đã xuất bản")}>
                          ✓ Duyệt
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                          onClick={() => setModal({ type: "reject", item: p })}>
                          ✕ Từ chối
                        </button>
                      </>}
                      {isReviewer && p.status !== "ARCHIVED" && (
                        <button className="btn btn-danger btn-sm" onClick={() => setModal({ type: "delete", item: p })}>
                          Xóa
                        </button>
                      )}
                      {isEditor && p.status !== "ARCHIVED" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: "form", item: p })}>
                          ✏️
                        </button>
                      )}
                    </div>
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

      {modal?.type === "delete" && (
        <div className="modal-overlay">
          <div className="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="delete-post-title">
            <div className="modal-header"><div className="modal-title" id="delete-post-title">Xóa bài viết?</div></div>
            <div className="modal-body">
              <p><strong>{modal.item.title}</strong></p>
              <p>Bài sẽ được gỡ khỏi Mini App khi tải lại dữ liệu và chuyển vào mục Lưu trữ. Nội dung vẫn được giữ lại.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" disabled={deleting} onClick={() => setModal(null)}>Hủy</button>
              <button className="btn btn-danger" disabled={deleting} onClick={removePost}>{deleting ? "Đang xóa..." : "Xác nhận xóa"}</button>
            </div>
          </div>
        </div>
      )}
      {modal?.type === "form" && (
        <PostFormModal item={modal.item} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "reject" && (
        <RejectModal item={modal.item} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
    </>
  );
}

