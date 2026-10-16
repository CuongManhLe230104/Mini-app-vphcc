import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Box, Header, Icon, Page, Text } from "zmp-ui";

import { POSTS as MOCK_POSTS } from "../mocks/posts";
import { api } from "../services/api";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
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
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.className}`}>
      {t.label}
    </span>
  );
}

function PostDetailPage() {
  const { id } = useParams();
  const mockPost = MOCK_POSTS.find((p) => p.id === id);
  const [post, setPost] = useState(mockPost);

  useEffect(() => {
    if (!id) return;
    api.get(`/posts/${id}`)
      .then((data) => {
        if (data && data.title) {
          setPost({
            ...data,
            type: (data.type || "news").toLowerCase(),
            tags: Array.isArray(data.tags) ? data.tags : [],
          });
        }
      })
      .catch(() => {});
  }, [id]);

  if (!post) {
    return (
      <Page className="bg-gray-50">
        <Header title="Chi tiết bài viết" />
        <Box className="flex flex-col items-center justify-center h-64 gap-3">
          <Icon icon="zi-search" className="text-gray-300" size={48} />
          <Text className="text-gray-400">Không tìm thấy bài viết</Text>
        </Box>
      </Page>
    );
  }

  return (
    <Page className="bg-gray-50">
      <Header title="Tin tức & Hướng dẫn" />

      <div className="pb-8">
        <Box className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-5">
          {/* Type badge */}
          <div className="mb-3">
            <PostTypeBadge type={post.type} />
          </div>

          {/* Tiêu đề */}
          <Text className="text-gray-900 font-bold text-xl leading-snug mb-3">
            {post.title}
          </Text>

          {/* Ngày đăng */}
          <div className="flex items-center gap-1.5 mb-4 pb-4 border-b border-gray-100">
            <Icon icon="zi-clock-1" className="text-gray-400" size={14} />
            <Text className="text-gray-400 text-sm">{formatDate(post.publishedAt)}</Text>
          </div>

          {/* Tóm tắt */}
          <Text className="text-gray-600 text-base leading-relaxed italic mb-4">
            {post.summary}
          </Text>

          {/* Video placeholder */}
          {post.type === "video" && (
            <div className="bg-gray-100 rounded-xl aspect-video flex flex-col items-center justify-center gap-2 mb-4">
              <Icon icon="zi-star" className="text-gray-400" size={36} />
              <Text className="text-gray-400 text-sm">Video sẽ được cập nhật</Text>
            </div>
          )}

          {/* Nội dung */}
          <Text className="text-gray-700 text-base leading-relaxed">
            {post.content}
          </Text>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-100">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-gray-100 text-gray-500 text-xs px-2.5 py-1 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </Box>

        <Box className="mx-4 mt-3 bg-yellow-50 rounded-xl border border-yellow-200 p-3">
          <Text className="text-yellow-700 text-xs text-center">
            ⚠️ Nội dung mẫu — chưa qua quy trình duyệt chính thức
          </Text>
        </Box>
      </div>
    </Page>
  );
}

export default PostDetailPage;

