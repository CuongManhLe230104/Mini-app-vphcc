import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const ROLE_NAMES = {
  SUPER_ADMIN: "Quản trị viên hệ thống",
  EDITOR: "Biên tập viên nội dung",
  REVIEWER: "Người duyệt nội dung",
  HANDLER: "Cán bộ xử lý",
  COUNTER_STAFF: "Cán bộ một cửa tại quầy",
};

const POST_STATUS_BADGE = {
  DRAFT: { label: "Nháp", cls: "badge-neutral" },
  PENDING: { label: "Chờ duyệt", cls: "badge-warning" },
  PUBLISHED: { label: "Đã đăng", cls: "badge-success" },
  REJECTED: { label: "Từ chối", cls: "badge-danger" },
  ARCHIVED: { label: "Lưu trữ", cls: "badge-neutral" },
};

const POST_TYPE_LABEL = {
  NEWS: "Tin tức",
  GUIDE: "Hướng dẫn",
  VIDEO: "Video",
};

const NOTICE_PUB_BADGE = {
  DRAFT: { label: "Nháp", cls: "badge-neutral" },
  PENDING: { label: "Chờ duyệt", cls: "badge-warning" },
  PUBLISHED: { label: "Đã công khai", cls: "badge-success" },
  REVOKED: { label: "Đã thu hồi", cls: "badge-danger" },
};

const AUDIT_ACTION_LABELS = {
  POST_CREATE: "Tạo bản nháp bài viết",
  POST_EDIT: "Cập nhật bài viết",
  POST_SUBMIT: "Gửi duyệt bài viết",
  POST_PUBLISH: "Phê duyệt & đăng bài",
  POST_REJECT: "Từ chối bài viết",
  POST_ARCHIVE: "Lưu trữ bài viết",
  CENTER_CREATE: "Khởi tạo thông tin Trung tâm",
  CENTER_UPDATE: "Cập nhật thông tin Trung tâm",
  PROCEDURE_CREATE: "Thêm thủ tục hành chính",
  PROCEDURE_UPDATE: "Cập nhật thủ tục hành chính",
  PROCEDURE_HIDE: "Tạm dừng thủ tục",
  FAQ_CREATE: "Thêm câu hỏi thường gặp",
  FAQ_UPDATE: "Cập nhật câu hỏi thường gặp",
  FAQ_DELETE: "Xóa câu hỏi thường gặp",
  NOTICE_CREATE: "Tạo văn bản niêm yết",
  NOTICE_UPDATE: "Cập nhật văn bản niêm yết",
  NOTICE_PUBLISH: "Xuất bản văn bản niêm yết",
  NOTICE_REVOKE: "Thu hồi văn bản niêm yết",
  NOTICE_INVENTORY_IMPORT: "Đồng bộ kho 53 nguồn niêm yết",
  COUNTER_STANDARD_SETUP: "Đồng bộ 4 quầy chuẩn Q1–Q4",
  COUNTER_UPDATE: "Cập nhật cấu hình quầy",
  FEEDBACK_EXPORT_EXCEL: "Xuất Excel tổng hợp góp ý",
  FEEDBACK_ASSIGN: "Phân công xử lý góp ý",
  FEEDBACK_UNASSIGN: "Gỡ phân công góp ý",
  FEEDBACK_STATUS_CHANGE: "Cập nhật trạng thái góp ý",
  FEEDBACK_REOPEN: "Mở lại góp ý",
  FEEDBACK_NOTE_ADD: "Thêm ghi chú nội bộ góp ý",
};

function fmtDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

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

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const canAccessQueue = ["SUPER_ADMIN", "COUNTER_STAFF"].includes(user?.role);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.allSettled([
      api.getCenter(),
      api.getFields(),
      api.getProcedures({ limit: 100 }),
      api.getPostsAdmin({ limit: 5 }),
      api.getPostsAdmin({ limit: 1, status: "PUBLISHED" }),
      api.getPostsAdmin({ limit: 1, status: "PENDING" }),
      api.getPostsAdmin({ limit: 1, status: "DRAFT" }),
      api.getNotices({ limit: 5 }),
      api.getFaqsAdmin(),
      canAccessQueue ? api.getQueueCounters() : Promise.resolve([]),
      isSuperAdmin ? api.getAudit(1) : Promise.resolve({ data: [] }),
    ]).then(
      ([
        centerRes,
        fieldsRes,
        proceduresRes,
        recentPostsRes,
        publishedPostsRes,
        pendingPostsRes,
        draftPostsRes,
        noticesRes,
        faqsRes,
        countersRes,
        auditRes,
      ]) => {
        if (!active) return;

        const center = centerRes.status === "fulfilled" ? centerRes.value : null;
        const fields =
          fieldsRes.status === "fulfilled"
            ? Array.isArray(fieldsRes.value)
              ? fieldsRes.value
              : fieldsRes.value?.data || []
            : [];
        const proceduresList =
          proceduresRes.status === "fulfilled" ? proceduresRes.value?.data || [] : [];
        const totalProcedures =
          proceduresRes.status === "fulfilled"
            ? proceduresRes.value?.total ?? proceduresList.length
            : 0;
        const validProcedures = proceduresList.filter(p => p.isValid !== false).length;

        // Thống kê số thủ tục theo từng lĩnh vực
        const countByFieldId = {};
        for (const proc of proceduresList) {
          const fid = proc.fieldId || proc.field?.id;
          if (fid) countByFieldId[fid] = (countByFieldId[fid] || 0) + 1;
        }
        const fieldBreakdown = fields
          .map(f => ({
            id: f.id,
            label: f.label,
            slug: f.slug,
            count: f._count?.procedures ?? countByFieldId[f.id] ?? 0,
          }))
          .sort((a, b) => b.count - a.count);

        const recentPosts =
          recentPostsRes.status === "fulfilled" ? recentPostsRes.value?.data || [] : [];
        const publishedCount =
          publishedPostsRes.status === "fulfilled" ? publishedPostsRes.value?.total ?? 0 : 0;
        const pendingCount =
          pendingPostsRes.status === "fulfilled" ? pendingPostsRes.value?.total ?? 0 : 0;
        const draftCount =
          draftPostsRes.status === "fulfilled" ? draftPostsRes.value?.total ?? 0 : 0;

        const noticesList =
          noticesRes.status === "fulfilled" ? noticesRes.value?.data || [] : [];
        const noticesTotal =
          noticesRes.status === "fulfilled"
            ? noticesRes.value?.meta?.total ?? noticesList.length
            : 0;

        const faqsList =
          faqsRes.status === "fulfilled"
            ? Array.isArray(faqsRes.value)
              ? faqsRes.value
              : faqsRes.value?.data || []
            : [];
        const publishedFaqsCount = faqsList.filter(f => f.isPublished).length;

        const countersList =
          countersRes.status === "fulfilled" && Array.isArray(countersRes.value)
            ? countersRes.value
            : [];
        const activeCountersCount = countersList.filter(c => c.isActive).length;

        const auditList =
          auditRes.status === "fulfilled" ? (auditRes.value?.data || []).slice(0, 6) : [];

        setData({
          center,
          totalProcedures,
          validProcedures,
          fieldsCount: fields.length,
          fieldBreakdown,
          publishedCount,
          pendingCount,
          draftCount,
          recentPosts,
          noticesTotal,
          noticesList,
          faqsTotal: faqsList.length,
          publishedFaqsCount,
          countersList,
          activeCountersCount,
          auditList,
        });
        setLoading(false);
      },
    );

    return () => {
      active = false;
    };
  }, [canAccessQueue, isSuperAdmin]);

  if (loading || !data) {
    return (
      <div className="loading-full">
        <span className="spinner" />
        <span>Đang tải dữ liệu tổng quan...</span>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Thủ tục hành chính",
      value: data.totalProcedures,
      sub: `${data.validProcedures} đang hiệu lực · ${data.fieldsCount} lĩnh vực`,
      accent: "#0068FF",
      to: "/procedures",
    },
    {
      label: "Bài viết đã xuất bản",
      value: data.publishedCount,
      sub: "Đang hiển thị trên Mini App",
      accent: "#00B14F",
      to: "/posts",
    },
    {
      label: "Bài viết chờ duyệt & Nháp",
      value: data.pendingCount,
      sub: `${data.pendingCount} chờ duyệt · ${data.draftCount} bản nháp`,
      accent: "#FF6B00",
      to: "/posts",
    },
    {
      label: "Văn bản niêm yết công khai",
      value: data.noticesTotal,
      sub: "Quyết định công bố & quy trình TTHC",
      accent: "#7C3AED",
      to: "/notices",
    },
    {
      label: "Câu hỏi thường gặp (FAQ)",
      value: data.faqsTotal,
      sub: `${data.publishedFaqsCount}/${data.faqsTotal} câu đang hiển thị công khai`,
      accent: "#0D9488",
      to: "/faqs",
    },
    ...(canAccessQueue
      ? [
          {
            label: "Quầy tiếp nhận phục vụ",
            value: `${data.activeCountersCount}/${data.countersList.length || 4}`,
            sub: "Quầy đang mở cấu hình lịch phục vụ",
            accent: "#2563EB",
            to: "/queue",
          },
        ]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Lời chào & Thông tin phiên quản trị */}
      <div
        className="card"
        style={{
          padding: "18px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          background: "linear-gradient(90deg, #F8FAFF 0%, #FFFFFF 100%)",
          borderLeft: "4px solid var(--primary)",
        }}
      >
        <div>
          <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)" }}>
            Hệ thống Quản trị Zalo Mini App — {data.center?.fullName || "Trung tâm Phục vụ hành chính công xã Nghĩa Thành"}
          </div>
          <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", marginTop: 4 }}>
            Cán bộ đăng nhập: <strong>{user?.fullName || user?.username}</strong> ({ROLE_NAMES[user?.role] || user?.role})
            {data.center?.address ? ` · Địa chỉ: ${data.center.address}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/procedures" className="btn btn-secondary btn-sm">
            Quản lý Thủ tục
          </Link>
          <Link to="/posts" className="btn btn-secondary btn-sm">
            Quản lý Tin tức
          </Link>
          <Link to="/notices" className="btn btn-secondary btn-sm">
            Quản lý Niêm yết
          </Link>
          <Link to="/center" className="btn btn-ghost btn-sm">
            Cấu hình Trung tâm
          </Link>
        </div>
      </div>

      {/* Hàng 1: Các chỉ số thống kê tổng hợp (không dùng icon emoji) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {summaryCards.map(card => (
          <Link
            key={card.label}
            to={card.to}
            className="card"
            style={{
              padding: "18px 20px",
              borderTop: `3px solid ${card.accent}`,
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
              {card.label}
            </div>
            <div style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.15 }}>
              {card.value}
            </div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>
              {card.sub}
            </div>
          </Link>
        ))}
      </div>

      {/* Hàng 2: Thông tin Trung tâm đang áp dụng + Phân bổ Thủ tục theo lĩnh vực */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: 20,
        }}
      >
        {/* Cột 1: Thông tin vận hành Trung tâm */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Thông tin Trung tâm đang cấu hình</div>
            <Link to="/center" className="btn btn-ghost btn-sm">
              Chỉnh sửa
            </Link>
          </div>
          {data.center ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, fontSize: "var(--font-size-sm)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Tên đơn vị:</span>
                <strong>{data.center.fullName || data.center.name}</strong>

                <span style={{ color: "var(--text-secondary)" }}>Địa chỉ:</span>
                <span>{data.center.address || "—"}</span>

                <span style={{ color: "var(--text-secondary)" }}>Số Hotline:</span>
                <strong style={{ color: "var(--primary)" }}>0254 3979 999 · 0937 064 147</strong>

                <span style={{ color: "var(--text-secondary)" }}>Cổng Dịch vụ công:</span>
                <span className="truncate">{data.center.servicePortalUrl || "https://dichvucong.gov.vn"}</span>

                <span style={{ color: "var(--text-secondary)" }}>Tra cứu hồ sơ:</span>
                <span className="truncate">{data.center.caseTrackingUrl || "https://dichvucong.gov.vn"}</span>

                <span style={{ color: "var(--text-secondary)" }}>Zalo OA ID:</span>
                <span>{data.center.oaId || "Chưa cấu hình"}</span>
              </div>

              {Array.isArray(data.center.workingHours) && data.center.workingHours.length > 0 && (
                <div
                  style={{
                    marginTop: 4,
                    padding: 12,
                    background: "var(--bg-base)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: "var(--font-size-xs)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" }}>
                    Giờ làm việc niêm yết trên Mini App
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.center.workingHours.map((wh, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "var(--font-size-sm)",
                        }}
                      >
                        <span style={{ color: "var(--text-secondary)" }}>{wh.day}</span>
                        <strong style={{ color: String(wh.hours).includes("Nghỉ") ? "var(--danger)" : "var(--text-primary)" }}>
                          {wh.hours}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-sm)" }}>
              Chưa có thông tin cấu hình Trung tâm.
            </div>
          )}
        </div>

        {/* Cột 2: Thống kê Thủ tục hành chính theo lĩnh vực */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Phân bổ Thủ tục theo lĩnh vực ({data.fieldsCount})</div>
            <Link to="/procedures" className="btn btn-ghost btn-sm">
              Xem tất cả
            </Link>
          </div>
          {data.fieldBreakdown.length === 0 ? (
            <div style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-sm)" }}>
              Chưa có dữ liệu lĩnh vực thủ tục hành chính.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 310, overflowY: "auto", paddingRight: 4 }}>
              {data.fieldBreakdown.map(f => {
                const maxCount = Math.max(1, data.fieldBreakdown[0]?.count || 1);
                const pct = Math.min(100, Math.round((f.count / maxCount) * 100));
                return (
                  <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{f.label}</span>
                      <strong style={{ color: "var(--primary)" }}>{f.count} thủ tục</strong>
                    </div>
                    <div style={{ height: 6, background: "var(--bg-base)", borderRadius: 999, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "var(--primary)",
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hàng 3: Bài viết mới nhất & Văn bản niêm yết công khai mới nhất */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: 20,
        }}
      >
        {/* Bài viết / Tin tức gần đây */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: "18px 22px", marginBottom: 0 }}>
            <div className="card-title">Tin tức & Hướng dẫn cập nhật gần đây</div>
            <Link to="/posts" className="btn btn-ghost btn-sm">
              Quản lý bài viết
            </Link>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tiêu đề</th>
                  <th>Loại</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPosts.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>
                      Chưa có bài viết nào.
                    </td>
                  </tr>
                ) : (
                  data.recentPosts.map(post => {
                    const st = POST_STATUS_BADGE[post.status] || { label: post.status, cls: "badge-neutral" };
                    return (
                      <tr key={post.id}>
                        <td style={{ maxWidth: 230 }}>
                          <div className="truncate" title={post.title} style={{ fontWeight: 500 }}>
                            {post.title}
                          </div>
                          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>
                            {post.author?.fullName || "Biên tập viên"}
                          </div>
                        </td>
                        <td style={{ fontSize: "var(--font-size-sm)" }}>
                          {POST_TYPE_LABEL[post.type] || post.type}
                        </td>
                        <td>
                          <span className={`badge ${st.cls}`}>{st.label}</span>
                        </td>
                        <td style={{ fontSize: "var(--font-size-sm)", whiteSpace: "nowrap" }}>
                          {fmtDate(post.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Văn bản niêm yết công khai gần đây */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: "18px 22px", marginBottom: 0 }}>
            <div className="card-title">Văn bản niêm yết công khai gần đây</div>
            <Link to="/notices" className="btn btn-ghost btn-sm">
              Quản lý niêm yết
            </Link>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Số hiệu / Tiêu đề</th>
                  <th>Cơ quan</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.noticesList.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>
                      Chưa có văn bản niêm yết nào.
                    </td>
                  </tr>
                ) : (
                  data.noticesList.map(n => {
                    const pub = NOTICE_PUB_BADGE[n.publicationStatus] || {
                      label: n.publicationStatus || "Đã đăng",
                      cls: "badge-success",
                    };
                    return (
                      <tr key={n.id}>
                        <td style={{ maxWidth: 250 }}>
                          {n.legalDocumentNumber && (
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-xs)", fontWeight: 700, color: "var(--primary)" }}>
                              {n.legalDocumentNumber}
                            </div>
                          )}
                          <div className="truncate" title={n.title} style={{ fontWeight: 500 }}>
                            {n.title}
                          </div>
                        </td>
                        <td style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>
                          {n.managingAuthority || n.issuingAuthority || "UBND TP.HCM"}
                        </td>
                        <td>
                          <span className={`badge ${pub.cls}`}>{pub.label}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Hàng 4: Danh sách Quầy phục vụ & Nhật ký hệ thống gần đây */}
      {(canAccessQueue || isSuperAdmin) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
            gap: 20,
          }}
        >
          {canAccessQueue && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: "18px 22px", marginBottom: 0 }}>
                <div className="card-title">Cấu hình các Quầy tiếp nhận ({data.countersList.length})</div>
                <Link to="/queue" className="btn btn-ghost btn-sm">
                  Chi tiết quầy
                </Link>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mã quầy</th>
                      <th>Tên quầy phục vụ</th>
                      <th>Định mức</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.countersList.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>
                          Chưa khởi tạo quầy phục vụ.
                        </td>
                      </tr>
                    ) : (
                      data.countersList.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 700, color: "var(--primary)" }}>{c.code}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{c.name}</div>
                            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>
                              {(c.fields || []).length} lĩnh vực · {(c.schedules || []).length} khung lịch tuần
                            </div>
                          </td>
                          <td style={{ fontSize: "var(--font-size-sm)" }}>
                            {c.slotMinutes || 30} phút/lượt · Online tối đa {c.appointmentQuota ?? 0}/ngày
                          </td>
                          <td>
                            <span className={`badge ${c.isActive ? "badge-success" : "badge-neutral"}`}>
                              {c.isActive ? "Đang hoạt động" : "Tạm dừng"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isSuperAdmin && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: "18px 22px", marginBottom: 0 }}>
                <div className="card-title">Nhật ký thao tác quản trị gần đây</div>
                <Link to="/audit" className="btn btn-ghost btn-sm">
                  Xem toàn bộ
                </Link>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Cán bộ</th>
                      <th>Thao tác</th>
                      <th>Đối tượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.auditList.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>
                          Chưa có nhật ký thao tác.
                        </td>
                      </tr>
                    ) : (
                      data.auditList.map(item => (
                        <tr key={item.id}>
                          <td style={{ fontSize: "var(--font-size-xs)", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                            {fmtDateTime(item.createdAt)}
                          </td>
                          <td style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>
                            {item.admin?.fullName || "Hệ thống"}
                          </td>
                          <td style={{ fontSize: "var(--font-size-sm)" }}>
                            {AUDIT_ACTION_LABELS[item.action] || item.action}
                          </td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>
                            {item.resource}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
