// db.js — định nghĩa cấu trúc dữ liệu mặc định + migrate (giữ nguyên logic từ bản gốc).
// Tách khỏi React để dễ test và tái sử dụng.

export const DB_KEY = "life-hub.db.v1";

const rid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function defaultFinance() {
  const now = Date.now();
  return {
    accounts: [
      { id: "cash", name: "Tiền mặt", icon: "💵", type: "cash", initial: 0, createdAt: now },
    ],
    categories: [
      { id: "c_food", name: "Ăn uống", icon: "🍜", kind: "expense" },
      { id: "c_transport", name: "Đi lại", icon: "🚌", kind: "expense" },
      { id: "c_shopping", name: "Mua sắm", icon: "🛍️", kind: "expense" },
      { id: "c_bills", name: "Hóa đơn", icon: "🧾", kind: "expense" },
      { id: "c_fun", name: "Giải trí", icon: "🎮", kind: "expense" },
      { id: "c_health", name: "Sức khỏe", icon: "💊", kind: "expense" },
      { id: "c_edu", name: "Giáo dục", icon: "📚", kind: "expense" },
      { id: "c_home", name: "Nhà cửa", icon: "🏠", kind: "expense" },
      { id: "c_other_e", name: "Khác", icon: "📦", kind: "expense" },
      { id: "c_salary", name: "Lương", icon: "💼", kind: "income" },
      { id: "c_bonus", name: "Thưởng", icon: "🎁", kind: "income" },
      { id: "c_invest", name: "Đầu tư", icon: "📈", kind: "income" },
      { id: "c_other_i", name: "Thu khác", icon: "💵", kind: "income" },
    ],
    tx: [],
    budgets: {},
    savings: [],
  };
}

export function defaultDB() {
  return {
    taskColumns: [
      { id: "plan", name: "Ý tưởng", kind: "plan" },
      { id: "todo", name: "Cần làm", kind: "todo" },
      { id: "doing", name: "Đang làm", kind: "doing" },
      { id: "pending", name: "Tạm hoãn", kind: "pending" },
      { id: "done", name: "Hoàn thành", kind: "done", isDone: true },
      { id: "cancel", name: "Đã hủy", kind: "cancel" },
    ],
    todos: [],
    habits: [],
    habitLogs: {},
    sleep: [],
    work: [],
    notes: [],
    journal: {},
    goals: [],
    finance: defaultFinance(),
    activity: [],
    settings: { theme: "light", name: "", currency: "₫" },
  };
}

export function migrate(db) {
  if (!Array.isArray(db.taskColumns) || db.taskColumns.length === 0)
    db.taskColumns = defaultDB().taskColumns;
  db.taskColumns.forEach((c) => {
    if (!c.kind)
      c.kind = c.isDone
        ? "done"
        : ["plan", "todo", "doing", "pending", "cancel"].includes(c.id)
        ? c.id
        : "custom";
  });
  if (!db._taskColsV3) {
    if (!db.taskColumns.some((c) => c.kind === "plan"))
      db.taskColumns.unshift({ id: "plan", name: "Ý tưởng", kind: "plan" });
    db._taskColsV3 = true;
  }
  if (!db._taskColsV2) {
    const doneIdx = db.taskColumns.findIndex((c) => c.isDone);
    if (!db.taskColumns.some((c) => c.kind === "pending")) {
      const at = doneIdx >= 0 ? doneIdx : db.taskColumns.length;
      db.taskColumns.splice(at, 0, { id: "pending", name: "Tạm hoãn", kind: "pending" });
    }
    if (!db.taskColumns.some((c) => c.kind === "cancel"))
      db.taskColumns.push({ id: "cancel", name: "Đã hủy", kind: "cancel" });
    db._taskColsV2 = true;
  }
  const firstCol = db.taskColumns[0].id;
  const doneCol =
    (db.taskColumns.find((c) => c.isDone) || {}).id ||
    db.taskColumns[db.taskColumns.length - 1].id;
  (db.todos || []).forEach((t) => {
    if (!t.columnId) t.columnId = t.done ? doneCol : firstCol;
    if (t.completedAt === undefined) t.completedAt = t.done ? t.createdAt || Date.now() : null;
    if (t.description === undefined) t.description = "";
    if (!Array.isArray(t.history)) {
      t.history = [{ from: null, to: t.columnId, at: t.createdAt || Date.now() }];
      if (t.completedAt && t.columnId === doneCol)
        t.history.push({ from: null, to: t.columnId, at: t.completedAt });
    }
  });
  (db.goals || []).forEach((g) => {
    if (!Array.isArray(g.subtasks)) g.subtasks = [];
    if (typeof g.progress !== "number") g.progress = g.done ? 100 : 0;
  });
  (db.habits || []).forEach((h) => {
    if (h.note === undefined) h.note = "";
  });
  (db.notes || []).forEach((n) => {
    if (!Array.isArray(n.blocks)) {
      n.blocks = [];
      const body = (n.body || "").split("\n");
      body.forEach((line) => n.blocks.push({ id: rid(), type: "text", text: line }));
      if (n.blocks.length === 0) n.blocks.push({ id: rid(), type: "text", text: "" });
      delete n.body;
    }
  });
  if (!Array.isArray(db.activity)) db.activity = [];
  if (!db.finance || typeof db.finance !== "object") db.finance = defaultFinance();
  const f = db.finance,
    df = defaultFinance();
  if (!Array.isArray(f.accounts) || f.accounts.length === 0) f.accounts = df.accounts;
  if (!Array.isArray(f.categories) || f.categories.length === 0) f.categories = df.categories;
  if (!Array.isArray(f.tx)) f.tx = [];
  if (!f.budgets || typeof f.budgets !== "object") f.budgets = {};
  if (!Array.isArray(f.savings)) f.savings = [];
  if (!db.settings.currency) db.settings.currency = "₫";
  return db;
}

export function loadDB() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DB_KEY));
    return migrate(parsed ? Object.assign(defaultDB(), parsed) : defaultDB());
  } catch {
    return defaultDB();
  }
}
