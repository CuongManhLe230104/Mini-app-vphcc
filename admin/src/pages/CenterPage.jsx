import { useState, useEffect } from "react";
import { api } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";


export default function CenterPage() {
  const { user } = useAuth();
  const { success: toastOk, error: toastErr } = useToast();
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [center, setCenter] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    setLoading(true); setLoadError("");
    api.getCenter()
      .then(data => {
        setCenter(data);
        setForm({
          name: data.name ?? "",
          fullName: data.fullName ?? "",
          address: data.address ?? "",
          hotline: data.hotline ?? "",
          oaId: data.oaId ?? "",
          servicePortalUrl: data.servicePortalUrl ?? "",
          caseTrackingUrl: data.caseTrackingUrl ?? "",
          workingHoursText: Array.isArray(data.workingHours)
            ? data.workingHours.map(w => `${w.day}: ${w.hours}`).join("\n")
            : "",
        });
      })
      .catch(err => {
        if (err.status !== 404) { setLoadError(err.message); return; }
        setForm({ name: "", fullName: "", address: "", hotline: "", oaId: "", servicePortalUrl: "", caseTrackingUrl: "", workingHoursText: "" });
      })
      .finally(() => setLoading(false));
  }, [retry]);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.workingHoursText.split("\n").filter(line => line.trim()).some(line => !/^.+?:.+$/.test(line))) throw new Error("Mỗi dòng lịch làm việc cần có dạng: Ngày: giờ làm việc");
      const workingHours = form.workingHoursText
        .split("\n")
        .map(line => {
          const [day, ...rest] = line.split(":");
          return { day: day.trim(), hours: rest.join(":").trim() };
        })
        .filter(w => w.day && w.hours);

      const payload = {
        name: form.name,
        fullName: form.fullName,
        address: form.address,
        hotline: form.hotline,
        oaId: form.oaId,
        servicePortalUrl: form.servicePortalUrl,
        caseTrackingUrl: form.caseTrackingUrl,
        workingHours,
      };
      await api.updateCenter(payload);
      toastOk("Đã cập nhật thông tin trung tâm");
    } catch (err) { toastErr(err.message); }
    finally { setSaving(false); }
  };

  if (loadError) return <div className="card" role="alert">{loadError}<button className="btn btn-primary" onClick={() => setRetry(n => n+1)}>Thử lại</button></div>;

  if (loading || !form) return (
    <div className="loading-full"><span className="spinner" /> Đang tải...</div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* Thông tin cơ bản */}
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-header">
            <div className="card-title">🏛️ Thông tin cơ bản</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label className="form-label required">Tên ngắn</label>
              <input className="form-input" value={form.name} onChange={set("name")} required placeholder="TT PVHCC xã Nghĩa Thành" />
            </div>
            <div className="form-group">
              <label className="form-label required">Hotline</label>
              <input className="form-input" value={form.hotline} onChange={set("hotline")} required placeholder="0255 123 456" />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label required">Tên đầy đủ</label>
              <input className="form-input" value={form.fullName} onChange={set("fullName")} required />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label required">Địa chỉ</label>
              <input className="form-input" value={form.address} onChange={set("address")} required placeholder="Số nhà, đường, xã, tỉnh" />
            </div>
          </div>
        </div>

        {/* Kênh kết nối */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🔗 Kênh kết nối</div>
          </div>
          <div className="form-group">
            <label className="form-label">Zalo OA ID</label>
            <input className="form-input" value={form.oaId} onChange={set("oaId")} placeholder="ID Official Account Zalo" />
            <span className="form-hint">Dùng để nút "Nhắn tin" trong Mini App mở đúng OA</span>
          </div>
          <div className="form-group">
            <label className="form-label">Cổng dịch vụ công</label>
            <input className="form-input" value={form.servicePortalUrl} onChange={set("servicePortalUrl")} placeholder="https://..." type="url" />
          </div>
          <div className="form-group">
            <label className="form-label">URL tra cứu hồ sơ</label>
            <input className="form-input" value={form.caseTrackingUrl} onChange={set("caseTrackingUrl")} placeholder="https://..." type="url" />
          </div>
        </div>

        {/* Giờ làm việc */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">⏰ Giờ làm việc</div>
          </div>
          <div className="form-group">
            <label className="form-label">Lịch làm việc</label>
            <textarea
              className="form-textarea"
              value={form.workingHoursText}
              onChange={set("workingHoursText")}
              rows={6}
              placeholder={"Thứ Hai – Thứ Sáu: 7:30 – 11:30, 13:00 – 17:00\nThứ Bảy: 7:30 – 11:30"}
            />
            <span className="form-hint">Mỗi dòng theo dạng: Ngày: giờ bắt đầu – giờ kết thúc</span>
          </div>
        </div>

        {/* Preview */}
        {center && (
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card-header">
              <div className="card-title">👁 Xem trước hiển thị</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {[
                { icon: "🏛️", label: "Tên", value: center.name },
                { icon: "📞", label: "Hotline", value: center.hotline },
                { icon: "📍", label: "Địa chỉ", value: center.address },
              ].map(item => (
                <div key={item.label} style={{ padding: 12, background: "var(--bg-base)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", marginBottom: 4 }}>{item.icon} {item.label}</div>
                  <div style={{ fontWeight: 600 }}>{item.value || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          {!isSuperAdmin && (
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", alignSelf: "center" }}>
              Chỉ SUPER_ADMIN mới có thể cập nhật thông tin trung tâm.
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving || !isSuperAdmin}>
            {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Đang lưu...</> : "💾 Lưu thay đổi"}
          </button>
        </div>
      </div>
    </form>
  );
}

