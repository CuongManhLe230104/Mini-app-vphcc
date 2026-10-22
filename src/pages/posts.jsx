import { useApiResource } from "../components/use-api-resource";
import RemoteState, { Pagination } from "../components/remote-state";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Header, Icon, Input, Page, Text } from "zmp-ui";

const POST_TYPES = [{ id: "all", label: "Tất cả" }, { id: "news", label: "Tin tức" }, { id: "guide", label: "Hướng dẫn" }, { id: "video", label: "Video" }];

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
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page, limit: 20, search: search.trim() });
  if (activeType !== "all") query.set("type", activeType.toUpperCase());
  const resource = useApiResource("/posts?" + query);
  const { loading, error } = resource;
  const filtered = (resource.data?.data || []).map(p => ({ ...p, type: p.type.toLowerCase() }));

  return (
    <Page className="bg-gray-50 page-with-header">
      <Header title="Tin tức & Hướng dẫn" showBackIcon={false} />

      <div className="pb-24 pt-2">
        {/* Tìm kiếm */}
        <Box className="mx-4 mb-3">
          <Input
            type="text"
            placeholder="Tìm bài viết..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            prefix={<Icon icon="zi-search" />}
            clearable
            onClear={() => { setSearch(""); setPage(1); }}
          />
        </Box>

        {/* Lọc loại bài */}
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto scrollbar-hide pb-1">
          {POST_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveType(t.id); setPage(1); }}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeType === t.id
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
              style={{ minHeight: 44 }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Danh sách bài viết */}
        {loading || error ? (
          <RemoteState {...resource} />
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
        <Pagination page={page} totalPages={resource.data?.totalPages} onChange={setPage} disabled={loading} />
      </div>
    </Page>
  );
}

export default PostsPage;

