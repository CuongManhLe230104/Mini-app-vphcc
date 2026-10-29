import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

const TICKET_STATUS_LABEL = {
  WAITING: { label: "Đang chờ", cls: "badge-pending" },
  CALLING: { label: "Đang gọi", cls: "badge-published" },
  SERVING: { label: "Đang phục vụ", cls: "badge-published" },
  COMPLETED: { label: "Hoàn tất", cls: "badge-draft" },
  CANCELLED: { label: "Đã hủy", cls: "badge-rejected" },
  NO_SHOW: { label: "Vắng mặt", cls: "badge-rejected" },
  TRANSFERRED: { label: "Đã chuyển quầy", cls: "badge-draft" },
};

const APPT_STATUS_LABEL = {
  CONFIRMED: { label: "Đã xác nhận", cls: "badge-pending" },
  CHECKED_IN: { label: "Đã check-in", cls: "badge-published" },
  COMPLETED: { label: "Hoàn tất", cls: "badge-draft" },
  CANCELLED: { label: "Đã hủy", cls: "badge-rejected" },
  RESCHEDULED: { label: "Đã đổi lịch", cls: "badge-draft" },
  NO_SHOW: { label: "Vắng mặt", cls: "badge-rejected" },
};

function makeIdemKey() {
  return "adm_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function toNullOrInt(val) {
  if (val === "" || val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : null;
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
  const [transferModal, setTransferModal] = useState(null); // { ticket, toCounterId, reason }

  // Dữ liệu cấu hình (SUPER_ADMIN)
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
          slotMinutes: current.slotMinutes ?? "",
          slotCapacity: current.slotCapacity ?? "",
          bookingMinLeadMinutes: current.bookingMinLeadMinutes ?? "",
          bookingMaxDaysAhead: current.bookingMaxDaysAhead ?? "",
          maxActiveTicketsPerCitizen: current.maxActiveTicketsPerCitizen ?? "",
          maxActiveAppointmentsPerCitizen: current.maxActiveAppointmentsPerCitizen ?? "",
          fieldIds: (current.fields || []).map(f => f.fieldId),
        });
        setScheduleWindows((current.schedules || []).map(s => ({
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
        })));
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

  const handleCreateCounter = async (e) => {
    e.preventDefault();
    try {
      const created = await api.createCounter({
        code: newCounter.code.trim().toUpperCase(),
        name: newCounter.name.trim(),
        description: newCounter.description.trim() || undefined,
      });
      toastOk(`Đã tạo quầy ${created.code} (trạng thái chưa kích hoạt)`);
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
        ticketEnabled: configForm.ticketEnabled,
        appointmentEnabled: configForm.appointmentEnabled,
        dailyCapacity: toNullOrInt(configForm.dailyCapacity),
        ticketQuota: toNullOrInt(configForm.ticketQuota),
        appointmentQuota: toNullOrInt(configForm.appointmentQuota),
        walkInQuota: toNullOrInt(configForm.walkInQuota),
        slotMinutes: toNullOrInt(configForm.slotMinutes),
        slotCapacity: toNullOrInt(configForm.slotCapacity),
        bookingMinLeadMinutes: toNullOrInt(configForm.bookingMinLeadMinutes),
        bookingMaxDaysAhead: toNullOrInt(configForm.bookingMaxDaysAhead),
        maxActiveTicketsPerCitizen: toNullOrInt(configForm.maxActiveTicketsPerCitizen),
        maxActiveAppointmentsPerCitizen: toNullOrInt(configForm.maxActiveAppointmentsPerCitizen),
        fieldIds: configForm.fieldIds,
      });
      toastOk("Đã lưu cấu hình quầy & hạn mức");
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
      toastOk("Đã lưu giờ hoạt động của quầy");
      await loadCounters();
      await loadBoard(selectedCounterId, date);
    } catch (err) {
      toastErr(err.message);
    }
  };

  const handleAddClosure = async (e) => {
    e.preventDefault();
    if (!selectedCounterId || !closureForm.date) return;
    try {
      await api.addCounterClosure(selectedCounterId, closureForm);
      toastOk("Đã thêm ngày nghỉ cho quầy");
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
      toastOk("Đã xóa ngày nghỉ");
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

  const activeTickets = (board?.tickets || []).filter(t => t.status === "CALLING" || t.status === "SERVING");
  const waitingTickets = (board?.tickets || []).filter(t => t.status === "WAITING");
  const doneTickets = (board?.tickets || []).filter(t => !["WAITING", "CALLING", "SERVING"].includes(t.status));
  const selectedCounterObj = counters.find(c => c.id === selectedCounterId);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Số thứ tự & Lịch hẹn tại quầy</h1>
          <p className="page-subtitle">Quản lý hàng chờ tập trung, check-in lịch hẹn và cấu hình hạn mức quầy</p>
        </div>
        {isSuper && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className={`btn ${tab === "board" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("board")}>
              🎫 Bảng vận hành quầy
            </button>
            <button className={`btn ${tab === "config" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("config")}>
              ⚙️ Cấu hình quầy & hạn mức
            </button>
          </div>
        )}
      </div>

      {/* Bộ chọn Quầy + Ngày + Tra cứu mã */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
          <div style={{ minWidth: 220 }}>
            <label className="form-label">Chọn quầy phục vụ</label>
            <select
              className="form-input"
              value={selectedCounterId}
              onChange={e => setSelectedCounterId(e.target.value)}
            >
              {counters.length === 0 && <option value="">-- Chưa có quầy nào --</option>}
              {counters.map(c => (
                <option key={c.id} value={c.id}>
                  Quầy {c.code} — {c.name} {!c.isActive ? "(Chưa kích hoạt)" : ""}
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

          <button className="btn btn-secondary" onClick={() => loadBoard(selectedCounterId, date)} disabled={loading || !selectedCounterId}>
            🔄 Làm mới
          </button>

          <form onSubmit={handleLookup} style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
            <input
              className="form-input"
              placeholder="Nhập mã tra cứu (VD: T... / A...)"
              value={lookupInput}
              onChange={e => setLookupInput(e.target.value)}
              style={{ width: 230 }}
            />
            <button type="submit" className="btn btn-primary">🔍 Tra mã</button>
          </form>
        </div>

        {lookupResult && (
          <div style={{ marginTop: 12, padding: 12, background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            {lookupResult.kind === "TICKET" ? (
              <div>
                <strong>Phiếu số {lookupResult.ticket.displayNumber}</strong> (Mã: <code>{lookupResult.ticket.lookupCode}</code>) — Quầy {lookupResult.ticket.counter.code} — Ngày {lookupResult.ticket.serviceDate} — Trạng thái: <strong>{TICKET_STATUS_LABEL[lookupResult.ticket.status]?.label || lookupResult.ticket.status}</strong>
              </div>
            ) : (
              <div>
                <strong>Lịch hẹn khung {lookupResult.appointment.slot}</strong> ngày {lookupResult.appointment.serviceDate} (Mã: <code>{lookupResult.appointment.lookupCode}</code>) — Người đặt: <strong>{lookupResult.appointment.contactName}</strong> ({lookupResult.appointment.contactPhone || "Không SĐT"}) — Trạng thái: <strong>{APPT_STATUS_LABEL[lookupResult.appointment.status]?.label || lookupResult.appointment.status}</strong>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              {lookupResult.kind === "APPOINTMENT" && lookupResult.appointment.status === "CONFIRMED" && (
                <button
                  className="btn btn-primary"
                  disabled={busyAction}
                  onClick={() => runAction(async () => {
                    await api.checkInAppointment(lookupResult.appointment.id);
                    setLookupResult(null);
                  }, "Đã check-in lịch hẹn và cấp số vào hàng chờ")}
                >
                  ✅ Check-in & Cấp số
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setLookupResult(null)}>Đóng</button>
            </div>
          </div>
        )}
      </div>

      {loadError && (
        <div className="card" role="alert" style={{ padding: 16, marginBottom: 16, background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}>
          <strong>Lỗi kết nối / tải dữ liệu:</strong> {loadError}
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => loadBoard(selectedCounterId, date)}>Thử lại</button>
          </div>
        </div>
      )}

      {tab === "board" && (
        <>
          {!selectedCounterId ? (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              Chưa có quầy phục vụ nào được tạo hoặc phân công cho tài khoản của bạn.
              {isSuper && <div style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={() => setTab("config")}>Tạo & cấu hình quầy ngay</button></div>}
            </div>
          ) : loading ? (
            <div className="card" style={{ padding: 24 }}>Đang tải dữ liệu quầy...</div>
          ) : board && (
            <>
              {/* Cảnh báo trạng thái quầy */}
              {(!board.counter.isActive || board.counter.closedToday || !board.counter.readiness.ticket.ready || !board.counter.readiness.appointment.ready) && (
                <div className="card" style={{ padding: 14, marginBottom: 16, background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E" }}>
                  <div><strong>⚠️ Trạng thái cấu hình & hoạt động của Quầy {board.counter.code}:</strong></div>
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {!board.counter.isActive && <li>Quầy đang ở trạng thái <strong>Chưa kích hoạt</strong> (người dân chưa thể lấy số/đặt lịch).</li>}
                    {board.counter.closedToday && <li>Quầy đang <strong>Đóng cửa ngày {board.date}</strong> ({board.counter.closureNote || "Ngày nghỉ"}).</li>}
                    {!board.counter.readiness.ticket.ready && <li>Lấy số trực tuyến chưa mở: {board.counter.readiness.ticket.missing.join(", ")}.</li>}
                    {!board.counter.readiness.appointment.ready && <li>Đặt lịch hẹn chưa mở: {board.counter.readiness.appointment.missing.join(", ")}.</li>}
                  </ul>
                </div>
              )}

              {/* Thống kê nhanh & Nút điều khiển chính */}
              <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <div><div style={{ fontSize: 12, color: "#6B7280" }}>Đang chờ</div><div style={{ fontSize: 22, fontWeight: 700, color: "#0068FF" }}>{board.summary.waiting}</div></div>
                  <div><div style={{ fontSize: 12, color: "#6B7280" }}>Đang gọi / Phục vụ</div><div style={{ fontSize: 22, fontWeight: 700, color: "#059669" }}>{board.summary.calling + board.summary.serving}</div></div>
                  <div><div style={{ fontSize: 12, color: "#6B7280" }}>Hoàn tất</div><div style={{ fontSize: 22, fontWeight: 700 }}>{board.summary.completed}</div></div>
                  <div><div style={{ fontSize: 12, color: "#6B7280" }}>Lịch hẹn chờ check-in</div><div style={{ fontSize: 22, fontWeight: 700, color: "#D97706" }}>{board.summary.appointmentsConfirmed}</div></div>
                  <div><div style={{ fontSize: 12, color: "#6B7280" }}>Tổng tải ngày</div><div style={{ fontSize: 22, fontWeight: 700 }}>{board.summary.totalUsed}{board.counter.dailyCapacity !== null ? ` / ${board.counter.dailyCapacity}` : ""}</div></div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-primary"
                    disabled={busyAction || board.summary.waiting === 0}
                    onClick={() => runAction(() => api.callNextTicket(selectedCounterId), "Đã gọi số tiếp theo")}
                  >
                    📢 Gọi số tiếp theo ({board.summary.waiting})
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={busyAction || !board.counter.isActive || board.counter.closedToday}
                    onClick={() => runAction(() => api.issueWalkInTicket(selectedCounterId, {}, makeIdemKey()), "Đã cấp số trực tiếp tại quầy")}
                  >
                    ➕ Cấp số trực tiếp (Walk-in)
                  </button>
                </div>
              </div>

              {/* Số đang gọi / đang phục vụ */}
              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>🔔 Số đang gọi / Đang phục vụ ({activeTickets.length})</h3>
                {activeTickets.length === 0 ? (
                  <p style={{ color: "#6B7280", margin: 0 }}>Hiện chưa có số nào đang được gọi.</p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {activeTickets.map(t => (
                      <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, flexWrap: "wrap", gap: 10 }}>
                        <div>
                          <span style={{ fontSize: 22, fontWeight: 800, color: "#047857", marginRight: 12 }}>{t.displayNumber}</span>
                          <span className={`badge ${TICKET_STATUS_LABEL[t.status]?.cls || ""}`}>{TICKET_STATUS_LABEL[t.status]?.label}</span>
                          <span style={{ marginLeft: 10, fontSize: 13, color: "#4B5563" }}>
                            Mã: <code>{t.lookupCode}</code> • Nguồn: {t.source} • Đã gọi {t.callCount} lần
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {t.status === "CALLING" && (
                            <>
                              <button className="btn btn-secondary" disabled={busyAction} onClick={() => runAction(() => api.recallTicket(t.id), `Đã gọi lại số ${t.displayNumber}`)}>
                                🔁 Gọi lại
                              </button>
                              <button className="btn btn-primary" disabled={busyAction} onClick={() => runAction(() => api.startServingTicket(t.id), `Bắt đầu phục vụ ${t.displayNumber}`)}>
                                ▶️ Bắt đầu phục vụ
                              </button>
                              <button className="btn btn-danger" disabled={busyAction} onClick={() => runAction(() => api.noShowTicket(t.id, "Gọi không có mặt"), `Đã đánh dấu vắng mặt ${t.displayNumber}`)}>
                                🚫 Vắng mặt
                              </button>
                            </>
                          )}
                          {t.status === "SERVING" && (
                            <button className="btn btn-primary" disabled={busyAction} onClick={() => runAction(() => api.completeTicket(t.id), `Đã hoàn tất số ${t.displayNumber}`)}>
                              ✅ Hoàn tất
                            </button>
                          )}
                          <button
                            className="btn btn-secondary"
                            disabled={busyAction || counters.length < 2}
                            onClick={() => setTransferModal({ ticket: t, toCounterId: counters.find(c => c.id !== selectedCounterId)?.id || "", reason: "" })}
                          >
                            ↪️ Chuyển quầy
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hai cột: Hàng chờ & Lịch hẹn */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 16 }}>
                {/* Hàng chờ WAITING */}
                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 12 }}>⏳ Hàng chờ ({waitingTickets.length})</h3>
                  {waitingTickets.length === 0 ? (
                    <p style={{ color: "#6B7280", margin: 0 }}>Không có số nào đang chờ.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Số</th>
                          <th>Mã tra cứu</th>
                          <th>Nguồn</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waitingTickets.map(t => (
                          <tr key={t.id}>
                            <td><strong>{t.displayNumber}</strong></td>
                            <td><code>{t.lookupCode}</code></td>
                            <td>{t.source}</td>
                            <td>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: "4px 8px", fontSize: 12 }}
                                disabled={busyAction || counters.length < 2}
                                onClick={() => setTransferModal({ ticket: t, toCounterId: counters.find(c => c.id !== selectedCounterId)?.id || "", reason: "" })}
                              >
                                Chuyển quầy
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Lịch hẹn trong ngày */}
                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 12 }}>📅 Lịch hẹn ngày {board.date} ({board.appointments.length})</h3>
                  {board.appointments.length === 0 ? (
                    <p style={{ color: "#6B7280", margin: 0 }}>Chưa có lịch hẹn nào trong ngày này.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Giờ</th>
                          <th>Người dân</th>
                          <th>Mã / Số</th>
                          <th>Trạng thái</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {board.appointments.map(a => (
                          <tr key={a.id}>
                            <td><strong>{a.slot}</strong></td>
                            <td>
                              <div>{a.contactName}</div>
                              {a.contactPhone && <div style={{ fontSize: 12, color: "#6B7280" }}>{a.contactPhone}</div>}
                            </td>
                            <td>
                              <div><code>{a.lookupCode}</code></div>
                              {a.ticket && <div style={{ fontSize: 12, color: "#047857", fontWeight: 600 }}>Số: {a.ticket.displayNumber}</div>}
                            </td>
                            <td>
                              <span className={`badge ${APPT_STATUS_LABEL[a.status]?.cls || ""}`}>
                                {APPT_STATUS_LABEL[a.status]?.label || a.status}
                              </span>
                            </td>
                            <td>
                              {a.status === "CONFIRMED" && (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  <button
                                    className="btn btn-primary"
                                    style={{ padding: "4px 8px", fontSize: 12 }}
                                    disabled={busyAction}
                                    onClick={() => runAction(() => api.checkInAppointment(a.id), "Đã check-in và cấp số vào hàng chờ")}
                                  >
                                    Check-in
                                  </button>
                                  <button
                                    className="btn btn-danger"
                                    style={{ padding: "4px 8px", fontSize: 12 }}
                                    disabled={busyAction}
                                    onClick={() => runAction(() => api.noShowAppointment(a.id, "Quá giờ không đến"), "Đã đánh dấu vắng mặt")}
                                  >
                                    Vắng
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Lịch sử phiếu đã kết thúc & Sự kiện tại quầy */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 12 }}>📋 Phiếu đã kết thúc ({doneTickets.length})</h3>
                  {doneTickets.length === 0 ? (
                    <p style={{ color: "#6B7280", margin: 0 }}>Chưa có phiếu nào kết thúc.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr><th>Số</th><th>Mã</th><th>Trạng thái</th></tr>
                      </thead>
                      <tbody>
                        {doneTickets.slice(0, 15).map(t => (
                          <tr key={t.id}>
                            <td><strong>{t.displayNumber}</strong></td>
                            <td><code>{t.lookupCode}</code></td>
                            <td><span className={`badge ${TICKET_STATUS_LABEL[t.status]?.cls || ""}`}>{TICKET_STATUS_LABEL[t.status]?.label || t.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 12 }}>🕒 Nhật ký sự kiện tại quầy ({events.length})</h3>
                  {events.length === 0 ? (
                    <p style={{ color: "#6B7280", margin: 0 }}>Chưa có sự kiện nào trong ngày.</p>
                  ) : (
                    <div style={{ maxHeight: 260, overflowY: "auto", fontSize: 13 }}>
                      {events.map(ev => (
                        <div key={ev.id} style={{ padding: "6px 0", borderBottom: "1px solid #F3F4F6" }}>
                          <strong>{ev.type}</strong> • <span style={{ color: "#6B7280" }}>{new Date(ev.createdAt).toLocaleTimeString("vi-VN")}</span> • <span>{ev.actorType}</span>
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

      {/* TAB CẤU HÌNH QUẦY (SUPER_ADMIN) */}
      {tab === "config" && isSuper && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Tạo quầy mới */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>➕ Tạo quầy phục vụ mới</h3>
            <p style={{ fontSize: 13, color: "#6B7280", marginTop: 0 }}>
              Quầy mới tạo sẽ ở trạng thái <strong>chưa kích hoạt</strong> cho tới khi Trung tâm duyệt và điền đủ lĩnh vực, giờ làm việc, hạn mức.
            </p>
            <form onSubmit={handleCreateCounter} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label className="form-label">Mã quầy (VD: A, B, Q1)</label>
                <input className="form-input" value={newCounter.code} onChange={e => setNewCounter({ ...newCounter, code: e.target.value })} required style={{ width: 120 }} />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label className="form-label">Tên quầy</label>
                <input className="form-input" value={newCounter.name} onChange={e => setNewCounter({ ...newCounter, name: e.target.value })} required placeholder="VD: Quầy Hộ tịch - Chứng thực" />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label className="form-label">Mô tả / Hướng dẫn vị trí</label>
                <input className="form-input" value={newCounter.description} onChange={e => setNewCounter({ ...newCounter, description: e.target.value })} placeholder="VD: Cửa số 1, tầng 1" />
              </div>
              <button type="submit" className="btn btn-primary">Tạo quầy</button>
            </form>
          </div>

          {selectedCounterObj && configForm && (
            <>
              <form onSubmit={handleSaveCounterConfig} className="card" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0 }}>⚙️ Cấu hình Quầy {selectedCounterObj.code} — {selectedCounterObj.name}</h3>
                <p style={{ fontSize: 13, color: "#6B7280", marginTop: 0 }}>
                  Để trống ô hạn mức nghĩa là <strong>chưa được Trung tâm duyệt</strong>. Chỉ bật lấy số / đặt lịch khi đã nhập các thông số bắt buộc.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
                  <div>
                    <label className="form-label">Tên quầy</label>
                    <input className="form-input" value={configForm.name} onChange={e => setConfigForm({ ...configForm, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="form-label">Mô tả vị trí</label>
                    <input className="form-input" value={configForm.description} onChange={e => setConfigForm({ ...configForm, description: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Sức chứa tối đa/ngày (dailyCapacity)</label>
                    <input type="number" min="0" className="form-input" value={configForm.dailyCapacity} onChange={e => setConfigForm({ ...configForm, dailyCapacity: e.target.value })} placeholder="Chưa duyệt (để trống)" />
                  </div>
                  <div>
                    <label className="form-label">Hạn mức lấy số online/ngày *</label>
                    <input type="number" min="0" className="form-input" value={configForm.ticketQuota} onChange={e => setConfigForm({ ...configForm, ticketQuota: e.target.value })} placeholder="Bắt buộc để mở lấy số" />
                  </div>
                  <div>
                    <label className="form-label">Hạn mức lịch hẹn/ngày *</label>
                    <input type="number" min="0" className="form-input" value={configForm.appointmentQuota} onChange={e => setConfigForm({ ...configForm, appointmentQuota: e.target.value })} placeholder="Bắt buộc để mở đặt lịch" />
                  </div>
                  <div>
                    <label className="form-label">Hạn mức trực tiếp tại quầy (walkInQuota)</label>
                    <input type="number" min="0" className="form-input" value={configForm.walkInQuota} onChange={e => setConfigForm({ ...configForm, walkInQuota: e.target.value })} placeholder="Để trống = không giới hạn" />
                  </div>
                  <div>
                    <label className="form-label">Độ dài khung giờ (phút) *</label>
                    <input type="number" min="5" max="480" className="form-input" value={configForm.slotMinutes} onChange={e => setConfigForm({ ...configForm, slotMinutes: e.target.value })} placeholder="VD: 30" />
                  </div>
                  <div>
                    <label className="form-label">Số chỗ mỗi khung giờ *</label>
                    <input type="number" min="1" className="form-input" value={configForm.slotCapacity} onChange={e => setConfigForm({ ...configForm, slotCapacity: e.target.value })} placeholder="VD: 3" />
                  </div>
                  <div>
                    <label className="form-label">Số ngày đặt trước tối đa *</label>
                    <input type="number" min="0" className="form-input" value={configForm.bookingMaxDaysAhead} onChange={e => setConfigForm({ ...configForm, bookingMaxDaysAhead: e.target.value })} placeholder="VD: 7" />
                  </div>
                  <div>
                    <label className="form-label">Đặt trước tối thiểu (phút)</label>
                    <input type="number" min="0" className="form-input" value={configForm.bookingMinLeadMinutes} onChange={e => setConfigForm({ ...configForm, bookingMinLeadMinutes: e.target.value })} placeholder="VD: 30" />
                  </div>
                  <div>
                    <label className="form-label">Số phiếu chờ tối đa / người *</label>
                    <input type="number" min="1" className="form-input" value={configForm.maxActiveTicketsPerCitizen} onChange={e => setConfigForm({ ...configForm, maxActiveTicketsPerCitizen: e.target.value })} placeholder="VD: 1" />
                  </div>
                  <div>
                    <label className="form-label">Số lịch hẹn chờ tối đa / người *</label>
                    <input type="number" min="1" className="form-input" value={configForm.maxActiveAppointmentsPerCitizen} onChange={e => setConfigForm({ ...configForm, maxActiveAppointmentsPerCitizen: e.target.value })} placeholder="VD: 2" />
                  </div>
                </div>

                {/* Gán lĩnh vực */}
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Lĩnh vực thủ tục thuộc quầy này</label>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {allFields.map(f => {
                      const checked = configForm.fieldIds.includes(f.id);
                      return (
                        <label key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#F9FAFB", padding: "6px 10px", borderRadius: 6, border: "1px solid #E5E7EB" }}>
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

                {/* Công tắc kích hoạt */}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <input type="checkbox" checked={configForm.isActive} onChange={e => setConfigForm({ ...configForm, isActive: e.target.checked })} />
                    Kích hoạt quầy (isActive)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <input type="checkbox" checked={configForm.ticketEnabled} onChange={e => setConfigForm({ ...configForm, ticketEnabled: e.target.checked })} />
                    Mở lấy số trong ngày (ticketEnabled)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <input type="checkbox" checked={configForm.appointmentEnabled} onChange={e => setConfigForm({ ...configForm, appointmentEnabled: e.target.checked })} />
                    Mở đặt lịch hẹn trước (appointmentEnabled)
                  </label>
                </div>

                <button type="submit" className="btn btn-primary">💾 Lưu cấu hình & hạn mức</button>
              </form>

              {/* Giờ hoạt động theo thứ */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>🕒 Giờ hoạt động theo tuần</h3>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setScheduleWindows([...scheduleWindows, { weekday: 1, startTime: "07:30", endTime: "11:30" }])}
                  >
                    + Thêm khung giờ
                  </button>
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
                          {WEEKDAYS.map((label, d) => <option key={d} value={d}>{label}</option>)}
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
                <button type="button" className="btn btn-primary" onClick={handleSaveSchedules}>💾 Lưu giờ hoạt động</button>
              </div>

              {/* Ngày nghỉ & Phân công cán bộ */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0 }}>🏖️ Ngày nghỉ / Đóng quầy đột xuất</h3>
                  <form onSubmit={handleAddClosure} style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    <input type="date" className="form-input" value={closureForm.date} onChange={e => setClosureForm({ ...closureForm, date: e.target.value })} required />
                    <input className="form-input" placeholder="Lý do nghỉ" value={closureForm.note} onChange={e => setClosureForm({ ...closureForm, note: e.target.value })} />
                    <button type="submit" className="btn btn-primary">Thêm</button>
                  </form>
                  {(selectedCounterObj.closures || []).length === 0 ? (
                    <p style={{ color: "#6B7280", margin: 0 }}>Chưa có ngày nghỉ nào được khai báo.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {selectedCounterObj.closures.map(cl => (
                        <li key={cl.id} style={{ marginBottom: 6 }}>
                          <strong>{cl.date}</strong> — {cl.note || "Nghỉ"}
                          <button className="btn btn-danger" style={{ marginLeft: 8, padding: "2px 6px", fontSize: 11 }} onClick={() => handleRemoveClosure(cl.id)}>Xóa</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ marginTop: 0 }}>👤 Phân công cán bộ phụ trách quầy</h3>
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
                  <button type="button" className="btn btn-primary" onClick={handleSaveStaff}>💾 Lưu phân công cán bộ</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal chuyển quầy */}
      {transferModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <h3 style={{ marginTop: 0 }}>Chuyển quầy cho phiếu {transferModal.ticket.displayNumber}</h3>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Chuyển sang quầy</label>
              <select
                className="form-input"
                value={transferModal.toCounterId}
                onChange={e => setTransferModal({ ...transferModal, toCounterId: e.target.value })}
              >
                {counters.filter(c => c.id !== selectedCounterId).map(c => (
                  <option key={c.id} value={c.id}>Quầy {c.code} — {c.name}</option>
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
              <button className="btn btn-secondary" onClick={() => setTransferModal(null)}>Hủy</button>
              <button
                className="btn btn-primary"
                disabled={!transferModal.toCounterId || !transferModal.reason.trim() || busyAction}
                onClick={() => runAction(async () => {
                  await api.transferTicket(transferModal.ticket.id, {
                    toCounterId: transferModal.toCounterId,
                    reason: transferModal.reason.trim(),
                  });
                  setTransferModal(null);
                }, "Đã chuyển phiếu sang quầy mới")}
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

