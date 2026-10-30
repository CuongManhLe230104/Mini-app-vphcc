import { useApiResource } from "../components/use-api-resource";
import RemoteState, { Pagination } from "../components/remote-state";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Header, Icon, Input, Page, Text } from "zmp-ui";
import { useZaloAction } from "../components/use-zalo-action";
import { openServicePortal } from "../services/zalo";

function ProceduresPage() {
  const navigate = useNavigate();
  const runZaloAction = useZaloAction();
  const [search, setSearch] = useState("");
  const [activeField, setActiveField] = useState("all");
  const [page, setPage] = useState(1);
  const fieldResource = useApiResource("/procedures/fields");
  const rawFields = fieldResource.data || [];
  const fields = [{ id: "all", label: "Tất cả" }, ...rawFields.map((f) => ({ id: f.slug, label: f.label }))];
  const query = new URLSearchParams({ page, limit: 50, field: activeField, search: search.trim() });
  const resource = useApiResource("/procedures?" + query);
  const filtered = resource.data?.data || [];

  function handleSelectProcedure(proc) {
    if (proc.sourceUrl) {
      runZaloAction(() => openServicePortal(proc.sourceUrl));
    } else {
      navigate(`/procedures/${proc.id}`);
    }
  }

  // Nhóm thủ tục theo lĩnh vực để hiển thị rõ theo từng danh mục
  const grouped = [];
  const groupMap = new Map();
  for (const proc of filtered) {
    const slug = proc.field?.slug || "other";
    const label = proc.field?.label || "Lĩnh vực khác";
    if (!groupMap.has(slug)) {
      const group = { slug, label, items: [] };
      groupMap.set(slug, group);
      grouped.push(group);
    }
    groupMap.get(slug).items.push(proc);
  }

  return (
    <Page className="bg-gray-50 page-with-header">
      <Header title="Thủ tục hành chính" showBackIcon={false} />

      <div className="pb-24 pt-2">
        {/* Tìm kiếm */}
        <Box className="mx-4 mb-3">
          <Input
            type="text"
            placeholder="Tìm tên hoặc mã thủ tục (VD: khai sinh, 1.001193)..."
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

        {/* Danh sách theo danh mục lĩnh vực */}
        <RemoteState {...fieldResource} />
        {resource.loading || resource.error ? (
          <RemoteState {...resource} />
        ) : filtered.length === 0 ? (
          <Box className="mx-4 bg-white rounded-xl p-8 text-center">
            <Icon icon="zi-search" className="text-gray-300 mb-2" size={40} />
            <Text className="text-gray-400 text-sm">
              Không tìm thấy thủ tục phù hợp
            </Text>
          </Box>
        ) : (
          <div className="mx-4 space-y-5">
            {grouped.map((group) => (
              <div key={group.slug} className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <Text className="text-blue-800 font-bold text-sm uppercase tracking-wide">
                    {group.label}
                  </Text>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">
                    {group.items.length} thủ tục
                  </span>
                </div>

                {group.items.map((proc) => (
                  <button
                    key={proc.id}
                    type="button"
                    className="w-full bg-white rounded-xl p-4 text-left shadow-sm border border-gray-100 active:opacity-75 transition-opacity"
                    onClick={() => handleSelectProcedure(proc)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon icon="zi-list-1" className="text-blue-600" size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {proc.code && (
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono font-medium">
                              Mã TTHC: {proc.code}
                            </span>
                          )}
                          {proc.field?.label && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                              {proc.field.label}
                            </span>
                          )}
                        </div>
                        <Text className="text-gray-900 font-semibold text-base leading-snug">
                          {proc.name}
                        </Text>
                        {proc.submission && (
                          <Text className="text-gray-600 text-sm mt-1 leading-relaxed">
                            {proc.submission}
                          </Text>
                        )}
                        <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-blue-600 text-xs font-semibold flex items-center gap-1">
                            <Icon icon="zi-send-solid" size={13} />
                            Nộp hồ sơ trực tuyến (Cổng DVC Quốc gia)
                          </span>
                          <Icon icon="zi-chevron-right" className="text-blue-500 flex-shrink-0" size={16} />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={resource.data?.totalPages} onChange={setPage} disabled={resource.loading} />
      </div>
    </Page>
  );
}

export default ProceduresPage;

