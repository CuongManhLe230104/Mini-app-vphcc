import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { useToast } from "../contexts/ToastContext";

// ───── Badge helper ─────
function ProcBadge({ isValid }) {
  return (
    <span className={`badge ${isValid ? "badge-success" : "badge-neutral"}`}>
      {isValid ? "Hiệu lực" : "Tạm dừng"}
    </span>
  );
}

// ───── Modal Form ─────
function ProcedureModal({ item, fields, onClose, onSaved }) {
  const { success: toastOk, error: toastErr } = useToast();
  const isEdit = Boolean(item?.id);
  const [form, setForm] = useState({
    name: item?.name ?? "",
    code: item?.code ?? "",
    fieldId: item?.fieldId ?? (fields[0]?.id || ""),
    authority: item?.authority ?? "UBND xã Nghĩa Thành",
    deadline: item?.deadline ?? "",
    fee: item?.fee ?? "Miễn phí",
    components: Array.isArray(item?.components) ? item.components.join("\n") : "",
    submission: item?.submission ?? "Nộp trực tiếp tại bộ phận một cửa",
    sourceUrl: item?.sourceUrl ?? "",
    isValid: item?.isValid ?? true,
  });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const setBool = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value === "true" }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        components: form.components.split("\n").map(s => s.trim()).filter(Boolean),
      };
      if (isEdit) await api.updateProcedure(item.id, payload);
      else        await api.createProcedure(payload);
      toastOk(isEdit ? "Đã cập nhật thủ tục" : "Đã tạo thủ tục mới");
      onSaved();
    } catch (err) {
      toastErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Sửa thủ tục" : "Thêm thủ tục mới"}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
          <div className="modal-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label required">Tên thủ tục</label>
                <input className="form-input" value={form.name} onChange={set("name")} required placeholder="Ví dụ: Đăng ký khai sinh" />
              </div>
              <div className="form-group">
                <label className="form-label">Mã thủ tục</label>
                <input className="form-input" value={form.code} onChange={set("code")} placeholder="1.000.00.00.H14" />
              </div>
              <div className="form-group">
                <label className="form-label required">Lĩnh vực</label>
                <select className="form-select" value={form.fieldId} onChange={set("fieldId")} required>
                  {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Cơ quan thực hiện</label>
                <input className="form-input" value={form.authority} onChange={set("authority")} required />
              </div>
              <div className="form-group">
                <label className="form-label required">Thời hạn giải quyết</label>
                <input className="form-input" value={form.deadline} onChange={set("deadline")} required placeholder="3 ngày làm việc" />
              </div>
              <div className="form-group">
                <label className="form-label required">Lệ phí</label>
                <input className="form-input" value={form.fee} onChange={set("fee")} required placeholder="Miễn phí" />
              </div>
              <div className="form-group">
                <label className="form-label">Trạng thái</label>
                <select className="form-select" value={String(form.isValid)} onChange={setBool("isValid")}>
                  <option value="true">Đang hiệu lực</option>
                  <option value="false">Tạm dừng</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label required">Thành phần hồ sơ</label>
                <textarea
                  className="form-textarea"
                  value={form.components}
                  onChange={set("components")}
                  rows={4}
                  placeholder="Mỗi thành phần một dòng&#10;Ví dụ: Tờ khai đăng ký khai sinh"
                />
                <span className="form-hint">Mỗi thành phần hồ sơ trên một dòng</span>
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label required">Cách thức nộp</label>
                <input className="form-input" value={form.submission} onChange={set("submission")} required />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Link nguồn chính thức</label>
                <input className="form-input" value={form.sourceUrl} onChange={set("sourceUrl")} placeholder="https://..." type="url" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" style={{ width:14,height:14 }} /> Đang lưu...</> : (isEdit ? "Cập nhật" : "Thêm mới")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ───── Confirm Delete ─────
function ConfirmDelete({ item, onClose, onDeleted }) {
  const { success: toastOk, error: toastErr } = useToast();
  const [loading, setLoading] = useState(false);
  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.deleteProcedure(item.id);
      toastOk("Đã xóa thủ tục");
      onDeleted();
    } catch (err) { toastErr(err.message); }
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
          <div className="confirm-message" style={{ fontWeight: 600 }}>Xóa thủ tục này?</div>
          <div className="confirm-sub" style={{ marginTop: 8 }}>"{item?.name}"</div>
          <div className="confirm-sub" style={{ marginTop: 4 }}>Thao tác này không thể hoàn tác.</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>
            {loading ? "Đang xóa..." : "Xóa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───── Main Page ─────
export default function ProceduresPage() {
  const [loadError, setLoadError] = useState("");
  const { user } = useAuth();
  const canWrite = ["SUPER_ADMIN", "REVIEWER"].includes(user?.role);
  const [procedures, setProcedures] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modal, setModal] = useState(null); // null | { type: "form"|"delete", item }

  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.getProcedures({ page, limit, field: fieldFilter || undefined, search: search || undefined });
      setProcedures(res.data ?? []);
      setTotalPages(res.totalPages ?? 1);
    } catch (err) { setLoadError(err.message); }
    finally { setLoading(false); }
  }, [page, fieldFilter, search]);

  useEffect(() => { api.getFields().then(data => setFields(Array.isArray(data) ? data : data?.data ?? [])).catch(err => setLoadError(err.message)); }, []);
  useEffect(() => { load(); }, [load]);

  const handleSaved = () => { setModal(null); load(); };
  const handleDeleted = () => { setModal(null); load(); };

  const fieldMap = Object.fromEntries(fields.map(f => [f.id, f.label]));

  if (loadError) return <div className="card" role="alert">{loadError}<button className="btn btn-primary" onClick={load}>Thử lại</button></div>;

  return (
    <>
      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <div className="search-wrapper">
            <input
              className="search-input"
              placeholder="Tìm tên thủ tục..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="form-select"
            style={{ width: 180 }}
            value={fieldFilter}
            onChange={e => { setFieldFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tất cả lĩnh vực</option>
            {fields.map(f => <option key={f.id} value={f.slug}>{f.label}</option>)}
          </select>
        </div>
        <div className="page-toolbar-right" style={{ display: canWrite ? undefined : "none" }}>
          <button className="btn btn-primary" onClick={() => setModal({ type: "form", item: null })}>
            + Thêm thủ tục
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tên thủ tục</th>
                <th>Mã</th>
                <th>Lĩnh vực</th>
                <th>Thời hạn</th>
                <th>Lệ phí</th>
                <th>Trạng thái</th>
                <th style={{ width: 120 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>
                  <div className="loading-full"><span className="spinner" /> Đang tải...</div>
                </td></tr>
              ) : procedures.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state"><div className="empty-state-icon">📋</div><div>Chưa có thủ tục nào</div></div>
                </td></tr>
              ) : procedures.map(p => (
                <tr key={p.id}>
                  <td style={{ maxWidth: 280 }}>
                    <div className="truncate" title={p.name} style={{ fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>{p.authority}</div>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-sm)" }}>{p.code || "—"}</td>
                  <td>{fieldMap[p.fieldId] || p.field?.label || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{p.deadline}</td>
                  <td>{p.fee}</td>
                  <td><ProcBadge isValid={p.isValid} /></td>
                  <td>
                    <div className="table-actions" style={{ display: canWrite ? undefined : "none" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setModal({ type: "form", item: p })}
                      >✏️</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--danger)" }}
                        disabled={user?.role !== "SUPER_ADMIN" || !p.isValid}
                        onClick={() => setModal({ type: "delete", item: p })}
                      >🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination" style={{ padding: "12px 16px" }}>
            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} className={`pagination-btn ${n === page ? "active" : ""}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === "form" && (
        <ProcedureModal item={modal.item} fields={fields} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal?.type === "delete" && (
        <ConfirmDelete item={modal.item} onClose={() => setModal(null)} onDeleted={handleDeleted} />
      )}
    </>
  );
}

