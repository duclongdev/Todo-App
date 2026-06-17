import { useState } from "react";
import { useStore } from "../store/StoreContext.jsx";
import PageHead from "../components/PageHead.jsx";
import { fmtMinutes, fmtVN, lastNDays, minutesBetween, parseKey, toKey } from "../lib/utils.js";

const TYPE_LABELS = {
  session_start: "🔑 Đăng nhập",
  navigate: "🧭 Điều hướng",
  task_add: "➕ Thêm việc",
  task_move: "🔀 Chuyển việc",
  task_edit: "📝 Sửa việc",
  task_delete: "🗑️ Xóa việc",
  column_add: "📂 Thêm cột",
  column_delete: "📁 Xóa cột",
  habit_add: "➕ Thêm thói quen",
  habit_edit: "✏️ Sửa thói quen",
  habit_tick: "🔥 Tick thói quen",
  goal_add: "🎯 Thêm mục tiêu",
  goal_complete: "✅ Mục tiêu",
  goal_subtask_add: "📌 Việc của mục tiêu",
  sleep_log: "😴 Ghi giấc ngủ",
  focus_log: "⏱️ Phiên tập trung",
  journal_save: "📔 Lưu nhật ký",
  note_save: "📝 Lưu ghi chú",
  finance_tx_add: "💸 Thêm giao dịch",
  finance_tx_edit: "✏️ Sửa giao dịch",
  finance_tx_delete: "🗑️ Xóa giao dịch",
  finance_budget: "📊 Ngân sách",
  finance_account: "🏦 Tài khoản",
  finance_saving: "🐷 Tiết kiệm",
};
const labelOf = (t) => TYPE_LABELS[t] || t;

