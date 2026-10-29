import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Header, Icon, Page, Text, useSnackbar } from "zmp-ui";
import RemoteState from "../components/remote-state";
import { useApiResource } from "../components/use-api-resource";
import { api } from "../services/api";
import { getZaloAccessToken } from "../services/zalo";

const SAVED_CODES_KEY = "nt_queue_lookup_codes";
const CITIZEN_JWT_KEY = "nt_citizen_jwt";

const TICKET_STATUS_TEXT = {
  WAITING: { label: "Đang chờ tới lượt", cls: "bg-blue-100 text-blue-700" },
  CALLING: { label: "Mời bạn đến quầy!", cls: "bg-green-100 text-green-800" },
  SERVING: { label: "Đang phục vụ tại quầy", cls: "bg-emerald-100 text-emerald-800" },
  COMPLETED: { label: "Đã hoàn tất", cls: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Đã hủy", cls: "bg-red-100 text-red-700" },
  NO_SHOW: { label: "Vắng mặt khi gọi", cls: "bg-amber-100 text-amber-800" },
  TRANSFERRED: { label: "Đã chuyển quầy", cls: "bg-purple-100 text-purple-700" },
};

const APPT_STATUS_TEXT = {
  CONFIRMED: { label: "Đã xác nhận", cls: "bg-blue-100 text-blue-700" },
  CHECKED_IN: { label: "Đã check-in tại quầy", cls: "bg-green-100 text-green-800" },
  COMPLETED: { label: "Đã hoàn tất", cls: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Đã hủy", cls: "bg-red-100 text-red-700" },
  RESCHEDULED: { label: "Đã đổi sang lịch khác", cls: "bg-gray-100 text-gray-600" },
  NO_SHOW: { label: "Vắng mặt", cls: "bg-amber-100 text-amber-800" },
};

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

async function ensureCitizenJwt() {
  const cached = sessionStorage.getItem(CITIZEN_JWT_KEY);
  if (cached) return cached;
  const zaloToken = await getZaloAccessToken();
  if (!zaloToken) {
    throw new Error("Vui lòng mở ứng dụng trong Zalo để xác thực tài khoản trước khi lấy số / đặt lịch.");
  }
  const authRes = await api.post("/auth/zalo", { accessToken: zaloToken });
  if (!authRes?.accessToken) {
    throw new Error("Không thể xác thực tài khoản Zalo. Vui lòng thử lại.");
  }
  sessionStorage.setItem(CITIZEN_JWT_KEY, authRes.accessToken);
  return authRes.accessToken;
}

async function authedRequest(method, path, body, headers = {}) {
  let jwt = await ensureCitizenJwt();
  try {
    return method === "GET"
      ? await api.get(path, { headers: { ...headers, Authorization: `Bearer ${jwt}` } })
      : await api.post(path, body, { headers: { ...headers, Authorization: `Bearer ${jwt}` } });
  } catch (err) {
    if (err?.status === 401) {
      sessionStorage.removeItem(CITIZEN_JWT_KEY);
      jwt = await ensureCitizenJwt();
      return method === "GET"
        ? await api.get(path, { headers: { ...headers, Authorization: `Bearer ${jwt}` } })
        : await api.post(path, body, { headers: { ...headers, Authorization: `Bearer ${jwt}` } });
    }
    throw err;
  }
}

export default function QueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { openSnackbar } = useSnackbar();

  const initialTab = ["ticket", "appointment", "lookup"].includes(searchParams.get("tab"))
    ? searchParams.get("tab")
    : "ticket";
  const [tab, setTab] = useState(initialTab);

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

  // Deep link từ Zalo OA: ?tab=appointment&field=<slug_or_id>
  useEffect(() => {
    const paramTab = searchParams.get("tab");
    if (["ticket", "appointment", "lookup"].includes(paramTab)) {
      setTab(paramTab);
    }
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

  // ───────── Luồng 1: Lấy số thứ tự trong ngày ─────────
  const ticketIdemRef = useRef(makeIdemKey("tkt"));
  const [issuingTicket, setIssuingTicket] = useState(false);
  const [issuedTicket, setIssuedTicket] = useState(null);

  const handleIssueTicket = async () => {
    if (!selectedFieldId) return;
    setIssuingTicket(true);
    try {
      const res = await authedRequest(
        "POST",
        "/queue/tickets",
        { fieldId: selectedFieldId, procedureId: selectedProcedureId || undefined },
        { "Idempotency-Key": ticketIdemRef.current },
      );
      setIssuedTicket(res);
      saveLookupCode(res.lookupCode);
      ticketIdemRef.current = makeIdemKey("tkt");
      catalogRes.reload();
      openSnackbar({ text: `Đã cấp số ${res.displayNumber} thành công!`, type: "success" });
    } catch (err) {
      openSnackbar({ text: err?.message || "Không thể cấp số lúc này", type: "error" });
    } finally {
      setIssuingTicket(false);
    }
  };

  // ───────── Luồng 2: Đặt lịch hẹn trước (từ OA / Mini App) ─────────
  const [availability, setAvailability] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [reviewStep, setReviewStep] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookedAppt, setBookedAppt] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // appointment đang đổi lịch
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
    if (tab === "appointment" && selectedFieldId) {
      loadAvailability(selectedFieldId);
      setReviewStep(false);
    }
  }, [tab, selectedFieldId, loadAvailability]);

  const currentDayObj = useMemo(
    () => (availability?.days || []).find(d => d.date === selectedDate) || null,
    [availability, selectedDate],
  );

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
        setBookedAppt(res);
        setRescheduleTarget(null);
        saveLookupCode(res.lookupCode);
        apptIdemRef.current = makeIdemKey("apt");
        openSnackbar({ text: "Đã đổi lịch hẹn thành công!", type: "success" });
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
        setBookedAppt(res);
        saveLookupCode(res.lookupCode);
        apptIdemRef.current = makeIdemKey("apt");
        openSnackbar({ text: "Đã đặt lịch hẹn thành công!", type: "success" });
      }
      setReviewStep(false);
      loadAvailability(selectedFieldId);
    } catch (err) {
      openSnackbar({ text: err?.message || "Không thể đặt lịch lúc này", type: "error" });
    } finally {
      setBookingBusy(false);
    }
  };

  // ───────── Luồng 3: Tra cứu & Số/Lịch của tôi ─────────
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
      // Nếu mở trên trình duyệt hoặc từ chối quyền Zalo, vẫn dùng tra cứu bằng mã bình thường
      setMyItems(null);
    } finally {
      setMyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "lookup") {
      setSavedCodes(loadSavedCodes());
      loadMyItems();
    }
  }, [tab, loadMyItems]);

  const handleCancelMyTicket = async (ticketId) => {
    try {
      await authedRequest("POST", `/queue/tickets/${ticketId}/cancel`, { reason: "Người dân chủ động hủy trên Mini App" });
      openSnackbar({ text: "Đã hủy phiếu số thứ tự", type: "success" });
      setIssuedTicket(null);
      loadMyItems();
      catalogRes.reload();
    } catch (err) {
      openSnackbar({ text: err?.message || "Không thể hủy phiếu", type: "error" });
    }
  };

  const handleCancelMyAppointment = async (appointmentId) => {
    try {
      await authedRequest("POST", `/queue/appointments/${appointmentId}/cancel`, { reason: "Người dân chủ động hủy trên Mini App" });
      openSnackbar({ text: "Đã hủy lịch hẹn và giải phóng chỗ", type: "success" });
      setBookedAppt(null);
      loadMyItems();
    } catch (err) {
      openSnackbar({ text: err?.message || "Không thể hủy lịch hẹn", type: "error" });
    }
  };

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  return (
    <Page className="bg-gray-50 page-with-header">
      <Header title="Lấy số & Đặt lịch hẹn" showBackIcon />

      <div className="pb-24 pt-3">
        {/* Thanh chuyển Tab */}
        <div className="mx-4 mb-4 grid grid-cols-3 gap-2 bg-white p-1.5 rounded-xl shadow-sm">
          {[
            { id: "ticket", label: "Lấy số", icon: "zi-clock-1" },
            { id: "appointment", label: "Đặt lịch", icon: "zi-calendar" },
            { id: "lookup", label: "Số của tôi", icon: "zi-search" },
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

        {/* Trạng thái tải danh mục quầy cho tab Lấy số & Đặt lịch */}
        {tab !== "lookup" && (catalogRes.loading || catalogRes.error) ? (
          <RemoteState loading={catalogRes.loading} error={catalogRes.error} reload={catalogRes.reload} />
        ) : null}

        {tab !== "lookup" && !catalogRes.loading && !catalogRes.error && allFields.length === 0 && (
          <Box className="mx-4 bg-white rounded-2xl p-5 shadow-sm text-base text-gray-700" role="status">
            <Text className="font-bold text-gray-900 text-base mb-1">
              Hệ thống lấy số & đặt lịch đang chờ kích hoạt
            </Text>
            <Text className="text-base text-gray-600">
              Trung tâm đang cập nhật cấu hình quầy phục vụ, giờ hoạt động và hạn mức. Bạn có thể chuyển sang mục{" "}
              <button className="text-blue-600 font-semibold underline" onClick={() => switchTab("lookup")}>
                Số của tôi
              </button>{" "}
              nếu đã có mã tra cứu.
            </Text>
          </Box>
        )}

        {/* ══════════════════ TAB 1: LẤY SỐ TRONG NGÀY ══════════════════ */}
        {tab === "ticket" && !catalogRes.loading && !catalogRes.error && allFields.length > 0 && (
          <div className="space-y-4 px-4">
            {issuedTicket ? (
              <Box className="bg-white rounded-2xl p-5 shadow-sm border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-800">
                    Biên nhận số thứ tự
                  </span>
                  <span className="text-sm text-gray-500">Ngày {issuedTicket.serviceDate}</span>
                </div>
                <div className="text-center py-4 bg-blue-50 rounded-xl mb-4">
                  <Text className="text-sm text-gray-600">Số thứ tự của bạn</Text>
                  <div className="text-4xl font-extrabold text-blue-700 my-1">{issuedTicket.displayNumber}</div>
                  <Text className="text-sm font-medium text-gray-700">
                    Quầy {issuedTicket.counter.code} — {issuedTicket.counter.name}
                  </Text>
                </div>

                <div className="space-y-2 text-base text-gray-700 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Mã tra cứu:</span>
                    <strong className="font-mono text-gray-900">{issuedTicket.lookupCode}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Số người chờ phía trước:</span>
                    <strong>{issuedTicket.aheadCount ?? 0} người</strong>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
                    📌 Vui lòng có mặt tại <strong>Quầy {issuedTicket.counter.code}</strong> và theo dõi màn hình gọi số. Bạn có thể dùng mã{" "}
                    <strong className="font-mono">{issuedTicket.lookupCode}</strong> ở tab &ldquo;Số của tôi&rdquo; để kiểm tra trạng thái bất kỳ lúc nào.
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    className="flex-1 min-h-[44px] bg-blue-600 text-white rounded-xl font-semibold text-base"
                    onClick={() => {
                      switchTab("lookup");
                      runCodeLookup(issuedTicket.lookupCode);
                    }}
                  >
                    Theo dõi hàng chờ
                  </button>
                  {issuedTicket.status === "WAITING" && (
                    <button
                      className="min-h-[44px] px-4 bg-red-50 text-red-600 rounded-xl font-semibold text-base"
                      onClick={() => handleCancelMyTicket(issuedTicket.id)}
                    >
                      Hủy số
                    </button>
                  )}
                </div>
              </Box>
            ) : (
              <>
                <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                  <Text className="font-bold text-gray-800 text-base">1. Chọn lĩnh vực & thủ tục</Text>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Lĩnh vực giải quyết</label>
                    <select
                      className="w-full min-h-[44px] px-3 py-2 border border-gray-200 rounded-xl text-base bg-white"
                      value={selectedFieldId}
                      onChange={e => {
                        setSelectedFieldId(e.target.value);
                        setSelectedProcedureId("");
                        ticketIdemRef.current = makeIdemKey("tkt");
                      }}
                    >
                      {allFields.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.label} (Quầy {f.counter.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedField?.procedures?.length > 0 && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Thủ tục cụ thể (không bắt buộc)</label>
                      <select
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-200 rounded-xl text-base bg-white"
                        value={selectedProcedureId}
                        onChange={e => setSelectedProcedureId(e.target.value)}
                      >
                        <option value="">-- Chọn chung theo lĩnh vực --</option>
                        {selectedField.procedures.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </Box>

                {selectedCounter && (
                  <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                    <Text className="font-bold text-gray-800 text-base">2. Trạng thái quầy phục vụ</Text>
                    <div className="p-3 bg-blue-50 rounded-xl">
                      <div className="font-bold text-blue-900 text-base">
                        Quầy {selectedCounter.code} — {selectedCounter.name}
                      </div>
                      {selectedCounter.description && (
                        <div className="text-sm text-blue-700 mt-0.5">{selectedCounter.description}</div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-base">
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <div className="text-xs text-gray-500">Số đang gọi</div>
                        <div className="text-lg font-bold text-green-700 mt-0.5">
                          {selectedCounter.today.currentlyServing?.length > 0
                            ? selectedCounter.today.currentlyServing.map(s => s.displayNumber).join(", ")
                            : "Chưa gọi"}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <div className="text-xs text-gray-500">Đang chờ tại quầy</div>
                        <div className="text-lg font-bold text-blue-700 mt-0.5">
                          {selectedCounter.today.waitingCount} người
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <div>
                        🕒 Giờ nhận số hôm nay:{" "}
                        <strong>
                          {selectedCounter.today.windows?.length > 0
                            ? selectedCounter.today.windows.map(w => `${w.startTime}–${w.endTime}`).join(", ")
                            : "Nghỉ"}
                        </strong>
                      </div>
                      {selectedCounter.today.remainingOnlineQuota !== null && (
                        <div>
                          🎫 Lượt lấy số trực tuyến còn lại hôm nay:{" "}
                          <strong>{selectedCounter.today.remainingOnlineQuota} lượt</strong>
                        </div>
                      )}
                    </div>

                    {!selectedCounter.readiness.ticket.ready ? (
                      <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-sm">
                        Quầy hiện chưa mở lấy số trực tuyến ({selectedCounter.readiness.ticket.missing.join(", ")}).
                      </div>
                    ) : selectedCounter.today.isClosedToday ? (
                      <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                        Quầy nghỉ hôm nay ({selectedCounter.today.closureNote || "Theo lịch làm việc"}). Bạn có thể chuyển sang tab Đặt lịch cho ngày tiếp theo.
                      </div>
                    ) : !selectedCounter.today.isOpenNow ? (
                      <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-sm">
                        Hiện đang ngoài giờ nhận số trực tuyến. Vui lòng lấy số trong khung giờ hoạt động hoặc chọn Đặt lịch hẹn trước.
                      </div>
                    ) : selectedCounter.today.remainingOnlineQuota === 0 ? (
                      <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                        Đã hết hạn mức lấy số trực tuyến hôm nay tại quầy này.
                      </div>
                    ) : null}

                    <button
                      disabled={
                        issuingTicket ||
                        !selectedCounter.readiness.ticket.ready ||
                        selectedCounter.today.isClosedToday ||
                        !selectedCounter.today.isOpenNow ||
                        selectedCounter.today.remainingOnlineQuota === 0
                      }
                      onClick={handleIssueTicket}
                      className="w-full min-h-[48px] bg-blue-600 disabled:bg-gray-300 text-white rounded-xl font-bold text-base shadow-sm"
                    >
                      {issuingTicket ? "Đang cấp số..." : "Xác nhận lấy số thứ tự"}
                    </button>
                  </Box>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════ TAB 2: ĐẶT LỊCH HẸN TRƯỚC ══════════════════ */}
        {tab === "appointment" && !catalogRes.loading && !catalogRes.error && allFields.length > 0 && (
          <div className="space-y-4 px-4">
            {bookedAppt ? (
              <Box className="bg-white rounded-2xl p-5 shadow-sm border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                    Xác nhận đặt lịch hẹn
                  </span>
                  <span className="text-sm text-gray-500">{bookedAppt.serviceDate}</span>
                </div>

                <div className="text-center py-4 bg-blue-50 rounded-xl">
                  <Text className="text-sm text-gray-600">Mã tra cứu lịch hẹn</Text>
                  <div className="text-3xl font-extrabold font-mono text-blue-700 my-1">
                    {bookedAppt.lookupCode}
                  </div>
                  <Text className="text-base font-semibold text-gray-800">
                    Khung giờ {bookedAppt.slot} • Ngày {bookedAppt.serviceDate}
                  </Text>
                  <Text className="text-sm text-gray-600 mt-0.5">
                    Quầy {bookedAppt.counter.code} — {bookedAppt.counter.name}
                  </Text>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700 space-y-1">
                  <div>👤 Người đặt: <strong>{bookedAppt.contactName}</strong></div>
                  <div>
                    📌 <strong>Hướng dẫn khi đến Trung tâm:</strong> Vui lòng mang đầy đủ thành phần hồ sơ bản chính/bản sao theo quy định và đọc mã{" "}
                    <strong className="font-mono">{bookedAppt.lookupCode}</strong> cho cán bộ tại{" "}
                    <strong>Quầy {bookedAppt.counter.code}</strong> để check-in vào hàng phục vụ.
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    className="flex-1 min-h-[44px] bg-blue-600 text-white rounded-xl font-semibold text-base"
                    onClick={() => {
                      setRescheduleTarget(bookedAppt);
                      setBookedAppt(null);
                    }}
                  >
                    Đổi lịch
                  </button>
                  <button
                    className="min-h-[44px] px-4 bg-red-50 text-red-600 rounded-xl font-semibold text-base"
                    onClick={() => handleCancelMyAppointment(bookedAppt.id)}
                  >
                    Hủy lịch
                  </button>
                </div>
              </Box>
            ) : reviewStep ? (
              <Box className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                <Text className="font-bold text-gray-900 text-lg">
                  {rescheduleTarget ? "Xác nhận đổi lịch hẹn" : "Kiểm tra thông tin đặt lịch"}
                </Text>
                <div className="space-y-2 text-base text-gray-700 bg-gray-50 p-4 rounded-xl">
                  <div>Lĩnh vực: <strong>{selectedField?.label}</strong></div>
                  <div>Quầy phục vụ: <strong>Quầy {selectedCounter?.code} — {selectedCounter?.name}</strong></div>
                  <div>Ngày hẹn: <strong>{selectedDate}</strong></div>
                  <div>Khung giờ: <strong>{selectedSlot}</strong></div>
                  {!rescheduleTarget && (
                    <>
                      <div>Họ và tên: <strong>{contactName}</strong></div>
                      {contactPhone && <div>Số điện thoại: <strong>{contactPhone}</strong></div>}
                    </>
                  )}
                </div>
                <Text className="text-xs text-gray-500">
                  Thông tin họ tên và số điện thoại chỉ dùng để cán bộ đối chiếu khi bạn đến check-in tại quầy.
                </Text>
                <div className="flex gap-2">
                  <button
                    className="min-h-[44px] px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold text-base"
                    onClick={() => setReviewStep(false)}
                    disabled={bookingBusy}
                  >
                    Quay lại sửa
                  </button>
                  <button
                    className="flex-1 min-h-[44px] bg-blue-600 text-white rounded-xl font-bold text-base disabled:opacity-50"
                    onClick={handleConfirmBooking}
                    disabled={bookingBusy}
                  >
                    {bookingBusy ? "Đang xử lý..." : "Xác nhận đặt lịch"}
                  </button>
                </div>
              </Box>
            ) : (
              <>
                {rescheduleTarget && (
                  <Box className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between text-sm text-amber-900">
                    <span>Đang đổi lịch cho mã <strong>{rescheduleTarget.lookupCode}</strong> ({rescheduleTarget.serviceDate} {rescheduleTarget.slot})</span>
                    <button className="underline font-semibold ml-2" onClick={() => setRescheduleTarget(null)}>Hủy đổi</button>
                  </Box>
                )}

                <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                  <Text className="font-bold text-gray-800 text-base">1. Chọn lĩnh vực</Text>
                  <select
                    className="w-full min-h-[44px] px-3 py-2 border border-gray-200 rounded-xl text-base bg-white"
                    value={selectedFieldId}
                    disabled={Boolean(rescheduleTarget)}
                    onChange={e => {
                      setSelectedFieldId(e.target.value);
                      setSelectedProcedureId("");
                    }}
                  >
                    {allFields.map(f => (
                      <option key={f.id} value={f.id}>{f.label} (Quầy {f.counter.code})</option>
                    ))}
                  </select>
                </Box>

                {availLoading || availError ? (
                  <RemoteState loading={availLoading} error={availError} reload={() => loadAvailability(selectedFieldId)} />
                ) : availability && (
                  <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
                    <div>
                      <Text className="font-bold text-gray-800 text-base mb-2">2. Chọn ngày còn chỗ</Text>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {(availability.days || []).map(d => {
                          const hasSlot = !d.closed && (d.slots || []).some(s => s.available);
                          const active = d.date === selectedDate;
                          return (
                            <button
                              key={d.date}
                              disabled={!hasSlot}
                              onClick={() => {
                                setSelectedDate(d.date);
                                setSelectedSlot("");
                              }}
                              className={`min-h-[48px] px-3 py-2 rounded-xl border text-left flex-shrink-0 ${
                                active
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : hasSlot
                                  ? "bg-white text-gray-800 border-gray-200"
                                  : "bg-gray-100 text-gray-400 border-gray-100"
                              }`}
                            >
                              <div className="text-xs font-semibold">{d.date.slice(5)}</div>
                              <div className="text-[11px]">{hasSlot ? "Còn chỗ" : "Hết/Nghỉ"}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {currentDayObj && (
                      <div>
                        <Text className="font-bold text-gray-800 text-base mb-2">3. Chọn khung giờ</Text>
                        {currentDayObj.closed ? (
                          <Text className="text-sm text-red-600">{currentDayObj.closureNote}</Text>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {(currentDayObj.slots || []).map(s => (
                              <button
                                key={s.slot}
                                disabled={!s.available}
                                onClick={() => setSelectedSlot(s.slot)}
                                className={`min-h-[44px] py-2 px-2 rounded-xl border text-center text-sm font-semibold ${
                                  selectedSlot === s.slot
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : s.available
                                    ? "bg-white text-gray-800 border-gray-200"
                                    : "bg-gray-100 text-gray-400 border-gray-100"
                                }`}
                              >
                                <div>{s.slot}</div>
                                <div className="text-[11px] font-normal">Còn {s.remaining} chỗ</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!rescheduleTarget && (
                      <div className="space-y-3 pt-2 border-t border-gray-100">
                        <Text className="font-bold text-gray-800 text-base">4. Thông tin liên hệ tối thiểu</Text>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Họ và tên người đến làm thủ tục *</label>
                          <input
                            className="w-full min-h-[44px] px-3 py-2 border border-gray-200 rounded-xl text-base"
                            placeholder="Nhập họ và tên"
                            value={contactName}
                            onChange={e => setContactName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Số điện thoại (tùy chọn)</label>
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

                    <button
                      disabled={!selectedDate || !selectedSlot || (!rescheduleTarget && contactName.trim().length < 2)}
                      onClick={() => setReviewStep(true)}
                      className="w-full min-h-[48px] bg-blue-600 disabled:bg-gray-300 text-white rounded-xl font-bold text-base"
                    >
                      Tiếp tục xem lại & xác nhận
                    </button>
                  </Box>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════ TAB 3: TRA CỨU & SỐ CỦA TÔI ══════════════════ */}
        {tab === "lookup" && (
          <div className="space-y-4 px-4">
            <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <Text className="font-bold text-gray-800 text-base">Tra cứu bằng mã số / mã lịch hẹn</Text>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  runCodeLookup(lookupCodeInput);
                }}
                className="flex gap-2"
              >
                <input
                  className="flex-1 min-h-[44px] px-3 py-2 border border-gray-200 rounded-xl text-base font-mono uppercase"
                  placeholder="Nhập mã (VD: T... hoặc A...)"
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
                <div className="p-4 bg-blue-50 rounded-xl space-y-2 text-base">
                  {lookupData.kind === "TICKET" ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-extrabold text-blue-800">{lookupData.ticket.displayNumber}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${TICKET_STATUS_TEXT[lookupData.ticket.status]?.cls || ""}`}>
                          {TICKET_STATUS_TEXT[lookupData.ticket.status]?.label || lookupData.ticket.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700">
                        Quầy {lookupData.ticket.counter.code} — {lookupData.ticket.counter.name} • Ngày {lookupData.ticket.serviceDate}
                      </div>
                      {lookupData.ticket.status === "WAITING" && (
                        <div className="text-sm font-semibold text-blue-900">
                          Còn {lookupData.ticket.aheadCount} người chờ phía trước
                          {lookupData.ticket.currentlyServing && ` (Đang gọi: ${lookupData.ticket.currentlyServing.displayNumber})`}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-blue-800">{lookupData.appointment.lookupCode}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${APPT_STATUS_TEXT[lookupData.appointment.status]?.cls || ""}`}>
                          {APPT_STATUS_TEXT[lookupData.appointment.status]?.label || lookupData.appointment.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700">
                        Ngày {lookupData.appointment.serviceDate} • Khung giờ <strong>{lookupData.appointment.slot}</strong>
                      </div>
                      <div className="text-sm text-gray-700">
                        Quầy {lookupData.appointment.counter.code} — {lookupData.appointment.counter.name}
                      </div>
                      {lookupData.appointment.ticket && (
                        <div className="text-sm font-semibold text-green-800">
                          Số thứ tự sau check-in: {lookupData.appointment.ticket.displayNumber}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Box>

            {/* Danh sách theo tài khoản Zalo (nếu đang mở trong Zalo) */}
            {myLoading && <Text className="text-sm text-gray-500 px-1">Đang đồng bộ phiếu của bạn...</Text>}
            {myItems && (
              <>
                <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                  <Text className="font-bold text-gray-800 text-base">Số thứ tự hôm nay của tôi</Text>
                  {(myItems.tickets || []).length === 0 ? (
                    <Text className="text-sm text-gray-500">Bạn chưa có phiếu số thứ tự nào trong hôm nay.</Text>
                  ) : (
                    myItems.tickets.map(t => (
                      <div key={t.id} className="p-3 border border-gray-100 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xl font-bold text-blue-700">{t.displayNumber}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TICKET_STATUS_TEXT[t.status]?.cls || ""}`}>
                            {TICKET_STATUS_TEXT[t.status]?.label || t.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          Quầy {t.counter.code} • Mã: <code className="font-mono">{t.lookupCode}</code>
                          {t.status === "WAITING" && ` • Còn ${t.aheadCount} người phía trước`}
                        </div>
                        {t.status === "WAITING" && (
                          <button
                            className="min-h-[44px] px-3 py-1.5 text-sm font-semibold text-red-600 bg-red-50 rounded-lg"
                            onClick={() => handleCancelMyTicket(t.id)}
                          >
                            Hủy phiếu số
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </Box>

                <Box className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                  <Text className="font-bold text-gray-800 text-base">Lịch hẹn của tôi</Text>
                  {(myItems.appointments || []).length === 0 ? (
                    <Text className="text-sm text-gray-500">Bạn chưa có lịch hẹn nào.</Text>
                  ) : (
                    myItems.appointments.map(a => (
                      <div key={a.id} className="p-3 border border-gray-100 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-900">{a.serviceDate} • {a.slot}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${APPT_STATUS_TEXT[a.status]?.cls || ""}`}>
                            {APPT_STATUS_TEXT[a.status]?.label || a.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          Quầy {a.counter.code} • Mã: <code className="font-mono">{a.lookupCode}</code>
                        </div>
                        {a.status === "CONFIRMED" && (
                          <div className="flex gap-2">
                            <button
                              className="min-h-[44px] px-3 py-1.5 text-sm font-semibold text-blue-600 bg-blue-50 rounded-lg"
                              onClick={() => {
                                setRescheduleTarget(a);
                                switchTab("appointment");
                              }}
                            >
                              Đổi lịch
                            </button>
                            <button
                              className="min-h-[44px] px-3 py-1.5 text-sm font-semibold text-red-600 bg-red-50 rounded-lg"
                              onClick={() => handleCancelMyAppointment(a.id)}
                            >
                              Hủy lịch
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </Box>
              </>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}

