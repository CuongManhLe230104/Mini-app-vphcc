import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { useToast } from "../contexts/ToastContext";

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("vi-VN");
}

const PUB_STATUS_LABELS = {
  DRAFT: { label: "Nháp", cls: "badge-neutral" },
  PENDING: { label: "Chờ duyệt", cls: "badge-warning" },
  PUBLISHED: { label: "Đã đăng công khai", cls: "badge-success" },
  REVOKED: { label: "Đã thu hồi", cls: "badge-danger" },
};

const LEGAL_STATUS_LABELS = {
  UNVERIFIED: { label: "Chưa xác minh", cls: "badge-neutral" },
  VALID: { label: "Còn hiệu lực", cls: "badge-success" },
  PARTIALLY_EXPIRED: { label: "Hiệu lực một phần", cls: "badge-warning" },
  EXPIRED: { label: "Hết hiệu lực", cls: "badge-danger" },
};

const NOTICE_TYPE_LABELS = {
  PROCEDURE_ANNOUNCEMENT: "Công bố TTHC",
  INTERNAL_PROCESS: "Quy trình nội bộ/điện tử",
  INTERNAL_PROCEDURE: "TTHC nội bộ",
};

const QUALITY_BADGES = {
  OK: { label: "Hợp lệ cơ bản", cls: "badge-success" },
  CONFLICT: { label: "Xung đột (4811/5116)", cls: "badge-danger" },
  DUPLICATE_CANDIDATE: { label: "Trùng văn bản (42/43)", cls: "badge-warning" },
  NEEDS_VERIFICATION: { label: "Cần đối chiếu ngày", cls: "badge-warning" },
  UNCHECKED: { label: "Chưa kiểm tra", cls: "badge-neutral" },
};

