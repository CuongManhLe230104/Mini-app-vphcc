import { useApiResource } from "../components/use-api-resource";
import RemoteState, { Pagination } from "../components/remote-state";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Header, Icon, Input, Page, Text } from "zmp-ui";
import { useZaloAction } from "../components/use-zalo-action";
import { openServicePortal } from "../services/zalo";

const NOTICE_TYPE_BADGE = {
  PROCEDURE_ANNOUNCEMENT: {
    label: "Công bố TTHC",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  INTERNAL_PROCESS: {
    label: "Quy trình nội bộ / điện tử",
    className: "bg-purple-50 text-purple-700 border border-purple-200",
  },
  INTERNAL_PROCEDURE: {
    label: "TTHC nội bộ",
    className: "bg-amber-50 text-amber-800 border border-amber-200",
  },
};

const LEGAL_STATUS_BADGE = {
  VALID: {
    label: "Còn hiệu lực",
    className: "bg-green-100 text-green-700",
  },
  PARTIALLY_EXPIRED: {
    label: "Hiệu lực một phần",
    className: "bg-amber-100 text-amber-800",
  },
  EXPIRED: {
    label: "Hết hiệu lực",
    className: "bg-gray-200 text-gray-600",
  },
  UNVERIFIED: {
    label: "Chưa xác minh hiệu lực",
    className: "bg-slate-100 text-slate-600",
  },
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function NoticeCard({ notice, onOpenDetail, onOpenDoc }) {
  const typeBadge =
    NOTICE_TYPE_BADGE[notice.noticeType] ||
    NOTICE_TYPE_BADGE.PROCEDURE_ANNOUNCEMENT;
  const legalBadge =
    LEGAL_STATUS_BADGE[notice.legalStatus] || LEGAL_STATUS_BADGE.UNVERIFIED;
  const primaryDoc =
    Array.isArray(notice.documents) && notice.documents.length > 0
      ? notice.documents[0]
      : null;
  const fieldTags = Array.isArray(notice.fieldTags) ? notice.fieldTags : [];

  return (
    <Box className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      {/* Dòng nhãn nhóm văn bản & hiệu lực pháp lý */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {notice.legalDocumentNumber && (
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-blue-600 text-white">
              {notice.legalDocumentNumber}
            </span>
          )}
          <span
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${typeBadge.className}`}
          >
            {typeBadge.label}
          </span>
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ${legalBadge.className}`}
        >
          {legalBadge.label}
        </span>
      </div>

      {/* Tiêu đề niêm yết (bấm mở chi tiết) */}
      <button
        type="button"
        onClick={() => onOpenDetail(notice.id)}
        className="w-full text-left active:opacity-75 transition-opacity"
      >
        <Text className="text-gray-900 font-bold text-base leading-snug mb-1.5">
          {notice.title}
        </Text>

        {/* Tóm tắt ngắn Điều 1 */}
        <Text className="text-gray-600 text-sm leading-relaxed line-clamp-2 mb-2.5">
          {notice.summary || notice.description}
        </Text>
      </button>

      {/* Thông tin cơ quan quản lý, ngày quyết định và thẻ lĩnh vực */}
      <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs text-gray-500">
        {notice.managingAuthority && (
          <div className="flex items-center gap-1.5">
            <Icon icon="zi-home" size={14} className="text-blue-600 flex-shrink-0" />
            <span className="truncate font-medium text-gray-700">
              {notice.managingAuthority}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Icon icon="zi-calendar" size={14} className="text-gray-400 flex-shrink-0" />
          <span>
            {notice.citedDateText
              ? `Ngày ban hành: ${notice.citedDateText}`
              : notice.legalDocumentDate
                ? `Ngày ban hành: ${formatDate(notice.legalDocumentDate)}`
                : `Thời gian niêm yết: ${formatDate(notice.startDate)}`}
          </span>
        </div>

        {fieldTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {fieldTags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Nút thao tác: Xem chi tiết & Mở văn bản PDF (tối thiểu 44x44px) */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenDetail(notice.id)}
          className="flex-1 bg-blue-50 text-blue-700 font-semibold text-sm py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 active:opacity-75"
          style={{ minHeight: 44 }}
        >
          <Icon icon="zi-info-circle" size={16} />
          <span>Chi tiết niêm yết</span>
        </button>

        {primaryDoc?.fileUrl && (
          <button
            type="button"
            onClick={() => onOpenDoc(primaryDoc.fileUrl)}
            className="flex-1 bg-blue-600 text-white font-semibold text-sm py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 active:opacity-80"
            style={{ minHeight: 44 }}
          >
            <Icon icon="zi-share-external-1" size={16} />
            <span>Mở văn bản PDF</span>
          </button>
        )}
      </div>
    </Box>
  );
}

function NoticesPage() {
  const navigate = useNavigate();
  const runZaloAction = useZaloAction();

  const [search, setSearch] = useState("");
  const [noticeType, setNoticeType] = useState("");
  const [fieldTag, setFieldTag] = useState("all");
  const [managingAuthority, setManagingAuthority] = useState("");
  const [includeArchived, setIncludeArchived] = useState(true);
  const [page, setPage] = useState(1);

  const metaResource = useApiResource("/notices/filters/metadata");
  const filterMeta = metaResource.data || {
    fields: [],
    managingAuthorities: [],
    years: [],
    noticeTypes: [],
  };

  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    includeArchived: String(includeArchived),
  });
  if (search.trim()) params.set("search", search.trim());
  if (noticeType) params.set("noticeType", noticeType);
  if (fieldTag && fieldTag !== "all") params.set("fieldTag", fieldTag);
  if (managingAuthority) params.set("managingAuthority", managingAuthority);

  const resource = useApiResource("/notices?" + params.toString());
  const notices = resource.data?.data || [];

  const typeTabs = [
    { value: "", label: "Tất cả văn bản" },
    { value: "PROCEDURE_ANNOUNCEMENT", label: "Công bố TTHC" },
    { value: "INTERNAL_PROCESS", label: "Quy trình nội bộ" },
    { value: "INTERNAL_PROCEDURE", label: "TTHC nội bộ" },
  ];

  return (
    <Page className="bg-gray-50 page-with-header">
      <Header title="Niêm yết công khai" />

      <div className="pb-24 pt-2">
        {/* Khung giới thiệu ngắn */}
        <Box className="mx-4 mb-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
          <Text className="text-blue-900 font-semibold text-sm">
            Thư viện văn bản niêm yết công khai
          </Text>
          <Text className="text-blue-700 text-xs mt-0.5 leading-relaxed">
            Tra cứu các Quyết định công bố thủ tục hành chính, quy trình nội bộ
            và danh mục TTHC niêm yết tại Trung tâm Phục vụ hành chính công xã
            Nghĩa Thành.
          </Text>
        </Box>

        {/* Ô tìm kiếm số quyết định, tiêu đề, từ khóa */}
        <Box className="mx-4 mb-3">
          <Input
            type="text"
            placeholder="Tìm số quyết định (VD: 5119/QĐ-UBND) hoặc tên lĩnh vực..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            prefix={<Icon icon="zi-search" />}
            clearable
            onClear={() => {
              setSearch("");
              setPage(1);
            }}
          />
        </Box>

        {/* Thanh lọc theo nhóm niêm yết */}
        <div className="flex gap-2 px-4 mb-3 overflow-x-auto scrollbar-hide pb-1">
          {typeTabs.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              onClick={() => {
                setNoticeType(tab.value);
                setPage(1);
              }}
              className={`flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors ${
                noticeType === tab.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
              style={{ minHeight: 44 }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bộ lọc lĩnh vực & cơ quan quản lý */}
        <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
          <select
            aria-label="Lọc theo lĩnh vực"
            value={fieldTag}
            onChange={(e) => {
              setFieldTag(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-700"
            style={{ minHeight: 44 }}
          >
            <option value="all">Tất cả lĩnh vực</option>
            {(filterMeta.fields || []).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <select
            aria-label="Lọc theo cơ quan quản lý"
            value={managingAuthority}
            onChange={(e) => {
              setManagingAuthority(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-700"
            style={{ minHeight: 44 }}
          >
            <option value="">Tất cả Sở / ngành</option>
            {(filterMeta.managingAuthorities || []).map((auth) => (
              <option key={auth} value={auth}>
                {auth}
              </option>
            ))}
          </select>
        </div>

        {/* Chế độ bao gồm lưu trữ */}
        <div className="mx-4 mb-3 flex items-center justify-between text-xs text-gray-500">
          <span>
            Hiển thị: <strong className="text-gray-800">{notices.length}</strong>{" "}
            hồ sơ niêm yết
          </span>
          <button
            type="button"
            onClick={() => {
              setIncludeArchived((v) => !v);
              setPage(1);
            }}
            className="text-blue-600 font-medium py-1 px-2 rounded"
          >
            {includeArchived
              ? "Đang hiện cả văn bản lưu trữ"
              : "Chỉ hiện đợt đang niêm yết"}
          </button>
        </div>

        {/* Danh sách kết quả */}
        {resource.loading || resource.error ? (
          <RemoteState {...resource} />
        ) : notices.length === 0 ? (
          <Box className="mx-4 bg-white rounded-2xl p-8 text-center shadow-sm">
            <Icon icon="zi-notif" className="text-gray-300 mb-2" size={40} />
            <Text className="text-gray-500 text-sm font-medium">
              Không tìm thấy hồ sơ niêm yết phù hợp
            </Text>
            <Text className="text-gray-400 text-xs mt-1">
              Thử đổi từ khóa số quyết định hoặc chọn lại bộ lọc lĩnh vực.
            </Text>
          </Box>
        ) : (
          <div className="mx-4 space-y-3">
            {notices.map((n) => (
              <NoticeCard
                key={n.id}
                notice={n}
                onOpenDetail={(id) => navigate(`/notices/${id}`)}
                onOpenDoc={(url) =>
                  runZaloAction(() => openServicePortal(url))
                }
              />
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={resource.data?.meta?.totalPages}
          onChange={setPage}
          disabled={resource.loading}
        />
      </div>
    </Page>
  );
}

export default NoticesPage;
