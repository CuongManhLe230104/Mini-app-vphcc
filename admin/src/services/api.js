/**
 * Dịch vụ API tập trung cho Admin Panel
 * Tất cả fetch đi qua đây — không gọi fetch trực tiếp trong component
 */

const BASE = "/api/v1";

function getToken() {
  return localStorage.getItem("admin_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.headers) {
    Object.entries(options.headers).forEach(([k, v]) => headers.set(k, v));
  }

  let res;
  try {
    res = await fetch(BASE + path, { ...options, headers });
  } catch (err) {
    throw Object.assign(new Error("Không thể kết nối tới máy chủ"), { code: "NETWORK_ERROR" });
  }

  const text = res.status === 204 ? "" : await res.text();
  let data;
  if (text) {
    try { data = JSON.parse(text); } catch { /* ignore */ }
  }

  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    window.location.href = "/login";
    throw new Error("Phiên đăng nhập hết hạn");
  }

  if (!res.ok) {
    const msg = data?.message
      ? (Array.isArray(data.message) ? data.message.join("; ") : data.message)
      : `Lỗi ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, data });
  }

  return data;
}

const get  = (path, opts = {}) => request(path, { ...opts, method: "GET" });
const post = (path, body, opts = {}) => request(path, { ...opts, method: "POST",  body: JSON.stringify(body) });
const patch = (path, body, opts = {}) => request(path, { ...opts, method: "PATCH", body: JSON.stringify(body) });
const del  = (path, opts = {}) => request(path, { ...opts, method: "DELETE" });

export const api = {
  getAudit: (page = 1) => get(`/audit?page=${page}&limit=20`),
  // Auth
  login: (username, password) => post("/auth/admin/login", { username, password }),
  me: () => get("/auth/me"),

  // Center
  getCenter: () => get("/center"),
  updateCenter: (data) => patch("/center", data),

  // Procedure Fields
  getFields: () => get("/procedures/fields"),

  // Procedures
  getProcedures: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && q.append(k, v));
    return get(`/procedures/admin/all?${q}`);
  },
  createProcedure: (data) => post("/procedures", data),
  updateProcedure: (id, data) => patch(`/procedures/${id}`, data),
  deleteProcedure: (id) => del(`/procedures/${id}`),

  // Posts (admin)
  getPostsAdmin: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && q.append(k, v));
    return get(`/posts/admin/all?${q}`);
  },
  deletePost: (id) => del(`/posts/admin/${id}`),
  updatePost: (id, data) => patch(`/posts/admin/${id}`, data),
  createDraft: (data) => post("/posts/admin/draft", data),
  submitPost: (id, version) => post(`/posts/admin/${id}/submit`, { version }),
  publishPost: (id, version) => post(`/posts/admin/${id}/publish`, { version }),
  rejectPost: (id, note, version) => post(`/posts/admin/${id}/reject`, { note, version }),

  // Notices
  getNotices: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && q.append(k, v));
    return get(`/notices/admin/all?${q}`);
  },
  createNotice: (data) => post("/notices", data),
  updateNotice: (id, data) => patch(`/notices/${id}`, data),

  // FAQs
  getFaqsAdmin: () => get("/faqs/admin/all"),
  createFaq: (data) => post("/faqs", data),
  updateFaq: (id, data) => patch(`/faqs/${id}`, data),
  deleteFaq: (id) => del(`/faqs/${id}`),
};

