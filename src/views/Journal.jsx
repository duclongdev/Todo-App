import { useEffect, useState } from "react";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../components/Toast.jsx";
import PageHead from "../components/PageHead.jsx";
import { fmtVN, today } from "../lib/utils.js";

const MOODS = ["😄", "🙂", "😐", "😕", "😢"];

export default function Journal() {
  const { db, update, log } = useStore();
  const toast = useToast();
  const [activeDate, setActiveDate] = useState(today());
  const [mood, setMood] = useState("");
  const [text, setText] = useState("");
  const [gratitude, setGratitude] = useState("");

  // Nạp nội dung trang nhật ký mỗi khi đổi ngày.
  useEffect(() => {
    const entry = db.journal[activeDate] || { mood: "", text: "", gratitude: "" };
    setMood(entry.mood || "");
    setText(entry.text || "");
    setGratitude(entry.gratitude || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate]);

  const save = (e) => {
    e.preventDefault();
    update((d) => {
      d.journal[activeDate] = { mood, text: text.trim(), gratitude: gratitude.trim() };
      if (!mood && !text.trim() && !gratitude.trim()) delete d.journal[activeDate];
    });
    log("journal_save", "Lưu nhật ký ngày " + activeDate);
    toast("Đã lưu nhật ký");
  };

  const dates = Object.keys(db.journal).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <PageHead title="📔 Nhật ký" subtitle="Ghi lại một ngày của bạn — cảm xúc, suy nghĩ và điều biết ơn." />

      <form className="card" onSubmit={save}>
        <div className="field">
          <label>Ngày</label>
          <input
            className="input"
            type="date"
            max={today()}
            style={{ maxWidth: 200 }}
            value={activeDate}
            onChange={(e) => setActiveDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Tâm trạng</label>
          <div className="moods">
            {MOODS.map((m) => (
              <button
                type="button"
                key={m}
                className={"mood" + (mood === m ? " is-active" : "")}
                onClick={() => setMood((cur) => (cur === m ? "" : m))}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Nhật ký</label>
          <textarea
            className="textarea"
            placeholder="Hôm nay của bạn thế nào?"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Lòng biết ơn</label>
          <textarea
            className="textarea"
            placeholder="3 điều bạn biết ơn hôm nay..."
            style={{ minHeight: 70 }}
            value={gratitude}
            onChange={(e) => setGratitude(e.target.value)}
          />
        </div>
        <button className="btn" type="submit">
          Lưu nhật ký
        </button>
      </form>

      {dates.length === 0 ? (
        <p className="empty">Chưa có trang nhật ký nào.</p>
      ) : (
        <>
          <div className="card__title" style={{ marginTop: 22 }}>
            📖 Các trang đã viết
          </div>
          <ul className="list">
            {dates.map((ds) => {
              const e = db.journal[ds];
              return (
                <li
                  className="item"
                  key={ds}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setActiveDate(ds);
                    window.scrollTo(0, 0);
                  }}
                >
                  <span style={{ fontSize: "1.3rem" }}>{e.mood || "📝"}</span>
                  <div style={{ flex: 1 }}>
                    <div className="item__text">{fmtVN(ds)}</div>
                    <div className="item__sub">{(e.text || e.gratitude || "").slice(0, 60) || "(trống)"}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
