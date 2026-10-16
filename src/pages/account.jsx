import { useState, useEffect } from "react";
import { Box, Header, Icon, Page, Text } from "zmp-ui";

import { useZaloAction } from "../components/use-zalo-action";
import { CENTER_INFO as MOCK_CENTER } from "../mocks/center";
import { api } from "../services/api";
import { callHotline, followZaloOA, openZaloChat } from "../services/zalo";

function SectionTitle({ children }) {
  return (
    <Text className="text-gray-800 font-semibold text-base mb-3">{children}</Text>
  );
}

function ActionRow({ icon, iconBg, label, sublabel, onClick }) {
  return (
    <button
      className="w-full flex items-center gap-3 py-3.5 border-b border-gray-100 last:border-0 active:opacity-70 transition-opacity text-left"
      onClick={onClick}
      style={{ minHeight: 56 }}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon icon={icon} size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <Text className="text-gray-800 font-medium text-base">{label}</Text>
        {sublabel && (
          <Text className="text-gray-400 text-sm mt-0.5">{sublabel}</Text>
        )}
      </div>
      <Icon icon="zi-chevron-right" className="text-gray-300 flex-shrink-0" size={18} />
    </button>
  );
}

function AccountPage() {
  const runZaloAction = useZaloAction();
  const [centerInfo, setCenterInfo] = useState(MOCK_CENTER);

  useEffect(() => {
    api.get("/center")
      .then((data) => {
        if (data && data.fullName) {
          setCenterInfo({
            ...data,
            workingHours: Array.isArray(data.workingHours) ? data.workingHours : MOCK_CENTER.workingHours,
          });
        }
      })
      .catch(() => {});
  }, []);

  function handleHotline() {
    runZaloAction(() => callHotline(centerInfo.hotline));
  }

  function handleChat() {
    runZaloAction(() => openZaloChat(centerInfo.oaId));
  }

  function handleFollowOA() {
    runZaloAction(() => followZaloOA(centerInfo.oaId));
  }

  return (
    <Page className="bg-gray-50">
      <Header title="Của tôi" showBackIcon={false} />

      <div className="pb-24 pt-4">
        {/* Thông tin trung tâm */}
        <Box className="mx-4 bg-blue-600 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon icon="zi-home" className="text-white" size={28} />
            </div>
            <div>
              <Text className="text-white font-bold text-base leading-snug">
                {centerInfo.fullName}
              </Text>
              <Text className="text-blue-200 text-sm mt-0.5">{centerInfo.address}</Text>
            </div>
          </div>
        </Box>

        {/* Liên hệ */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm px-4 mb-4">
          <div className="pt-4">
            <SectionTitle>Liên hệ</SectionTitle>
          </div>
          <ActionRow
            icon="zi-call"
            iconBg="bg-green-100"
            label="Gọi Hotline"
            sublabel={centerInfo.hotline}
            onClick={handleHotline}
          />
          <ActionRow
            icon="zi-chat"
            iconBg="bg-blue-100"
            label="Nhắn tin qua Zalo OA"
            sublabel={centerInfo.oaId ? "Trung tâm PVHCC" : "Chưa cấu hình OA"}
            onClick={handleChat}
          />
          <ActionRow
            icon="zi-star"
            iconBg="bg-yellow-100"
            label="Quan tâm Zalo OA"
            sublabel="Nhận thông báo từ trung tâm"
            onClick={handleFollowOA}
          />
          <div className="pb-2" />
        </Box>

        {/* Lịch làm việc */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-4">
          <SectionTitle>Lịch làm việc</SectionTitle>
          <div className="space-y-2.5">
            {centerInfo.workingHours.map((wh, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Icon icon="zi-clock-1" className="text-blue-500" size={16} />
                  <Text className="text-gray-700 text-sm font-medium">{wh.day}</Text>
                </div>
                <Text
                  className={`text-sm font-medium ${
                    wh.hours === "Nghỉ" || wh.hours.includes("Nghỉ")
                      ? "text-red-500"
                      : "text-blue-600"
                  }`}
                >
                  {wh.hours}
                </Text>
              </div>
            ))}
          </div>
        </Box>

        {/* Địa chỉ */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-4">
          <SectionTitle>Địa chỉ</SectionTitle>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon icon="zi-location" className="text-red-500" size={20} />
            </div>
            <Text className="text-gray-700 text-base leading-relaxed flex-1">
              {centerInfo.address}
            </Text>
          </div>
        </Box>

        {/* Cảnh báo dữ liệu mẫu */}
        <Box className="mx-4 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
          <Text className="text-yellow-700 text-xs text-center">
            ⚠️ Thông tin liên hệ mẫu — cần xác nhận chính thức với đơn vị
          </Text>
        </Box>
      </div>
    </Page>
  );
}

export default AccountPage;