const PERIODS = [
  ["today", "Hôm nay"],
  ["7d", "7 ngày"],
  ["30d", "30 ngày"],
  ["all", "Tất cả"],
];

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="chart">
      {data.map((d, i) => (
        <div className="chart__col" key={i}>
          <div className="chart__val">{d.raw != null ? d.raw : d.value || ""}</div>
          <div
            className={"chart__bar" + (d.value === 0 ? " soft" : "")}
            style={{ height: `${Math.round((d.value / max) * 100)}%` }}
            title={String(d.raw ?? d.value)}
          />
          <div className="chart__label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function Tile({ icon, label, value }) {
  return (
    <div className="stat">
      <div className="stat__label">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="stat__value">{value}</div>
    </div>
  );
}

function ChartCard({ title, data }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card__title">{title}</div>
      <BarChart data={data} />
    </div>
  );
}

export default function Stats() {
  const { db } = useStore();
  const [typeFilter, setTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("7d");

  const periodStart = () => {
    if (periodFilter === "today") {
      const n = new Date();
      n.setHours(0, 0, 0, 0);
      return n.getTime();
    }
    if (periodFilter === "7d") return Date.now() - 7 * 864e5;
    if (periodFilter === "30d") return Date.now() - 30 * 864e5;
    return 0;
  };

  const totalFocus = db.work.reduce((s, w) => s + w.minutes, 0);
  const tasksDone = db.todos.filter((t) => t.done).length;
  const sessions = db.activity.filter((a) => a.type === "session_start");

  const days14 = lastNDays(14);
  const days7 = lastNDays(7);

  const habitData = days14.map((ds) => {
    const done = db.habits.filter((h) => (db.habitLogs[h.id] || {})[ds]).length;
    return { label: parseKey(ds).getDate(), value: done, raw: done || "" };
  });
  const sleepMap = {};
  db.sleep.forEach((s) => (sleepMap[s.date] = minutesBetween(s.bedtime, s.waketime)));
  const sleepData = days14.map((ds) => {
    const m = sleepMap[ds] || 0;
    return { label: parseKey(ds).getDate(), value: m, raw: m ? (m / 60).toFixed(1) : "" };
  });
  const workMap = {};
  db.work.forEach((w) => (workMap[w.date] = (workMap[w.date] || 0) + w.minutes));
  const workData = days7.map((ds) => {
    const m = workMap[ds] || 0;
    return { label: fmtVN(ds).split(" ")[0], value: m, raw: m || "" };
  });
  const actMap = {};
  db.activity.forEach((a) => {
    const k = toKey(new Date(a.ts));
    actMap[k] = (actMap[k] || 0) + 1;
  });
  const actData = days7.map((ds) => {
    const c = actMap[ds] || 0;
    return { label: fmtVN(ds).split(" ")[0], value: c, raw: c || "" };
  });

  const start = periodStart();
  const rows = db.activity
    .filter((a) => a.ts >= start && (typeFilter === "all" || a.type === typeFilter))
    .sort((a, b) => b.ts - a.ts);

  const byType = {};
  rows.forEach((r) => (byType[r.type] = (byType[r.type] || 0) + 1));
  const presentTypes = Array.from(new Set(db.activity.map((a) => a.type)));
  const sessRows = sessions.filter((a) => a.ts >= start).sort((a, b) => b.ts - a.ts).slice(0, 30);

  return (
    <>
      <PageHead
        title="📊 Thống kê"
        subtitle="Tổng hợp hoạt động, nhật ký đăng nhập và mọi thao tác trên app."
      />

      <div className="grid grid--stats">
        <Tile icon="🔑" label="Lượt đăng nhập" value={String(sessions.length)} />
        <Tile icon="⚡" label="Tổng thao tác" value={String(db.activity.length)} />
        <Tile icon="⏱️" label="Tổng tập trung" value={fmtMinutes(totalFocus)} />
        <Tile icon="✅" label="Việc đã xong" value={String(tasksDone)} />
      </div>

      {db.habits.length > 0 && <ChartCard title="🔥 Thói quen hoàn thành mỗi ngày" data={habitData} />}
      {db.sleep.length > 0 && <ChartCard title="😴 Giờ ngủ mỗi đêm" data={sleepData} />}
      {db.work.length > 0 && <ChartCard title="⏱️ Phút tập trung mỗi ngày (7 ngày)" data={workData} />}
      <ChartCard title="⚡ Số thao tác mỗi ngày (7 ngày)" data={actData} />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__title">📋 Nhật ký hoạt động</div>
        <div className="pills">
          {PERIODS.map(([p, label]) => (
            <button
              key={p}
              className={"pill" + (periodFilter === p ? " is-active" : "")}
              onClick={() => setPeriodFilter(p)}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 14 }}>
          <select
            className="select"
            style={{ maxWidth: 260 }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Tất cả loại thao tác</option>
            {presentTypes.map((t) => (
              <option key={t} value={t}>
                {labelOf(t)}
              </option>
            ))}
          </select>
        </div>

        {rows.length > 0 && (
          <div className="row" style={{ marginBottom: 14 }}>
            {Object.entries(byType)
              .sort((a, b) => b[1] - a[1])
              .map(([t, c]) => (
                <span className="tag" key={t} style={{ flex: "0 0 auto" }}>
                  {`${labelOf(t)}: ${c}`}
                </span>
              ))}
          </div>
        )}

        {rows.length === 0 ? (
          <p className="empty">Không có hoạt động nào trong bộ lọc này.</p>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Loại</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.id}>
                    <td className="table__time">
                      {new Date(r.ts).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td>
                      <span className="badge">{labelOf(r.type)}</span>
                    </td>
                    <td>{r.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && (
              <p className="stat__sub" style={{ marginTop: 10 }}>
                {`Hiển thị 200 / ${rows.length} thao tác gần nhất.`}
              </p>
            )}
          </>
        )}
      </div>

      {sessRows.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card__title">🔑 Lịch sử đăng nhập</div>
          <ul className="list">
            {sessRows.map((s) => (
              <li className="item" key={s.id}>
                <span>🔑</span>
                <span className="item__text">
                  {new Date(s.ts).toLocaleString("vi-VN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
