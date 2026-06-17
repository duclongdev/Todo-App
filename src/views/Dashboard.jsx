import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { useNav } from "../components/NavContext.jsx";
import PageHead from "../components/PageHead.jsx";
import {
  addDays,
  dayKey,
  fmtFull,
  fmtMinutes,
  formatMoney,
  minutesBetween,
  toKey,
  today,
} from "../lib/utils.js";

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Chào buổi sáng";
  if (h < 14) return "Chào buổi trưa";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

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

function StatTile({ icon, label, value, sub }) {
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

const MOODS = ["😄", "🙂", "😐", "😕", "😢"];

export default function Dashboard() {
  const { db, update, log } = useStore();
  const toast = useToast();
  const navigate = useNav();
  const t = today();

  const openTasks = db.todos.filter((x) => !x.done && !x.cancelledAt);
  const doneTasks = db.todos.filter((x) => x.done);
  const habitsDone = db.habits.filter((h) => (db.habitLogs[h.id] || {})[t]).length;
  const bestStreak = db.habits.reduce(
    (m, h) => Math.max(m, streakOf(db.habitLogs[h.id] || {})),
    0
  );

  const lastSleep = [...db.sleep].sort((a, b) => b.date.localeCompare(a.date))[0];
  const sleepMin = lastSleep ? minutesBetween(lastSleep.bedtime, lastSleep.waketime) : 0;
  const focusToday = db.work.filter((w) => w.date === t).reduce((s, w) => s + w.minutes, 0);
  const dayGoals = db.goals.filter((g) => g.scope === "day" && g.period === dayKey());

  const completeTask = (taskId) => {
    update((d) => {
      const it = d.todos.find((x) => x.id === taskId);
      if (it) {
        it.done = true;
        it.completedAt = Date.now();
        const doneCol = d.taskColumns.find((c) => c.isDone);
        if (doneCol) it.columnId = doneCol.id;
      }
    });
    log("task_move", "Hoàn thành việc từ Tổng quan");
  };

  const toggleGoal = (goalId, checked) =>
    update((d) => {
      const it = d.goals.find((x) => x.id === goalId);
      if (it) it.done = checked;
    });

  const setMood = (mood) => {
    update((d) => {
      d.journal[t] = Object.assign({ text: "", gratitude: "" }, d.journal[t], { mood });
    });
    toast("Đã ghi tâm trạng");
  };

  // ---- Tài chính tháng này ----
  const fin = db.finance;
  const cur = db.settings.currency || "₫";
  const mkey =
    new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0");
  const mtx = fin.tx.filter((x) => x.date && x.date.slice(0, 7) === mkey);
  const inc = mtx.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0);
  const exp = mtx.filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);
  const accountBalance = (id) => {
    let b = (fin.accounts.find((a) => a.id === id) || {}).initial || 0;
    fin.tx.forEach((x) => {
      if (x.type === "income" && x.accountId === id) b += x.amount;
      else if (x.type === "expense" && x.accountId === id) b -= x.amount;
      else if (x.type === "transfer") {
        if (x.accountId === id) b -= x.amount;
        if (x.toAccountId === id) b += x.amount;
      }
    });
    return b;
  };
  const net = fin.accounts.reduce((s, a) => s + accountBalance(a.id), 0);

  const journalToday = db.journal[t];

  return (
    <>
      <PageHead
        title={`${greeting()}${db.settings.name ? ", " + db.settings.name : ""} 👋`}
        subtitle={fmtFull()}
      />

      <div className="grid grid--stats">
        <StatTile
          icon="✅"
          label="Công việc"
          value={String(openTasks.length)}
          sub={`còn lại · ${doneTasks.length} xong`}
        />
        <StatTile
          icon="🔥"
          label="Thói quen"
          value={`${habitsDone}/${db.habits.length}`}
          sub={`streak tốt nhất: ${bestStreak} ngày`}
        />
        <StatTile
          icon="😴"
          label="Giấc ngủ"
          value={sleepMin ? fmtMinutes(sleepMin) : "—"}
          sub={lastSleep ? "đêm gần nhất" : "chưa ghi"}
        />
        <StatTile
          icon="⏱️"
          label="Tập trung"
          value={focusToday ? fmtMinutes(focusToday) : "—"}
          sub="hôm nay"
        />
      </div>

      <div className="grid grid--2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card__title">
            <span>✅ Việc cần làm</span>
            <button className="btn btn--sm btn--ghost" onClick={() => navigate("tasks")}>
              Mở
            </button>
          </div>
          {openTasks.length === 0 ? (
            <p className="empty">Tuyệt! Không còn việc nào 🎉</p>
          ) : (
            <ul className="list">
              {openTasks.slice(0, 5).map((task) => (
                <li className="item" key={task.id}>
                  <input
                    type="checkbox"
                    className="check"
                    checked={false}
                    onChange={() => completeTask(task.id)}
                  />
                  <span className="item__text">{task.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card__title">
            <span>🎯 Mục tiêu hôm nay</span>
            <button className="btn btn--sm btn--ghost" onClick={() => navigate("goals")}>
              Mở
            </button>
          </div>
          {dayGoals.length === 0 ? (
            <p className="empty">Chưa đặt mục tiêu cho hôm nay.</p>
          ) : (
            <ul className="list">
              {dayGoals.map((g) => (
                <li className={"item" + (g.done ? " done" : "")} key={g.id}>
                  <input
                    type="checkbox"
                    className="check"
                    checked={g.done}
                    onChange={(e) => toggleGoal(g.id, e.target.checked)}
                  />
                  <span className="item__text">{g.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__title">
          <span>💰 Tài chính tháng này</span>
          <button className="btn btn--sm btn--ghost" onClick={() => navigate("finance")}>
            Mở
          </button>
        </div>
        <div className="grid grid--stats">
          <div className="stat">
            <div className="stat__label">📥 Thu nhập</div>
            <div className="stat__value amount--in" style={{ fontSize: "1.3rem" }}>
              {formatMoney(inc, cur)}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">📤 Chi tiêu</div>
            <div className="stat__value amount--out" style={{ fontSize: "1.3rem" }}>
              {formatMoney(exp, cur)}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">🏦 Tổng tài sản</div>
            <div className="stat__value" style={{ fontSize: "1.3rem" }}>
              {formatMoney(net, cur)}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__title">
          <span>📔 Tâm trạng hôm nay</span>
          <button className="btn btn--sm btn--ghost" onClick={() => navigate("journal")}>
            Viết nhật ký
          </button>
        </div>
        <div className="moods">
          {MOODS.map((m) => (
            <button
              key={m}
              className={"mood" + (journalToday && journalToday.mood === m ? " is-active" : "")}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
