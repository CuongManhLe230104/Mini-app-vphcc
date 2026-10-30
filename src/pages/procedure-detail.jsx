import { useApiResource } from "../components/use-api-resource";
import RemoteState, { Pagination } from "../components/remote-state";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Header, Icon, Page, Text } from "zmp-ui";

import { openServicePortal } from "../services/zalo";
import { useZaloAction } from "../components/use-zalo-action";

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon icon={icon} className="text-blue-600" size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <Text className="text-gray-400 text-xs mb-0.5">{label}</Text>
        <Text className="text-gray-800 text-sm font-medium">{value}</Text>
      </div>
    </div>
  );
}

function ProcedureDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const resource = useApiResource(`/procedures/${encodeURIComponent(id)}`);
  const proc = resource.data;
  const runZaloAction = useZaloAction();
  if (!proc) return <Page className="bg-gray-50 page-with-header"><Header title="Chi tiết thủ tục" /><RemoteState {...resource} empty /></Page>;

  return (
    <Page className="bg-gray-50 page-with-header">
      <Header title="Chi tiết thủ tục" />

      <div className="pb-8 pt-2">
        {/* Tiêu đề */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon icon="zi-list-1" className="text-blue-600" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <Text className="text-gray-800 font-bold text-lg leading-snug">
                {proc.name}
              </Text>
              {proc.code && (
                <Text className="text-gray-400 text-xs mt-1">Mã: {proc.code}</Text>
              )}
            </div>
          </div>
        </Box>

        {/* Thông tin tóm tắt */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
          <Text className="text-gray-800 font-semibold text-base mb-2">
            Thông tin chung
          </Text>
          <InfoRow icon="zi-home" label="Cơ quan thực hiện" value={proc.authority} />
          <InfoRow icon="zi-clock-1" label="Thời hạn giải quyết" value={proc.deadline} />
          <InfoRow icon="zi-star" label="Lệ phí" value={proc.fee} />
        </Box>

        {/* Thành phần hồ sơ */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
          <Text className="text-gray-800 font-semibold text-base mb-3">
            Thành phần hồ sơ
          </Text>
          <div className="space-y-2.5">
            {(Array.isArray(proc.components) ? proc.components : []).map((comp, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Text className="text-white text-xs font-bold">{idx + 1}</Text>
                </div>
                <Text className="text-gray-700 text-sm leading-relaxed flex-1">
                  {comp}
                </Text>
              </div>
            ))}
          </div>
        </Box>

        {/* Cách nộp / Mục đích thực hiện */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
          <Text className="text-gray-800 font-semibold text-base mb-2">
            Nhiệm vụ / Mục đích thực hiện
          </Text>
          <Text className="text-gray-700 text-sm leading-relaxed">
            {proc.submission}
          </Text>
        </Box>

        {/* Nút nộp hồ sơ trực tuyến & Thông tin nguồn */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
          {proc.sourceUrl ? (
            <button
              type="button"
              className="w-full bg-blue-600 text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 active:opacity-80"
              style={{ minHeight: 48 }}
              onClick={() => runZaloAction(() => openServicePortal(proc.sourceUrl))}
            >
              <Icon icon="zi-send-solid" size={18} />
              <span>Nộp hồ sơ trên Cổng Dịch vụ công Quốc gia</span>
            </button>
          ) : (
            <Text className="text-amber-800 mb-2">
              Thông tin chưa có đủ nguồn hoặc ngày rà soát. Vui lòng xác nhận với trung tâm trước khi thực hiện.
            </Text>
          )}
          {proc.reviewDate && (
            <Text className="text-gray-400 text-xs mt-2.5 text-center">
              Ngày rà soát: {new Date(proc.reviewDate).toLocaleDateString("vi-VN")}
            </Text>
          )}
        </Box>
      </div>
    </Page>
  );
}

export default ProcedureDetailPage;

