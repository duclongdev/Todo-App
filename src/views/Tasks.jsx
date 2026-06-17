import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { useNav } from "../components/NavContext.jsx";
import PageHead from "../components/PageHead.jsx";
import Modal from "../components/Modal.jsx";
import { fmtMinutes, uid } from "../lib/utils.js";

const PRI = {
  high: { label: "Cao", cls: "tag--high" },
  med: { label: "Vừa", cls: "tag--med" },
  low: { label: "Thấp", cls: "tag--low" },
};
const KIND_MARK = { plan: " 💡", done: " ✓", cancel: " ✕", pending: " ⏸", doing: " ▶" };
const SCOPE_LABEL = { day: "Ngày", week: "Tuần", month: "Tháng", year: "Năm" };
const ORDER = { high: 0, med: 1, low: 2 };

function fmtDateTime(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return v;
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const fmtDuration = (ms) => fmtMinutes(Math.max(0, ms) / 60000);

// Đổi cột + ghi mốc thời gian + lưu lịch sử (giữ nguyên logic gốc).
function applyColumn(d, t, colId) {
  const prevCol = t.columnId;
  const col = d.taskColumns.find((c) => c.id === colId);
  const kind = col ? col.kind : null;
  t.columnId = colId;
  t.done = !!(col && col.isDone);
  if (kind === "doing" && !t.startedAt) t.startedAt = Date.now();
  t.completedAt = col && col.isDone ? t.completedAt || Date.now() : null;
  t.cancelledAt = kind === "cancel" ? t.cancelledAt || Date.now() : null;
  if (prevCol !== colId) {
    t.history = t.history || [];
    t.history.push({ from: prevCol, to: colId, at: Date.now() });
  }
}

const newTask = (overrides) => ({
  id: uid(),
  text: "",
  description: "",
  priority: "med",
  due: null,
  columnId: null,
  done: false,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  history: [],
  createdAt: Date.now(),
  ...overrides,
});

// ===================== GOAL PICKER =====================
function GoalPicker({ task, onClose, onLinked }) {
  const { db, update, log } = useStore();
  const toast = useToast();
  const [q, setQ] = useState("");
  const rows = db.goals.filter((g) => !q.trim() || g.title.toLowerCase().includes(q.trim().toLowerCase()));

  const link = (g) => {
    if ((g.subtasks || []).some((s) => s.taskId === task.id)) {
      toast("Đã liên kết với mục tiêu này rồi", "err");
      return;
    }
    update((d) => {
      const gg = d.goals.find((x) => x.id === g.id);
      const t = d.todos.find((x) => x.id === task.id);
      if (gg)
        (gg.subtasks = gg.subtasks || []).push({
          id: uid(),
          text: t ? t.text : task.text,
          done: t ? t.done : false,
          taskId: task.id,
        });
    });
    log("goal_subtask_add", "Liên kết công việc vào mục tiêu: " + task.text);
    toast("Đã liên kết với mục tiêu");
    onClose();
    onLinked && onLinked();
  };

  return (
    <Modal title="Liên kết công việc vào mục tiêu" onClose={onClose}>
      <input
        className="input"
        placeholder="🔍 Tìm mục tiêu..."
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="list">
        {rows.length === 0 ? (
          <p className="empty">Không tìm thấy mục tiêu.</p>
        ) : (
          rows.map((g) => (
            <li className="item item--clickable" key={g.id} onClick={() => link(g)}>
              <span className="picker__icon">🎯</span>
              <div className="item__body item__body--min">
                <div className="item__text">{g.title}</div>
                <div className="item__sub">
                  {(SCOPE_LABEL[g.scope] || g.scope) + " · " + (g.subtasks || []).length + " việc con"}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </Modal>
  );
}

// ===================== TASK DETAIL MODAL =====================
function TaskDetailModal({ taskId, onClose }) {
  const { db, update, log } = useStore();
  const toast = useToast();
  const navigate = useNav();
  const task = db.todos.find((x) => x.id === taskId);

  const [text, setText] = useState(task ? task.text : "");
  const [description, setDescription] = useState(task ? task.description || "" : "");
  const [priority, setPriority] = useState(task ? task.priority : "med");
  const [due, setDue] = useState(task ? task.due || "" : "");
  const [columnId, setColumnId] = useState(task ? task.columnId : "");
  const [subInput, setSubInput] = useState("");
  const [goalPicker, setGoalPicker] = useState(false);

  if (!task) return null;
  const cols = db.taskColumns;
  const columnName = (id) =>
    (cols.find((x) => x.id === id) || {}).name || (id ? "(cột đã xóa)" : "Tạo mới");

  const linkedGoal = db.goals.find((g) => (g.subtasks || []).some((s) => s.taskId === task.id)) || null;
  const subs = task.subtasks || [];
  const doneCount = subs.filter((s) => s.done).length;

  const save = () => {
    if (!text.trim()) return toast("Tên không được trống", "err");
    let moveDetail = "";
    update((d) => {
      const t = d.todos.find((x) => x.id === task.id);
      if (!t) return;
      t.text = text.trim();
      t.description = description.trim();
      t.priority = priority;
      t.due = due || null;
      if (t.columnId !== columnId) {
        const fromName = columnName(t.columnId);
        applyColumn(d, t, columnId);
        moveDetail = `"${t.text}": ${fromName} → ${columnName(columnId)}`;
      }
    });
    if (moveDetail) log("task_move", moveDetail);
    log("task_edit", "Sửa công việc: " + text.trim());
    onClose();
  };

  const remove = () => {
    if (!confirm("Xóa công việc này?")) return;
    update((d) => (d.todos = d.todos.filter((x) => x.id !== task.id)));
    log("task_delete", "Xóa công việc: " + task.text);
    onClose();
  };

  const toggleSub = (subId, checked) =>
    update((d) => {
      const t = d.todos.find((x) => x.id === task.id);
      const ss = t && t.subtasks.find((x) => x.id === subId);
      if (ss) ss.done = checked;
    });
  const removeSub = (subId) =>
    update((d) => {
      const t = d.todos.find((x) => x.id === task.id);
      if (t) t.subtasks = t.subtasks.filter((x) => x.id !== subId);
    });
  const addSub = () => {
    if (!subInput.trim()) return;
    update((d) => {
      const t = d.todos.find((x) => x.id === task.id);
      if (t) (t.subtasks = t.subtasks || []).push({ id: uid(), text: subInput.trim(), done: false });
    });
    setSubInput("");
  };
  const unlinkGoal = () => {
    update((d) => {
      (d.goals || []).forEach((gg) => {
        gg.subtasks = (gg.subtasks || []).filter((s) => s.taskId !== task.id);
      });
    });
    log("goal_unlink", "Bỏ liên kết mục tiêu khỏi: " + task.text);
  };

  const history = task.history || [];

  return (
    <Modal title="Chi tiết công việc" onClose={onClose}>
      <div className="field">
        <label>Tên công việc</label>
        <input className="input" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="field">
        <label>Mô tả</label>
        <textarea
          className="textarea"
          placeholder="Mô tả chi tiết..."
          style={{ minHeight: 120 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="row">
        <div className="field" style={{ margin: 0 }}>
          <label>Cột</label>
          <select className="select" value={columnId} onChange={(e) => setColumnId(e.target.value)}>
            {cols.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Ưu tiên</label>
          <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="high">Ưu tiên: Cao</option>
            <option value="med">Ưu tiên: Vừa</option>
            <option value="low">Ưu tiên: Thấp</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Thời gian hoàn thành dự kiến</label>
        <input
          className="input"
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </div>

      {/* Việc con */}
      <div className="field">
        <label>🧩 Việc con{subs.length ? ` (${doneCount}/${subs.length})` : ""}</label>
        {subs.length > 0 && (
          <>
            <div className="progress" style={{ marginBottom: 8 }}>
              <div
                className="progress__bar"
                style={{ "--pct": `${Math.round((doneCount / subs.length) * 100)}%` }}
              />
            </div>
            <div>
              {subs.map((s) => (
                <div className={"subtask" + (s.done ? " done" : "")} key={s.id}>
                  <input
                    type="checkbox"
                    className="check"
                    checked={!!s.done}
                    onChange={(e) => toggleSub(s.id, e.target.checked)}
                  />
                  <span className="subtask__text">{s.text}</span>
                  <button className="icon-btn" title="Xóa việc con" onClick={() => removeSub(s.id)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <input
            className="input"
            placeholder="Thêm việc con..."
            maxLength={200}
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
      </div>

      {/* Mục tiêu liên kết */}
      <div className="field">
        <label>🎯 Mục tiêu liên kết</label>
        {linkedGoal ? (
          <div className="row" style={{ marginTop: 8 }}>
            <div style={{ flex: "0 0 auto" }}>
              <button
                className="tag tag--ok tag--btn"
                title="Mở mục tiêu"
                onClick={() => {
                  onClose();
                  navigate("goals");
                }}
              >
                🎯 {linkedGoal.title} ↗
              </button>
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <button className="btn btn--sm btn--ghost" onClick={unlinkGoal}>
                ⛓️‍💥 Bỏ liên kết
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <button className="btn btn--sm btn--ghost" onClick={() => setGoalPicker(true)}>
              🔗 Liên kết với một mục tiêu
            </button>
          </div>
        )}
      </div>

      {/* Mốc thời gian */}
      <div className="stat__sub" style={{ lineHeight: 1.7 }}>
        <div>🗓️ Tạo: {new Date(task.createdAt).toLocaleString("vi-VN")}</div>
        {task.startedAt && <div>▶ Bắt đầu làm: {new Date(task.startedAt).toLocaleString("vi-VN")}</div>}
        {task.completedAt && <div>✓ Hoàn thành: {new Date(task.completedAt).toLocaleString("vi-VN")}</div>}
        {task.startedAt && task.completedAt && (
          <div>⏱ Thời gian làm: {fmtDuration(task.completedAt - task.startedAt)}</div>
        )}
        {task.cancelledAt && <div>✕ Đã hủy: {new Date(task.cancelledAt).toLocaleString("vi-VN")}</div>}
      </div>

      {/* Lịch sử trạng thái */}
      <div className="stat__sub" style={{ marginTop: 10, lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          🔄 Lịch sử trạng thái ({history.length})
        </div>
        {history.length === 0 ? (
          <div>(chưa có thay đổi)</div>
        ) : (
          [...history].reverse().map((h, i) => (
            <div key={i}>
              {new Date(h.at).toLocaleString("vi-VN")} ·{" "}
              {h.from == null
                ? `Tạo ở "${columnName(h.to)}"`
                : `"${columnName(h.from)}" → "${columnName(h.to)}"`}
            </div>
          ))
        )}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn" onClick={save}>
            Lưu
          </button>
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn btn--danger" onClick={remove}>
            Xóa
          </button>
        </div>
      </div>

      {goalPicker && <GoalPicker task={task} onClose={() => setGoalPicker(false)} />}
    </Modal>
  );
}

// ===================== META TAGS =====================
function MetaTags({ t }) {
  const out = [];
  const p = PRI[t.priority];
  if (t.description) out.push(<span className="tag" key="desc">📝</span>);
  if (p) out.push(<span className={"tag " + p.cls} key="pri">{p.label}</span>);
  if (t.due) {
    const overdue = !t.done && !t.cancelledAt && new Date(t.due) < new Date();
    out.push(
      <span className="tag" key="due" style={overdue ? { color: "var(--danger)" } : undefined}>
        🎯 {fmtDateTime(t.due)}
      </span>
    );
  }
  if (t.startedAt && !t.completedAt && !t.cancelledAt)
    out.push(<span className="tag" key="start">▶ {fmtDateTime(t.startedAt)}</span>);
  if (t.completedAt) out.push(<span className="tag tag--ok" key="done">✓ {fmtDateTime(t.completedAt)}</span>);
  if (t.startedAt && t.completedAt)
    out.push(<span className="tag" key="dur">⏱ {fmtDuration(t.completedAt - t.startedAt)}</span>);
  if (t.cancelledAt) out.push(<span className="tag tag--high" key="cancel">✕ {fmtDateTime(t.cancelledAt)}</span>);
  return out;
}

// ===================== MAIN VIEW =====================
export default function Tasks({ intent }) {
  const { db, update, log } = useStore();
  const toast = useToast();

  const [text, setText] = useState("");
  const [priority, setPriority] = useState("med");
  const [due, setDue] = useState("");
  const [addCol, setAddCol] = useState(db.taskColumns[0]?.id || "");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState({ priority: "all", status: "all", due: "all" });
  const [dragId, setDragId] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const layout = db.settings.taskLayout || "board";

  // Mở popup chi tiết khi điều hướng từ Mục tiêu (intent.openTaskId).
  useEffect(() => {
    if (intent && intent.openTaskId) setDetailId(intent.openTaskId);
  }, [intent]);

  const columnName = (id) => (db.taskColumns.find((x) => x.id === id) || {}).name || "?";

  const moveTask = (taskId, colId) => {
    let detail = "";
    update((d) => {
      const t = d.todos.find((x) => x.id === taskId);
      if (!t) return;
      const fromName = (d.taskColumns.find((c) => c.id === t.columnId) || {}).name || "?";
      applyColumn(d, t, colId);
      detail = `"${t.text}": ${fromName} → ${(d.taskColumns.find((c) => c.id === colId) || {}).name || "?"}`;
    });
    log("task_move", detail);
  };

  const addTask = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    update((d) => {
      const t = newTask({ text: text.trim(), priority });
      t.due = due || null;
      applyColumn(d, t, addCol);
      d.todos.unshift(t);
    });
    log("task_add", "Thêm công việc: " + text.trim());
    setText("");
    setDue("");
  };

  const setLayout = (id) => update((d) => (d.settings.taskLayout = id));

  const addColumn = () => {
    const name = prompt("Tên cột mới:");
    if (!name || !name.trim()) return;
    update((d) => d.taskColumns.push({ id: uid(), name: name.trim() }));
    log("column_add", "Thêm cột: " + name.trim());
  };

  const passFilter = (t) => {
    if (query.trim() && !t.text.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (filter.priority !== "all" && t.priority !== filter.priority) return false;
    if (filter.status !== "all" && t.columnId !== filter.status) return false;
    if (filter.due !== "all") {
      const has = !!t.due;
      if (filter.due === "none" && has) return false;
      if (filter.due === "has" && !has) return false;
      if (filter.due === "overdue" && (!has || t.done || t.cancelledAt || new Date(t.due) >= new Date()))
        return false;
      if (filter.due === "today") {
        if (!has) return false;
        if (new Date(t.due).toDateString() !== new Date().toDateString()) return false;
      }
    }
    return true;
  };

  const sortedFiltered = useMemo(() => {
    const colIndex = {};
    db.taskColumns.forEach((c, i) => (colIndex[c.id] = i));
    return db.todos
      .filter(passFilter)
      .sort(
        (a, b) =>
          colIndex[a.columnId] - colIndex[b.columnId] || ORDER[a.priority] - ORDER[b.priority]
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.todos, db.taskColumns, query, filter]);

  const deleteTask = (t) => {
    update((d) => (d.todos = d.todos.filter((x) => x.id !== t.id)));
    log("task_delete", "Xóa công việc: " + t.text);
  };

  const MoveSelect = ({ t, style }) => (
    <select
      className="tcard__move"
      style={style}
      value={t.columnId}
      onChange={(e) => moveTask(t.id, e.target.value)}
    >
      {db.taskColumns.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <PageHead
        title="✅ Công việc"
        subtitle="Kéo–thả qua các cột, nhiều kiểu hiển thị (Bảng / Danh sách / Bảng kê), lọc & theo dõi thời gian."
      />

      {/* Form thêm việc */}
      <form className="card" onSubmit={addTask}>
        <div className="field" style={{ margin: 0 }}>
          <label>Việc mới</label>
          <input
            className="input"
            placeholder="Thêm việc mới..."
            maxLength={200}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Cột</label>
            <select className="select" value={addCol} onChange={(e) => setAddCol(e.target.value)}>
              {db.taskColumns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Ưu tiên</label>
            <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="med">Ưu tiên: Vừa</option>
              <option value="high">Ưu tiên: Cao</option>
              <option value="low">Ưu tiên: Thấp</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Thời gian hoàn thành</label>
            <input
              className="input"
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
            <button className="btn" type="submit">
              Thêm
            </button>
          </div>
        </div>
      </form>

      {/* Thanh công cụ */}
      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <div style={{ flex: "0 0 auto" }}>
            <div className="seg">
              {[
                ["board", "▦ Bảng"],
                ["list", "☰ Danh sách"],
                ["table", "▤ Bảng kê"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={"seg__btn" + (layout === id ? " is-active" : "")}
                  onClick={() => setLayout(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <input
            className="input"
            placeholder="🔍 Tìm theo tên..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div style={{ flex: "0 0 auto" }}>
            <button className="btn btn--ghost" onClick={addColumn}>
              ＋ Thêm cột
            </button>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <select
            className="select"
            value={filter.priority}
            onChange={(e) => setFilter((f) => ({ ...f, priority: e.target.value }))}
          >
            <option value="all">Mọi ưu tiên</option>
            <option value="high">Ưu tiên cao</option>
            <option value="med">Ưu tiên vừa</option>
            <option value="low">Ưu tiên thấp</option>
          </select>
          <select
            className="select"
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="all">Mọi trạng thái</option>
            {db.taskColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={filter.due}
            onChange={(e) => setFilter((f) => ({ ...f, due: e.target.value }))}
          >
            <option value="all">Mọi hạn</option>
            <option value="overdue">Quá hạn</option>
            <option value="today">Hôm nay</option>
            <option value="has">Có hạn</option>
            <option value="none">Không hạn</option>
          </select>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => {
                setQuery("");
                setFilter({ priority: "all", status: "all", due: "all" });
              }}
            >
              Xóa lọc
            </button>
          </div>
        </div>
      </div>

      {/* Nội dung theo layout */}
      {layout === "list" && (
        <TaskList rows={sortedFiltered} db={db} onOpen={setDetailId} onDelete={deleteTask} MoveSelect={MoveSelect} />
      )}
      {layout === "table" && (
        <TaskTable rows={sortedFiltered} onOpen={setDetailId} onDelete={deleteTask} MoveSelect={MoveSelect} />
      )}
      {layout === "board" && (
        <TaskBoard
          db={db}
          passFilter={passFilter}
          onOpen={setDetailId}
          onDelete={deleteTask}
          moveTask={moveTask}
          addColumn={addColumn}
          dragId={dragId}
          setDragId={setDragId}
          update={update}
          log={log}
          toast={toast}
          MoveSelect={MoveSelect}
        />
      )}

      {detailId && <TaskDetailModal taskId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

function TaskList({ rows, db, onOpen, onDelete, MoveSelect }) {
  if (!rows.length) return <p className="empty">Không có công việc phù hợp.</p>;
  return (
    <ul className="list">
      {rows.map((t) => {
        const col = db.taskColumns.find((c) => c.id === t.columnId);
        return (
          <li className={"item" + (t.done || t.cancelledAt ? " done" : "")} key={t.id}>
            <span className="badge">{col ? col.name : "?"}</span>
            <span className="item__text" style={{ cursor: "pointer" }} onClick={() => onOpen(t.id)}>
              {t.text}
            </span>
            <MetaTags t={t} />
            <MoveSelect t={t} style={{ flex: "0 0 130px" }} />
            <button className="icon-btn" title="Xóa" onClick={() => onDelete(t)}>
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TaskTable({ rows, onOpen, onDelete, MoveSelect }) {
  if (!rows.length) return <p className="empty">Không có công việc phù hợp.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Công việc</th>
            <th>Trạng thái</th>
            <th>Ưu tiên</th>
            <th>Hạn</th>
            <th>Hoàn thành</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const p = PRI[t.priority];
            return (
              <tr key={t.id}>
                <td>
                  <span
                    style={{
                      cursor: "pointer",
                      ...(t.done || t.cancelledAt
                        ? { color: "var(--muted)", textDecoration: "line-through" }
                        : {}),
                    }}
                    onClick={() => onOpen(t.id)}
                  >
                    {t.text}
                  </span>
                  {t.description ? <span> 📝</span> : null}
                </td>
                <td>
                  <MoveSelect t={t} style={{ maxWidth: 140 }} />
                </td>
                <td>{p ? <span className={"tag " + p.cls}>{p.label}</span> : null}</td>
                <td className="table__time">{t.due ? fmtDateTime(t.due) : "—"}</td>
                <td className="table__time">
                  {t.completedAt ? fmtDateTime(t.completedAt) : t.cancelledAt ? "Đã hủy" : "—"}
                </td>
                <td>
                  <button className="icon-btn" title="Xóa" onClick={() => onDelete(t)}>
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaskBoard({ db, passFilter, onOpen, onDelete, moveTask, addColumn, dragId, setDragId, update, log, toast, MoveSelect }) {
  const [dragOverCol, setDragOverCol] = useState(null);

  const renameColumn = (col) => {
    const name = prompt("Đổi tên cột:", col.name);
    if (!name || !name.trim()) return;
    update((d) => {
      const c = d.taskColumns.find((x) => x.id === col.id);
      if (c) c.name = name.trim();
    });
  };

  const deleteColumn = (col) => {
    if (db.taskColumns.length <= 1) return toast("Phải còn ít nhất 1 cột", "err");
    const count = db.todos.filter((t) => t.columnId === col.id).length;
    if (count && !confirm(`Cột "${col.name}" có ${count} việc. Chúng sẽ chuyển sang cột đầu tiên. Tiếp tục?`))
      return;
    update((d) => {
      const target = d.taskColumns.find((c) => c.id !== col.id).id;
      d.todos.forEach((t) => {
        if (t.columnId === col.id) t.columnId = target;
      });
      d.taskColumns = d.taskColumns.filter((c) => c.id !== col.id);
    });
    log("column_delete", "Xóa cột: " + col.name);
  };

  const quickAdd = (col) => {
    const text = prompt("Việc mới trong cột " + col.name + ":");
    if (!text || !text.trim()) return;
    update((d) => {
      const t = newTask({ text: text.trim() });
      applyColumn(d, t, col.id);
      d.todos.unshift(t);
    });
    log("task_add", "Thêm công việc: " + text.trim());
  };

  return (
    <div className="board">
      {db.taskColumns.map((col) => {
        const cards = db.todos
          .filter((t) => t.columnId === col.id && passFilter(t))
          .sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
        return (
          <div
            className={"column" + (dragOverCol === col.id ? " drop-over" : "")}
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverCol !== col.id) setDragOverCol(col.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverCol(null);
              const id = dragId || (e.dataTransfer && e.dataTransfer.getData("text/plain"));
              if (id) moveTask(id, col.id);
            }}
          >
            <div className="column__head">
              <span className="column__name">{col.name + (KIND_MARK[col.kind] || "")}</span>
              <span className="column__count">{cards.length}</span>
              <button
                className="icon-btn"
                title="Đổi tên cột"
                style={{ color: "var(--muted)" }}
                onClick={() => renameColumn(col)}
              >
                ✏️
              </button>
              <button className="icon-btn" title="Xóa cột" onClick={() => deleteColumn(col)}>
                🗑️
              </button>
            </div>
            <div className="column__cards">
              {cards.map((t) => (
                <div
                  className={
                    "tcard" +
                    (t.done ? " done" : "") +
                    (t.cancelledAt ? " cancelled" : "") +
                    (dragId === t.id ? " dragging" : "")
                  }
                  key={t.id}
                  draggable
                  onDragStart={(e) => {
                    setDragId(t.id);
                    e.dataTransfer.effectAllowed = "move";
                    try {
                      e.dataTransfer.setData("text/plain", t.id);
                    } catch {
                      /* noop */
                    }
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDragOverCol(null);
                  }}
                >
                  <div
                    className="tcard__text"
                    style={{ cursor: "pointer" }}
                    title="Bấm để xem & sửa chi tiết"
                    onClick={() => onOpen(t.id)}
                  >
                    {t.text}
                  </div>
                  {(() => {
                    const tags = MetaTags({ t });
                    return tags.length ? <div className="tcard__meta">{tags}</div> : null;
                  })()}
                  <div className="tcard__foot">
                    <MoveSelect t={t} />
                    <button className="icon-btn" title="Xóa" onClick={() => onDelete(t)}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className="column__add" onClick={() => quickAdd(col)}>
              ＋ Thêm việc
            </button>
          </div>
        );
      })}
      <button className="add-column" title="Thêm cột" onClick={addColumn}>
        ＋
      </button>
    </div>
  );
}
