import { useRef, useState } from "react";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../components/Toast.jsx";
import PageHead from "../components/PageHead.jsx";
import { today } from "../lib/utils.js";

const CURRENCIES = [
  ["₫", "₫ — VND (Việt Nam)"],
  ["$", "$ — USD"],
  ["€", "€ — EUR"],
  ["£", "£ — GBP"],
  ["¥", "¥ — JPY/CNY"],
];

export default function Settings({ fileSync, toggleTheme }) {
  const { db, update, replace, reset, exportJSON } = useStore();
  const toast = useToast();
  const [name, setName] = useState(db.settings.name || "");
  const fileInputRef = useRef(null);
  const downloadRef = useRef(null);

  const saveName = (e) => {
    e.preventDefault();
    update((d) => (d.settings.name = name.trim()));
    toast("Đã lưu");
  };

  const setCurrency = (val) => {
    update((d) => (d.settings.currency = val));
    toast("Đã đổi đơn vị tiền tệ");
  };

  const exportData = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = downloadRef.current;
    a.href = URL.createObjectURL(blob);
    a.download = `life-hub-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Đã xuất file sao lưu");
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        replace(JSON.parse(reader.result));
        toast("Đã khôi phục dữ liệu");
      } catch {
        toast("File không hợp lệ", "err");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const resetAll = () => {
    if (!confirm("Xóa TẤT CẢ dữ liệu? Hành động này không thể hoàn tác.")) return;
    reset();
    toast("Đã xóa toàn bộ dữ liệu");
  };

  return (
    <>
      <PageHead title="⚙️ Cài đặt" subtitle="Cá nhân hóa và quản lý dữ liệu của bạn." />

      <form className="card" onSubmit={saveName}>
        <div className="card__title">👤 Hồ sơ</div>
        <div className="row">
          <input
            className="input"
            placeholder="Tên của bạn"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div style={{ flex: "0 0 auto" }}>
            <button className="btn" type="submit">
              Lưu
            </button>
          </div>
        </div>
      </form>

      <div className="card">
        <div className="card__title">🎨 Giao diện</div>
        <button className="btn btn--ghost" onClick={toggleTheme}>
          {db.settings.theme === "dark" ? "☀️ Chuyển sáng" : "🌙 Chuyển tối"}
        </button>
      </div>

      <div className="card">
        <div className="card__title">💱 Đơn vị tiền tệ</div>
        <select
          className="select"
          style={{ maxWidth: 220 }}
          value={db.settings.currency || "₫"}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {CURRENCIES.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="card__title">🔗 File dữ liệu (.json)</div>
        {fileSync.supported ? (
          <>
            <p className="stat__sub" style={{ marginBottom: 12 }}>
              {fileSync.connected
                ? `Đang đồng bộ với file: ${fileSync.name}. Tự lưu khi thay đổi & khi đóng app, tự nạp khi mở lại.`
                : "Kết nối một file .json để tự động lưu khi đóng và tự nạp khi mở app."}
            </p>
            <div className="row" style={{ flexDirection: "column" }}>
              <button className="btn" onClick={() => fileSync.connectNew()}>
                {fileSync.connected ? "Đổi / tạo file mới" : "Tạo & kết nối file .json"}
              </button>
              <button className="btn btn--ghost" onClick={() => fileSync.openExisting()}>
                Mở file có sẵn & nạp dữ liệu
              </button>
              {fileSync.connected && (
                <button className="btn btn--ghost" onClick={() => fileSync.disconnect()}>
                  Ngắt kết nối file
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="stat__sub">
            Trình duyệt này không hỗ trợ lưu trực tiếp ra file (.json). Hãy dùng Chrome/Edge, hoặc dùng Xuất/Nhập
            dữ liệu bên dưới. Dữ liệu vẫn được lưu an toàn trong trình duyệt.
          </p>
        )}
      </div>

      <div className="card">
        <div className="card__title">💾 Dữ liệu</div>
        <p className="stat__sub" style={{ marginBottom: 14 }}>
          Mọi dữ liệu được lưu ngay trên trình duyệt này. Nên xuất file sao lưu định kỳ.
        </p>
        <div className="row" style={{ flexDirection: "column" }}>
          <button className="btn btn--ghost" onClick={exportData}>
            ⬇️ Xuất dữ liệu (.json)
          </button>
          <button className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>
            ⬆️ Nhập dữ liệu
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={importData}
          />
          <button className="btn btn--danger" onClick={resetAll}>
            🗑️ Xóa toàn bộ dữ liệu
          </button>
        </div>
      </div>

      <p className="stat__sub" style={{ textAlign: "center", marginTop: 24 }}>
        Life Hub · Dữ liệu của bạn, riêng tư trên máy bạn.
      </p>

      {/* Anchor ẩn phục vụ tải file sao lưu */}
      <a ref={downloadRef} style={{ display: "none" }} aria-hidden="true">
        download
      </a>
    </>
  );
}
