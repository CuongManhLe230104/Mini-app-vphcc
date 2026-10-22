import { useApiResource } from "../components/use-api-resource";
import RemoteState, { Pagination } from "../components/remote-state";
import { useState } from "react";
import { Header, Page } from "zmp-ui";
import { openServicePortal } from "../services/zalo";
import { useZaloAction } from "../components/use-zalo-action";
export default function NoticesPage() {
  const [page, setPage] = useState(1);
  const resource = useApiResource("/notices?includeArchived=true&limit=20&page=" + page);
  const notices = resource.data?.data || [];
  const run = useZaloAction();
  const date = value => new Date(value).toLocaleDateString("vi-VN");
  return <Page className="bg-gray-50 page-with-header"><Header title="Niêm yết công khai" showBackIcon={false} />
    <div className="pb-24 pt-2">
      <RemoteState {...resource} empty={!notices.length} />
      {notices.map(n => <article key={n.id} className="m-4 p-4 bg-white rounded-xl shadow-sm">
        <span className={n.isActive ? "text-green-700" : "text-gray-500"}>{n.isActive ? "Đang niêm yết" : "Đã hết hạn"}</span>
        <h2 className="font-semibold text-lg mt-2">{n.title}</h2>
        <p className="my-2 whitespace-pre-wrap">{n.description}</p>
        <p className="text-gray-500">{date(n.startDate)} – {date(n.endDate)}</p>
        {(n.documents || []).map(doc => <button key={doc.id} className="block text-blue-600 text-left py-3" onClick={() => run(() => openServicePortal(doc.fileUrl))}>{doc.name}</button>)}
      </article>)}
      <Pagination page={page} totalPages={resource.data?.meta?.totalPages} onChange={setPage} disabled={resource.loading} />
    </div>
  </Page>;
}
