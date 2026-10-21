import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Header, Icon, Input, Page, Text } from "zmp-ui";

import { POST_TYPES } from "../mocks/posts";
import { api } from "../services/api";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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

function PostsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("all");
  const [posts, setPosts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/posts?limit=50")
      .then((res) => {
        if (res && Array.isArray(res.data)) {
          const mapped = res.data.map((p) => ({
            ...p,
            type: (p.type || "news").toLowerCase(),
          }));
          setPosts(mapped);
        }
      })
      .catch(() => setError("Không tải được tin tức. Vui lòng kiểm tra kết nối và mở lại trang."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = posts.filter((p) => {
    const matchType = activeType === "all" || p.type === activeType;
    const matchSearch =
      !search.trim() ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.summary ?? "").toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <Page className="bg-gray-50">
      <Header title="Tin tức & Hướng dẫn" showBackIcon={false} />

      <div className="pb-24 pt-2">
        {/* Tìm kiếm */}
        <Box className="mx-4 mb-3">
          <Input
            type="text"
            placeholder="Tìm bài viết..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<Icon icon="zi-search" />}
            clearable
            onClear={() => setSearch("")}
          />
        </Box>

        {/* Lọc loại bài */}
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto scrollbar-hide pb-1">
          {POST_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeType === t.id
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
              style={{ minHeight: 36 }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Danh sách bài viết */}
        {loading || error ? (
          <Box className="mx-4 bg-white rounded-xl p-4" role="status">{loading ? "Đang tải tin tức..." : error}</Box>
        ) : filtered.length === 0 ? (
          <Box className="mx-4 bg-white rounded-xl p-8 text-center">
            <Icon icon="zi-search" className="text-gray-300 mb-2" size={40} />
            <Text className="text-gray-400 text-sm">
              Không tìm thấy bài viết phù hợp
            </Text>
          </Box>
        ) : (
          <div className="mx-4 space-y-2.5">
            {filtered.map((post) => (
              <button
                key={post.id}
                className="w-full bg-white rounded-xl p-4 text-left shadow-sm active:opacity-70 transition-opacity"
                onClick={() => navigate(`/posts/${post.id}`)}
              >
                <div className="mb-1.5">
                  <PostTypeBadge type={post.type} />
                </div>
                <Text className="text-gray-800 font-semibold text-base leading-snug mb-1">
                  {post.title}
                </Text>
                <Text className="text-gray-500 text-sm leading-relaxed line-clamp-2">
                  {post.summary}
                </Text>
                <div className="flex items-center gap-1 mt-2">
                  <Icon icon="zi-clock-1" className="text-gray-400" size={13} />
                  <Text className="text-gray-400 text-xs">
                    {formatDate(post.publishedAt)}
                  </Text>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

export default PostsPage;

