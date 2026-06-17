import { useState } from "react";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { useNav } from "../components/NavContext.jsx";
import PageHead from "../components/PageHead.jsx";
import Modal from "../components/Modal.jsx";
import { periodKey, periodLabel, uid } from "../lib/utils.js";

const SCOPES = [
  ["day", "Ngày"],
  ["week", "Tuần"],
  ["month", "Tháng"],
  ["year", "Năm"],
];

const subDone = (s, db) => {
  if (s.taskId) {
    const t = db.todos.find((x) => x.id === s.taskId);
    return t ? t.done : s.done;
  }
  return s.done;
};
const hasLinked = (g) => (g.subtasks || []).some((s) => s.taskId);
const progressOf = (g, db) => {
  if (g.subtasks && g.subtasks.length) {
    const done = g.subtasks.filter((s) => subDone(s, db)).length;
    return Math.round((done / g.subtasks.length) * 100);
  }
  return g.progress || 0;
};

// Hộp chọn công việc có sẵn để liên kết.
function TaskPicker({ title, onPick, onClose }) {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const colName = (id) => (db.taskColumns.find((c) => c.id === id) || {}).name || "";
  const rows = db.todos.filter((t) => !q.trim() || t.text.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Modal title={title} onClose={onClose}>
      <input
        className="input"
        placeholder="🔍 Tìm công việc..."
        autoFocus
        style={{ marginBottom: 12 }}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="list">
        {rows.length === 0 ? (
          <p className="empty">Không tìm thấy công việc.</p>
        ) : (
          rows.map((t) => (
            <li
              className="item"
              key={t.id}
              style={{ cursor: "pointer" }}
              onClick={() => {
                onPick(t);
                onClose();
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>{t.done ? "✅" : "⬜"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item__text">{t.text}</div>
                <div className="item__sub">{colName(t.columnId)}</div>
              </div>
            </li>
          ))
        )}
      </ul>
    </Modal>
  );
}

function GoalCard({ g, expanded, onToggleExpand }) {
  const { db, update, log } = useStore();
  const toast = useToast();
  const navigate = useNav();
  const [subInput, setSubInput] = useState("");
  const [progress, setProgress] = useState(g.progress || 0);
  // picker: { mode: 'link'|'add', subId } | null
  const [picker, setPicker] = useState(null);

  const pct = progressOf(g, db);
  const linked = hasLinked(g);
  const done100 = pct === 100;

  const toggleDone = (checked) => {
    update((d) => {
      const x = d.goals.find((q) => q.id === g.id);
      if (x) {
        x.done = checked;
        if (!x.subtasks.length) x.progress = checked ? 100 : 0;
      }
    });
    log("goal_complete", (checked ? "Hoàn thành" : "Mở lại") + " mục tiêu: " + g.title);
  };

  const removeGoal = () => update((d) => (d.goals = d.goals.filter((x) => x.id !== g.id)));

  const toggleSub = (s, checked) => {
    update((d) => {
      const gg = d.goals.find((q) => q.id === g.id);
      const ss = gg.subtasks.find((q) => q.id === s.id);
      if (s.taskId) {
        const t = d.todos.find((x) => x.id === s.taskId);
        if (t) {
          t.done = checked;
          t.completedAt = checked ? t.completedAt || Date.now() : null;
          const doneCol = d.taskColumns.find((c) => c.isDone);
          const firstCol = d.taskColumns[0];
          if (checked && doneCol) t.columnId = doneCol.id;
          if (!checked && t.columnId === (doneCol && doneCol.id)) t.columnId = firstCol.id;
        } else {
          ss.taskId = null;
          ss.done = checked;
        }
      } else {
        ss.done = checked;
      }
    });
  };

  const removeSub = (s) =>
    update((d) => {
      const gg = d.goals.find((q) => q.id === g.id);
      gg.subtasks = gg.subtasks.filter((q) => q.id !== s.id);
    });

  const addSub = () => {
    if (!subInput.trim()) return;
    update((d) => {
      const gg = d.goals.find((q) => q.id === g.id);
      gg.subtasks.push({ id: uid(), text: subInput.trim(), done: false, taskId: null });
    });
    log("goal_subtask_add", "Thêm việc cho mục tiêu: " + g.title);
    setSubInput("");
  };

  const unlinkSub = (s) =>
    update((d) => {
      const ss = d.goals.find((q) => q.id === g.id).subtasks.find((q) => q.id === s.id);
      ss.taskId = null;
      ss.done = subDone(s, db);
    });

  // Tạo task mới ở cột đầu & liên kết với subtask.
  const createAndLink = (s) => {
    const firstCol = db.taskColumns[0];
    const taskId = uid();
    const now = Date.now();
    update((d) => {
      d.todos.unshift({
        id: taskId,
        text: s.text,
        description: "",
        priority: "med",
        due: null,
        columnId: firstCol.id,
        done: false,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        history: [{ from: null, to: firstCol.id, at: now }],
        createdAt: now,
      });
      const ss = d.goals.find((q) => q.id === g.id).subtasks.find((q) => q.id === s.id);
      if (ss) ss.taskId = taskId;
    });
    log("task_add", "Từ mục tiêu (liên kết) → " + s.text);
    toast("Đã tạo công việc & liên kết");
  };

  const linkExistingToSub = (subId, task) => {
    update((d) => {
      const ss = d.goals.find((q) => q.id === g.id).subtasks.find((q) => q.id === subId);
      if (ss) ss.taskId = task.id;
    });
    toast("Đã liên kết công việc");
  };

  const addLinkedFromExisting = (task) => {
    if (g.subtasks.some((s) => s.taskId === task.id)) {
      toast("Công việc này đã được liên kết", "err");
      return;
    }
    update((d) => {
      d.goals
        .find((q) => q.id === g.id)
        .subtasks.push({ id: uid(), text: task.text, done: false, taskId: task.id });
    });
    log("goal_subtask_add", "Liên kết công việc vào mục tiêu: " + task.text);
    toast("Đã liên kết công việc");
  };

  const saveProgress = (val) => {
    update((d) => {
      const x = d.goals.find((q) => q.id === g.id);
      if (x) {
        x.progress = Number(val);
        x.done = x.progress === 100;
      }
    });
  };

  return (
    <div className="goal">
      <div className="goal__head">
        <input
          type="checkbox"
          className="check"
          checked={done100 || g.done}
          onChange={(e) => toggleDone(e.target.checked)}
        />
        <span
          className="goal__title"
          style={done100 ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}
        >
          {g.title}
        </span>
        <span className="stat__sub">{pct}%</span>
        <button className="icon-btn" style={{ color: "var(--muted)" }} onClick={onToggleExpand}>
          {expanded ? "▾" : "▸"}
        </button>
        <button className="icon-btn" onClick={removeGoal}>
          🗑️
        </button>
      </div>
      <div className="progress" style={{ marginTop: 10 }}>
        <div className="progress__bar" style={{ width: pct + "%" }} />
      </div>

      {expanded && (
        <div className="goal__body">
          {g.subtasks &&
            g.subtasks.map((s) => {
              const isLinked = !!s.taskId;
              const linkedTask = isLinked ? db.todos.find((x) => x.id === s.taskId) : null;
              const done = subDone(s, db);
              return (
                <div className={"subtask" + (done ? " done" : "")} key={s.id}>
                  <input
                    type="checkbox"
                    className="check"
                    checked={done}
                    onChange={(e) => toggleSub(s, e.target.checked)}
                  />
                  <span className="subtask__text">{s.text}</span>
                  {isLinked &&
                    (linkedTask ? (
                      <button
                        className="tag tag--ok"
                        style={{ cursor: "pointer", border: "none" }}
                        title="Mở công việc này trong tab Công việc"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("tasks", { openTaskId: s.taskId });
                        }}
                      >
                        🔗 {(db.taskColumns.find((c) => c.id === linkedTask.columnId) || {}).name || ""} ↗
                      </button>
                    ) : (
                      <span className="tag">🔗 task đã xóa</span>
                    ))}
                  {!isLinked ? (
                    <>
                      <button
                        className="icon-btn"
                        title="Tạo công việc & liên kết"
                        style={{ color: "var(--primary)" }}
                        onClick={() => createAndLink(s)}
                      >
                        ↗
                      </button>
                      <button
                        className="icon-btn"
                        title="Liên kết công việc có sẵn"
                        style={{ color: "var(--primary)" }}
                        onClick={() => setPicker({ mode: "link", subId: s.id })}
                      >
                        🔗
                      </button>
                    </>
                  ) : (
                    <button
                      className="icon-btn"
                      title="Bỏ liên kết"
                      style={{ color: "var(--muted)" }}
                      onClick={() => unlinkSub(s)}
                    >
                      ⛓️‍💥
                    </button>
                  )}
                  <button className="icon-btn" onClick={() => removeSub(s)}>
                    ✕
                  </button>
                </div>
              );
            })}

          {!g.subtasks || g.subtasks.length === 0 ? (
            <div className="field" style={{ margin: "0 0 10px" }}>
              <label>Tiến độ thủ công (thêm công việc chi tiết để tính tự động)</label>
              <div className="row" style={{ alignItems: "center" }}>
                <input
                  type="range"
                  className="slider"
                  min="0"
                  max="100"
                  step="5"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  onMouseUp={(e) => saveProgress(e.target.value)}
                  onTouchEnd={(e) => saveProgress(e.target.value)}
                />
                <div style={{ flex: "0 0 50px" }}>
                  <span className="stat__sub">{progress}%</span>
                </div>
              </div>
            </div>
          ) : linked ? (
            <p className="stat__sub" style={{ margin: "8px 0" }}>
              🔒 Đã liên kết công việc — tiến độ tự tính, không chỉnh tay.
            </p>
          ) : null}

          <div className="row" style={{ marginTop: 10 }}>
            <input
              className="input"
              placeholder="Thêm công việc chi tiết..."
              maxLength={120}
              value={subInput}
              onChange={(e) => setSubInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSub()}
            />
            <div style={{ flex: "0 0 auto" }}>
              <button className="btn btn--sm" onClick={addSub}>
                Thêm
              </button>
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ flex: "0 0 auto" }}>
              <button className="btn btn--sm btn--ghost" onClick={() => setPicker({ mode: "add" })}>
                🔗 Liên kết công việc có sẵn
              </button>
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <button className="btn btn--sm btn--ghost" onClick={() => navigate("tasks")}>
                Mở tab Công việc →
              </button>
            </div>
          </div>
        </div>
      )}

      {picker && (
        <TaskPicker
          title={picker.mode === "link" ? "Chọn công việc để liên kết" : "Liên kết công việc vào mục tiêu"}
          onClose={() => setPicker(null)}
          onPick={(task) =>
            picker.mode === "link" ? linkExistingToSub(picker.subId, task) : addLinkedFromExisting(task)
          }
        />
      )}
    </div>
  );
}

