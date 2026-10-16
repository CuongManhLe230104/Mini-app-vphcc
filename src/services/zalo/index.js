/**
 * services/zalo/index.js
 *
 * Đóng gói toàn bộ zmp-sdk.
 * Màn hình không gọi zmp-sdk trực tiếp — dùng qua đây.
 *
 * Quy tắc:
 * - Phân biệt môi trường browser (dev) và Zalo thật
 * - Xử lý luồng khi người dùng từ chối quyền
 * - Không dùng Zalo user ID do client tự gửi làm bằng chứng xác thực
 * - Khóa bí mật chỉ nằm ở backend
 */

import {
  getAccessToken,
  getUserInfo,
  getPhoneNumber,
  getSetting,
  authorize,
  followOA,
  openChat,
  openPhone,
  openWebview,
  openMediaPicker,
  getSystemInfo,
} from "zmp-sdk";

/** Lấy access token để backend xác minh */
export async function getZaloAccessToken() {
  try {
    return await getAccessToken({});
  } catch (err) {
    console.error("[zalo] getAccessToken failed");
    throw err;
  }
}

/** Lấy thông tin người dùng — chỉ khi thực sự cần */
export async function getZaloUserInfo() {
  try {
    return await getUserInfo({});
  } catch (err) {
    console.error("[zalo] getUserInfo failed");
    throw err;
  }
}

/** Lấy số điện thoại — token xử lý ở backend, không lộ client */
export async function getZaloPhoneNumber() {
  try {
    const { token } = await getPhoneNumber({});
    return token; // gửi token về backend để backend giải mã
  } catch (err) {
    console.error("[zalo] getPhoneNumber failed");
    throw err;
  }
}

/** Xin quyền — có luồng xử lý khi từ chối */
export async function requestPermission(permissions) {
  try {
    const settings = await getSetting({});
    const missing = permissions.filter((p) => !settings.authSetting[p]);
    if (missing.length > 0) {
      await authorize({ scopes: missing });
    }
  } catch (err) {
    console.warn("[zalo] authorize failed or denied");
    throw err;
  }
}

/** Quan tâm OA — khi người dân chủ động bấm */
export async function followZaloOA(oaId) {
  if (!oaId) throw new Error("Kênh Zalo OA chưa được cấu hình");
  try {
    await followOA({ id: oaId });
  } catch (err) {
    console.error("[zalo] followOA failed");
    throw err;
  }
}

/** Mở chat với OA chính thức */
export async function openZaloChat(oaId) {
  if (!oaId) throw new Error("Kênh Zalo OA chưa được cấu hình");
  return openChat({ type: "oa", id: oaId });
}

/** Gọi điện hotline đã xác nhận */
export async function callHotline(phoneNumber) {
  const normalized = String(phoneNumber ?? "").replace(/[\s().-]/g, "");
  if (!/^\+?\d{8,15}$/.test(normalized)) throw new Error("Số hotline chưa được cấu hình chính thức");
  phoneNumber = normalized;
  return openPhone({ phoneNumber });
}

/** Mở webview cổng dịch vụ công chính thức */
export async function openServicePortal(url) {
  if (!url || !/^https:\/\//i.test(url)) throw new Error("Đường dẫn dịch vụ chưa được cấu hình hợp lệ");
  return openWebview({ url });
}

/** Chọn ảnh — tệp lưu qua backend riêng */
export async function pickMedia(config = {}) {
  try {
    return await openMediaPicker(config);
  } catch (err) {
    console.error("[zalo] openMediaPicker failed");
    throw err;
  }
}

/** Lấy theme Zalo để đồng bộ giao diện */
export function getZaloTheme() {
  return getSystemInfo().zaloTheme;
}

