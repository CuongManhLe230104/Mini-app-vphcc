import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Header, Icon, Page, Text } from "zmp-ui";

import { CENTER_INFO as MOCK_CENTER } from "../mocks/center";
import { api } from "../services/api";
import { callHotline, followZaloOA, openServicePortal } from "../services/zalo";
import Logo from "../components/logo";
import { useZaloAction } from "../components/use-zalo-action";

/** Danh sách tiện ích nhanh trên trang chủ */
const QUICK_SERVICES = [
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
  const [centerInfo, setCenterInfo] = useState(MOCK_CENTER);
  const [posts, setPosts] = useState([]);

  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState("");

  useEffect(() => {
    // Tải thông tin trung tâm từ backend
    api.get("/center")
      .then((data) => {
        if (data && data.fullName) setCenterInfo(data);
      })
      .catch(() => {});

    // Tải tin tức từ backend
    api.get("/posts?limit=3")
      .then((res) => {
        if (res && Array.isArray(res.data)) {
          // Map kiểu dữ liệu từ backend sang format hiển thị
          const mapped = res.data.map((p) => ({
            ...p,
            type: (p.type || "news").toLowerCase(),
          }));
          setPosts(mapped);
        }
      })
      .catch(() => setPostsError("Không tải được tin tức. Vui lòng kiểm tra kết nối và mở lại trang."))
      .finally(() => setPostsLoading(false));
  }, []);

  const highlighted = posts.filter((p) => p.isHighlighted).slice(0, 3);

  function handleQuickService(svc) {
    if (svc.action === "nav") navigate(svc.to);
    else if (svc.action === "hotline") runZaloAction(() => callHotline(centerInfo.hotline));
    else if (svc.action === "oa") {
      runZaloAction(() => followZaloOA(centerInfo.oaId));
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
              <Text className="text-white text-base font-semibold leading-snug">
                Trung tâm Phục vụ
              </Text>
              <Text className="text-white text-lg font-bold leading-snug">
                Hành chính công
              </Text>
              <Text className="text-blue-200 text-sm mt-0.5">xã Nghĩa Thành</Text>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <Icon icon="zi-location" className="text-blue-300 flex-shrink-0" size={16} />
            <Text className="text-blue-200 text-xs leading-tight">{centerInfo.address}</Text>
          </div>
        </div>

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

          {postsLoading || postsError ? (
            <Box className="bg-white rounded-xl p-4" role="status">{postsLoading ? "Đang tải tin tức..." : postsError}</Box>
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
          </div>
        </Box>
      </div>
    </Page>
  );
}

export default HomePage;
