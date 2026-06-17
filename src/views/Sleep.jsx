import { useState } from "react";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../components/Toast.jsx";
import PageHead from "../components/PageHead.jsx";
import { fmtMinutes, fmtVN, minutesBetween, today, uid } from "../lib/utils.js";

const QUALITY = [
  ["5", "⭐ Rất tốt"],
  ["4", "Tốt"],
  ["3", "Bình thường"],
  ["2", "Kém"],
  ["1", "Rất kém"],
];

function Field({ label, children }) {
  return (
    <div className="field" style={{ margin: 0 }}>
      <label>{label}</label>
      {children}
    </div>
  );
}
function Tile({ icon, label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat__label">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="stat__value">{value}</div>
      <div className="stat__sub">{sub}</div>
    </div>
  );
}

export default function Sleep() {
  const { db, update, log } = useStore();
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [bed, setBed] = useState("23:00");
  const [wake, setWake] = useState("07:00");
  const [quality, setQuality] = useState("4");
  const [note, setNote] = useState("");

  const save = (e) => {
    e.preventDefault();
    update((d) => {
      d.sleep = d.sleep.filter((s) => s.date !== date); // 1 bản ghi / ngày
      d.sleep.push({
        id: uid(),
        date,
        bedtime: bed,
        waketime: wake,
        quality: Number(quality),
        note: note.trim(),
      });
    });
    log("sleep_log", "Ghi giấc ngủ ngày " + date);
    toast("Đã lưu giấc ngủ");
  };

  const remove = (id) => update((d) => (d.sleep = d.sleep.filter((x) => x.id !== id)));

  const all = [...db.sleep].sort((a, b) => b.date.localeCompare(a.date));
  const recent = all.slice(0, 7);
  const avg = recent.length
    ? recent.reduce((s, r) => s + minutesBetween(r.bedtime, r.waketime), 0) / recent.length
    : 0;
  const avgQ = recent.length
    ? (recent.reduce((s, r) => s + r.quality, 0) / recent.length).toFixed(1)
    : "0";

  return (
    <>
      <PageHead title="😴 Giấc ngủ" subtitle="Ghi lại giờ đi ngủ, giờ thức dậy và chất lượng giấc ngủ." />

      <form className="card" onSubmit={save}>
        <div className="row">
          <Field label="Ngày">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Đi ngủ">
            <input className="input" type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
          </Field>
          <Field label="Thức dậy">
            <input className="input" type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
          </Field>
          <Field label="Chất lượng">
            <select className="select" value={quality} onChange={(e) => setQuality(e.target.value)}>
              {QUALITY.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="field">
          <label>Ghi chú</label>
          <input
            className="input"
            placeholder="Ghi chú (tùy chọn)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <button className="btn" type="submit">
          Lưu giấc ngủ
        </button>
      </form>

      {recent.length > 0 && (
        <div className="grid grid--stats" style={{ marginTop: 16 }}>
          <Tile icon="⏰" label="TB thời lượng" value={fmtMinutes(avg)} sub={`${recent.length} đêm gần nhất`} />
          <Tile icon="⭐" label="TB chất lượng" value={avgQ + "/5"} sub="đánh giá" />
        </div>
      )}

      {all.length === 0 ? (
        <p className="empty">Chưa có bản ghi giấc ngủ nào.</p>
      ) : (
        <ul className="list" style={{ marginTop: 16 }}>
          {all.map((s) => {
            const dur = minutesBetween(s.bedtime, s.waketime);
            return (
              <li className="item" key={s.id}>
                <div style={{ flex: 1 }}>
                  <div className="item__text">{`${fmtVN(s.date)} · ${fmtMinutes(dur)}`}</div>
                  <div className="item__sub">
                    {`${s.bedtime} → ${s.waketime} · ${"⭐".repeat(s.quality)}${s.note ? " · " + s.note : ""}`}
                  </div>
                </div>
                <button className="icon-btn" onClick={() => remove(s.id)}>
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
