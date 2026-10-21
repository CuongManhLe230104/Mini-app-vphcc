import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "info", duration = 3500) => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), duration);
  }, []);

  const success = useCallback((msg) => show(msg, "success"), [show]);
  const error   = useCallback((msg) => show(msg, "danger"),  [show]);
  const warn    = useCallback((msg) => show(msg, "warning"), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, warn }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span style={{ fontSize: 16 }}>
              {t.type === "success" ? "✓" : t.type === "danger" ? "✕" : t.type === "warning" ? "⚠" : "ℹ"}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

