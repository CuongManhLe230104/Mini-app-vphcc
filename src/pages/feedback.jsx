import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Header, Icon, Page, Text } from "zmp-ui";
import { api } from "../services/api";

/**
 * Giới hạn kỹ thuật ban đầu cho biểu mẫu Gửi góp ý — đặt thành hằng số để dễ điều chỉnh.
 */
export const FEEDBACK_FORM_LIMITS = {
  FULL_NAME_MIN: 2,
  FULL_NAME_MAX: 100,
  CONTENT_MIN: 10,
  CONTENT_MAX: 3000,
};

function createSubmissionKey() {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}_${Math.random().toString(36).slice(2, 12)}`;
  return `fb_${rand}`.slice(0, 64);
}

function isValidVietnamesePhoneInput(raw) {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/[\s.\-()]/g, "");
  if (!cleaned) return false;
  const normalized = cleaned.startsWith("+84") ? "0" + cleaned.slice(3) : cleaned;
  return /^0[35789]\d{8}$/.test(normalized) || /^02\d{8,9}$/.test(normalized);
}

function validateFeedbackForm(values) {
  const errors = {};
  const trimmedName = String(values.fullName ?? "").trim().replace(/\s+/g, " ");
  const trimmedPhone = String(values.phone ?? "").trim();
  const trimmedContent = String(values.content ?? "").replace(/\r\n/g, "\n").trim();

  if (!trimmedName) {
    errors.fullName = "Vui lòng nhập họ và tên.";
  } else if (
    trimmedName.length < FEEDBACK_FORM_LIMITS.FULL_NAME_MIN ||
    trimmedName.length > FEEDBACK_FORM_LIMITS.FULL_NAME_MAX
  ) {
    errors.fullName = `Họ và tên cần từ ${FEEDBACK_FORM_LIMITS.FULL_NAME_MIN} đến ${FEEDBACK_FORM_LIMITS.FULL_NAME_MAX} ký tự.`;
  } else if (!/\p{L}/u.test(trimmedName)) {
    errors.fullName = "Họ và tên phải chứa chữ cái hợp lệ.";
  }

  if (!trimmedPhone) {
    errors.phone = "Vui lòng nhập số điện thoại.";
  } else if (!isValidVietnamesePhoneInput(trimmedPhone)) {
    errors.phone = "Số điện thoại không đúng định dạng Việt Nam (bắt đầu bằng 0 hoặc +84).";
  }

  if (!trimmedContent) {
    errors.content = "Vui lòng nhập nội dung góp ý.";
  } else if (
    trimmedContent.length < FEEDBACK_FORM_LIMITS.CONTENT_MIN ||
    trimmedContent.length > FEEDBACK_FORM_LIMITS.CONTENT_MAX
  ) {
    errors.content = `Nội dung góp ý cần từ ${FEEDBACK_FORM_LIMITS.CONTENT_MIN} đến ${FEEDBACK_FORM_LIMITS.CONTENT_MAX} ký tự.`;
  }

  return errors;
}

export default function FeedbackPage() {
  const navigate = useNavigate();

  // Không tự lấy thông tin từ Zalo và không lưu dữ liệu cá nhân vào bộ nhớ lâu dài trên thiết bị
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    content: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [copied, setCopied] = useState(false);

  const idemKeyRef = useRef(createSubmissionKey());

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    idemKeyRef.current = createSubmissionKey();
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (submitError) setSubmitError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const errors = validateFeedbackForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitError("");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setFieldErrors({});

    try {
      const response = await api.post(
        "/feedback",
        {
          fullName: form.fullName,
          phone: form.phone,
          content: form.content,
        },
        {
          headers: {
            "Idempotency-Key": idemKeyRef.current,
          },
        },
      );

      if (!response?.code) {
        throw new Error("Máy chủ chưa xác nhận mã tiếp nhận. Vui lòng thử lại.");
      }

      setReceipt({
        code: response.code,
        createdAt: response.createdAt,
      });
    } catch (err) {
      if (err?.code === "IDEMPOTENCY_PAYLOAD_MISMATCH") {
        idemKeyRef.current = createSubmissionKey();
      }
      if (err?.field && ["fullName", "phone", "content"].includes(err.field)) {
        setFieldErrors({ [err.field]: err.message || "Thông tin chưa hợp lệ." });
      } else if (err?.code === "OFFLINE") {
        setSubmitError("Không có kết nối mạng. Nội dung của bạn vẫn được giữ nguyên, vui lòng kiểm tra mạng và thử lại.");
      } else {
        setSubmitError(err?.message || "Chưa thể gửi góp ý lúc này. Nội dung của bạn vẫn được giữ nguyên, vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetNew = () => {
    setReceipt(null);
    setCopied(false);
    setForm({
      fullName: "",
      phone: "",
      content: "",
    });
    setFieldErrors({});
    setSubmitError("");
    idemKeyRef.current = createSubmissionKey();
  };

  const handleCopyCode = async () => {
    if (!receipt?.code) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(receipt.code);
        setCopied(true);
      }
    } catch {
      // Bỏ qua nếu thiết bị hạn chế quyền clipboard
    }
  };

  const trimmedContentLen = form.content.replace(/\r\n/g, "\n").trim().length;

  return (
    <Page className="bg-gray-50 page-with-header">
      <Header title="Gửi góp ý" showBackIcon />

      <div className="px-4 pt-4 pb-10">
        {receipt ? (
          <Box className="bg-white rounded-2xl p-5 shadow-sm border border-green-200 space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
              <Icon icon="zi-check-circle" size={32} />
            </div>

            <div className="space-y-2 text-center">
              <Text className="text-gray-900 font-bold text-lg leading-snug">
                Trung tâm đã tiếp nhận góp ý của bạn.
              </Text>

              <div className="py-3 px-4 bg-blue-50 border border-blue-200 rounded-xl">
                <Text className="text-gray-700 text-base">
                  Mã góp ý:{" "}
                  <strong className="font-mono text-lg text-blue-700">{receipt.code}</strong>
                </Text>
              </div>

              <Text className="text-gray-700 text-base leading-relaxed">
                Vui lòng lưu mã này để tiện liên hệ với trung tâm.
              </Text>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="w-full min-h-[46px] bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-semibold text-base active:opacity-80"
              >
                {copied ? "Đã sao chép mã góp ý" : "Sao chép mã góp ý"}
              </button>

              <button
                type="button"
                onClick={handleResetNew}
                className="w-full min-h-[46px] bg-gray-100 text-gray-800 rounded-xl font-semibold text-base active:opacity-80"
              >
                Gửi góp ý khác
              </button>

              <button
                type="button"
                onClick={() => navigate("/")}
                className="w-full min-h-[46px] bg-blue-600 text-white rounded-xl font-bold text-base active:opacity-80"
              >
                Quay về Trang chủ
              </button>
            </div>
          </Box>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div>
                <Text className="text-gray-900 font-bold text-lg leading-snug">
                  Gửi góp ý đến Trung tâm
                </Text>
                <Text className="text-gray-600 text-base mt-1 leading-relaxed">
                  Mọi ý kiến đóng góp về hoạt động phục vụ của Trung tâm, tiện ích trên Mini App hoặc các vấn đề khác sẽ được cán bộ, chuyên viên tiếp nhận để rà soát và hoàn thiện.
                </Text>
              </div>

              {/* Họ và tên */}
              <div>
                <label htmlFor="fb-fullname" className="block text-base font-semibold text-gray-800 mb-1.5">
                  Họ và tên <span className="text-red-600">*</span>
                </label>
                <input
                  id="fb-fullname"
                  type="text"
                  maxLength={120}
                  value={form.fullName}
                  disabled={submitting}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  placeholder="Nhập họ và tên của bạn"
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  className={`w-full min-h-[48px] px-3.5 py-2.5 border rounded-xl text-base bg-white outline-none ${
                    fieldErrors.fullName ? "border-red-500 bg-red-50/30" : "border-gray-300 focus:border-blue-600"
                  }`}
                />
                {fieldErrors.fullName && (
                  <p role="alert" className="text-red-600 text-sm mt-1.5">
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>

              {/* Số điện thoại */}
              <div>
                <label htmlFor="fb-phone" className="block text-base font-semibold text-gray-800 mb-1.5">
                  Số điện thoại <span className="text-red-600">*</span>
                </label>
                <input
                  id="fb-phone"
                  type="tel"
                  inputMode="tel"
                  maxLength={20}
                  value={form.phone}
                  disabled={submitting}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="VD: 0912345678 hoặc +84912345678"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className={`w-full min-h-[48px] px-3.5 py-2.5 border rounded-xl text-base bg-white outline-none ${
                    fieldErrors.phone ? "border-red-500 bg-red-50/30" : "border-gray-300 focus:border-blue-600"
                  }`}
                />
                {fieldErrors.phone && (
                  <p role="alert" className="text-red-600 text-sm mt-1.5">
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              {/* Nội dung */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="fb-content" className="text-base font-semibold text-gray-800">
                    Nội dung góp ý <span className="text-red-600">*</span>
                  </label>
                  <span className="text-xs text-gray-500">
                    {trimmedContentLen}/{FEEDBACK_FORM_LIMITS.CONTENT_MAX}
                  </span>
                </div>
                <textarea
                  id="fb-content"
                  rows={5}
                  maxLength={FEEDBACK_FORM_LIMITS.CONTENT_MAX + 50}
                  value={form.content}
                  disabled={submitting}
                  onChange={(e) => updateField("content", e.target.value)}
                  placeholder="Nhập nội dung góp ý chi tiết (tối thiểu 10 ký tự)..."
                  aria-invalid={Boolean(fieldErrors.content)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-base bg-white outline-none leading-relaxed ${
                    fieldErrors.content ? "border-red-500 bg-red-50/30" : "border-gray-300 focus:border-blue-600"
                  }`}
                />
                {fieldErrors.content && (
                  <p role="alert" className="text-red-600 text-sm mt-1.5">
                    {fieldErrors.content}
                  </p>
                )}
              </div>

              {/* Thông báo mục đích thu thập trước khi gửi */}
              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5">
                <Icon icon="zi-info-circle" className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                <Text className="text-blue-900 text-sm leading-relaxed">
                  Họ tên và số điện thoại được dùng để tiếp nhận, xử lý và liên hệ phản hồi góp ý. Thông tin chỉ được cung cấp cho cán bộ có quyền xử lý, không hiển thị công khai.
                </Text>
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5"
                >
                  <Icon icon="zi-warning-circle" className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                  <Text className="text-red-800 text-sm leading-relaxed">{submitError}</Text>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[50px] bg-blue-600 disabled:bg-blue-400 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 active:opacity-85"
              >
                <Icon icon="zi-send-solid" size={18} />
                <span>{submitting ? "Đang gửi góp ý..." : "Gửi góp ý"}</span>
              </button>
            </Box>
          </form>
        )}
      </div>
    </Page>
  );
}
