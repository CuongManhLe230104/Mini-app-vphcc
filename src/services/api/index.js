/** Gọi API tập trung; chỉ chứa URL công khai, không chứa khóa bí mật. */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const { headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders);
  if (typeof requestOptions.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let res;
  try {
    res = await fetch(BASE_URL + path, { ...requestOptions, headers });
  } catch (error) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw Object.assign(new Error("Không có kết nối mạng"), { code: "OFFLINE" });
    }
    throw error;
  }
  const text = res.status === 204 ? "" : await res.text();
  let data;
  if (text) {
    try { data = JSON.parse(text); }
    catch {
      if (res.ok) throw Object.assign(new Error("Máy chủ trả về dữ liệu không hợp lệ"), { status: res.status });
    }
  }
  if (!res.ok) {
    const detail = data && typeof data === "object" ? data : {};
    const message = Array.isArray(detail.message) ? detail.message.join("; ") : detail.message;
    throw Object.assign(new Error(message || "Yêu cầu không thành công"), detail, { status: res.status, message: message || "Yêu cầu không thành công" });
  }
  return data;
}

export const api = {
  get: (path, options = {}) => request(path, { ...options, method: "GET" }),
  post: (path, body, options = {}) => request(path, { ...options, method: "POST", body: JSON.stringify(body) }),
};
