import { useApiResource } from "../components/use-api-resource";
import RemoteState, { Pagination } from "../components/remote-state";
import { useNavigate } from "react-router-dom";
import { Box, Button, Header, Icon, Page, Text } from "zmp-ui";

import { callHotline, openServicePortal, openZaloChat } from "../services/zalo";
import Logo from "../components/logo";
import { useZaloAction } from "../components/use-zalo-action";

const FEEDBACK_PORTAL_URL = "https://dichvucong.gov.vn/nop-phan-anh-kien-nghi?typeInapp=1";
const HCM_NEWS_URL = "https://vnexpress.net/chu-de/thanh-pho-ho-chi-minh-2091";

/** Danh sách tiện ích nhanh trên trang chủ */
const QUICK_SERVICES = [
  {
    label: "Lấy số",
    icon: "zi-clock-1",
    color: "bg-indigo-50 text-indigo-600",
    action: "nav",
    to: "/queue?tab=ticket",
  },
  {
    label: "Đặt lịch",
    icon: "zi-calendar",
    color: "bg-teal-50 text-teal-600",
    action: "nav",
    to: "/queue?tab=appointment",
  },
  { label: "Hỏi đáp", icon: "zi-help-circle", color: "bg-blue-50 text-blue-600", action: "nav", to: "/faqs" },
  {
    label: "Thủ tục",
    icon: "zi-list-1",
    color: "bg-blue-50 text-blue-600",
    action: "nav",
    to: "/procedures",
  },
  {
    label: "Tin tức",
    icon: "zi-star",
    color: "bg-yellow-50 text-yellow-600",
    action: "nav",
    to: "/posts",
  },
  {
    label: "Niêm yết",
    icon: "zi-file",
    color: "bg-green-50 text-green-600",
    action: "nav",
    to: "/notices",
  },
  {
    label: "Phản ánh",
    icon: "zi-edit-text",
    color: "bg-orange-50 text-orange-600",
    action: "feedback",
  },
  {
    label: "Liên hệ",
    icon: "zi-location",
    color: "bg-purple-50 text-purple-600",
    action: "nav",
    to: "/account",
  },
  {
    label: "Hotline",
    icon: "zi-call",
    color: "bg-red-50 text-red-600",
    action: "hotline",
  },
  {
    label: "OA Zalo",
    icon: "zi-chat",
    color: "bg-sky-50 text-sky-600",
    action: "oa",
  },
];

