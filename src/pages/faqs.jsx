import { useApiResource } from "../components/use-api-resource";
import RemoteState, { Pagination } from "../components/remote-state";
import { Header, Page } from "zmp-ui";
export default function FaqsPage() {
  const resource = useApiResource("/faqs");
  const items = resource.data || [];
  return <Page className="bg-gray-50 page-with-header"><Header title="Câu hỏi thường gặp" />
    <div className="pb-24"><RemoteState {...resource} empty={!items.length} />
      {items.map(f => <details key={f.id} className="m-4 p-4 bg-white rounded-xl">
        <summary className="font-semibold py-2">{f.question}</summary><p className="mt-3 whitespace-pre-wrap">{f.answer}</p>
      </details>)}
    </div></Page>;
}
