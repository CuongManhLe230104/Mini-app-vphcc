import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

function fmtDateTime(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FeedbackDetailModal({ feedbackId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.getFeedbackDetail(feedbackId);
      setDetail(res);
    } catch (err) {
      setLoadError(err.message || "Không tải được chi tiết góp ý.");
    } finally {
      setLoading(false);
    }
  }, [feedbackId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal modal-lg" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div className="modal-title">
            Chi tiết góp ý {detail?.code ? `— ${detail.code}` : ""}
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {loading ? (
            <div className="loading-full">
              <span className="spinner" /> Đang tải chi tiết...
            </div>
          ) : loadError ? (
            <div role="alert" style={{ color: "var(--danger)" }}>
              <p>{loadError}</p>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={loadDetail}>
                Thử lại
              </button>
            </div>
          ) : detail ? (
            <>
              <div
                style={{
                  padding: 16,
                  background: "var(--bg-base)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    background: "var(--warning-bg)",
                    color: "#9A3412",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                    border: "1px solid #FED7AA",
                  }}
                >
                  Thông tin do người gửi cung cấp — Số điện thoại chưa xác thực
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, fontSize: "var(--font-size-sm)" }}>
                  <div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-xs)" }}>Mã góp ý</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--primary)" }}>
                      {detail.code}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-xs)" }}>Thời gian gửi</div>
                    <div style={{ fontWeight: 500 }}>{fmtDateTime(detail.createdAt)}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-xs)" }}>Họ và tên người gửi</div>
                    <div style={{ fontWeight: 600 }}>{detail.fullName}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-xs)" }}>Số điện thoại liên hệ</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{detail.phone}</div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, marginBottom: 6 }}>
                  Nội dung góp ý của người dân
                </div>
                <div
                  style={{
                    padding: 16,
                    background: "#FFFFFF",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.65,
                  }}
                >
                  {detail.content}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const { user } = useAuth();
  const { success: toastOk, error: toastErr } = useToast();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    totalAll: 0,
    todayCount: 0,
    last7DaysCount: 0,
    thisMonthCount: 0,
    filteredTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [exporting, setExporting] = useState(false);

  // Bộ lọc gọn gàng
  const [codeFilter, setCodeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, limit: 15 });

  const [selectedId, setSelectedId] = useState(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.getFeedbackList({
        page,
        limit: 15,
        code: codeFilter.trim() || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setItems(res?.data || []);
      if (res?.summary) setSummary(res.summary);
      setMeta(res?.meta || { total: 0, totalPages: 1, limit: 15 });
    } catch (err) {
      setLoadError(err.message || "Không thể tải danh sách góp ý.");
    } finally {
      setLoading(false);
    }
  }, [page, codeFilter, fromDate, toDate]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleResetFilters = () => {
    setCodeFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await api.exportFeedbackExcel({
        code: codeFilter.trim() || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      toastOk("Đã xuất file Excel tổng hợp góp ý.");
    } catch (err) {
      toastErr(err.message || "Không thể xuất file Excel.");
    } finally {
      setExporting(false);
    }
  };

  const summaryCards = [
    {
      label: "Tổng số góp ý đã nhận",
      value: summary.totalAll,
      accent: "#0068FF",
    },
    {
      label: "Góp ý trong hôm nay",
      value: summary.todayCount,
      accent: "#00B14F",
    },
    {
      label: "Góp ý 7 ngày gần đây",
      value: summary.last7DaysCount,
      accent: "#7C3AED",
    },
    {
      label: "Góp ý trong tháng này",
      value: summary.thisMonthCount,
      accent: "#0D9488",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Khối thống kê tổng hợp */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className="card"
            style={{
              padding: "16px 18px",
              borderTop: `3px solid ${c.accent}`,
            }}
          >
            <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", fontWeight: 600 }}>
              {c.label}
            </div>
            <div style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Bộ lọc & Nút xuất Excel tổng hợp (dành cho Admin) */}
      <div className="card" style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>
              Tổng hợp ý kiến góp ý của người dân ({meta.total || 0} bản ghi khớp lọc)
            </div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: 2 }}>
              Chuyên viên, công chức theo dõi ý kiến góp ý để rà soát và hoàn thiện dịch vụ của Trung tâm & Mini App.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleResetFilters}>
              Đặt lại lọc
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadList}>
              Làm mới
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={exporting}
                onClick={handleExportExcel}
              >
                {exporting ? "Đang xuất Excel..." : "Xuất file Excel (.xlsx)"}
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <label className="form-label">Tìm theo mã góp ý</label>
            <input
              className="form-input"
              placeholder="VD: GY-..."
              value={codeFilter}
              onChange={(e) => {
                setCodeFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="form-label">Từ ngày</label>
            <input
              type="date"
              className="form-input"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="form-label">Đến ngày</label>
            <input
              type="date"
              className="form-input"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {loadError && (
        <div className="card" role="alert" style={{ color: "var(--danger)" }}>
          <p>{loadError}</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={loadList}>
            Thử lại
          </button>
        </div>
      )}

      {/* Bảng danh sách góp ý */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 56 }}>STT</th>
                <th style={{ width: 170 }}>Mã góp ý</th>
                <th style={{ width: 200 }}>Họ tên & SĐT</th>
                <th>Nội dung góp ý</th>
                <th style={{ width: 150 }}>Thời gian gửi</th>
                <th style={{ width: 90 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="loading-full">
                      <span className="spinner" /> Đang tải dữ liệu...
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div>Chưa có ý kiến góp ý nào.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {(page - 1) * (meta.limit || 15) + idx + 1}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>
                      {row.code}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{row.fullName}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>
                        {row.maskedPhone}
                      </div>
                    </td>
                    <td style={{ maxWidth: 420 }}>
                      <div className="truncate" title={row.contentExcerpt}>
                        {row.contentExcerpt}
                      </div>
                    </td>
                    <td style={{ fontSize: "var(--font-size-xs)", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                      {fmtDateTime(row.createdAt)}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelectedId(row.id)}
                        >
                          Xem
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta.totalPages > 1 && (
          <div className="pagination" style={{ padding: "12px 16px" }}>
            <button
              className="pagination-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹
            </button>
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={`pagination-btn ${n === page ? "active" : ""}`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              className="pagination-btn"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {selectedId && (
        <FeedbackDetailModal
          feedbackId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
