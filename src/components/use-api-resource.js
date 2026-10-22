import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";

export function useApiResource(path) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ path: null, data: null, loading: true, error: "" });
  const reload = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    setState({ path, data: null, loading: true, error: "" });
    api.get(path, { signal: controller.signal })
      .then(data => { if (active) setState({ path, data, loading: false, error: "" }); })
      .catch(err => { if (active) setState({ path, data: null, loading: false,
        error: err.code === "OFFLINE" ? "Bạn đang mất kết nối mạng." : err.status === 404 ? "Nội dung chưa có hoặc không còn được công khai." : "Không tải được dữ liệu. Vui lòng thử lại." }); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [path, attempt]);
  useEffect(() => {
    const visible = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("online", reload);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("online", reload); document.removeEventListener("visibilitychange", visible); };
  }, [reload]);
  return { ...(state.path === path ? state : { data: null, loading: true, error: "" }), reload };
}
