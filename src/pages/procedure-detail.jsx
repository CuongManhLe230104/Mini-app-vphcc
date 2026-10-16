import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Header, Icon, Page, Text } from "zmp-ui";

import { PROCEDURES as MOCK_PROCEDURES } from "../mocks/procedures";
import { api } from "../services/api";

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
  const mockProc = MOCK_PROCEDURES.find((p) => p.id === id);
  const [proc, setProc] = useState(mockProc);

  useEffect(() => {
    if (!id) return;
    api.get(`/procedures/${id}`)
      .then((data) => {
        if (data && data.name) {
          setProc({
            id: data.id,
            code: data.code,
            name: data.name,
            authority: data.authority,
            deadline: data.deadline,
            fee: data.fee,
            components: Array.isArray(data.components) ? data.components : [],
            submission: data.submission,
            sourceUrl: data.sourceUrl,
            reviewDate: data.reviewDate ? new Date(data.reviewDate).toLocaleDateString("vi-VN") : null,
          });
        }
      })
      .catch(() => {});
  }, [id]);

  if (!proc) {
    return (
      <Page className="bg-gray-50">
        <Header title="Chi tiết thủ tục" />
        <Box className="flex flex-col items-center justify-center h-64 gap-3">
          <Icon icon="zi-search" className="text-gray-300" size={48} />
          <Text className="text-gray-400">Không tìm thấy thủ tục</Text>
        </Box>
      </Page>
    );
  }

  return (
    <Page className="bg-gray-50">
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
            {proc.components.map((comp, idx) => (
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

        {/* Cách nộp */}
        <Box className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
          <Text className="text-gray-800 font-semibold text-base mb-2">
            Cách thức nộp
          </Text>
          <Text className="text-gray-700 text-sm leading-relaxed">
            {proc.submission}
          </Text>
        </Box>

        {/* Thông tin nguồn */}
        <Box className="mx-4 bg-yellow-50 rounded-xl border border-yellow-200 p-3 mb-3">
          <Text className="text-yellow-800 text-xs leading-relaxed">
            ⚠️ Dữ liệu mẫu — chưa đồng bộ nguồn chính thức. Vui lòng liên hệ
            trực tiếp để xác nhận thông tin trước khi thực hiện thủ tục.
          </Text>
          {proc.reviewDate && (
            <Text className="text-yellow-600 text-xs mt-1">
              Ngày rà soát mẫu: {proc.reviewDate}
            </Text>
          )}
        </Box>
      </div>
    </Page>
  );
}

export default ProcedureDetailPage;

