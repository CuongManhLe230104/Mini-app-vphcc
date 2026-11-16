import { useApiResource } from "../components/use-api-resource";
import RemoteState from "../components/remote-state";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Header, Icon, Page, Text } from "zmp-ui";
import { openServicePortal } from "../services/zalo";
import { useZaloAction } from "../components/use-zalo-action";

const NOTICE_TYPE_META = {
  PROCEDURE_ANNOUNCEMENT: {
    label: "Công bố TTHC / Danh mục TTHC",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
    isInternalOnly: false,
  },
  INTERNAL_PROCESS: {
    label: "Quy trình nội bộ / điện tử giải quyết TTHC",
    className: "bg-purple-50 text-purple-700 border border-purple-200",
    isInternalOnly: true,
  },
  INTERNAL_PROCEDURE: {
    label: "TTHC nội bộ trong hệ thống hành chính nhà nước",
    className: "bg-amber-50 text-amber-800 border border-amber-200",
    isInternalOnly: true,
  },
};

const LEGAL_STATUS_META = {
  VALID: {
    label: "Còn hiệu lực",
    className: "bg-green-100 text-green-700",
  },
  PARTIALLY_EXPIRED: {
    label: "Hết hiệu lực một phần",
    className: "bg-amber-100 text-amber-800",
  },
  EXPIRED: {
    label: "Hết hiệu lực toàn bộ",
    className: "bg-gray-200 text-gray-600",
  },
  UNVERIFIED: {
    label: "Chưa xác minh hiệu lực",
    className: "bg-slate-100 text-slate-600",
  },
};

const IMPACT_LABELS = {
  NEW: { label: "Mới ban hành", className: "bg-green-50 text-green-700" },
  AMENDED: { label: "Sửa đổi, bổ sung", className: "bg-blue-50 text-blue-700" },
  REPLACED: { label: "Thay thế", className: "bg-purple-50 text-purple-700" },
  REPEALED: { label: "Bãi bỏ", className: "bg-red-50 text-red-700" },
  INTERNAL_PROCESS: {
    label: "Quy trình nội bộ / điện tử",
    className: "bg-slate-100 text-slate-700",
  },
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon icon={icon} className="text-blue-600" size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <Text className="text-gray-400 text-xs mb-0.5">{label}</Text>
        <Text className="text-gray-800 text-sm font-medium leading-snug">
          {value}
        </Text>
      </div>
    </div>
  );
}

function NoticeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const runZaloAction = useZaloAction();
  const resource = useApiResource(`/notices/${encodeURIComponent(id)}`);
  const notice = resource.data;

  if (!notice) {
    return (
      <Page className="bg-gray-50 page-with-header">
        <Header title="Chi tiết niêm yết" />
        <RemoteState {...resource} empty />
      </Page>
    );
  }

  const typeMeta =
    NOTICE_TYPE_META[notice.noticeType] ||
    NOTICE_TYPE_META.PROCEDURE_ANNOUNCEMENT;
  const legalMeta =
    LEGAL_STATUS_META[notice.legalStatus] || LEGAL_STATUS_META.UNVERIFIED;
  const documents = Array.isArray(notice.documents) ? notice.documents : [];
  const fieldTags = Array.isArray(notice.fieldTags) ? notice.fieldTags : [];
  const procedureLinks = Array.isArray(notice.procedureLinks)
    ? notice.procedureLinks
    : [];
  const relatedNotices = Array.isArray(notice.relatedNotices)
    ? notice.relatedNotices
    : [];

  return (
    <Page className="bg-gray-50 page-with-header">
      <Header title="Chi tiết niêm yết" />

      <div className="pb-24 pt-2">
        {/* 1. Tiêu đề niêm yết & Nhãn phân loại */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeMeta.className}`}
            >
              {typeMeta.label}
            </span>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${legalMeta.className}`}
            >
              {legalMeta.label}
            </span>
          </div>

          <Text className="text-gray-900 font-bold text-lg leading-snug">
            {notice.title}
          </Text>

          {notice.noticeType === "INTERNAL_PROCEDURE" && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Text className="text-amber-900 text-xs font-semibold">
                Lưu ý: Đây là Thủ tục hành chính nội bộ giữa các cơ quan hành
                chính nhà nước (không phải thủ tục lấy số thứ tự hoặc nộp hồ sơ
                công dân tại quầy).
              </Text>
            </div>
          )}

          {notice.noticeType === "INTERNAL_PROCESS" && (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-3">
              <Text className="text-purple-900 text-xs font-semibold">
                Văn bản phê duyệt quy trình nội bộ, quy trình điện tử giải quyết
                thủ tục hành chính phục vụ tra cứu công khai.
              </Text>
            </div>
          )}
        </Box>

        {/* 2. Thông tin Thông báo niêm yết & Quyết định được dẫn chiếu */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
          <Text className="text-gray-800 font-semibold text-base mb-2">
            Thông tin văn bản niêm yết
          </Text>
          <InfoRow
            icon="zi-home"
            label="Đơn vị niêm yết"
            value={
              notice.publishingUnit ||
              "Trung tâm Phục vụ hành chính công xã Nghĩa Thành"
            }
          />
          <InfoRow
            icon="zi-star"
            label="Số hiệu Quyết định được niêm yết"
            value={notice.legalDocumentNumber}
          />
          <InfoRow
            icon="zi-calendar"
            label="Ngày ban hành Quyết định"
            value={
              notice.citedDateText || formatDate(notice.legalDocumentDate)
            }
          />
          <InfoRow
            icon="zi-user-solid"
            label="Cơ quan ban hành"
            value={notice.issuingAuthority || "Chủ tịch UBND Thành phố Hồ Chí Minh"}
          />
          <InfoRow
            icon="zi-list-1"
            label="Cơ quan quản lý chuyên ngành"
            value={notice.managingAuthority}
          />
          {fieldTags.length > 0 && (
            <div className="pt-2.5">
              <Text className="text-gray-400 text-xs mb-1.5">
                Lĩnh vực áp dụng
              </Text>
              <div className="flex flex-wrap gap-1.5">
                {fieldTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Box>

        {/* 3. Nội dung tóm tắt Điều 1 / Phạm vi niêm yết */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
          <Text className="text-gray-800 font-semibold text-base mb-2">
            Tóm tắt nội dung công bố (Điều 1)
          </Text>
          <Text className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
            {notice.summary || notice.description}
          </Text>
        </Box>

        {/* 4. Nút nổi bật: Xem toàn bộ văn bản PDF */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
          <Text className="text-gray-800 font-semibold text-base mb-2.5">
            Tệp văn bản niêm yết chính thức ({documents.length})
          </Text>

          {documents.length === 0 ? (
            <Text className="text-gray-400 text-sm">
              Hồ sơ này hiện chưa đính kèm tệp PDF.
            </Text>
          ) : (
            <div className="space-y-2.5">
              {documents.map((doc, idx) => {
                const url = doc.fileUrl || doc.url;
                return (
                  <div
                    key={doc.id || idx}
                    className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl"
                  >
                    <div className="flex items-start gap-2.5 mb-2.5">
                      <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon
                          icon="zi-file"
                          className="text-white"
                          size={18}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Text className="text-gray-900 text-sm font-semibold leading-snug">
                          {doc.name || "Văn bản PDF niêm yết"}
                        </Text>
                        <Text className="text-gray-500 text-xs mt-0.5">
                          Bộ hồ sơ PDF (Thông báo niêm yết, Quyết định và Phụ lục)
                        </Text>
                      </div>
                    </div>

                    {url && (
                      <button
                        type="button"
                        onClick={() =>
                          runZaloAction(() => openServicePortal(url))
                        }
                        className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 active:opacity-80"
                        style={{ minHeight: 48 }}
                      >
                        <Icon icon="zi-share-external-1" size={18} />
                        <span>Xem toàn bộ văn bản PDF</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {notice.sourcePortalUrl && (
            <button
              type="button"
              onClick={() =>
                runZaloAction(() => openServicePortal(notice.sourcePortalUrl))
              }
              className="w-full mt-2.5 bg-gray-100 text-gray-700 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 text-xs active:opacity-75"
              style={{ minHeight: 44 }}
            >
              <Icon icon="zi-link" size={15} />
              <span>Tra cứu cổng thông tin gốc được dẫn chiếu</span>
            </button>
          )}
        </Box>

        {/* 5. Danh sách Thủ tục hành chính liên quan (Mốc NY3) */}
        {procedureLinks.length > 0 && (
          <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
            <Text className="text-gray-800 font-semibold text-base mb-1">
              Thủ tục hành chính liên quan ({procedureLinks.length})
            </Text>
            <Text className="text-gray-500 text-xs mb-3">
              Các thủ tục tại Trung tâm chịu tác động hoặc dẫn chiếu từ văn bản
              niêm yết này:
            </Text>

            <div className="space-y-2.5">
              {procedureLinks.map((lnk) => {
                const proc = lnk.procedure;
                if (!proc) return null;
                const impact =
                  IMPACT_LABELS[lnk.impactType] || IMPACT_LABELS.AMENDED;
                return (
                  <div
                    key={lnk.id || proc.id}
                    className="p-3 rounded-xl border border-gray-200 bg-gray-50/70"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${impact.className}`}
                      >
                        {impact.label}
                      </span>
                      {proc.code && (
                        <span className="text-xs font-mono bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded">
                          Mã TTHC: {proc.code}
                        </span>
                      )}
                    </div>

                    <Text className="text-gray-900 font-semibold text-sm leading-snug mb-1">
                      {proc.name}
                    </Text>

                    {(lnk.receivingAuthority || lnk.resolvingAuthority) && (
                      <div className="text-xs text-gray-600 space-y-0.5 mb-2">
                        {lnk.receivingAuthority && (
                          <div>• Tiếp nhận: {lnk.receivingAuthority}</div>
                        )}
                        {lnk.resolvingAuthority && (
                          <div>• Giải quyết: {lnk.resolvingAuthority}</div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => navigate(`/procedures/${proc.id}`)}
                        className="flex-1 bg-white border border-blue-200 text-blue-700 font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1 active:opacity-75"
                        style={{ minHeight: 44 }}
                      >
                        <Icon icon="zi-list-1" size={14} />
                        <span>Xem hướng dẫn thủ tục</span>
                      </button>

                      {/* Không hiển thị nút nộp hồ sơ công dân đối với TTHC nội bộ */}
                      {!typeMeta.isInternalOnly && proc.sourceUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            runZaloAction(() =>
                              openServicePortal(proc.sourceUrl)
                            )
                          }
                          className="flex-1 bg-blue-600 text-white font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1 active:opacity-80"
                          style={{ minHeight: 44 }}
                        >
                          <Icon icon="zi-send-solid" size={14} />
                          <span>Nộp hồ sơ trực tuyến</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Box>
        )}

        {/* 6. Văn bản niêm yết cùng cơ quan quản lý */}
        {relatedNotices.length > 0 && (
          <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
            <Text className="text-gray-800 font-semibold text-base mb-2.5">
              Văn bản niêm yết cùng cơ quan ({relatedNotices.length})
            </Text>
            <div className="space-y-2">
              {relatedNotices.map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => navigate(`/notices/${rel.id}`)}
                  className="w-full text-left p-3 rounded-xl bg-gray-50 border border-gray-100 active:opacity-75 flex items-center justify-between gap-2"
                  style={{ minHeight: 44 }}
                >
                  <div className="min-w-0 flex-1">
                    {rel.legalDocumentNumber && (
                      <span className="text-xs font-mono font-bold text-blue-700 block mb-0.5">
                        {rel.legalDocumentNumber}
                      </span>
                    )}
                    <Text className="text-gray-800 text-xs font-medium line-clamp-2">
                      {rel.title}
                    </Text>
                  </div>
                  <Icon
                    icon="zi-chevron-right"
                    size={16}
                    className="text-gray-400 flex-shrink-0"
                  />
                </button>
              ))}
            </div>
          </Box>
        )}
      </div>
    </Page>
  );
}

export default NoticeDetailPage;
