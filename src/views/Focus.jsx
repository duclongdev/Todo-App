import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../components/Toast.jsx";
import PageHead from "../components/PageHead.jsx";
import { fmtMinutes, fmtVN, pad, today, uid } from "../lib/utils.js";

const fmtClock = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

export default function Focus() {
  const { db, update, log } = useStore();
  const toast = useToast();

  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [project, setProject] = useState("");
  const intervalRef = useRef(null);

  // Đếm giờ qua useEffect — tự dọn interval khi dừng/unmount.
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const stopAndSave = () => {
    setRunning(false);
    const min = Math.round(seconds / 60);
    if (min < 1) {
      toast("Phiên quá ngắn (< 1 phút)", "err");
      setSeconds(0);
      return;
    }
    const proj = project.trim() || "Tập trung";
    update((d) =>
      d.work.push({ id: uid(), date: today(), minutes: min, project: proj, note: "", createdAt: Date.now() })
    );
    log("focus_log", `Phiên tập trung ${min} phút: ${proj}`);
    setSeconds(0);
    toast(`Đã lưu ${min} phút tập trung 🎉`);
  };

  // ---- Nhập tay ----
  const [mProj, setMProj] = useState("");
  const [mMin, setMMin] = useState("");
  const [mDate, setMDate] = useState(today());

  const addManual = (e) => {
    e.preventDefault();
    const min = parseInt(mMin, 10);
    if (!min || min < 1) return toast("Nhập số phút hợp lệ", "err");
    const proj = mProj.trim() || "Làm việc";
    update((d) =>
      d.work.push({ id: uid(), date: mDate, minutes: min, project: proj, note: "", createdAt: Date.now() })
    );
    log("focus_log", `Nhập tay ${min} phút: ${proj}`);
    setMProj("");
    setMMin("");
  };

  const remove = (id) => update((d) => (d.work = d.work.filter((x) => x.id !== id)));

  const t = today();
  const todayMin = db.work.filter((w) => w.date === t).reduce((s, w) => s + w.minutes, 0);
  const all = [...db.work]
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
    .slice(0, 30);

  return (
    <>
      <PageHead
        title="⏱️ Tập trung & Giờ làm việc"
        subtitle="Bấm giờ một phiên làm việc, hoặc nhập thủ công thời gian đã làm."
      />

      <div className="card">
        <div className="timer">
          <div className="timer__display">{fmtClock(seconds)}</div>
          <div className="timer__controls">
            <button className="btn" onClick={() => setRunning((r) => !r)}>
              {running ? "Tạm dừng" : seconds > 0 ? "Tiếp tục" : "Bắt đầu"}
            </button>
            <button className="btn btn--ghost" onClick={stopAndSave}>
              Dừng & Lưu
            </button>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <input
            className="input"
            placeholder="Đang làm gì? (vd: Học tiếng Anh)"
            style={{ maxWidth: 280, margin: "14px auto 0" }}
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
        </div>
      </div>

      <form className="card" onSubmit={addManual}>
        <div className="card__title">
          <span>✍️ Nhập thủ công</span>
        </div>
        <div className="row">
          <input className="input" placeholder="Công việc" value={mProj} onChange={(e) => setMProj(e.target.value)} />
          <input
            className="input"
            type="number"
            min="1"
            placeholder="Số phút"
            value={mMin}
            onChange={(e) => setMMin(e.target.value)}
          />
          <input className="input" type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
          <div style={{ flex: "0 0 auto" }}>
            <button className="btn" type="submit">
              Thêm
            </button>
          </div>
        </div>
      </form>

      <div className="grid grid--stats" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="stat__label">
            <span>⏱️</span>
            <span>Tổng hôm nay</span>
          </div>
          <div className="stat__value">{todayMin ? fmtMinutes(todayMin) : "—"}</div>
        </div>
      </div>

      {all.length === 0 ? (
        <p className="empty">Chưa có phiên làm việc nào.</p>
      ) : (
        <ul className="list" style={{ marginTop: 16 }}>
          {all.map((w) => (
            <li className="item" key={w.id}>
              <div style={{ flex: 1 }}>
                <div className="item__text">{w.project}</div>
                <div className="item__sub">{`${fmtVN(w.date)} · ${fmtMinutes(w.minutes)}`}</div>
              </div>
              <button className="icon-btn" onClick={() => remove(w.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
