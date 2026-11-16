import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Header, Icon, Page, Text, useSnackbar } from "zmp-ui";
import RemoteState from "../components/remote-state";
import { useApiResource } from "../components/use-api-resource";
import { api } from "../services/api";
import { getZaloAccessToken } from "../services/zalo";

const SAVED_CODES_KEY = "nt_queue_lookup_codes";
const CITIZEN_JWT_KEY = "nt_citizen_jwt";
const CITIZEN_SESSION_KEY = "nt_citizen_session_key";

const UNIFIED_STATUS_STYLE = {
  BOOKED: { label: "Đã đặt lịch", cls: "bg-blue-100 text-blue-800" },
  CALLING: { label: "Đang gọi — Mời đến quầy!", cls: "bg-green-100 text-green-800" },
  SERVING: { label: "Đang tiếp nhận", cls: "bg-emerald-100 text-emerald-800" },
  COMPLETED: { label: "Hoàn tất", cls: "bg-gray-100 text-gray-700" },
  CANCELLED: { label: "Đã hủy", cls: "bg-red-100 text-red-700" },
  NO_SHOW: { label: "Vắng mặt", cls: "bg-amber-100 text-amber-800" },
  UNSERVED_PAST_SLOT: { label: "Chưa được phục vụ (chờ gọi)", cls: "bg-amber-100 text-amber-900" },
};

const WEEKDAY_NAMES = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function getStatusBadge(item) {
  const key = item?.unifiedStatus || (item?.status === "CONFIRMED" ? "BOOKED" : item?.status);
  return UNIFIED_STATUS_STYLE[key] || {
    label: item?.unifiedStatusLabel || item?.status || "Đã đặt lịch",
    cls: "bg-blue-100 text-blue-800",
  };
}

function formatSlotDisplay(slot, slotMinutes = 30) {
  if (!slot) return "";
  const [h, m] = String(slot).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return slot;
  const total = h * 60 + m + (slotMinutes || 30);
  const eh = String(Math.floor(total / 60)).padStart(2, "0");
  const em = String(total % 60).padStart(2, "0");
  return `${slot} – ${eh}:${em}`;
}

