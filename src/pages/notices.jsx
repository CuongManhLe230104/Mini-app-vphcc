import { Box, Header, Icon, Page, Text } from "zmp-ui";

import { NOTICES } from "../mocks/notices";

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusBadge({ isActive }) {
  return isActive ? (
    <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium">
      Đang niêm yết
    </span>
  ) : (
    <span className="bg-gray-100 text-gray-500 text-xs px-2.5 py-1 rounded-full font-medium">
      Đã hết hạn
    </span>
  );
}

function NoticesPage() {
  const active = NOTICES.filter((n) => n.isActive);
  const expired = NOTICES.filter((n) => !n.isActive);

  return (
    <Page className="bg-gray-50">
      <Header title="Niêm yết công khai" showBackIcon={false} />

      <div className="pb-24 pt-2">
        {/* Đang niêm yết */}
        {active.length > 0 && (
          <Box className="mx-4 mb-4">
            <Text className="text-gray-800 font-semibold text-base mb-3">
              Đang niêm yết ({active.length})
            </Text>
            <div className="space-y-2.5">
              {active.map((n) => (
                <div
                  key={n.id}
                  className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Text className="text-gray-800 font-semibold text-base leading-snug flex-1">
                      {n.title}
                    </Text>
                    <StatusBadge isActive={n.isActive} />
                  </div>
                  <Text className="text-gray-500 text-sm leading-relaxed mb-3">
                    {n.description}
                  </Text>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Icon icon="zi-clock" className="text-gray-400" size={13} />
                      <Text className="text-gray-400 text-xs">
                        {formatDate(n.startDate)} – {formatDate(n.endDate)}
                      </Text>
                    </div>
                  </div>
                  {n.documents.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {n.documents.map((doc, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Icon icon="zi-document" className="text-blue-500" size={16} />
                          <Text className="text-blue-600 text-sm">{doc.name}</Text>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Box>
        )}

        {/* Đã hết hạn */}
        {expired.length > 0 && (
          <Box className="mx-4 mb-4">
            <Text className="text-gray-500 font-semibold text-base mb-3">
              Đã hết hạn ({expired.length})
            </Text>
            <div className="space-y-2">
              {expired.map((n) => (
                <div
                  key={n.id}
                  className="bg-white rounded-xl p-4 shadow-sm opacity-70 border-l-4 border-gray-300"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Text className="text-gray-600 font-medium text-sm leading-snug flex-1">
                      {n.title}
                    </Text>
                    <StatusBadge isActive={n.isActive} />
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Icon icon="zi-clock" className="text-gray-400" size={13} />
                    <Text className="text-gray-400 text-xs">
                      {formatDate(n.startDate)} – {formatDate(n.endDate)}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </Box>
        )}

        {NOTICES.length === 0 && (
          <Box className="mx-4 bg-white rounded-xl p-8 text-center">
            <Icon icon="zi-document" className="text-gray-300 mb-2" size={40} />
            <Text className="text-gray-400 text-sm">Chưa có nội dung niêm yết</Text>
          </Box>
        )}

        <Box className="mx-4 mt-2 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
          <Text className="text-yellow-700 text-xs text-center">
            ⚠️ Dữ liệu mẫu — chưa qua quy trình duyệt chính thức
          </Text>
        </Box>
      </div>
    </Page>
  );
}

export default NoticesPage;

