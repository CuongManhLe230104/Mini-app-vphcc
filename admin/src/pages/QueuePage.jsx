import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

const UNIFIED_BADGE = {
  BOOKED: { label: "Đã đặt lịch", cls: "badge-pending" },
  CALLING: { label: "Đang gọi", cls: "badge-published" },
  SERVING: { label: "Đang tiếp nhận", cls: "badge-published" },
  COMPLETED: { label: "Hoàn tất", cls: "badge-draft" },
  CANCELLED: { label: "Đã hủy", cls: "badge-rejected" },
  NO_SHOW: { label: "Vắng mặt", cls: "badge-rejected" },
  UNSERVED_PAST_SLOT: { label: "Chưa được phục vụ", cls: "badge-rejected" },
};

function getUnifiedBadge(item) {
  const key = item?.unifiedStatus || (item?.status === "CONFIRMED" ? "BOOKED" : item?.status);
  return UNIFIED_BADGE[key] || {
    label: item?.unifiedStatusLabel || item?.status || "Đã đặt lịch",
    cls: "badge-pending",
  };
}

function makeIdemKey() {
  return "adm_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function toNullOrInt(val) {
  if (val === "" || val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function countSlotsInWindows(windows, slotMinutes) {
  const dur = Number(slotMinutes) > 0 ? Number(slotMinutes) : 30;
  let total = 0;
  for (const w of windows || []) {
    const [sh, sm] = String(w.startTime || "00:00").split(":").map(Number);
    const [eh, em] = String(w.endTime || "00:00").split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    for (let t = start; t + dur <= end; t += dur) total++;
  }
  return total;
}

export default function QueuePage() {
  const { user } = useAuth();
  const { success: toastOk, error: toastErr } = useToast();
  const isSuper = user?.role === "SUPER_ADMIN";

  const [tab, setTab] = useState("board"); // "board" | "config"
  const [counters, setCounters] = useState([]);
  const [selectedCounterId, setSelectedCounterId] = useState("");
  const [date, setDate] = useState(() => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10));
  const [board, setBoard] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyAction, setBusyAction] = useState(false);

  // Tra cứu mã
  const [lookupInput, setLookupInput] = useState("");
  const [lookupResult, setLookupResult] = useState(null);

  // Chuyển quầy modal
  const [transferModal, setTransferModal] = useState(null);

  // Dữ liệu cấu hình Lịch phục vụ (SUPER_ADMIN)
  const [allFields, setAllFields] = useState([]);
  const [staffCandidates, setStaffCandidates] = useState([]);
  const [newCounter, setNewCounter] = useState({ code: "", name: "", description: "" });
  const [configForm, setConfigForm] = useState(null);
  const [scheduleWindows, setScheduleWindows] = useState([]);
  const [closureForm, setClosureForm] = useState({ date: "", note: "" });
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);

  const loadCounters = useCallback(async () => {
    try {
      const list = await api.getQueueCounters();
      setCounters(list);
      if (list.length > 0 && !selectedCounterId) {
        setSelectedCounterId(list[0].id);
      }
      return list;
    } catch (err) {
      setLoadError(err.message);
      return [];
    }
  }, [selectedCounterId]);

  const loadBoard = useCallback(async (cid, d) => {
    if (!cid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const [b, ev] = await Promise.all([
        api.getCounterBoard(cid, d),
        api.getCounterEvents(cid, d),
      ]);
      setBoard(b);
      setEvents(ev);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCounters();
    if (isSuper) {
      api.getFields().then(setAllFields).catch(() => {});
      api.getStaffCandidates().then(setStaffCandidates).catch(() => {});
    }
  }, [loadCounters, isSuper]);

  useEffect(() => {
    if (selectedCounterId) {
      loadBoard(selectedCounterId, date);
      const current = counters.find(c => c.id === selectedCounterId);
      if (current) {
        setConfigForm({
          name: current.name || "",
          description: current.description || "",
          isActive: Boolean(current.isActive),
          ticketEnabled: Boolean(current.ticketEnabled),
          appointmentEnabled: Boolean(current.appointmentEnabled),
          dailyCapacity: current.dailyCapacity ?? "",
          ticketQuota: current.ticketQuota ?? "",
          appointmentQuota: current.appointmentQuota ?? "",
          walkInQuota: current.walkInQuota ?? "",
          slotMinutes: current.slotMinutes ?? 30,
          slotCapacity: current.slotCapacity ?? 1,
          bookingMinLeadMinutes: current.bookingMinLeadMinutes ?? 30,
          bookingMaxDaysAhead: current.bookingMaxDaysAhead ?? 7,
          maxActiveTicketsPerCitizen: current.maxActiveTicketsPerCitizen ?? 1,
          maxActiveAppointmentsPerCitizen: current.maxActiveAppointmentsPerCitizen ?? 2,
          fieldIds: (current.fields || []).map(f => f.fieldId),
        });
        setScheduleWindows(
          (current.schedules || []).map(s => ({
            weekday: s.weekday,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        );
        setSelectedStaffIds((current.staff || []).map(s => s.adminId));
      }
    } else {
      setLoading(false);
    }
  }, [selectedCounterId, date, counters, loadBoard]);

  const runAction = async (fn, okMsg) => {
    setBusyAction(true);
    try {
      await fn();
      if (okMsg) toastOk(okMsg);
      await loadBoard(selectedCounterId, date);
    } catch (err) {
      toastErr(err.message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupInput.trim()) return;
    try {
      const res = await api.lookupQueueCode(lookupInput.trim());
      setLookupResult(res);
    } catch (err) {
      setLookupResult(null);
      toastErr(err.message);
    }
  };

  const handleSetupStandardFourCounters = async () => {
    setBusyAction(true);
    try {
      const created = await api.setupStandardCounters();
      toastOk(`Đã khởi tạo / đồng bộ ${created.length} quầy chuẩn (Q1–Q4, 30 phút/lượt)`);
      const list = await loadCounters();
      if (!selectedCounterId && list[0]?.id) {
        setSelectedCounterId(list[0].id);
      } else if (selectedCounterId) {
        await loadBoard(selectedCounterId, date);
      }
    } catch (err) {
      toastErr(err.message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleCreateCounter = async (e) => {
    e.preventDefault();
    try {
      const created = await api.createCounter({
        code: newCounter.code.trim().toUpperCase(),
        name: newCounter.name.trim(),
        description: newCounter.description.trim() || undefined,
      });
      toastOk(`Đã tạo quầy ${created.code}`);
      setNewCounter({ code: "", name: "", description: "" });
      const list = await loadCounters();
      setSelectedCounterId(created.id || list[0]?.id || "");
    } catch (err) {
      toastErr(err.message);
    }
  };

  const handleSaveCounterConfig = async (e) => {
    e.preventDefault();
    if (!selectedCounterId || !configForm) return;
    try {
      await api.updateCounter(selectedCounterId, {
        name: configForm.name,
        description: configForm.description,
        isActive: configForm.isActive,
        ticketEnabled: false,
        appointmentEnabled: configForm.appointmentEnabled,
        dailyCapacity: toNullOrInt(configForm.dailyCapacity),
        ticketQuota: 0,
        appointmentQuota: toNullOrInt(configForm.appointmentQuota),
        walkInQuota: toNullOrInt(configForm.walkInQuota),
        slotMinutes: toNullOrInt(configForm.slotMinutes),
        slotCapacity: toNullOrInt(configForm.slotCapacity),
        bookingMinLeadMinutes: toNullOrInt(configForm.bookingMinLeadMinutes),
        bookingMaxDaysAhead: toNullOrInt(configForm.bookingMaxDaysAhead),
        maxActiveTicketsPerCitizen: 1,
        maxActiveAppointmentsPerCitizen: toNullOrInt(configForm.maxActiveAppointmentsPerCitizen),
        fieldIds: configForm.fieldIds,
      });
      toastOk("Đã lưu cấu hình Lịch phục vụ & hạn mức của quầy");
      await loadCounters();
      await loadBoard(selectedCounterId, date);
    } catch (err) {
      toastErr(err.message);
    }
  };

  const handleSaveSchedules = async () => {
    if (!selectedCounterId) return;
    try {
      await api.setCounterSchedules(selectedCounterId, scheduleWindows);
      toastOk("Đã lưu khung giờ làm việc trong tuần");
      await loadCounters();
      await loadBoard(selectedCounterId, date);
    } catch (err) {
      toastErr(err.message);
    }
  };

  const handleApplyStandardWeekdaySchedule = () => {
    const standard = [1, 2, 3, 4, 5].flatMap(weekday => [
      { weekday, startTime: "07:30", endTime: "11:30" },
      { weekday, startTime: "13:30", endTime: "17:00" },
    ]);
    setScheduleWindows(standard);
    toastOk("Đã điền mẫu lịch Thứ Hai – Thứ Sáu (Sáng 07:30–11:30, Chiều 13:30–17:00). Bấm Lưu giờ hoạt động để áp dụng.");
  };

  const handleAddClosure = async (e) => {
    e.preventDefault();
    if (!selectedCounterId || !closureForm.date) return;
    try {
      const res = await api.addCounterClosure(selectedCounterId, closureForm);
      if (res?.warning) {
        toastOk(res.warning);
      } else {
        toastOk("Đã khóa nhận lịch mới cho ngày ngoại lệ");
      }
      setClosureForm({ date: "", note: "" });
      await loadCounters();
      await loadBoard(selectedCounterId, date);
    } catch (err) {
      toastErr(err.message);
    }
  };

  const handleRemoveClosure = async (closureId) => {
    try {
      await api.removeCounterClosure(selectedCounterId, closureId);
      toastOk("Đã mở lại nhận lịch cho ngày này");
      await loadCounters();
      await loadBoard(selectedCounterId, date);
    } catch (err) {
      toastErr(err.message);
    }
  };

  const handleSaveStaff = async () => {
    try {
      await api.setCounterStaff(selectedCounterId, selectedStaffIds);
      toastOk("Đã cập nhật phân công cán bộ quầy");
      await loadCounters();
    } catch (err) {
      toastErr(err.message);
    }
  };

  // Phân nhóm lượt trong ngày theo đúng Mục 7.1:
  // 1. Đang gọi / Đang tiếp nhận
  // 2. Lịch trong khung giờ hiện tại & khung giờ đã qua chưa phục vụ (sắp theo Khung giờ -> Số gọi)
  // 3. Nhóm khung giờ sắp tới
  // 4. Nhóm đã hoàn tất / đã hủy / vắng mặt
  const activeTickets = useMemo(
    () => (board?.tickets || []).filter(t => t.status === "CALLING" || t.status === "SERVING"),
    [board],
  );
  const waitingEligibleTickets = useMemo(
    () => (board?.tickets || []).filter(t => t.status === "WAITING" && !t.isFutureSlot),
    [board],
  );
  const waitingFutureTickets = useMemo(
    () => (board?.tickets || []).filter(t => t.status === "WAITING" && t.isFutureSlot),
    [board],
  );
  const doneTickets = useMemo(
    () => (board?.tickets || []).filter(t => !["WAITING", "CALLING", "SERVING"].includes(t.status)),
    [board],
  );

  const selectedCounterObj = counters.find(c => c.id === selectedCounterId);

  // Tính toán trực tiếp bảng năng lực phục vụ (Mục 9.2)
  const liveCapacityPreview = useMemo(() => {
    if (!configForm) return null;
    const sampleDay =
      scheduleWindows.find(w => w.weekday >= 1 && w.weekday <= 5)?.weekday ??
      scheduleWindows[0]?.weekday ??
      1;
    const dayWindows = scheduleWindows.filter(w => w.weekday === sampleDay);
    const morningWindows = dayWindows.filter(w => String(w.startTime) < "12:00");
    const afternoonWindows = dayWindows.filter(w => String(w.startTime) >= "12:00");
    const slotMins = toNullOrInt(configForm.slotMinutes) || 30;
    const positions = toNullOrInt(configForm.slotCapacity) || 1;
    const morningSlots = countSlotsInWindows(morningWindows, slotMins);
    const afternoonSlots = countSlotsInWindows(afternoonWindows, slotMins);
    const totalSlotsPerDay = morningSlots + afternoonSlots;
    const theoreticalMaxTurns = totalSlotsPerDay * positions;
    const dailyCap = toNullOrInt(configForm.dailyCapacity);
    const effectiveMaxTurns = dailyCap !== null ? Math.min(theoreticalMaxTurns, dailyCap) : theoreticalMaxTurns;
    const onlineQuota = toNullOrInt(configForm.appointmentQuota) ?? 0;
    const walkInRemaining = Math.max(0, effectiveMaxTurns - onlineQuota);
    return {
      slotMins,
      positions,
      morningSlots,
      afternoonSlots,
      totalSlotsPerDay,
      theoreticalMaxTurns,
      effectiveMaxTurns,
      onlineQuota,
      walkInRemaining,
    };
  }, [configForm, scheduleWindows]);

  return (
    <div className="page-container">
      <div
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}
      >
        <div>
          <h1 className="page-title">Vận hành Quầy & Lịch phục vụ</h1>
          <p className="page-subtitle">
            Đặt lịch cấp số gọi ngay (1-1), gọi số theo khung giờ và quản trị năng lực phục vụ 4 quầy
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className={`btn ${tab === "board" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab("board")}
          >
            Bảng vận hành quầy
          </button>
          {isSuper && (
            <button
              className={`btn ${tab === "config" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTab("config")}
            >
              Lịch phục vụ & Cấu hình quầy
            </button>
          )}
        </div>
      </div>

      {/* Bộ chọn Quầy + Ngày + Tra cứu mã */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
          <div style={{ minWidth: 260 }}>
            <label className="form-label">Quầy đang phụ trách</label>
            <select
              className="form-input"
              value={selectedCounterId}
              onChange={e => setSelectedCounterId(e.target.value)}
            >
              {counters.length === 0 && <option value="">-- Chưa có quầy nào --</option>}
              {counters.map(c => (
                <option key={c.id} value={c.id}>
                  Quầy {c.code} — {c.name} {!c.isActive ? "(Tạm dừng nhận lịch)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Ngày phục vụ</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => loadBoard(selectedCounterId, date)}
            disabled={loading || !selectedCounterId}
          >
            Làm mới
          </button>

          {isSuper && counters.length < 4 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyAction}
              onClick={handleSetupStandardFourCounters}
            >
              Khởi tạo nhanh 4 Quầy chuẩn (Q1–Q4)
            </button>
          )}

          <form onSubmit={handleLookup} style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
            <input
              className="form-input"
              placeholder="Tra mã hẹn / mã số (A... / T...)"
              value={lookupInput}
              onChange={e => setLookupInput(e.target.value)}
              style={{ width: 230 }}
            />
            <button type="submit" className="btn btn-primary">Tra mã</button>
          </form>
        </div>

        {lookupResult && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: "#EFF6FF",
              borderRadius: 8,
              border: "1px solid #BFDBFE",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {lookupResult.kind === "TICKET" ? (
              <div>
                <strong>Số gọi {lookupResult.ticket.displayNumber}</strong> (Mã phiếu: <code>{lookupResult.ticket.lookupCode}</code>
                {lookupResult.ticket.appointmentLookupCode ? `, Mã hẹn: ${lookupResult.ticket.appointmentLookupCode}` : ""}) — Quầy{" "}
                {lookupResult.ticket.counter.code} — Ngày {lookupResult.ticket.serviceDate}{" "}
                {lookupResult.ticket.slotRange ? `(${lookupResult.ticket.slotRange})` : ""} — Trạng thái:{" "}
                <strong>{getUnifiedBadge(lookupResult.ticket).label}</strong>
              </div>
            ) : (
              <div>
                <strong>
                  Số gọi {lookupResult.appointment.displayNumber || lookupResult.appointment.ticket?.displayNumber || "Đang cấp"}
                </strong>{" "}
                — Khung giờ <strong>{lookupResult.appointment.slotRange || lookupResult.appointment.slot}</strong> ngày{" "}
                {lookupResult.appointment.serviceDate} (Mã hẹn: <code>{lookupResult.appointment.lookupCode}</code>) — Người đặt:{" "}
                <strong>{lookupResult.appointment.contactName}</strong> ({lookupResult.appointment.contactPhone || "Không SĐT"}) — Trạng thái:{" "}
                <strong>{getUnifiedBadge(lookupResult.appointment).label}</strong>
              </div>
            )}
            <button className="btn btn-secondary" onClick={() => setLookupResult(null)}>
              Đóng
            </button>
          </div>
        )}
      </div>

      {loadError && (
        <div
          className="card"
          role="alert"
          style={{ padding: 16, marginBottom: 16, background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}
        >
          <strong>Lỗi kết nối / tải dữ liệu:</strong> {loadError}
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => loadBoard(selectedCounterId, date)}>
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB 1: MÀN HÌNH CÁN BỘ QUẦY (MỤC 7) ══════════════════ */}
      {tab === "board" && (
        <>
          {!selectedCounterId ? (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              Chưa có quầy phục vụ nào được tạo hoặc phân công cho tài khoản của bạn.
              {isSuper && (
                <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
                  <button className="btn btn-primary" onClick={handleSetupStandardFourCounters} disabled={busyAction}>
                    Khởi tạo 4 Quầy chuẩn (Q1–Q4)
                  </button>
                  <button className="btn btn-secondary" onClick={() => setTab("config")}>
                    Mở cấu hình Lịch phục vụ
                  </button>
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="card" style={{ padding: 24 }}>Đang tải dữ liệu vận hành quầy...</div>
          ) : board && (
            <>
              {/* Thông tin Quầy, Ngày & Khung giờ hiện tại + 5 thao tác chính (Mục 7.1 & 7.2) */}
              <div
                className="card"
                style={{
                  padding: 16,
                  marginBottom: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 4 }}>
                    <strong>Quầy {board.counter.code} — {board.counter.name}</strong> • Ngày <strong>{board.date}</strong> • Khung giờ hiện tại:{" "}
                    <strong style={{ color: "#1D4ED8" }}>
                      {board.currentSlotRange || "Ngoài khung giờ hẹn"}
                    </strong>{" "}
                    ({board.counter.slotMinutes || 30} phút/lượt)
                  </div>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>Đang gọi / Tiếp nhận</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#059669" }}>
                        {board.summary.calling + board.summary.serving}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>Chờ gọi (đến giờ)</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#0068FF" }}>
                        {waitingEligibleTickets.length}
                      </div>
                    </div>
                    {board.summary.unservedPastSlots > 0 && (
                      <div>
                        <div style={{ fontSize: 12, color: "#B91C1C" }}>Quá khung giờ chưa gọi</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#DC2626" }}>
                          {board.summary.unservedPastSlots}
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>Khung giờ sắp tới</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#D97706" }}>
                        {waitingFutureTickets.length}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>Hoàn tất / Vắng</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>
                        {board.summary.completed} / {board.summary.noShow}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-primary"
                    disabled={busyAction || waitingEligibleTickets.length === 0}
                    onClick={() => runAction(() => api.callNextTicket(selectedCounterId), "Đã gọi số tiếp theo")}
                    title="Gọi số tiếp theo trong khung giờ hợp lệ (ưu tiên khung giờ trước -> số thứ tự)"
                  >
                    Gọi tiếp ({waitingEligibleTickets.length})
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={busyAction || !board.counter.isActive || board.counter.closedToday}
                    onClick={() =>
                      runAction(
                        () => api.issueWalkInTicket(selectedCounterId, {}, makeIdemKey()),
                        "Đã cấp số cho người dân đến trực tiếp tại quầy",
                      )
                    }
                  >
                    Cấp số trực tiếp tại quầy
                  </button>
                </div>
              </div>

              {/* Khu vực Số đang gọi / Đang tiếp nhận với đúng bộ nút: Gọi lại, Tiếp nhận, Hoàn tất, Vắng mặt (Mục 7.2) */}
              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>
                  Số đang gọi / Đang tiếp nhận tại quầy ({activeTickets.length})
                </h3>
                {activeTickets.length === 0 ? (
                  <p style={{ color: "#6B7280", margin: 0 }}>
                    Hiện chưa có số nào đang gọi hoặc đang tiếp nhận. Bấm <strong>&ldquo;Gọi tiếp&rdquo;</strong> để gọi lượt kế tiếp trong khung giờ.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {activeTickets.map(t => {
                      const badge = getUnifiedBadge(t);
                      return (
                        <div
                          key={t.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: 14,
                            background: "#F0FDF4",
                            border: "1px solid #BBF7D0",
                            borderRadius: 10,
                            flexWrap: "wrap",
                            gap: 12,
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 26, fontWeight: 800, color: "#047857" }}>{t.displayNumber}</span>
                              <span className={`badge ${badge.cls}`}>{badge.label}</span>
                              {t.slotRange && (
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#1D4ED8" }}>
                                  Khung giờ: {t.slotRange}
                                </span>
                              )}
                            </div>
                            <div style={{ marginTop: 4, fontSize: 13, color: "#4B5563" }}>
                              {t.contactName && <span>Người dân: <strong>{t.contactName}</strong> • </span>}
                              {t.procedureName && <span>Thủ tục: <strong>{t.procedureName}</strong> • </span>}
                              Mã hẹn/phiếu: <code>{t.appointmentLookupCode || t.lookupCode}</code> • Đã gọi {t.callCount} lần
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {t.status === "CALLING" && (
                              <>
                                <button
                                  className="btn btn-secondary"
                                  disabled={busyAction}
                                  onClick={() => runAction(() => api.recallTicket(t.id), `Đã gọi lại số ${t.displayNumber}`)}
                                >
                                  Gọi lại
                                </button>
                                <button
                                  className="btn btn-primary"
                                  disabled={busyAction}
                                  onClick={() =>
                                    runAction(() => api.serveTicket(t.id), `Đã tiếp nhận số ${t.displayNumber}`)
                                  }
                                >
                                  Tiếp nhận
                                </button>
                                <button
                                  className="btn btn-danger"
                                  disabled={busyAction}
                                  onClick={() =>
                                    runAction(
                                      () => api.noShowTicket(t.id, "Đã gọi tại quầy nhưng vắng mặt"),
                                      `Đã đánh dấu vắng mặt ${t.displayNumber}`,
                                    )
                                  }
                                >
                                  Vắng mặt
                                </button>
                              </>
                            )}
                            {t.status === "SERVING" && (
                              <button
                                className="btn btn-primary"
                                disabled={busyAction}
                                onClick={() =>
                                  runAction(() => api.completeTicket(t.id), `Đã hoàn tất lượt ${t.displayNumber}`)
                                }
                              >
                                Hoàn tất
                              </button>
                            )}
                            <button
                              className="btn btn-secondary"
                              disabled={busyAction || counters.length < 2}
                              onClick={() =>
                                setTransferModal({
                                  ticket: t,
                                  toCounterId: counters.find(c => c.id !== selectedCounterId)?.id || "",
                                  reason: "",
                                })
                              }
                            >
                              Chuyển quầy
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Hai cột: Lịch cần xử lý (khung hiện tại & quá giờ chưa gọi) + Nhóm khung giờ sắp tới */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                {/* Cột 1: Lịch hẹn & số chờ trong khung giờ hiện tại / khung giờ trước chưa gọi */}
                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                    Danh sách chờ gọi trong khung giờ ({waitingEligibleTickets.length})
                  </h3>
                  <p style={{ fontSize: 12, color: "#6B7280", marginTop: 0, marginBottom: 12 }}>
                    Sắp xếp ưu tiên theo <strong>Khung giờ → Số gọi</strong>. Lượt của khung giờ trước chưa được gọi được giữ ở đầu danh sách và đánh dấu <strong>Chưa được phục vụ</strong>.
                  </p>
                  {waitingEligibleTickets.length === 0 ? (
                    <p style={{ color: "#6B7280", margin: 0 }}>
                      Không còn lượt chờ trong khung giờ hiện tại.
                    </p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Khung giờ</th>
                          <th>Số gọi</th>
                          <th>Người dân / Nhu cầu</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waitingEligibleTickets.map(t => {
                          const badge = getUnifiedBadge(t);
                          return (
                            <tr key={t.id} style={t.isPastSlot ? { background: "#FEF2F2" } : undefined}>
                              <td>
                                <strong>{t.slotRange || t.slot || "Trực tiếp"}</strong>
                              </td>
                              <td>
                                <strong style={{ fontSize: 16, color: "#1D4ED8" }}>{t.displayNumber}</strong>
                                <div style={{ fontSize: 11, color: "#6B7280" }}>
                                  <code>{t.appointmentLookupCode || t.lookupCode}</code>
                                </div>
                              </td>
                              <td>
                                <div>{t.contactName || (t.source === "WALK_IN" ? "Khách trực tiếp" : "Đặt lịch online")}</div>
                                {t.procedureName && (
                                  <div style={{ fontSize: 12, color: "#6B7280" }}>{t.procedureName}</div>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${badge.cls}`}>{badge.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Cột 2: Nhóm khung giờ sắp tới trong ngày */}
                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                    Nhóm khung giờ sắp tới ({waitingFutureTickets.length})
                  </h3>
                  <p style={{ fontSize: 12, color: "#6B7280", marginTop: 0, marginBottom: 12 }}>
                    Đã được cấp số gọi ngay khi đặt lịch. Hệ thống không tự động gọi sớm khi chưa đến khung giờ hẹn.
                  </p>
                  {waitingFutureTickets.length === 0 ? (
                    <p style={{ color: "#6B7280", margin: 0 }}>Chưa có lịch hẹn ở các khung giờ tiếp theo.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Khung giờ</th>
                          <th>Số gọi đã cấp</th>
                          <th>Người dân</th>
                          <th>Trạng thái</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waitingFutureTickets.map(t => {
                          const badge = getUnifiedBadge(t);
                          return (
                            <tr key={t.id}>
                              <td>
                                <strong>{t.slotRange || t.slot}</strong>
                              </td>
                              <td>
                                <strong style={{ color: "#1D4ED8" }}>{t.displayNumber}</strong>
                                <div style={{ fontSize: 11, color: "#6B7280" }}>
                                  <code>{t.appointmentLookupCode || t.lookupCode}</code>
                                </div>
                              </td>
                              <td>
                                <div>{t.contactName || "Người dân"}</div>
                                {t.contactPhone && (
                                  <div style={{ fontSize: 12, color: "#6B7280" }}>{t.contactPhone}</div>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${badge.cls}`}>{badge.label}</span>
                              </td>
                              <td>
                                {t.appointmentId && (
                                  <button
                                    className="btn btn-danger"
                                    style={{ padding: "4px 8px", fontSize: 12 }}
                                    disabled={busyAction}
                                    onClick={() =>
                                      runAction(
                                        () => api.cancelAdminAppointment(t.appointmentId, "Hủy theo yêu cầu tại quầy"),
                                        `Đã hủy lịch hẹn ${t.displayNumber}`,
                                      )
                                    }
                                  >
                                    Hủy lịch
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Nhóm đã hoàn tất / đã hủy / vắng mặt & Nhật ký sự kiện */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 12 }}>
                    Đã hoàn tất / Đã hủy / Vắng mặt ({doneTickets.length})
                  </h3>
                  {doneTickets.length === 0 ? (
                    <p style={{ color: "#6B7280", margin: 0 }}>Chưa có lượt nào kết thúc trong ngày.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Khung giờ</th>
                          <th>Số gọi</th>
                          <th>Người dân</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doneTickets.slice(0, 20).map(t => {
                          const badge = getUnifiedBadge(t);
                          return (
                            <tr key={t.id}>
                              <td>{t.slotRange || t.slot || "Trực tiếp"}</td>
                              <td>
                                <strong>{t.displayNumber}</strong>
                              </td>
                              <td>{t.contactName || "—"}</td>
                              <td>
                                <span className={`badge ${badge.cls}`}>{badge.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 12 }}>Nhật ký sự kiện tại quầy ({events.length})</h3>
                  {events.length === 0 ? (
                    <p style={{ color: "#6B7280", margin: 0 }}>Chưa có sự kiện nào trong ngày.</p>
                  ) : (
                    <div style={{ maxHeight: 260, overflowY: "auto", fontSize: 13 }}>
                      {events.map(ev => (
                        <div key={ev.id} style={{ padding: "6px 0", borderBottom: "1px solid #F3F4F6" }}>
                          <strong>{ev.type}</strong> •{" "}
                          <span style={{ color: "#6B7280" }}>
                            {new Date(ev.createdAt).toLocaleTimeString("vi-VN")}
                          </span>{" "}
                          • <span>{ev.actorType}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════════ TAB 2: MÀN HÌNH QUẢN TRỊ "LỊCH PHỤC VỤ" (MỤC 9) ══════════════════ */}
      {tab === "config" && isSuper && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Khởi tạo nhanh 4 quầy chuẩn theo 4 nhóm lĩnh vực đã xác nhận */}
          <div className="card" style={{ padding: 16, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>4 Quầy phục vụ theo lĩnh vực đã xác nhận của Trung tâm</h3>
                <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0 0" }}>
                  Quầy 1: Tư pháp – hộ tịch • Quầy 2: Kinh doanh – môi trường • Quầy 3: Đất đai – quy hoạch • Quầy 4: Văn hóa – giáo dục – y tế – LĐTBXH (Mặc định <strong>30 phút/lượt</strong>).
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busyAction}
                onClick={handleSetupStandardFourCounters}
              >
                Khởi tạo / Đồng bộ 4 Quầy chuẩn (Q1–Q4)
              </button>
            </div>
          </div>

          {selectedCounterObj && configForm && (
            <>
              {/* Bảng tính tự động năng lực phục vụ (Mục 9.2) */}
              {liveCapacityPreview && (
                <div className="card" style={{ padding: 16, background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                  <h3 style={{ marginTop: 0, marginBottom: 8, color: "#1E3A8A" }}>
                    Bảng tính tự động năng lực phục vụ — Quầy {selectedCounterObj.code} ({selectedCounterObj.name})
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                    <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>Số khung {liveCapacityPreview.slotMins} phút / ngày</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#1D4ED8" }}>
                        {liveCapacityPreview.totalSlotsPerDay} khung
                      </div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>
                        Sáng {liveCapacityPreview.morningSlots} • Chiều {liveCapacityPreview.afternoonSlots}
                      </div>
                    </div>
                    <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>Vị trí tiếp nhận đồng thời</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#1D4ED8" }}>
                        {liveCapacityPreview.positions} vị trí
                      </div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>Số chỗ mỗi khung giờ</div>
                    </div>
                    <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>Tổng số lượt tối đa của quầy</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#047857" }}>
                        {liveCapacityPreview.effectiveMaxTurns} lượt/ngày
                      </div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>
                        Lý thuyết: {liveCapacityPreview.theoreticalMaxTurns} lượt
                      </div>
                    </div>
                    <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>Cho phép đặt lịch online</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#2563EB" }}>
                        {liveCapacityPreview.onlineQuota} lượt/ngày
                      </div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>Cấp số gọi ngay khi đặt</div>
                    </div>
                    <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>Dành cho khách đến trực tiếp</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#D97706" }}>
                        {liveCapacityPreview.walkInRemaining} lượt/ngày
                      </div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>Dự phòng tại quầy</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cấu hình theo quầy (Mục 9.1) */}
              <form onSubmit={handleSaveCounterConfig} className="card" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0 }}>
                  Cấu hình Lịch phục vụ — Quầy {selectedCounterObj.code} ({selectedCounterObj.name})
                </h3>
                <p style={{ fontSize: 13, color: "#6B7280", marginTop: 0 }}>
                  Hệ thống tự động chặn nếu giảm số vị trí tiếp nhận hoặc trần đặt lịch online xuống thấp hơn số lịch người dân đã đặt.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label className="form-label">Tên quầy phục vụ</label>
                    <input
                      className="form-input"
                      value={configForm.name}
                      onChange={e => setConfigForm({ ...configForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Mô tả / Ghi chú cấu hình</label>
                    <input
                      className="form-input"
                      value={configForm.description}
                      onChange={e => setConfigForm({ ...configForm, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Thời lượng phục vụ mặc định (phút/lượt) *</label>
                    <input
                      type="number"
                      min="5"
                      max="480"
                      className="form-input"
                      value={configForm.slotMinutes}
                      onChange={e => setConfigForm({ ...configForm, slotMinutes: e.target.value })}
                      placeholder="Mặc định: 30"
                    />
                  </div>
                  <div>
                    <label className="form-label">Số vị trí/cán bộ tiếp nhận đồng thời *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={configForm.slotCapacity}
                      onChange={e => setConfigForm({ ...configForm, slotCapacity: e.target.value })}
                      placeholder="Mặc định: 1"
                    />
                  </div>
                  <div>
                    <label className="form-label">Số lượt đặt online tối đa / ngày *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={configForm.appointmentQuota}
                      onChange={e => setConfigForm({ ...configForm, appointmentQuota: e.target.value })}
                      placeholder="VD: 10"
                    />
                  </div>
                  <div>
                    <label className="form-label">Tổng sức chứa tối đa / ngày (dailyCapacity)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={configForm.dailyCapacity}
                      onChange={e => setConfigForm({ ...configForm, dailyCapacity: e.target.value })}
                      placeholder="VD: 15"
                    />
                  </div>
                  <div>
                    <label className="form-label">Đặt trước tối đa (ngày) *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={configForm.bookingMaxDaysAhead}
                      onChange={e => setConfigForm({ ...configForm, bookingMaxDaysAhead: e.target.value })}
                      placeholder="VD: 7"
                    />
                  </div>
                  <div>
                    <label className="form-label">Khóa đặt trước giờ hẹn (phút)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={configForm.bookingMinLeadMinutes}
                      onChange={e => setConfigForm({ ...configForm, bookingMinLeadMinutes: e.target.value })}
                      placeholder="VD: 30"
                    />
                  </div>
                  <div>
                    <label className="form-label">Giới hạn lịch đang chờ / người dân *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={configForm.maxActiveAppointmentsPerCitizen}
                      onChange={e => setConfigForm({ ...configForm, maxActiveAppointmentsPerCitizen: e.target.value })}
                      placeholder="VD: 2"
                    />
                  </div>
                  <div>
                    <label className="form-label">Hạn mức trực tiếp tại quầy (walkInQuota)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={configForm.walkInQuota}
                      onChange={e => setConfigForm({ ...configForm, walkInQuota: e.target.value })}
                      placeholder="Để trống = theo sức chứa còn lại"
                    />
                  </div>
                </div>

                {/* Gán lĩnh vực phụ trách */}
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Lĩnh vực thủ tục thuộc quầy này (mỗi lĩnh vực thuộc 1 quầy)</label>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {allFields.map(f => {
                      const checked = configForm.fieldIds.includes(f.id);
                      return (
                        <label
                          key={f.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: checked ? "#EFF6FF" : "#F9FAFB",
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: checked ? "1px solid #93C5FD" : "1px solid #E5E7EB",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              const next = e.target.checked
                                ? [...configForm.fieldIds, f.id]
                                : configForm.fieldIds.filter(id => id !== f.id);
                              setConfigForm({ ...configForm, fieldIds: next });
                            }}
                          />
                          {f.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Công tắc Bật/Tắt nhận đặt lịch của quầy */}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={configForm.isActive}
                      onChange={e => setConfigForm({ ...configForm, isActive: e.target.checked })}
                    />
                    Kích hoạt quầy phục vụ
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={configForm.appointmentEnabled}
                      onChange={e => setConfigForm({ ...configForm, appointmentEnabled: e.target.checked })}
                    />
                    Nhận đặt lịch & cấp số online
                  </label>
                </div>

                <button type="submit" className="btn btn-primary">
                  Lưu cấu hình quầy
                </button>
              </form>

              {/* Lịch làm việc chung theo tuần (Buổi sáng & Buổi chiều) */}
              <div className="card" style={{ padding: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>Ngày làm việc & Giờ nhận lịch buổi sáng / buổi chiều</h3>
                    <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0 0" }}>
                      Hệ thống tự động chia thành các khung giờ {configForm.slotMinutes || 30} phút trong từng buổi.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleApplyStandardWeekdaySchedule}
                    >
                      Điền nhanh Thứ 2 – Thứ 6 (07:30–11:30 & 13:30–17:00)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        setScheduleWindows([
                          ...scheduleWindows,
                          { weekday: 1, startTime: "07:30", endTime: "11:30" },
                        ])
                      }
                    >
                      + Thêm khung giờ
                    </button>
                  </div>
                </div>
                {scheduleWindows.length === 0 ? (
                  <p style={{ color: "#6B7280" }}>Chưa có khung giờ hoạt động nào.</p>
                ) : (
                  <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                    {scheduleWindows.map((w, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                          className="form-input"
                          style={{ width: 150 }}
                          value={w.weekday}
                          onChange={e => {
                            const copy = [...scheduleWindows];
                            copy[idx] = { ...copy[idx], weekday: Number(e.target.value) };
                            setScheduleWindows(copy);
                          }}
                        >
                          {WEEKDAYS.map((label, d) => (
                            <option key={d} value={d}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          className="form-input"
                          style={{ width: 130 }}
                          value={w.startTime}
                          onChange={e => {
                            const copy = [...scheduleWindows];
                            copy[idx] = { ...copy[idx], startTime: e.target.value };
                            setScheduleWindows(copy);
                          }}
                        />
                        <span>đến</span>
                        <input
                          type="time"
                          className="form-input"
                          style={{ width: 130 }}
                          value={w.endTime}
                          onChange={e => {
                            const copy = [...scheduleWindows];
                            copy[idx] = { ...copy[idx], endTime: e.target.value };
                            setScheduleWindows(copy);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => setScheduleWindows(scheduleWindows.filter((_, i) => i !== idx))}
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="btn btn-primary" onClick={handleSaveSchedules}>
                  Lưu giờ hoạt động
                </button>
              </div>

              {/* Ngoại lệ theo ngày & Phân công cán bộ (Mục 9.3) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0 }}>Ngoại lệ theo ngày (Tạm dừng nhận lịch mới / Nghỉ lễ)</h3>
                  <p style={{ fontSize: 12, color: "#6B7280", marginTop: 0 }}>
                    Khi tạm dừng một ngày đã có người đặt lịch: hệ thống <strong>khóa nhận lịch mới</strong> nhưng <strong>không tự động hủy ngầm</strong> các lịch đã được cấp số.
                  </p>
                  <form onSubmit={handleAddClosure} style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    <input
                      type="date"
                      className="form-input"
                      value={closureForm.date}
                      onChange={e => setClosureForm({ ...closureForm, date: e.target.value })}
                      required
                    />
                    <input
                      className="form-input"
                      placeholder="Lý do (VD: Nghỉ lễ / Họp đột xuất)"
                      value={closureForm.note}
                      onChange={e => setClosureForm({ ...closureForm, note: e.target.value })}
                    />
                    <button type="submit" className="btn btn-primary">
                      Khóa nhận lịch ngày này
                    </button>
                  </form>
                  {(selectedCounterObj.closures || []).length === 0 ? (
                    <p style={{ color: "#6B7280", margin: 0 }}>Chưa có ngày ngoại lệ nào.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {selectedCounterObj.closures.map(cl => (
                        <li key={cl.id} style={{ marginBottom: 6 }}>
                          <strong>{cl.date}</strong> — {cl.note || "Tạm dừng nhận lịch mới"}
                          <button
                            className="btn btn-danger"
                            style={{ marginLeft: 8, padding: "2px 6px", fontSize: 11 }}
                            onClick={() => handleRemoveClosure(cl.id)}
                          >
                            Mở lại
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0 }}>Phân công cán bộ phụ trách quầy</h3>
                  <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                    {staffCandidates.map(adm => {
                      const checked = selectedStaffIds.includes(adm.id);
                      return (
                        <label key={adm.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              const next = e.target.checked
                                ? [...selectedStaffIds, adm.id]
                                : selectedStaffIds.filter(id => id !== adm.id);
                              setSelectedStaffIds(next);
                            }}
                          />
                          {adm.fullName} (<code>{adm.username}</code> — {adm.role})
                        </label>
                      );
                    })}
                  </div>
                  <button type="button" className="btn btn-primary" onClick={handleSaveStaff}>
                    Lưu phân công cán bộ
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Tạo thêm quầy tùy chỉnh (nếu cần ngoài 4 quầy chuẩn) */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Tạo thêm quầy phục vụ</h3>
            <form
              onSubmit={handleCreateCounter}
              style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
            >
              <div>
                <label className="form-label">Mã quầy (VD: Q1..Q4)</label>
                <input
                  className="form-input"
                  value={newCounter.code}
                  onChange={e => setNewCounter({ ...newCounter, code: e.target.value })}
                  required
                  style={{ width: 120 }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label className="form-label">Tên quầy</label>
                <input
                  className="form-input"
                  value={newCounter.name}
                  onChange={e => setNewCounter({ ...newCounter, name: e.target.value })}
                  required
                  placeholder="VD: Quầy 1 — Tư pháp – hộ tịch"
                />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label className="form-label">Mô tả</label>
                <input
                  className="form-input"
                  value={newCounter.description}
                  onChange={e => setNewCounter({ ...newCounter, description: e.target.value })}
                  placeholder="VD: [CẤU HÌNH THỬ] 30 phút/lượt"
                />
              </div>
              <button type="submit" className="btn btn-secondary">
                Tạo quầy
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal chuyển quầy */}
      {transferModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <h3 style={{ marginTop: 0 }}>Chuyển quầy cho số {transferModal.ticket.displayNumber}</h3>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Chuyển sang quầy</label>
              <select
                className="form-input"
                value={transferModal.toCounterId}
                onChange={e => setTransferModal({ ...transferModal, toCounterId: e.target.value })}
              >
                {counters
                  .filter(c => c.id !== selectedCounterId)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      Quầy {c.code} — {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Lý do chuyển quầy (bắt buộc)</label>
              <input
                className="form-input"
                value={transferModal.reason}
                onChange={e => setTransferModal({ ...transferModal, reason: e.target.value })}
                placeholder="VD: Đúng thẩm quyền lĩnh vực Đất đai"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setTransferModal(null)}>
                Hủy
              </button>
              <button
                className="btn btn-primary"
                disabled={!transferModal.toCounterId || !transferModal.reason.trim() || busyAction}
                onClick={() =>
                  runAction(async () => {
                    await api.transferTicket(transferModal.ticket.id, {
                      toCounterId: transferModal.toCounterId,
                      reason: transferModal.reason.trim(),
                    });
                    setTransferModal(null);
                  }, "Đã chuyển phiếu sang quầy mới")
                }
              >
                Xác nhận chuyển
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