function makeIdemKey(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadSavedCodes() {
  try {
    const raw = localStorage.getItem(SAVED_CODES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

function saveLookupCode(code) {
  if (!code) return;
  try {
    const next = [code, ...loadSavedCodes().filter(c => c !== code)].slice(0, 10);
    localStorage.setItem(SAVED_CODES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

function getOrCreateCitizenSessionKey() {
  try {
    const existing = localStorage.getItem(CITIZEN_SESSION_KEY);
    if (existing && /^[a-zA-Z0-9_-]{16,64}$/.test(existing)) return existing;
    const randomPart =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().replace(/-/g, "")
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}_${Math.random().toString(36).slice(2, 12)}`;
    const generated = `cs_${randomPart}`.slice(0, 48);
    localStorage.setItem(CITIZEN_SESSION_KEY, generated);
    return generated;
  } catch {
    return `cs_mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

async function ensureCitizenAuthHeader(forceFallback = false) {
  if (!forceFallback) {
    try {
      const cached = sessionStorage.getItem(CITIZEN_JWT_KEY);
      if (cached) return `Bearer ${cached}`;
    } catch {
      // ignore sessionStorage error
    }
    try {
      const zaloToken = await getZaloAccessToken();
      if (zaloToken && zaloToken !== "DEFAULT ACCESS TOKEN") {
        const authRes = await api.post("/auth/zalo", { accessToken: zaloToken });
        if (authRes?.accessToken) {
          try {
            sessionStorage.setItem(CITIZEN_JWT_KEY, authRes.accessToken);
          } catch {
            // ignore sessionStorage error
          }
          return `Bearer ${authRes.accessToken}`;
        }
      }
    } catch {
      // Khi chạy trên Zalo Studio Simulator, trình duyệt, hoặc người dùng chưa cấp quyền Graph API,
      // chuyển sang phiên thiết bị ổn định để người dân vẫn đặt lịch bằng Họ tên + SĐT ở Bước 3.
    }
  }
  return `CitizenSession ${getOrCreateCitizenSessionKey()}`;
}

async function authedRequest(method, path, body, headers = {}) {
  let authHeader = await ensureCitizenAuthHeader(false);
  try {
    return method === "GET"
      ? await api.get(path, { headers: { ...headers, Authorization: authHeader } })
      : await api.post(path, body, { headers: { ...headers, Authorization: authHeader } });
  } catch (err) {
    if (err?.status === 401) {
      try {
        sessionStorage.removeItem(CITIZEN_JWT_KEY);
      } catch {
        // ignore
      }
      authHeader = await ensureCitizenAuthHeader(true);
      return method === "GET"
        ? await api.get(path, { headers: { ...headers, Authorization: authHeader } })
        : await api.post(path, body, { headers: { ...headers, Authorization: authHeader } });
    }
    throw err;
  }
}

function normalizeTabParam(rawTab) {
  if (rawTab === "lookup" || rawTab === "mine" || rawTab === "history") return "mine";
  // Cả ?tab=ticket, ?tab=appointment hoặc mặc định đều dẫn vào cùng 1 luồng Đặt lịch đến Trung tâm (Mục 6.1 & 12.2)
  return "book";
}

export default function QueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { openSnackbar } = useSnackbar();

  const [tab, setTab] = useState(() => normalizeTabParam(searchParams.get("tab")));
  const [step, setStep] = useState(1); // 1: Chọn nhu cầu | 2: Chọn lịch | 3: Xác nhận

  const catalogRes = useApiResource("/queue/catalog");
  const counters = catalogRes.data?.counters || [];

  // Danh sách tất cả lĩnh vực đã được gán vào quầy đang hoạt động
  const allFields = useMemo(() => {
    const list = [];
    for (const c of counters) {
      for (const f of c.fields || []) {
        list.push({ ...f, counter: c });
      }
    }
    return list;
  }, [counters]);

  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [selectedProcedureId, setSelectedProcedureId] = useState("");

  useEffect(() => {
    setTab(normalizeTabParam(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    if (allFields.length === 0) return;
    const paramField = searchParams.get("field");
    if (paramField) {
      const matched = allFields.find(f => f.id === paramField || f.slug === paramField);
      if (matched) {
        setSelectedFieldId(matched.id);
        return;
      }
    }
    if (!selectedFieldId || !allFields.some(f => f.id === selectedFieldId)) {
      setSelectedFieldId(allFields[0].id);
    }
  }, [allFields, searchParams, selectedFieldId]);

  const selectedField = useMemo(
    () => allFields.find(f => f.id === selectedFieldId) || null,
    [allFields, selectedFieldId],
  );
  const selectedCounter = selectedField?.counter || null;
  const selectedProcedure = useMemo(
    () => (selectedField?.procedures || []).find(p => p.id === selectedProcedureId) || null,
    [selectedField, selectedProcedureId],
  );

  // ───────── Luồng thống nhất: Đặt lịch đến Trung tâm & Nhận số gọi ngay ─────────
  const [availability, setAvailability] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookedAppt, setBookedAppt] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const apptIdemRef = useRef(makeIdemKey("apt"));

  const loadAvailability = useCallback(async (fid) => {
    if (!fid) return;
    setAvailLoading(true);
    setAvailError("");
    try {
      const data = await api.get(`/queue/availability?fieldId=${encodeURIComponent(fid)}`);
      setAvailability(data);
      const firstOpenDay = (data.days || []).find(d => !d.closed && (d.slots || []).some(s => s.available));
      setSelectedDate(firstOpenDay?.date || data.days?.[0]?.date || "");
      setSelectedSlot("");
    } catch (err) {
      setAvailability(null);
      setAvailError(err?.message || "Chưa tải được lịch trống của lĩnh vực này");
    } finally {
      setAvailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "book" && selectedFieldId) {
      loadAvailability(selectedFieldId);
    }
  }, [tab, selectedFieldId, loadAvailability]);

  const currentDayObj = useMemo(
    () => (availability?.days || []).find(d => d.date === selectedDate) || null,
    [availability, selectedDate],
  );

  const slotMinutes = availability?.slotMinutes || selectedCounter?.bookingConfig?.slotMinutes || 30;

  const handleConfirmBooking = async () => {
    if (!selectedFieldId || !selectedDate || !selectedSlot) return;
    setBookingBusy(true);
    try {
      if (rescheduleTarget) {
        const res = await authedRequest(
          "POST",
          `/queue/appointments/${rescheduleTarget.id}/reschedule`,
          { date: selectedDate, slot: selectedSlot },
          { "Idempotency-Key": apptIdemRef.current },
        );
        setBookedAppt({
          ...res,
          fieldLabel: res.fieldLabel || selectedField?.label,
          procedureName: res.procedureName || selectedProcedure?.name || null,
        });
        setRescheduleTarget(null);
        saveLookupCode(res.lookupCode);
        if (res.ticket?.lookupCode) saveLookupCode(res.ticket.lookupCode);
        apptIdemRef.current = makeIdemKey("apt");
        openSnackbar({ text: "Đã đổi lịch và cấp số gọi mới thành công!", type: "success" });
      } else {
        const res = await authedRequest(
          "POST",
          "/queue/appointments",
          {
            fieldId: selectedFieldId,
            procedureId: selectedProcedureId || undefined,
            date: selectedDate,
            slot: selectedSlot,
            contactName: contactName.trim(),
            contactPhone: contactPhone.trim() || undefined,
          },
          { "Idempotency-Key": apptIdemRef.current },
        );
        setBookedAppt({
          ...res,
          fieldLabel: res.fieldLabel || selectedField?.label,
          procedureName: res.procedureName || selectedProcedure?.name || null,
        });
        saveLookupCode(res.lookupCode);
        if (res.ticket?.lookupCode) saveLookupCode(res.ticket.lookupCode);
        apptIdemRef.current = makeIdemKey("apt");
        openSnackbar({
          text: `Đặt lịch thành công! Số gọi của bạn: ${res.displayNumber || res.ticket?.displayNumber || ""}`,
          type: "success",
        });
      }
      setStep(1);
      loadAvailability(selectedFieldId);
      catalogRes.reload();
    } catch (err) {
      openSnackbar({ text: err?.message || "Không thể đặt lịch lúc này", type: "error" });
    } finally {
      setBookingBusy(false);
    }
  };

  // ───────── Màn hình "Lịch hẹn của tôi" (Sắp tới / Lịch sử / Tra cứu mã) ─────────
  const [mineSection, setMineSection] = useState("upcoming"); // "upcoming" | "history"
  const [lookupCodeInput, setLookupCodeInput] = useState("");
  const [lookupData, setLookupData] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupErr, setLookupErr] = useState("");
  const [savedCodes, setSavedCodes] = useState(() => loadSavedCodes());
  const [myItems, setMyItems] = useState(null);
  const [myLoading, setMyLoading] = useState(false);

  const runCodeLookup = useCallback(async (code) => {
    const cleaned = String(code || "").trim().toUpperCase();
    if (!cleaned) return;
    setLookupCodeInput(cleaned);
    setLookupLoading(true);
    setLookupErr("");
    try {
      const res = await api.get(`/queue/lookup/${encodeURIComponent(cleaned)}`);
      setLookupData(res);
      saveLookupCode(cleaned);
      setSavedCodes(loadSavedCodes());
    } catch (err) {
      setLookupData(null);
      setLookupErr(err?.message || "Không tìm thấy thông tin với mã này");
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const loadMyItems = useCallback(async () => {
    setMyLoading(true);
    try {
      const res = await authedRequest("GET", "/queue/mine");
      setMyItems(res);
    } catch {
      setMyItems(null);
    } finally {
      setMyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "mine") {
      setSavedCodes(loadSavedCodes());
      loadMyItems();
    }
  }, [tab, loadMyItems]);

  const handleCancelMyAppointment = async (appointmentId) => {
    try {
      await authedRequest("POST", `/queue/appointments/${appointmentId}/cancel`, {
        reason: "Người dân chủ động hủy trước giờ hẹn trên Mini App",
      });
      openSnackbar({ text: "Đã hủy lịch hẹn và giải phóng chỗ trống", type: "success" });
      if (bookedAppt?.id === appointmentId) {
        setBookedAppt(null);
      }
      loadMyItems();
      if (selectedFieldId) loadAvailability(selectedFieldId);
      catalogRes.reload();
    } catch (err) {
      openSnackbar({ text: err?.message || "Không thể hủy lịch hẹn", type: "error" });
    }
  };

  const switchTab = (nextTab) => {
    const normalized = normalizeTabParam(nextTab);
    setTab(normalized);
    setSearchParams({ tab: normalized }, { replace: true });
  };

  const upcomingList = useMemo(() => {
    if (!myItems) return [];
    if (Array.isArray(myItems.upcomingAppointments)) return myItems.upcomingAppointments;
    return (myItems.appointments || []).filter(a => a.status === "CONFIRMED" || a.status === "CHECKED_IN");
  }, [myItems]);

  const historyList = useMemo(() => {
    if (!myItems) return [];
    if (Array.isArray(myItems.historyAppointments)) return myItems.historyAppointments;
    return (myItems.appointments || []).filter(a => a.status !== "CONFIRMED" && a.status !== "CHECKED_IN");
  }, [myItems]);

  return (
    <Page className="bg-gray-50 page-with-header">
      <Header title="Đặt lịch đến Trung tâm" showBackIcon />

      <div className="pb-24 pt-3">
        {/* Thanh chuyển 2 Tab chính: Đặt lịch đến Trung tâm & Lịch hẹn của tôi */}
        <div className="mx-4 mb-4 grid grid-cols-2 gap-2 bg-white p-1.5 rounded-xl shadow-sm">
          {[
            { id: "book", label: "Đặt lịch đến Trung tâm", icon: "zi-calendar" },
            { id: "mine", label: "Lịch hẹn của tôi", icon: "zi-list-1" },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => switchTab(item.id)}
              className={`min-h-[44px] py-2 px-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                tab === item.id ? "bg-blue-600 text-white" : "text-gray-600"
              }`}
            >
              <Icon icon={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Trạng thái tải danh mục quầy */}
        {tab === "book" && (catalogRes.loading || catalogRes.error) ? (
          <RemoteState loading={catalogRes.loading} error={catalogRes.error} reload={catalogRes.reload} />
        ) : null}

        {tab === "book" && !catalogRes.loading && !catalogRes.error && allFields.length === 0 && (
          <Box className="mx-4 bg-white rounded-2xl p-5 shadow-sm text-base text-gray-700" role="status">
            <Text className="font-bold text-gray-900 text-base mb-1">
              Lịch phục vụ trực tuyến đang được cập nhật
            </Text>
            <Text className="text-base text-gray-600">
              Trung tâm đang cập nhật cấu hình quầy phục vụ và khung giờ làm việc. Bạn có thể chuyển sang mục{" "}
              <button className="text-blue-600 font-semibold underline" onClick={() => switchTab("mine")}>
                Lịch hẹn của tôi
              </button>{" "}
              để xem hoặc tra cứu lịch hẹn đã đặt.
            </Text>
          </Box>
        )}

        {/* ══════════════════ TAB 1: ĐẶT LỊCH ĐẾN TRUNG TÂM (LUỒNG 3 BƯỚC + CẤP SỐ NGAY) ══════════════════ */}
        {tab === "book" && !catalogRes.loading && !catalogRes.error && allFields.length > 0 && (
          <div className="space-y-4 px-4">
            {bookedAppt ? (
              /* ───────── PHIẾU XÁC NHẬN ĐẶT LỊCH & SỐ GỌI ĐÃ CẤP (MỤC 6.3) ───────── */
              <Box className="bg-white rounded-2xl p-5 shadow-sm border border-green-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-800">
                    <Icon icon="zi-check-circle" size={14} />
                    Đặt lịch thành công
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getStatusBadge(bookedAppt).cls}`}>
                    {getStatusBadge(bookedAppt).label}
                  </span>
                </div>

                {/* Số gọi được cấp ngay & Mã lịch hẹn */}
                <div className="text-center py-4 px-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Số gọi tại quầy đã được cấp
                  </Text>
                  <div className="text-4xl font-extrabold text-blue-700 my-1">
                    {bookedAppt.displayNumber || bookedAppt.ticket?.displayNumber || "Đang cấp"}
                  </div>
                  <Text className="text-base font-bold text-gray-900">
                    Quầy {bookedAppt.counter?.code} — {bookedAppt.counter?.name}
                  </Text>
                  <div className="mt-2 inline-block bg-white px-3 py-1 rounded-lg border border-blue-200 text-xs text-gray-600">
                    Mã hẹn: <strong className="font-mono text-sm text-gray-900">{bookedAppt.lookupCode}</strong>
                  </div>
                </div>

                {/* Thông tin chi tiết của phiếu xác nhận */}
                <div className="space-y-2 text-base text-gray-700 bg-gray-50 p-4 rounded-xl">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Ngày & Khung giờ:</span>
                    <strong className="text-right text-gray-900">
                      {bookedAppt.serviceDate} • {bookedAppt.slotRange || formatSlotDisplay(bookedAppt.slot, slotMinutes)}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Quầy phục vụ:</span>
                    <strong className="text-right text-gray-900">
                      Quầy {bookedAppt.counter?.code} ({bookedAppt.counter?.name})
                    </strong>
                  </div>
                  {bookedAppt.fieldLabel && (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Lĩnh vực:</span>
                      <strong className="text-right text-gray-900">{bookedAppt.fieldLabel}</strong>
                    </div>
                  )}
                  {bookedAppt.procedureName && (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Thủ tục:</span>
                      <strong className="text-right text-gray-900">{bookedAppt.procedureName}</strong>
                    </div>
                  )}
                  {bookedAppt.contactName && (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Người đặt lịch:</span>
                      <strong className="text-right text-gray-900">{bookedAppt.contactName}</strong>
                    </div>
                  )}
                </div>

                {/* Hướng dẫn chuẩn Mục 6.3: Không bấm xác nhận có mặt, không lấy số lần hai */}
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900 space-y-1">
                  <div className="font-bold">📌 Hướng dẫn khi đến Trung tâm:</div>
                  <div>
                    <strong>Đến đúng khung giờ, trình phiếu tại quầy và chờ gọi số.</strong>
                  </div>
                  <div className="text-xs text-blue-800">
                    Bạn đã có sẵn số gọi <strong>{bookedAppt.displayNumber || bookedAppt.ticket?.displayNumber}</strong>, không cần lấy số lại hoặc bấm check-in khi tới Trung tâm.
                  </div>
                </div>

                {/* Các nút thao tác trên phiếu xác nhận */}
                <div className="space-y-2">
                  <button
                    className="w-full min-h-[44px] bg-blue-600 text-white rounded-xl font-semibold text-base"
                    onClick={() => switchTab("mine")}
                  >
                    Xem trong &ldquo;Lịch hẹn của tôi&rdquo;
                  </button>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 min-h-[44px] bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm"
                      onClick={() => {
                        setRescheduleTarget(bookedAppt);
                        setBookedAppt(null);
                        setStep(2);
                      }}
                    >
                      Đổi khung giờ khác
                    </button>
                    {bookedAppt.status === "CONFIRMED" && (
                      <button
                        className="min-h-[44px] px-4 bg-red-50 text-red-600 rounded-xl font-semibold text-sm"
                        onClick={() => handleCancelMyAppointment(bookedAppt.id)}
                      >
                        Hủy lịch
                      </button>
                    )}
                  </div>
                  <button
                    className="w-full min-h-[44px] text-blue-600 font-semibold text-sm underline"
                    onClick={() => {
                      setBookedAppt(null);
                      setStep(1);
                    }}
                  >
                    + Đặt thêm lịch hẹn mới
                  </button>
                </div>
              </Box>
            ) : (
              <>
                {rescheduleTarget && (
                  <Box className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between text-sm text-amber-900">
                    <span>
                      Đang đổi lịch cho số <strong>{rescheduleTarget.displayNumber || rescheduleTarget.lookupCode}</strong> (
                      {rescheduleTarget.serviceDate} • {rescheduleTarget.slot})
                    </span>
                    <button
                      className="underline font-semibold ml-2"
                      onClick={() => {
                        setRescheduleTarget(null);
                        setStep(1);
                      }}
                    >
                      Hủy đổi
                    </button>
                  </Box>
                )}

                {/* Thanh tiến trình 3 bước */}
                <div className="bg-white rounded-2xl p-3 shadow-sm grid grid-cols-3 gap-2 text-center">
                  {[
                    { id: 1, title: "Bước 1", sub: "Chọn nhu cầu" },
                    { id: 2, title: "Bước 2", sub: "Chọn lịch" },
                    { id: 3, title: "Bước 3", sub: "Xác nhận" },
                  ].map(s => {
                    const active = step === s.id;
                    const done = step > s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={s.id > step}
                        onClick={() => s.id < step && setStep(s.id)}
                        className={`py-2 px-1 rounded-xl border text-xs transition-colors ${
                          active
                            ? "bg-blue-600 text-white border-blue-600 font-bold"
                            : done
                            ? "bg-blue-50 text-blue-700 border-blue-200 font-semibold"
                            : "bg-gray-50 text-gray-400 border-gray-100"
                        }`}
                      >
                        <div>{s.title}</div>
                        <div className="text-[11px] truncate">{s.sub}</div>
                      </button>
                    );
                  })}
                </div>

                {/* ───────── BƯỚC 1: CHỌN NHU CẦU (MỤC 6.2) ───────── */}
                {step === 1 && (
                  <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
                    <Text className="font-bold text-gray-900 text-base">
                      Bước 1 — Chọn nhu cầu giải quyết thủ tục
                    </Text>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lĩnh vực cần giải quyết *
                      </label>
                      <select
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-200 rounded-xl text-base bg-white"
                        value={selectedFieldId}
                        disabled={Boolean(rescheduleTarget)}
                        onChange={e => {
                          setSelectedFieldId(e.target.value);
                          setSelectedProcedureId("");
                          apptIdemRef.current = makeIdemKey("apt");
                        }}
                      >
                        {allFields.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.label} — Quầy {f.counter.code}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedField?.procedures?.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Thủ tục cụ thể (nếu biết — không bắt buộc)
                        </label>
                        <select
                          className="w-full min-h-[44px] px-3 py-2 border border-gray-200 rounded-xl text-base bg-white"
                          value={selectedProcedureId}
                          disabled={Boolean(rescheduleTarget)}
                          onChange={e => setSelectedProcedureId(e.target.value)}
                        >
                          <option value="">-- Chọn chung theo lĩnh vực --</option>
                          {selectedField.procedures.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Hệ thống tự xác định và hiển thị quầy dự kiến tương ứng */}
                    {selectedCounter && (
                      <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl space-y-1.5">
                        <div className="text-xs font-semibold text-blue-700 uppercase">
                          Quầy phục vụ tương ứng (tự động xác định)
                        </div>
                        <div className="font-bold text-blue-900 text-base">
                          Quầy {selectedCounter.code} — {selectedCounter.name}
                        </div>
                        <div className="text-xs text-blue-800">
                          ⏱ Thời lượng phục vụ dự kiến: <strong>{slotMinutes} phút/lượt</strong> • Cấp số gọi ngay khi đặt lịch thành công.
                        </div>
                        {selectedCounter.today && (
                          <div className="text-xs text-gray-600 pt-1 border-t border-blue-100 flex justify-between">
                            <span>
                              Đang gọi hôm nay:{" "}
                              <strong>
                                {selectedCounter.today.currentlyServing?.length > 0
                                  ? selectedCounter.today.currentlyServing.map(s => s.displayNumber).join(", ")
                                  : "Chưa gọi"}
                              </strong>
                            </span>
                            <span>
                              Đang chờ: <strong>{selectedCounter.today.waitingCount} lượt</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!selectedFieldId}
                      onClick={() => setStep(2)}
                      className="w-full min-h-[48px] bg-blue-600 disabled:bg-gray-300 text-white rounded-xl font-bold text-base shadow-sm"
                    >
                      Tiếp tục chọn ngày & khung giờ
                    </button>
                  </Box>
                )}

                {/* ───────── BƯỚC 2: CHỌN LỊCH (MỤC 6.2) ───────── */}
                {step === 2 && (
                  <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <Text className="font-bold text-gray-900 text-base">
                        Bước 2 — Chọn ngày & khung giờ
                      </Text>
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                        Quầy {selectedCounter?.code}
                      </span>
                    </div>

                    {availLoading || availError ? (
                      <RemoteState
                        loading={availLoading}
                        error={availError}
                        reload={() => loadAvailability(selectedFieldId)}
                      />
                    ) : availability ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Chọn ngày làm việc
                          </label>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {(availability.days || []).map(d => {
                              const hasSlot = !d.closed && (d.slots || []).some(s => s.available);
                              const active = d.date === selectedDate;
                              const wdName = WEEKDAY_NAMES[d.weekday] ?? "";
                              return (
                                <button
                                  key={d.date}
                                  type="button"
                                  disabled={!hasSlot}
                                  onClick={() => {
                                    setSelectedDate(d.date);
                                    setSelectedSlot("");
                                  }}
                                  className={`min-h-[52px] px-3 py-2 rounded-xl border text-left flex-shrink-0 ${
                                    active
                                      ? "bg-blue-600 text-white border-blue-600"
                                      : hasSlot
                                      ? "bg-white text-gray-800 border-gray-200"
                                      : "bg-gray-100 text-gray-400 border-gray-100"
                                  }`}
                                >
                                  <div className="text-xs font-bold">
                                    {wdName} ({d.date.slice(8, 10)}/{d.date.slice(5, 7)})
                                  </div>
                                  <div className="text-[11px]">
                                    {hasSlot ? `Còn ${d.remainingDayQuota ?? ""} lượt` : "Nghỉ / Đủ lượt"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {currentDayObj && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Chọn khung giờ còn nhận lịch ({slotMinutes} phút/lượt)
                            </label>
                            {currentDayObj.closed ? (
                              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                                {currentDayObj.closureNote || "Ngày nghỉ theo lịch làm việc"}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                {(currentDayObj.slots || []).map(s => (
                                  <button
                                    key={s.slot}
                                    type="button"
                                    disabled={!s.available}
                                    onClick={() => setSelectedSlot(s.slot)}
                                    className={`min-h-[48px] py-2 px-3 rounded-xl border text-left text-sm font-semibold transition-colors ${
                                      selectedSlot === s.slot
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : s.available
                                        ? "bg-white text-gray-800 border-gray-200"
                                        : "bg-gray-100 text-gray-400 border-gray-100 line-through"
                                    }`}
                                  >
                                    <div>{formatSlotDisplay(s.slot, slotMinutes)}</div>
                                    <div className="text-[11px] font-normal">
                                      {s.available ? `Còn ${s.remaining} chỗ` : "Đã qua / Hết chỗ"}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : null}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="min-h-[48px] px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold text-base"
                      >
                        Quay lại
                      </button>
                      <button
                        type="button"
                        disabled={!selectedDate || !selectedSlot}
                        onClick={() => setStep(3)}
                        className="flex-1 min-h-[48px] bg-blue-600 disabled:bg-gray-300 text-white rounded-xl font-bold text-base"
                      >
                        Tiếp tục xác nhận
                      </button>
                    </div>
                  </Box>
                )}

                {/* ───────── BƯỚC 3: XÁC NHẬN & NHẬN SỐ NGAY (MỤC 6.2) ───────── */}
                {step === 3 && (
                  <Box className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                    <Text className="font-bold text-gray-900 text-lg">
                      {rescheduleTarget ? "Bước 3 — Xác nhận đổi lịch hẹn" : "Bước 3 — Kiểm tra & Xác nhận đặt lịch"}
                    </Text>

                    <div className="space-y-2 text-base text-gray-700 bg-blue-50/70 border border-blue-100 p-4 rounded-xl">
                      <div>
                        Lĩnh vực: <strong>{selectedField?.label}</strong>
                      </div>
                      {selectedProcedure && (
                        <div>
                          Thủ tục: <strong>{selectedProcedure.name}</strong>
                        </div>
                      )}
                      <div>
                        Quầy phục vụ: <strong>Quầy {selectedCounter?.code} — {selectedCounter?.name}</strong>
                      </div>
                      <div>
                        Ngày hẹn: <strong>{selectedDate}</strong>
                      </div>
                      <div>
                        Khung giờ dự kiến: <strong>{formatSlotDisplay(selectedSlot, slotMinutes)}</strong>
                      </div>
                    </div>

                    {!rescheduleTarget && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Họ và tên người đến làm thủ tục *
                          </label>
                          <input
                            className="w-full min-h-[44px] px-3 py-2 border border-gray-200 rounded-xl text-base"
                            placeholder="Nhập họ và tên của bạn"
                            value={contactName}
                            onChange={e => setContactName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Số điện thoại liên hệ (không bắt buộc)
                          </label>
                          <input
                            type="tel"
                            className="w-full min-h-[44px] px-3 py-2 border border-gray-200 rounded-xl text-base"
                            placeholder="VD: 0912345678"
                            value={contactPhone}
                            onChange={e => setContactPhone(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600">
                      Hệ thống sẽ giữ khung giờ và <strong>cấp ngay số gọi tại quầy</strong> cho bạn. Khi đến Trung tâm đúng khung giờ đã chọn, bạn chỉ cần trình phiếu xác nhận và chờ gọi số.
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="min-h-[48px] px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold text-base"
                        onClick={() => setStep(2)}
                        disabled={bookingBusy}
                      >
                        Quay lại
                      </button>
                      <button
                        type="button"
                        className="flex-1 min-h-[48px] bg-blue-600 text-white rounded-xl font-bold text-base disabled:opacity-50"
                        onClick={handleConfirmBooking}
                        disabled={bookingBusy || (!rescheduleTarget && contactName.trim().length < 2)}
                      >
                        {bookingBusy ? "Đang cấp số..." : "Xác nhận & Nhận số ngay"}
                      </button>
                    </div>
                  </Box>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════ TAB 2: LỊCH HẸN CỦA TÔI (SẮP TỚI / LỊCH SỬ / TRA CỨU MÃ — MỤC 6.4) ══════════════════ */}
        {tab === "mine" && (
          <div className="space-y-4 px-4">
            {/* Nút chuyển Sắp tới / Lịch sử */}
            <div className="grid grid-cols-2 gap-2 bg-white p-1.5 rounded-xl shadow-sm">
              <button
                type="button"
                onClick={() => setMineSection("upcoming")}
                className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                  mineSection === "upcoming" ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-gray-600"
                }`}
              >
                Sắp tới ({upcomingList.length})
              </button>
              <button
                type="button"
                onClick={() => setMineSection("history")}
                className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                  mineSection === "history" ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-gray-600"
                }`}
              >
                Lịch sử ({historyList.length})
              </button>
            </div>

            {myLoading && <Text className="text-sm text-gray-500 px-1">Đang đồng bộ lịch hẹn của bạn...</Text>}

            {/* Danh sách Sắp tới hoặc Lịch sử */}
            <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <Text className="font-bold text-gray-800 text-base">
                {mineSection === "upcoming" ? "Lịch hẹn sắp tới của tôi" : "Lịch sử đặt lịch (Hoàn tất / Đã hủy / Vắng mặt)"}
              </Text>

              {(mineSection === "upcoming" ? upcomingList : historyList).length === 0 ? (
                <div className="py-4 text-center space-y-2">
                  <Text className="text-sm text-gray-500">
                    {mineSection === "upcoming"
                      ? "Bạn chưa có lịch hẹn nào sắp tới."
                      : "Chưa có lịch hẹn nào trong lịch sử."}
                  </Text>
                  {mineSection === "upcoming" && (
                    <button
                      type="button"
                      onClick={() => switchTab("book")}
                      className="min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold"
                    >
                      Đặt lịch đến Trung tâm ngay
                    </button>
                  )}
                </div>
              ) : (
                (mineSection === "upcoming" ? upcomingList : historyList).map(a => {
                  const badge = getStatusBadge(a);
                  const callNum = a.displayNumber || a.ticket?.displayNumber;
                  return (
                    <div key={a.id} className="p-3.5 border border-gray-200 rounded-2xl space-y-2.5 bg-gray-50/50">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="text-xs text-gray-500">Số gọi tại quầy</div>
                          <div className="text-2xl font-extrabold text-blue-700">
                            {callNum || "Đang cấp"}
                          </div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="text-sm text-gray-800 space-y-1">
                        <div>
                          📅 <strong>{a.serviceDate}</strong> • Khung giờ{" "}
                          <strong>{a.slotRange || formatSlotDisplay(a.slot, 30)}</strong>
                        </div>
                        <div>
                          🏛 <strong>Quầy {a.counter?.code}</strong> — {a.counter?.name}
                        </div>
                        {(a.fieldLabel || a.procedureName) && (
                          <div className="text-xs text-gray-600">
                            📋 {a.procedureName || a.fieldLabel}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Mã hẹn: <code className="font-mono font-bold text-gray-800">{a.lookupCode}</code>
                        </div>
                      </div>

                      <div className="text-xs text-blue-800 bg-blue-50 p-2.5 rounded-xl">
                        📌 Đến đúng khung giờ, trình phiếu tại quầy và chờ gọi số.
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          className="min-h-[44px] px-3 py-1.5 text-sm font-semibold text-blue-700 bg-blue-100 rounded-xl"
                          onClick={() => {
                            setBookedAppt(a);
                            switchTab("book");
                          }}
                        >
                          Xem phiếu xác nhận
                        </button>
                        {a.status === "CONFIRMED" && (!a.ticket || a.ticket.status === "WAITING") && (
                          <>
                            <button
                              type="button"
                              className="min-h-[44px] px-3 py-1.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl"
                              onClick={() => {
                                setRescheduleTarget(a);
                                setBookedAppt(null);
                                setStep(2);
                                switchTab("book");
                              }}
                            >
                              Đổi lịch
                            </button>
                            <button
                              type="button"
                              className="min-h-[44px] px-3 py-1.5 text-sm font-semibold text-red-600 bg-red-50 rounded-xl"
                              onClick={() => handleCancelMyAppointment(a.id)}
                            >
                              Hủy lịch
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </Box>

            {/* Khung tra cứu bằng mã hẹn / mã số (dành cho cả thiết bị không đăng nhập Zalo) */}
            <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <Text className="font-bold text-gray-800 text-base">Tra cứu nhanh bằng mã hẹn</Text>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  runCodeLookup(lookupCodeInput);
                }}
                className="flex gap-2"
              >
                <input
                  className="flex-1 min-h-[44px] px-3 py-2 border border-gray-200 rounded-xl text-base font-mono uppercase"
                  placeholder="Nhập mã hẹn (VD: A... hoặc T...)"
                  value={lookupCodeInput}
                  onChange={e => setLookupCodeInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="min-h-[44px] px-4 bg-blue-600 text-white rounded-xl font-semibold text-base"
                >
                  Tra cứu
                </button>
              </form>

              {savedCodes.length > 0 && (
                <div>
                  <Text className="text-xs text-gray-500 mb-1.5">Mã đã lưu trên thiết bị này:</Text>
                  <div className="flex flex-wrap gap-1.5">
                    {savedCodes.map(code => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => runCodeLookup(code)}
                        className="px-2.5 py-1.5 bg-gray-100 rounded-lg text-xs font-mono font-semibold text-blue-700"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {lookupLoading && <Text className="text-sm text-gray-500">Đang tra cứu...</Text>}
              {lookupErr && <Text className="text-sm text-red-600">{lookupErr}</Text>}

              {lookupData && (
                <div className="p-4 bg-blue-50 rounded-xl space-y-2 text-base border border-blue-100">
                  {lookupData.kind === "TICKET" ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-extrabold text-blue-800">
                          {lookupData.ticket.displayNumber}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusBadge(lookupData.ticket).cls}`}>
                          {getStatusBadge(lookupData.ticket).label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700">
                        Quầy {lookupData.ticket.counter.code} — {lookupData.ticket.counter.name} • Ngày {lookupData.ticket.serviceDate}
                        {lookupData.ticket.slotRange ? ` • Khung giờ ${lookupData.ticket.slotRange}` : ""}
                      </div>
                      <div className="text-xs text-blue-800">
                        📌 Đến đúng khung giờ, trình phiếu tại quầy và chờ gọi số.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-xs text-gray-500">Số gọi đã cấp</div>
                          <div className="text-2xl font-extrabold text-blue-800">
                            {lookupData.appointment.displayNumber || lookupData.appointment.ticket?.displayNumber || lookupData.appointment.lookupCode}
                          </div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusBadge(lookupData.appointment).cls}`}>
                          {getStatusBadge(lookupData.appointment).label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700">
                        Ngày <strong>{lookupData.appointment.serviceDate}</strong> • Khung giờ{" "}
                        <strong>{lookupData.appointment.slotRange || lookupData.appointment.slot}</strong>
                      </div>
                      <div className="text-sm text-gray-700">
                        Quầy {lookupData.appointment.counter.code} — {lookupData.appointment.counter.name} • Mã hẹn:{" "}
                        <strong className="font-mono">{lookupData.appointment.lookupCode}</strong>
                      </div>
                      <div className="text-xs text-blue-800">
                        📌 Đến đúng khung giờ, trình phiếu tại quầy và chờ gọi số.
                      </div>
                    </>
                  )}
                </div>
              )}
            </Box>
          </div>
        )}
      </div>
    </Page>
  );
}
