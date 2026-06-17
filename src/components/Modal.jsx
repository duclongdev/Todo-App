import { useEffect, useState } from "react";

/**
 * Modal — popup dùng chung (thay cho U.modal). Điều khiển hoàn toàn bằng React:
 * cha quyết định render <Modal> hay không; đóng qua prop onClose.
 */
export default function Modal({ title, children, onClose, width }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className={`modal-overlay${shown ? " show" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={width ? { maxWidth: width } : undefined}>
        <div className="modal__head">
          <h3 className="modal__title">{title}</h3>
          <button className="icon-btn" style={{ fontSize: "1.1rem" }} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
