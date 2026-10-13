/**
 * services/api/index.js
 *
 * Lớp gọi API tập trung.
 * Tất cả màn hình gọi qua đây — không fetch rải rác trong component.
 *
 * Quy tắc:
 * - Xử lý lỗi mạng thống nhất
 * - Xử lý phiên đăng nhập (401) thống nhất
 * - Không để secrets ở đây — dùng biến môi trường
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw { status: res.status, ...error };
    }

    return res.json();
  } catch (err) {
    if (!navigator.onLine) {
      throw { code: "OFFLINE", message: "Không có kết nối mạng" };
    }
    throw err;
  }
}

export const api = {
  get: (path, options) => request(path, { method: "GET", ...options }),
  post: (path, body, options) =>
    request(path, {
      method: "POST",
      body: JSON.stringify(body),
      ...options,
    }),
};

