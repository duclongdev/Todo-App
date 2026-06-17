// store.js — tầng dữ liệu, lưu vào localStorage + thông báo thay đổi (cho file sync)
window.Store = (function () {
  const DB_KEY = "life-hub.db.v1";
  const subs = [];

  function defaultFinance() {
    const now = Date.now();
    return {
      accounts: [{ id: "cash", name: "Tiền mặt", icon: "💵", type: "cash", initial: 0, createdAt: now }],
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
      tx: [], // {id, type:'income'|'expense'|'transfer', amount, accountId, toAccountId, categoryId, date, note, createdAt}
      budgets: {}, // { categoryId: monthlyAmount }
      savings: [], // {id, name, icon, target, saved, deadline, createdAt}
    };
  }

  function defaultDB() {
    return {
      taskColumns: [
        { id: "todo", name: "Cần làm", kind: "todo" },
        { id: "doing", name: "Đang làm", kind: "doing" },
        { id: "pending", name: "Tạm hoãn", kind: "pending" },
        { id: "done", name: "Hoàn thành", kind: "done", isDone: true },
        { id: "cancel", name: "Đã hủy", kind: "cancel" },
      ],
      todos: [], // {id, text, description, done, columnId, priority, due, startedAt, completedAt, cancelledAt, createdAt}
      habits: [], // {id, name, icon, note, createdAt}
      habitLogs: {}, // { habitId: { "YYYY-MM-DD": true } }
      sleep: [],
      work: [],
      notes: [], // {id, title, blocks:[{id,type,text,checked,collapsed,content}], pinned, updatedAt}
      journal: {},
      goals: [], // {id, title, scope, period, done, progress, subtasks:[{id,text,done,taskId}], createdAt}
      finance: defaultFinance(),
      activity: [],
      settings: { theme: "light", name: "", currency: "₫" },
    };
  }

  function migrate(db) {
    if (!Array.isArray(db.taskColumns) || db.taskColumns.length === 0)
      db.taskColumns = defaultDB().taskColumns;
    // Gán "kind" cho cột cũ
    db.taskColumns.forEach((c) => {
      if (!c.kind) c.kind = c.isDone ? "done" : (["todo", "doing", "pending", "cancel"].includes(c.id) ? c.id : "custom");
    });
    // Bổ sung 1 lần 2 trạng thái mới: Tạm hoãn & Đã hủy
    if (!db._taskColsV2) {
      const doneIdx = db.taskColumns.findIndex((c) => c.isDone);
      if (!db.taskColumns.some((c) => c.kind === "pending")) {
        const at = doneIdx >= 0 ? doneIdx : db.taskColumns.length;
        db.taskColumns.splice(at, 0, { id: "pending", name: "Tạm hoãn", kind: "pending" });
      }
      if (!db.taskColumns.some((c) => c.kind === "cancel")) {
        db.taskColumns.push({ id: "cancel", name: "Đã hủy", kind: "cancel" });
      }
      db._taskColsV2 = true;
    }
    const firstCol = db.taskColumns[0].id;
    const doneCol = (db.taskColumns.find((c) => c.isDone) || {}).id || db.taskColumns[db.taskColumns.length - 1].id;
    (db.todos || []).forEach((t) => {
      if (!t.columnId) t.columnId = t.done ? doneCol : firstCol;
      if (t.completedAt === undefined) t.completedAt = t.done ? t.createdAt || Date.now() : null;
      if (t.description === undefined) t.description = "";
      if (!Array.isArray(t.history)) {
        // Khởi tạo lịch sử cho dữ liệu cũ: mục tạo + (nếu có) mốc hoàn thành
        t.history = [{ from: null, to: t.columnId, at: t.createdAt || Date.now() }];
        if (t.completedAt && t.columnId === doneCol) {
          t.history.push({ from: null, to: t.columnId, at: t.completedAt });
        }
      }
    });
    (db.goals || []).forEach((g) => {
      if (!Array.isArray(g.subtasks)) g.subtasks = [];
      if (typeof g.progress !== "number") g.progress = g.done ? 100 : 0;
    });
    (db.habits || []).forEach((h) => { if (h.note === undefined) h.note = ""; });
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
    // Tài chính
    if (!db.finance || typeof db.finance !== "object") db.finance = defaultFinance();
    const f = db.finance, df = defaultFinance();
    if (!Array.isArray(f.accounts) || f.accounts.length === 0) f.accounts = df.accounts;
    if (!Array.isArray(f.categories) || f.categories.length === 0) f.categories = df.categories;
    if (!Array.isArray(f.tx)) f.tx = [];
    if (!f.budgets || typeof f.budgets !== "object") f.budgets = {};
    if (!Array.isArray(f.savings)) f.savings = [];
    if (!db.settings.currency) db.settings.currency = "₫";
    return db;
  }

  function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  let db;
  function loadDB() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DB_KEY));
      return migrate(parsed ? Object.assign(defaultDB(), parsed) : defaultDB());
    } catch {
      return defaultDB();
    }
  }
  db = loadDB();

  function persist(silent) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    if (!silent) subs.forEach((fn) => { try { fn(db); } catch (_) {} });
  }

  return {
    get(key) { return db[key]; },
    set(key, val) { db[key] = val; persist(); },
    update(fn) { fn(db); persist(); },
    all() { return db; },
    export() { return JSON.stringify(db, null, 2); },
    // importSilent: không phát sự kiện onChange (tránh ghi ngược lại file khi vừa nạp từ file)
    import(obj, silent) { db = migrate(Object.assign(defaultDB(), obj)); persist(silent); },
    reset() { db = defaultDB(); persist(); },
    onChange(fn) { subs.push(fn); },
  };
})();