// ───── Modal Biên tập & Duyệt Hồ sơ Niêm yết ─────
function NoticeFormModal({ item, proceduresList, onClose, onSaved }) {
  const { success: toastOk, error: toastErr } = useToast();
  const isEdit = Boolean(item?.id);
  const toDateInput = (d) =>
    d
      ? new Date(new Date(d).getTime() + 7 * 3600000)
          .toISOString()
          .substring(0, 10)
      : "";

  const [form, setForm] = useState({
    title: item?.title ?? "",
    description: item?.description ?? "",
    summary: item?.summary ?? "",
    legalDocumentNumber: item?.legalDocumentNumber ?? "",
    legalDocumentDate: toDateInput(item?.legalDocumentDate),
    citedDateText: item?.citedDateText ?? "",
    issuingAuthority:
      item?.issuingAuthority ?? "Chủ tịch UBND Thành phố Hồ Chí Minh",
    managingAuthority: item?.managingAuthority ?? "",
    publishingUnit:
      item?.publishingUnit ??
      "Trung tâm Phục vụ hành chính công xã Nghĩa Thành",
    noticeType: item?.noticeType ?? "PROCEDURE_ANNOUNCEMENT",
    publicationStatus: item?.publicationStatus ?? "DRAFT",
    legalStatus: item?.legalStatus ?? "UNVERIFIED",
    fieldTagsText: Array.isArray(item?.fieldTags)
      ? item.fieldTags.join(", ")
      : "",
    sourcePortalUrl: item?.sourcePortalUrl ?? "",
    verificationNote: item?.verificationNote ?? "",
    startDate: toDateInput(item?.startDate) || "2026-08-01",
    endDate: toDateInput(item?.endDate) || "2030-12-31",
    documents: (item?.documents || []).map(({ name, fileUrl }) => ({
      name,
      fileUrl,
    })),
    procedureLinks: (item?.procedureLinks || []).map((lnk) => ({
      procedureId: lnk.procedureId || lnk.procedure?.id || "",
      impactType: lnk.impactType || "AMENDED",
      receivingAuthority:
        lnk.receivingAuthority ||
        "Trung tâm Phục vụ hành chính công xã Nghĩa Thành",
      resolvingAuthority: lnk.resolvingAuthority || "",
      acceptsAtCenter: lnk.acceptsAtCenter ?? true,
      note: lnk.note || "",
    })),
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fieldTags = form.fieldTagsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        title: form.title,
        description: form.description,
        summary: form.summary || form.description,
        legalDocumentNumber: form.legalDocumentNumber || undefined,
        legalDocumentDate: form.legalDocumentDate
          ? new Date(form.legalDocumentDate + "T00:00:00+07:00").toISOString()
          : undefined,
        citedDateText: form.citedDateText || undefined,
        issuingAuthority: form.issuingAuthority || undefined,
        managingAuthority: form.managingAuthority || undefined,
        publishingUnit: form.publishingUnit || undefined,
        noticeType: form.noticeType,
        publicationStatus: form.publicationStatus,
        legalStatus: form.legalStatus,
        fieldTags,
        sourcePortalUrl: form.sourcePortalUrl || undefined,
        verificationNote: form.verificationNote || undefined,
        startDate: new Date(form.startDate + "T00:00:00+07:00").toISOString(),
        endDate: new Date(form.endDate + "T23:59:59+07:00").toISOString(),
        documents: form.documents,
        procedureLinks: form.procedureLinks.filter((l) => l.procedureId),
      };
      if (isEdit) await api.updateNotice(item.id, payload);
      else await api.createNotice(payload);
      toastOk(isEdit ? "Đã cập nhật hồ sơ niêm yết" : "Đã tạo niêm yết mới");
      onSaved();
    } catch (err) {
      toastErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 780 }}>
        <div className="modal-header">
          <div className="modal-title">
            {isEdit ? "Biên tập hồ sơ niêm yết" : "Thêm niêm yết mới"}
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
          <div
            className="modal-body"
            style={{ maxHeight: "75vh", overflowY: "auto" }}
          >
            <div className="form-group">
              <label className="form-label required">Tiêu đề niêm yết</label>
              <input
                className="form-input"
                value={form.title}
                onChange={set("title")}
                required
                placeholder="Ví dụ: Niêm yết công khai Quyết định số 5119/QĐ-UBND..."
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
              }}
            >
              <div className="form-group">
                <label className="form-label">Số hiệu Quyết định</label>
                <input
                  className="form-input"
                  value={form.legalDocumentNumber}
                  onChange={set("legalDocumentNumber")}
                  placeholder="VD: 5119/QĐ-UBND"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ngày ban hành QĐ</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.legalDocumentDate}
                  onChange={set("legalDocumentDate")}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Chuỗi ngày dẫn chiếu</label>
                <input
                  className="form-input"
                  value={form.citedDateText}
                  onChange={set("citedDateText")}
                  placeholder="VD: 13 tháng 8 năm 2026"
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
              }}
            >
              <div className="form-group">
                <label className="form-label">Nhóm niêm yết</label>
                <select
                  className="form-input"
                  value={form.noticeType}
                  onChange={set("noticeType")}
                >
                  <option value="PROCEDURE_ANNOUNCEMENT">
                    Công bố TTHC / Danh mục TTHC
                  </option>
                  <option value="INTERNAL_PROCESS">
                    Quy trình nội bộ / điện tử
                  </option>
                  <option value="INTERNAL_PROCEDURE">
                    TTHC nội bộ hành chính nhà nước
                  </option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Trạng thái xuất bản</label>
                <select
                  className="form-input"
                  value={form.publicationStatus}
                  onChange={set("publicationStatus")}
                >
                  <option value="DRAFT">Nháp (Chưa công khai)</option>
                  <option value="PENDING">Chờ duyệt</option>
                  <option value="PUBLISHED">Đã đăng công khai</option>
                  <option value="REVOKED">Đã thu hồi</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Trạng thái hiệu lực pháp lý</label>
                <select
                  className="form-input"
                  value={form.legalStatus}
                  onChange={set("legalStatus")}
                >
                  <option value="UNVERIFIED">Chưa xác minh hiệu lực</option>
                  <option value="VALID">Còn hiệu lực</option>
                  <option value="PARTIALLY_EXPIRED">
                    Hết hiệu lực một phần
                  </option>
                  <option value="EXPIRED">Hết hiệu lực toàn bộ</option>
                </select>
              </div>
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
            >
              <div className="form-group">
                <label className="form-label">Cơ quan quản lý lĩnh vực</label>
                <input
                  className="form-input"
                  value={form.managingAuthority}
                  onChange={set("managingAuthority")}
                  placeholder="VD: Sở Nông nghiệp và Môi trường"
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Thẻ lĩnh vực (phân cách bằng dấu phẩy)
                </label>
                <input
                  className="form-input"
                  value={form.fieldTagsText}
                  onChange={set("fieldTagsText")}
                  placeholder="VD: Đo đạc và bản đồ, Đất đai"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tóm tắt Điều 1 (hiển thị nổi bật)</label>
              <textarea
                className="form-textarea"
                value={form.summary}
                onChange={set("summary")}
                rows={2}
                placeholder="Trích yếu ngắn gọn Điều 1..."
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Nội dung chi tiết</label>
              <textarea
                className="form-textarea"
                value={form.description}
                onChange={set("description")}
                required
                rows={3}
              />
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
            >
              <div className="form-group">
                <label className="form-label required">Ngày bắt đầu niêm yết</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.startDate}
                  onChange={set("startDate")}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label required">Ngày kết thúc niêm yết</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.endDate}
                  onChange={set("endDate")}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Ghi chú đối chiếu bản gốc / xác minh
              </label>
              <input
                className="form-input"
                value={form.verificationNote}
                onChange={set("verificationNote")}
                placeholder="Ghi chú xác minh ngày ban hành, số hiệu..."
              />
            </div>

            {/* Tài liệu PDF đính kèm */}
            <div className="form-group">
              <label className="form-label">
                Tài liệu PDF niêm yết (đường dẫn HTTPS)
              </label>
              {form.documents.map((doc, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1.4fr auto",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <input
                    className="form-input"
                    aria-label="Tên tài liệu"
                    placeholder="Tên tài liệu"
                    required
                    value={doc.name}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        documents: p.documents.map((d, i) =>
                          i === idx ? { ...d, name: e.target.value } : d
                        ),
                      }))
                    }
                  />
                  <input
                    className="form-input"
                    type="url"
                    pattern="https://.*"
                    aria-label="Đường dẫn tài liệu"
                    placeholder="https://drive.google.com/..."
                    required
                    value={doc.fileUrl}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        documents: p.documents.map((d, i) =>
                          i === idx ? { ...d, fileUrl: e.target.value } : d
                        ),
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        documents: p.documents.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    Xóa
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    documents: [...p.documents, { name: "", fileUrl: "" }],
                  }))
                }
              >
                + Thêm tài liệu PDF
              </button>
            </div>

            {/* Liên kết Thủ tục hành chính (NY3) */}
            <div className="form-group">
              <label className="form-label">
                Liên kết Thủ tục hành chính tại Trung tâm (Mốc NY3)
              </label>
              {form.procedureLinks.map((lnk, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.6fr 1fr auto",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <select
                    className="form-input"
                    value={lnk.procedureId}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        procedureLinks: p.procedureLinks.map((item, i) =>
                          i === idx
                            ? { ...item, procedureId: e.target.value }
                            : item
                        ),
                      }))
                    }
                  >
                    <option value="">-- Chọn thủ tục hành chính --</option>
                    {proceduresList.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        [{pr.code || "TTHC"}] {pr.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-input"
                    value={lnk.impactType}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        procedureLinks: p.procedureLinks.map((item, i) =>
                          i === idx
                            ? { ...item, impactType: e.target.value }
                            : item
                        ),
                      }))
                    }
                  >
                    <option value="NEW">Mới ban hành</option>
                    <option value="AMENDED">Sửa đổi, bổ sung</option>
                    <option value="REPLACED">Thay thế</option>
                    <option value="REPEALED">Bãi bỏ</option>
                    <option value="INTERNAL_PROCESS">
                      Quy trình nội bộ/điện tử
                    </option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        procedureLinks: p.procedureLinks.filter(
                          (_, i) => i !== idx
                        ),
                      }))
                    }
                  >
                    Xóa
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    procedureLinks: [
                      ...p.procedureLinks,
                      {
                        procedureId: "",
                        impactType: "AMENDED",
                        receivingAuthority:
                          "Trung tâm Phục vụ hành chính công xã Nghĩa Thành",
                        resolvingAuthority: form.managingAuthority || "",
                        acceptsAtCenter: true,
                        note: "",
                      },
                    ],
                  }))
                }
              >
                + Gắn thủ tục hành chính liên quan
              </button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? "Đang lưu..."
                : isEdit
                  ? "Lưu cập nhật"
                  : "Tạo niêm yết"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ───── Modal Xử lý Cờ chất lượng Nguồn Kiểm kê (NY0 / NY2) ─────
