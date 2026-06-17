import { useState } from "react";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../components/Toast.jsx";
import PageHead from "../components/PageHead.jsx";
import { addDays, parseKey, today, toKey, uid, weekDays } from "../lib/utils.js";

const ICONS = ["💧", "🏃", "📚", "🧘", "🥗", "💊", "🦷", "✍️", "🎸", "🌙", "☀️", "💪", "🚭", "🧹", "💰", "🎯"];
const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function streakOf(logs) {
  let streak = 0;
  let d = new Date();
  if (!logs[toKey(d)]) d = addDays(d, -1);
  while (logs[toKey(d)]) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

function HabitEditor({ habit, onSave, onCancel }) {
  const [name, setName] = useState(habit.name);
  const [icon, setIcon] = useState(habit.icon);
  const [note, setNote] = useState(habit.note || "");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), icon, note: note.trim() });
  };

  return (
    <form className="habit" onSubmit={submit}>
      <div className="row">
        <input
          className="input"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="select"
          style={{ maxWidth: 80, flex: "0 0 80px" }}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
        >
          {ICONS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="textarea"
        placeholder="Ghi chú cho thói quen này..."
        style={{ minHeight: 60, marginTop: 8 }}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="row" style={{ marginTop: 8, justifyContent: "flex-start" }}>
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn btn--sm" type="submit">
            Lưu
          </button>
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn btn--sm btn--ghost" type="button" onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
    </form>
  );
}

export default function Habits() {
  const { db, update, log } = useStore();
  const toast = useToast();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [editingId, setEditingId] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const addHabit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    update((d) => d.habits.push({ id: uid(), name: name.trim(), icon, note: "", createdAt: Date.now() }));
    log("habit_add", "Thêm thói quen: " + name.trim());
    setName("");
  };

  const toggle = (habitId, dateStr) => {
    update((d) => {
      d.habitLogs[habitId] = d.habitLogs[habitId] || {};
      if (d.habitLogs[habitId][dateStr]) delete d.habitLogs[habitId][dateStr];
      else d.habitLogs[habitId][dateStr] = true;
    });
    log("habit_tick", "Cập nhật thói quen ngày " + dateStr);
  };

  const saveHabit = (id, patch) => {
    update((d) => {
      const x = d.habits.find((q) => q.id === id);
      if (x) Object.assign(x, patch);
    });
    log("habit_edit", "Sửa thói quen: " + patch.name);
    setEditingId(null);
  };

  const removeHabit = (h) => {
    if (!confirm(`Xóa thói quen "${h.name}"?`)) return;
    update((d) => {
      d.habits = d.habits.filter((x) => x.id !== h.id);
      delete d.habitLogs[h.id];
    });
  };

  const days = weekDays(weekOffset);
  const rangeLabel = `${toKey(parseKey(days[0])).slice(5)} → ${toKey(parseKey(days[6])).slice(5)}`;
  const weekTitle =
    weekOffset === 0
      ? "Tuần này"
      : weekOffset === -1
      ? "Tuần trước"
      : weekOffset === 1
      ? "Tuần sau"
      : `${weekOffset > 0 ? "+" : ""}${weekOffset} tuần`;

  return (
    <>
      <PageHead
        title="🔥 Thói quen"
        subtitle="Theo dõi theo tuần, chuyển qua các tuần khác và ghi chú cho từng thói quen."
      />

      <form className="card" onSubmit={addHabit}>
        <div className="row">
          <input
            className="input"
            placeholder="Tên thói quen (vd: Uống 2L nước)"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="select"
            style={{ maxWidth: 90, flex: "0 0 90px" }}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          >
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <div style={{ flex: "0 0 auto" }}>
            <button className="btn" type="submit">
              Thêm
            </button>
          </div>
        </div>
      </form>

      {db.habits.length === 0 ? (
        <p className="empty">Chưa có thói quen nào. Hãy thêm một thói quen tốt!</p>
      ) : (
        <>
          <div className="weeknav" style={{ marginTop: 16 }}>
            <button
              className="weeknav__btn"
              title="Tuần trước"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              ◀
            </button>
            <div className="weeknav__label">
              <div>{weekTitle}</div>
              <div className="stat__sub weeknav__today">{rangeLabel}</div>
            </div>
            <button
              className="weeknav__btn"
              title="Tuần sau"
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              ▶
            </button>
            {weekOffset !== 0 && (
              <button className="btn btn--sm btn--ghost" onClick={() => setWeekOffset(0)}>
                Hôm nay
              </button>
            )}
          </div>

          <div className="grid">
            {db.habits.map((h) => {
              if (editingId === h.id) {
                return (
                  <HabitEditor
                    key={h.id}
                    habit={h}
                    onSave={(patch) => saveHabit(h.id, patch)}
                    onCancel={() => setEditingId(null)}
                  />
                );
              }
              const logs = db.habitLogs[h.id] || {};
              return (
                <div className="habit" key={h.id}>
                  <div className="habit__head">
                    <span className="habit__icon">{h.icon}</span>
                    <span className="habit__name">{h.name}</span>
                    <span className="habit__streak">🔥 {streakOf(logs)}</span>
                    <button
                      className="icon-btn"
                      title="Sửa / ghi chú"
                      style={{ color: "var(--muted)" }}
                      onClick={() => setEditingId(h.id)}
                    >
                      ✏️
                    </button>
                    <button className="icon-btn" title="Xóa" onClick={() => removeHabit(h)}>
                      🗑️
                    </button>
                  </div>
                  {h.note && <div className="habit__note">📝 {h.note}</div>}
                  <div className="habit__week">
                    {days.map((ds) => {
                      const date = parseKey(ds);
                      const isFuture = date > new Date();
                      return (
                        <div
                          key={ds}
                          className={
                            "daycell" +
                            (logs[ds] ? " on" : "") +
                            (ds === today() ? " today" : "")
                          }
                          style={isFuture ? { opacity: 0.45 } : undefined}
                          onClick={() => toggle(h.id, ds)}
                        >
                          <span className="daycell__num">{date.getDate()}</span>
                          <span>{DOW[date.getDay()]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
