import { useApiResource } from "../components/use-api-resource";
import RemoteState, { Pagination } from "../components/remote-state";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Header, Icon, Input, Page, Text } from "zmp-ui";


function ProceduresPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeField, setActiveField] = useState("all");
  const [page, setPage] = useState(1);
  const fieldResource = useApiResource("/procedures/fields");
  const fields = [{ id: "all", label: "Tất cả" }, ...(fieldResource.data || []).map(f => ({ id: f.slug, label: f.label }))];
  const query = new URLSearchParams({ page, limit: 20, field: activeField, search: search.trim() });
  const resource = useApiResource("/procedures?" + query);
  const filtered = resource.data?.data || [];

  return (
    <Page className="bg-gray-50 page-with-header">
      <Header title="Thủ tục hành chính" showBackIcon={false} />

      <div className="pb-24 pt-2">
        {/* Tìm kiếm */}
        <Box className="mx-4 mb-3">
          <Input
            type="text"
            placeholder="Tìm tên hoặc mã thủ tục..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            prefix={<Icon icon="zi-search" />}
            clearable
            onClear={() => { setSearch(""); setPage(1); }}
          />
        </Box>

        {/* Lọc lĩnh vực */}
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto scrollbar-hide pb-1">
          {fields.map((f) => (
            <button
              key={f.id}
              onClick={() => { setActiveField(f.id); setPage(1); }}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeField === f.id
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
              style={{ minHeight: 44 }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Danh sách */}
        <RemoteState {...fieldResource} />
        {resource.loading || resource.error ? <RemoteState {...resource} /> : filtered.length === 0 ? (
          <Box className="mx-4 bg-white rounded-xl p-8 text-center">
            <Icon icon="zi-search" className="text-gray-300 mb-2" size={40} />
            <Text className="text-gray-400 text-sm">
              Không tìm thấy thủ tục phù hợp
            </Text>
          </Box>
        ) : (
          <div className="mx-4 space-y-2">
            {filtered.map((proc) => (
              <button
                key={proc.id}
                className="w-full bg-white rounded-xl p-4 text-left shadow-sm active:opacity-70 transition-opacity"
                onClick={() => navigate(`/procedures/${proc.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon icon="zi-list-1" className="text-blue-600" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Text className="text-gray-800 font-medium text-base leading-snug">
                      {proc.name}
                    </Text>
                    {(!proc.sourceUrl || !proc.reviewDate) && <Text className="text-amber-800 text-sm">Chưa đủ thông tin nguồn/rà soát</Text>}
                    <Text className="text-gray-400 text-sm mt-0.5">
                      {proc.authority}
                    </Text>
                    <div className="flex gap-3 mt-2">
                      <div className="flex items-center gap-1">
                        <Icon icon="zi-clock-1" className="text-gray-400" size={13} />
                        <Text className="text-gray-500 text-xs">{proc.deadline}</Text>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon icon="zi-star" className="text-gray-400" size={13} />
                        <Text className="text-gray-500 text-xs">{proc.fee}</Text>
                      </div>
                    </div>
                  </div>
                  <Icon icon="zi-chevron-right" className="text-gray-300 flex-shrink-0 mt-1" size={18} />
                </div>
              </button>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={resource.data?.totalPages} onChange={setPage} disabled={resource.loading} />
      </div>
    </Page>
  );
}

export default ProceduresPage;