/** Format ngày đăng */
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Badge loại bài */
function PostTypeBadge({ type }) {
  const map = {
    news: { label: "Tin tức", className: "bg-blue-100 text-blue-700" },
    guide: { label: "Hướng dẫn", className: "bg-green-100 text-green-700" },
    video: { label: "Video", className: "bg-orange-100 text-orange-700" },
  };
  const t = map[type] ?? { label: type, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.className}`}>
      {t.label}
    </span>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const runZaloAction = useZaloAction();
  const centerResource = useApiResource("/center");
  const centerInfo = centerResource.data || {};
  const postsResource = useApiResource("/posts?limit=3");
  const posts = (postsResource.data?.data || []).map(p => ({ ...p, type: p.type.toLowerCase() }));
  const highlighted = posts.filter((p) => p.isHighlighted).slice(0, 3);

  function handleQuickService(svc) {
    if (svc.action === "nav") navigate(svc.to);
    else if (svc.action === "hotline") runZaloAction(() => callHotline(centerInfo.hotline));
    else if (svc.action === "feedback") runZaloAction(() => openServicePortal(FEEDBACK_PORTAL_URL));
    else if (svc.action === "oa") {
      runZaloAction(() => openZaloChat(centerInfo.oaId));
    }
  }

  return (
    <Page className="bg-gray-50">
      <div className="pb-24">
        {/* Banner */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-5 pt-8 pb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="bg-white p-1 rounded-xl shadow-sm flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ width: 60, height: 60 }}>
              <Logo style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div>
              <Text className="text-white text-lg font-bold leading-snug">{centerInfo.fullName || "Thông tin trung tâm"}</Text>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <Icon icon="zi-location" className="text-blue-300 flex-shrink-0" size={16} />
            <Text className="text-blue-200 text-xs leading-tight">{centerInfo.address || ""}</Text>
          </div>
        </div>

        <RemoteState {...centerResource} />
        {/* Tiện ích nhanh */}
        <Box className="mx-4 -mt-4 bg-white rounded-2xl shadow-sm px-4 py-4">
          <Text className="text-gray-800 font-semibold text-base mb-3">
            Dịch vụ nhanh
          </Text>
          <div className="grid grid-cols-3 gap-3">
            {QUICK_SERVICES.map((svc) => (
              <button
                key={svc.label}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl active:opacity-70 transition-opacity"
                style={{ minHeight: 64 }}
                onClick={() => handleQuickService(svc)}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center ${svc.color}`}
                >
                  <Icon icon={svc.icon} size={22} />
                </div>
                <Text className="text-gray-700 text-xs text-center font-medium">
                  {svc.label}
                </Text>
              </button>
            ))}
          </div>
        </Box>

        {/* Tin nổi bật */}
        <Box className="mx-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <Text className="text-gray-800 font-semibold text-base">
              Tin nổi bật
            </Text>
            <button
              className="text-blue-600 text-sm font-medium active:opacity-70"
              onClick={() => navigate("/posts")}
            >
              Xem tất cả
            </button>
          </div>

          <button
            type="button"
            className="w-full mb-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-3.5 text-left shadow-sm flex items-center gap-3 active:opacity-80 transition-opacity"
            onClick={() => runZaloAction(() => openServicePortal(HCM_NEWS_URL))}
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon icon="zi-star" className="text-white" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <Text className="text-white font-semibold text-sm leading-snug">
                Tin tức mới nhất TP. Hồ Chí Minh
              </Text>
              <Text className="text-blue-100 text-xs mt-0.5 truncate">
                Xem chuyên mục TP.HCM trên VnExpress
              </Text>
            </div>
            <Icon icon="zi-chevron-right" className="text-white/80 flex-shrink-0" size={18} />
          </button>

          {postsResource.loading || postsResource.error ? (
            <RemoteState {...postsResource} />
          ) : highlighted.length === 0 ? (
            <Box className="bg-white rounded-xl p-4 text-center">
              <Text className="text-gray-400 text-sm">Chưa có tin tức</Text>
            </Box>
          ) : (
            <div className="space-y-2.5">
              {highlighted.map((post) => (
                <button
                  key={post.id}
                  className="w-full bg-white rounded-xl p-3.5 text-left shadow-sm active:opacity-70 transition-opacity"
                  onClick={() => navigate(`/posts/${post.id}`)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="mb-1.5">
                        <PostTypeBadge type={post.type} />
                      </div>
                      <Text className="text-gray-800 font-medium text-sm leading-snug line-clamp-2">
                        {post.title}
                      </Text>
                      <Text className="text-gray-400 text-xs mt-1">
                        {formatDate(post.publishedAt)}
                      </Text>
                    </div>
                    <Icon icon="zi-chevron-right" className="text-gray-300 mt-1 flex-shrink-0" size={18} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Box>

        {/* Dịch vụ công trực tuyến */}
        <Box className="mx-4 mt-4">
          <Text className="text-gray-800 font-semibold text-base mb-3">
            Dịch vụ công trực tuyến
          </Text>
          <div className="space-y-2.5">
            <button
              className="w-full bg-white border border-blue-200 rounded-xl py-3.5 px-4 flex items-center gap-3 active:opacity-70 transition-opacity"
              onClick={() => runZaloAction(() => openServicePortal(centerInfo.servicePortalUrl))}
            >
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon icon="zi-send-solid" className="text-blue-600" size={20} />
              </div>
              <div className="flex-1 text-left">
                <Text className="text-gray-800 font-medium text-sm">
                  Nộp hồ sơ trực tuyến
                </Text>
                <Text className="text-gray-400 text-xs">
                  Qua cổng dịch vụ công quốc gia
                </Text>
              </div>
              <Icon icon="zi-chevron-right" className="text-gray-300" size={18} />
            </button>

            <button
              className="w-full bg-white border border-blue-200 rounded-xl py-3.5 px-4 flex items-center gap-3 active:opacity-70 transition-opacity"
              onClick={() => runZaloAction(() => openServicePortal(centerInfo.caseTrackingUrl))}
            >
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon icon="zi-search" className="text-green-600" size={20} />
              </div>
              <div className="flex-1 text-left">
                <Text className="text-gray-800 font-medium text-sm">
                  Tra cứu tiến độ hồ sơ
                </Text>
                <Text className="text-gray-400 text-xs">
                  Qua cổng dịch vụ công quốc gia
                </Text>
              </div>
              <Icon icon="zi-chevron-right" className="text-gray-300" size={18} />
            </button>

            <button
              className="w-full bg-white border border-blue-200 rounded-xl py-3.5 px-4 flex items-center gap-3 active:opacity-70 transition-opacity"
              onClick={() => runZaloAction(() => openServicePortal(FEEDBACK_PORTAL_URL))}
            >
              <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon icon="zi-edit-text" className="text-orange-600" size={20} />
              </div>
              <div className="flex-1 text-left">
                <Text className="text-gray-800 font-medium text-sm">
                  Phản ánh kiến nghị
                </Text>
                <Text className="text-gray-400 text-xs">
                  Qua cổng dịch vụ công quốc gia (dichvucong.gov.vn)
                </Text>
              </div>
              <Icon icon="zi-chevron-right" className="text-gray-300" size={18} />
            </button>
          </div>
        </Box>
      </div>
    </Page>
  );
}

export default HomePage;
