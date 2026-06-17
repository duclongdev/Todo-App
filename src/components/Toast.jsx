import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(null);

function ToastItem({ msg, type, onDone }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Hiện ra ở frame kế tiếp để kích hoạt transition CSS.
    const raf = requestAnimationFrame(() => setShown(true));
    const hide = setTimeout(() => setShown(false), 2600);
    const remove = setTimeout(onDone, 2900);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, [onDone]);

  return <div className={`toast toast--${type}${shown ? " show" : ""}`}>{msg}</div>;
}

/** ToastProvider — thay cho U.toast cũ. Dùng qua hook useToast(). */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback((msg, type = "ok") => {
    const id = ++idRef.current;
    setToasts((list) => [...list, { id, msg, type }]);
  }, []);

  const remove = useCallback(
    (id) => setToasts((list) => list.filter((t) => t.id !== id)),
    []
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <ToastItem key={t.id} msg={t.msg} type={t.type} onDone={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