export default function Goals() {
  const { db, update, log } = useStore();
  const [scope, setScope] = useState("day");
  const [title, setTitle] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());

  const cur = periodKey(scope);
  const goals = db.goals.filter((g) => g.scope === scope && g.period === cur);

  const addGoal = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const id = uid();
    update((d) =>
      d.goals.push({
        id,
        title: title.trim(),
        scope,
        period: periodKey(scope),
        done: false,
        progress: 0,
        subtasks: [],
        createdAt: Date.now(),
      })
    );
    log("goal_add", "Thêm mục tiêu: " + title.trim());
    setTitle("");
    setExpanded((prev) => new Set(prev).add(id));
  };

  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const scopeLabel = SCOPES.find((s) => s[0] === scope)[1].toLowerCase();

  return (
    <>
      <PageHead
        title="🎯 Mục tiêu"
        subtitle="Liên kết công việc cụ thể — khi việc xong, tiến độ tự cập nhật."
      />

      <div className="pills">
        {SCOPES.map(([s, label]) => (
          <button
            key={s}
            className={"pill" + (scope === s ? " is-active" : "")}
            onClick={() => setScope(s)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="stat__sub" style={{ margin: "-6px 0 14px" }}>
        {periodLabel(scope)}
      </p>

      <form className="card" onSubmit={addGoal}>
        <div className="row">
          <input
            className="input"
            placeholder={`Mục tiêu cho ${scopeLabel} này...`}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div style={{ flex: "0 0 auto" }}>
            <button className="btn" type="submit">
              Thêm
            </button>
          </div>
        </div>
      </form>

      {goals.length === 0 ? (
        <p className="empty">Chưa có mục tiêu nào cho kỳ này.</p>
      ) : (
        <div className="grid" style={{ marginTop: 16 }}>
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              g={g}
              expanded={expanded.has(g.id)}
              onToggleExpand={() => toggleExpand(g.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