function SourceQualityModal({ source, onClose, onSaved }) {
  const { success: toastOk, error: toastErr } = useToast();
  const [form, setForm] = useState({
    qualityStatus: source.qualityStatus || "OK",
    qualityNote: source.qualityNote || "",
    resolvedLegalDocumentNumber: source.headerCode || "",
    needsDateVerification: Boolean(source.needsDateVerification),
    publicAccessOk: source.publicAccessOk ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateNoticeSource(source.id, form);
      toastOk(`Đã cập nhật đối chiếu Nguồn #${source.sourceIndex}`);
      onSaved();
    } catch (err) {
      toastErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title">
            Đối chiếu Nguồn #{source.sourceIndex} — {source.headerCode}
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSave} style={{ display: "contents" }}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Đường dẫn PDF gốc trên Drive</label>
              <a
                href={source.originalUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--primary)", fontSize: 13 }}
              >
                {source.originalUrl} ↗
              </a>
            </div>
            <div className="form-group">
              <label className="form-label">Trạng thái chất lượng nguồn</label>
              <select
                className="form-input"
                value={form.qualityStatus}
                onChange={(e) =>
                  setForm((p) => ({ ...p, qualityStatus: e.target.value }))
                }
              >
                <option value="OK">
                  OK — Đã đối chiếu khớp bản gốc (Cho phép duyệt đăng)
                </option>
                <option value="CONFLICT">
                  CONFLICT — Xung đột số hiệu (Chặn xuất bản cho tới khi xử lý)
                </option>
                <option value="DUPLICATE_CANDIDATE">
                  DUPLICATE_CANDIDATE — Trùng văn bản
                </option>
                <option value="NEEDS_VERIFICATION">
                  NEEDS_VERIFICATION — Cần kiểm tra lại ngày ban hành
                </option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                Số hiệu Quyết định chốt sau đối chiếu
              </label>
              <input
                className="form-input"
                value={form.resolvedLegalDocumentNumber}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    resolvedLegalDocumentNumber: e.target.value,
                  }))
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ghi chú kết quả đối chiếu</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.qualityNote}
                onChange={(e) =>
                  setForm((p) => ({ ...p, qualityNote: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Đóng
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu kết quả xác minh"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ───── Trang Quản trị Niêm yết công khai ─────
export default function NoticesPage() {
  const { user } = useAuth();
  const { success: toastOk, error: toastErr } = useToast();
  const canWrite = ["SUPER_ADMIN", "REVIEWER"].includes(user?.role);

  const [activeTab, setActiveTab] = useState("notices"); // "notices" | "sources"
  const [loadError, setLoadError] = useState("");
  const [notices, setNotices] = useState([]);
  const [sourcesData, setSourcesData] = useState({ summary: {}, data: [] });
  const [proceduresList, setProceduresList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pubFilter, setPubFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sourceQualityFilter, setSourceQualityFilter] = useState("");

  const [modal, setModal] = useState(null);
  const [previewNotice, setPreviewNotice] = useState(null);
  const [sourceModal, setSourceModal] = useState(null);

  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [noticesRes, sourcesRes, procsRes] = await Promise.all([
        api.getNotices({
          page,
          limit,
          publicationStatus: pubFilter || undefined,
          noticeType: typeFilter || undefined,
          search: search.trim() || undefined,
        }),
        api.getNoticeSources({
          qualityStatus: sourceQualityFilter || undefined,
        }),
        api.getProcedures({ limit: 100 }),
      ]);
      setNotices(noticesRes.data ?? []);
      setTotalPages(noticesRes.meta?.totalPages ?? 1);
      setSourcesData(sourcesRes ?? { summary: {}, data: [] });
      setProceduresList(procsRes.data ?? []);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pubFilter, typeFilter, search, sourceQualityFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleImportInventory = async (publishRecommendedSamples) => {
    setImporting(true);
    try {
      const res = await api.importNoticeInventory(publishRecommendedSamples);
      toastOk(
        `Đã đồng bộ ${res.totalInventory} nguồn Drive (${res.createdDrafts} bản nháp mới, ${res.publishedSamples} mẫu kiểm thử công khai)`
      );
      load();
    } catch (err) {
      toastErr(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handlePublish = async (notice) => {
    try {
      await api.publishNotice(notice.id, { legalStatus: "VALID" });
      toastOk(`Đã duyệt và xuất bản: ${notice.legalDocumentNumber || notice.title}`);
      load();
    } catch (err) {
      toastErr(err.message);
    }
  };

  const handleRevoke = async (notice) => {
    try {
      await api.revokeNotice(notice.id, "Thu hồi để rà soát lại nội dung");
      toastOk("Đã thu hồi niêm yết khỏi danh sách công khai");
      load();
    } catch (err) {
      toastErr(err.message);
    }
  };

  if (loadError) {
    return (
      <div className="card" role="alert">
        {loadError}
        <button className="btn btn-primary" onClick={load}>
          Thử lại
        </button>
      </div>
    );
  }

  const srcSummary = sourcesData.summary || {};

  return (
    <>
      {/* Thanh công cụ & Chuyển tab */}
      <div
        className="page-toolbar"
        style={{ flexWrap: "wrap", gap: 12, marginBottom: 16 }}
      >
        <div
          className="page-toolbar-left"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <button
            type="button"
            className={`btn ${activeTab === "notices" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("notices")}
          >
            Hồ sơ Niêm yết ({notices.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "sources" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("sources")}
          >
            Kiểm kê 53 nguồn Drive ({srcSummary.total || 0}/53)
          </button>
        </div>

        <div
          className="page-toolbar-right"
          style={{
            display: canWrite ? "flex" : "none",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            disabled={importing}
            onClick={() => handleImportInventory(true)}
            title="Nhập 53 nguồn vào kho nháp và duyệt mẫu 6 văn bản tiêu biểu theo Kế hoạch V2"
          >
            {importing
              ? "Đang đồng bộ..."
              : "Đồng bộ 53 nguồn Drive & Mở 6 mẫu chuẩn"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ item: null })}
          >
            + Thêm niêm yết
          </button>
        </div>
      </div>

      {activeTab === "notices" ? (
        <>
          {/* Bộ lọc danh sách niêm yết */}
          <div
            className="card"
            style={{
              padding: 12,
              marginBottom: 14,
              display: "grid",
              gridTemplateColumns: "1.5fr 1fr 1fr",
              gap: 10,
            }}
          >
            <input
              className="form-input"
              placeholder="Tìm theo số QĐ (VD: 5119/QĐ-UBND) hoặc tiêu đề..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              className="form-input"
              value={pubFilter}
              onChange={(e) => {
                setPubFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái xuất bản</option>
              <option value="PUBLISHED">Đã đăng công khai</option>
              <option value="DRAFT">Bản nháp (Chờ rà soát)</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="REVOKED">Đã thu hồi</option>
            </select>
            <select
              className="form-input"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả nhóm văn bản</option>
              <option value="PROCEDURE_ANNOUNCEMENT">Công bố TTHC</option>
              <option value="INTERNAL_PROCESS">Quy trình nội bộ/điện tử</option>
              <option value="INTERNAL_PROCEDURE">TTHC nội bộ</option>
            </select>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Số QĐ / Tiêu đề</th>
                    <th>Nhóm & Cơ quan</th>
                    <th>Ngày ban hành</th>
                    <th>Xuất bản</th>
                    <th>Hiệu lực pháp lý</th>
                    <th>Tệp / TTHC</th>
                    <th style={{ width: 220 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="loading-full">
                          <span className="spinner" /> Đang tải...
                        </div>
                      </td>
                    </tr>
                  ) : notices.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <div>
                            Chưa có hồ sơ niêm yết. Nhấn &ldquo;Đồng bộ 53 nguồn
                            Drive&rdquo; để khởi tạo kho kiểm kê.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    notices.map((n) => {
                      const pub =
                        PUB_STATUS_LABELS[n.publicationStatus] ||
                        PUB_STATUS_LABELS.PUBLISHED;
                      const leg =
                        LEGAL_STATUS_LABELS[n.legalStatus] ||
                        LEGAL_STATUS_LABELS.UNVERIFIED;
                      return (
                        <tr key={n.id}>
                          <td style={{ maxWidth: 320 }}>
                            {n.legalDocumentNumber && (
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  fontWeight: 700,
                                  color: "var(--primary)",
                                  marginRight: 6,
                                }}
                              >
                                [{n.legalDocumentNumber}]
                              </span>
                            )}
                            <div
                              className="truncate"
                              title={n.title}
                              style={{ fontWeight: 500 }}
                            >
                              {n.title}
                            </div>
                            {n.needsVerification && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#b45309",
                                  marginTop: 2,
                                }}
                              >
                                {n.verificationNote || "Cần đối chiếu bản gốc"}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>
                              {NOTICE_TYPE_LABELS[n.noticeType] ||
                                "Công bố TTHC"}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                              }}
                            >
                              {n.managingAuthority || "—"}
                            </div>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {n.citedDateText || fmtDate(n.legalDocumentDate) || fmtDate(n.startDate)}
                          </td>
                          <td>
                            <span className={`badge ${pub.cls}`}>
                              {pub.label}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${leg.cls}`}>
                              {leg.label}
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            <div>
                              {(n.documents || []).length} tệp PDF
                            </div>
                            <div style={{ color: "var(--text-secondary)" }}>
                              {(n.procedureLinks || []).length} TTHC
                            </div>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setPreviewNotice(n)}
                              >
                                Xem
                              </button>
                              {canWrite && (
                                <>
                                  {n.publicationStatus !== "PUBLISHED" && (
                                    <button
                                      className="btn btn-success btn-sm"
                                      onClick={() => handlePublish(n)}
                                    >
                                      Duyệt
                                    </button>
                                  )}
                                  {n.publicationStatus !== "REVOKED" && (
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => handleRevoke(n)}
                                    >
                                      Xóa
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setModal({ item: n })}
                                  >
                                    Sửa
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination" style={{ padding: "12px 16px" }}>
                <button
                  className="pagination-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (num) => (
                    <button
                      key={num}
                      className={`pagination-btn ${num === page ? "active" : ""}`}
                      onClick={() => setPage(num)}
                    >
                      {num}
                    </button>
                  )
                )}
                <button
                  className="pagination-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Tab Kiểm kê 53 nguồn Google Drive (NY0 / NY2) */
        <>
          <div
            className="card"
            style={{
              padding: 12,
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge badge-success">
                Hợp lệ cơ bản: {srcSummary.ok || 0}
              </span>
              <span className="badge badge-danger">
                Xung đột 4811/5116: {srcSummary.conflict || 0}
              </span>
              <span className="badge badge-warning">
                Trùng văn bản (42/43): {srcSummary.duplicateCandidate || 0}
              </span>
              <span className="badge badge-warning">
                Cần đối chiếu ngày (1, 31): {srcSummary.needsVerification || 0}
              </span>
            </div>
            <select
              className="form-input"
              style={{ width: 260 }}
              value={sourceQualityFilter}
              onChange={(e) => setSourceQualityFilter(e.target.value)}
            >
              <option value="">Tất cả 53 nguồn kiểm kê</option>
              <option value="CONFLICT">Chỉ nguồn xung đột (Nguồn #22)</option>
              <option value="DUPLICATE_CANDIDATE">
                Chỉ nguồn nghi trùng (Nguồn #42, #43)
              </option>
              <option value="NEEDS_VERIFICATION">
                Chỉ nguồn cần đối chiếu ngày (Nguồn #1, #31)
              </option>
              <option value="OK">Nguồn hợp lệ cơ bản</option>
            </select>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>STT</th>
                    <th>Số QĐ đầu mục</th>
                    <th>Trích yếu & Ghi chú kiểm kê</th>
                    <th>Cờ chất lượng</th>
                    <th>Hồ sơ niêm yết gắn kết</th>
                    <th style={{ width: 140 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(sourcesData.data || []).length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          Chưa nhập kho kiểm kê. Nhấn &ldquo;Đồng bộ 53 nguồn
                          Drive&rdquo; ở góc trên.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    (sourcesData.data || []).map((src) => {
                      const qb =
                        QUALITY_BADGES[src.qualityStatus] ||
                        QUALITY_BADGES.UNCHECKED;
                      return (
                        <tr key={src.id}>
                          <td style={{ fontWeight: 700 }}>
                            #{src.sourceIndex}
                          </td>
                          <td style={{ fontFamily: "monospace", fontWeight: 600 }}>
                            {src.headerCode}
                          </td>
                          <td style={{ maxWidth: 380 }}>
                            <div
                              className="truncate"
                              title={src.title}
                              style={{ fontWeight: 500 }}
                            >
                              {src.title}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color:
                                  src.qualityStatus === "OK"
                                    ? "var(--text-secondary)"
                                    : "#b45309",
                                marginTop: 2,
                              }}
                            >
                              {src.qualityNote}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${qb.cls}`}>
                              {qb.label}
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {src.notice ? (
                              <span>
                                {src.notice.publicationStatus === "PUBLISHED"
                                  ? "Đã công khai"
                                  : "Bản nháp"}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <div className="table-actions">
                              <a
                                href={src.originalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-ghost btn-sm"
                              >
                                Xem
                              </a>
                              {canWrite && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setSourceModal(src)}
                                >
                                  Sửa
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {previewNotice && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setPreviewNotice(null)}
        >
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">Chi tiết văn bản niêm yết công khai</div>
              <button className="modal-close" onClick={() => setPreviewNotice(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>Tiêu đề niêm yết</div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-size-lg)" }}>{previewNotice.title}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>Số hiệu Quyết định</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{previewNotice.legalDocumentNumber || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>Ngày ban hành</div>
                  <div>{previewNotice.citedDateText || fmtDate(previewNotice.legalDocumentDate) || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>Cơ quan ban hành</div>
                  <div>{previewNotice.issuingAuthority || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>Cơ quan quản lý lĩnh vực</div>
                  <div>{previewNotice.managingAuthority || "—"}</div>
                </div>
              </div>
              {previewNotice.summary && (
                <div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>Tóm tắt Điều 1 / Phạm vi</div>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{previewNotice.summary}</div>
                </div>
              )}
              {previewNotice.description && (
                <div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>Nội dung chi tiết</div>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{previewNotice.description}</div>
                </div>
              )}
              {(previewNotice.documents || []).length > 0 && (
                <div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginBottom: 4 }}>Tệp văn bản đính kèm</div>
                  <ul style={{ paddingLeft: 18, margin: 0 }}>
                    {previewNotice.documents.map((doc, idx) => (
                      <li key={idx} style={{ marginBottom: 4 }}>
                        <a href={doc.fileUrl} target="_blank" rel="noreferrer">{doc.name}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setPreviewNotice(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <NoticeFormModal
          item={modal.item}
          proceduresList={proceduresList}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}

      {sourceModal && (
        <SourceQualityModal
          source={sourceModal}
          onClose={() => setSourceModal(null)}
          onSaved={() => {
            setSourceModal(null);
            load();
          }}
        />
      )}
    </>
  );
}
