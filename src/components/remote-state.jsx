export default function RemoteState({ loading, error, reload, empty = false }) {
  if (!loading && !error && !empty) return null;
  return <div className="m-4 p-4 bg-white rounded-xl text-base" role={error ? "alert" : "status"}>
    {loading ? "Đang tải dữ liệu…" : error || "Chưa có nội dung để hiển thị."}
    {!loading && error && <button className="block text-blue-600 mt-2 px-4 py-3" onClick={reload}>Thử lại</button>}
  </div>;
}
export function Pagination({ page, totalPages, onChange, disabled }) {
  if (!totalPages) return null;
  return <div className="flex items-center justify-center gap-4 p-4">
    <button className="px-3 py-3 text-blue-600 disabled:opacity-40" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>Trước</button>
    <span>Trang {page}/{totalPages}</span>
    <button className="px-3 py-3 text-blue-600 disabled:opacity-40" disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>Sau</button>
  </div>;
}
