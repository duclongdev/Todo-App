// stats.js — Thống kê: biểu đồ + nhật ký hoạt động/đăng nhập có lọc chi tiết
(function () {
  const { el, fmtMinutes } = U;
  let typeFilter = "all";
  let periodFilter = "7d"; // today | 7d | 30d | all

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

  function periodStart() {
    const now = new Date();
    if (periodFilter === "today") { now.setHours(0, 0, 0, 0); return now.getTime(); }
    if (periodFilter === "7d") return Date.now() - 7 * 864e5;
    if (periodFilter === "30d") return Date.now() - 30 * 864e5;
    return 0;
  }

  function barChart(data) {
    const max = Math.max(1, ...data.map((d) => d.value));
    const chart = el("div", { class: "chart" });
    data.forEach((d) => {
      const h = Math.round((d.value / max) * 100);
      chart.append(el("div", { class: "chart__col" }, [
        el("div", { class: "chart__val", text: d.raw != null ? d.raw : (d.value || "") }),
        el("div", { class: "chart__bar" + (d.value === 0 ? " soft" : ""), style: `height:${h}%`, title: String(d.raw ?? d.value) }),
        el("div", { class: "chart__label", text: d.label }),
      ]));
    });
    return chart;
  }

  function render(root) {
    const db = Store.all();
    root.innerHTML = "";
    root.append(el("div", { class: "page-head" }, [
      el("h2", { text: "📊 Thống kê" }),
      el("p", { text: "Tổng hợp hoạt động, nhật ký đăng nhập và mọi thao tác trên app." }),
    ]));

    // ---- Tiles tổng ----
    const totalFocus = db.work.reduce((s, w) => s + w.minutes, 0);
    const totalHabitTicks = Object.values(db.habitLogs).reduce((s, m) => s + Object.keys(m).length, 0);
    const tasksDone = db.todos.filter((t) => t.done).length;
    const sessions = db.activity.filter((a) => a.type === "session_start");
    root.append(el("div", { class: "grid grid--stats" }, [
      tile("🔑", "Lượt đăng nhập", String(sessions.length)),
      tile("⚡", "Tổng thao tác", String(db.activity.length)),
      tile("⏱️", "Tổng tập trung", fmtMinutes(totalFocus)),
      tile("✅", "Việc đã xong", String(tasksDone)),
    ]));

    // ---- Charts ----
    const days14 = U.lastNDays(14), days7 = U.lastNDays(7);
    if (db.habits.length) {
      const data = days14.map((ds) => { const done = db.habits.filter((h) => (db.habitLogs[h.id] || {})[ds]).length; return { label: U.parseKey(ds).getDate(), value: done, raw: done || "" }; });
      root.append(card("🔥 Thói quen hoàn thành mỗi ngày", barChart(data)));
    }
    if (db.sleep.length) {
      const map = {}; db.sleep.forEach((s) => (map[s.date] = U.minutesBetween(s.bedtime, s.waketime)));
      const data = days14.map((ds) => { const m = map[ds] || 0; return { label: U.parseKey(ds).getDate(), value: m, raw: m ? (m / 60).toFixed(1) : "" }; });
      root.append(card("😴 Giờ ngủ mỗi đêm", barChart(data)));
    }
    if (db.work.length) {
      const map = {}; db.work.forEach((w) => (map[w.date] = (map[w.date] || 0) + w.minutes));
      const data = days7.map((ds) => { const m = map[ds] || 0; return { label: U.fmtVN(ds).split(" ")[0], value: m, raw: m || "" }; });
      root.append(card("⏱️ Phút tập trung mỗi ngày (7 ngày)", barChart(data)));
    }

    // Hoạt động theo ngày (7 ngày)
    {
      const map = {};
      db.activity.forEach((a) => { const k = U.toKey(new Date(a.ts)); map[k] = (map[k] || 0) + 1; });
      const data = days7.map((ds) => { const c = map[ds] || 0; return { label: U.fmtVN(ds).split(" ")[0], value: c, raw: c || "" }; });
      root.append(card("⚡ Số thao tác mỗi ngày (7 ngày)", barChart(data)));
    }

    // ---- Nhật ký hoạt động (lọc chi tiết) ----
    const logCard = el("div", { class: "card", style: "margin-top:16px" });
    logCard.append(el("div", { class: "card__title", text: "📋 Nhật ký hoạt động" }));

    // Bộ lọc thời gian
    const periodPills = el("div", { class: "pills" });
    [["today", "Hôm nay"], ["7d", "7 ngày"], ["30d", "30 ngày"], ["all", "Tất cả"]].forEach(([p, label]) => {
      const b = el("button", { class: "pill" + (periodFilter === p ? " is-active" : ""), text: label });
      b.addEventListener("click", () => { periodFilter = p; render(root); });
      periodPills.append(b);
    });
    logCard.append(periodPills);

    // Bộ lọc loại thao tác
    const presentTypes = Array.from(new Set(db.activity.map((a) => a.type)));
    const typeSel = el("select", { class: "select", style: "max-width:260px" }, [
      el("option", { value: "all", text: "Tất cả loại thao tác" }),
      ...presentTypes.map((t) => el("option", { value: t, text: labelOf(t), selected: t === typeFilter })),
    ]);
    typeSel.value = typeFilter;
    typeSel.addEventListener("change", () => { typeFilter = typeSel.value; render(root); });
    logCard.append(el("div", { style: "margin-bottom:14px" }, [typeSel]));

    // Lọc dữ liệu
    const start = periodStart();
    let rows = db.activity.filter((a) => a.ts >= start && (typeFilter === "all" || a.type === typeFilter));
    rows = rows.sort((a, b) => b.ts - a.ts);

    // Tóm tắt theo loại trong phạm vi lọc
    const byType = {};
    rows.forEach((r) => (byType[r.type] = (byType[r.type] || 0) + 1));
    const summary = el("div", { class: "row", style: "margin-bottom:14px" });
    Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => {
      summary.append(el("span", { class: "tag", style: "flex:0 0 auto", text: `${labelOf(t)}: ${c}` }));
    });
    if (rows.length) logCard.append(summary);

    if (rows.length === 0) {
      logCard.append(el("p", { class: "empty", text: "Không có hoạt động nào trong bộ lọc này." }));
    } else {
      const table = el("table", { class: "table" });
      table.append(el("thead", {}, el("tr", {}, [
        el("th", { text: "Thời gian" }), el("th", { text: "Loại" }), el("th", { text: "Chi tiết" }),
      ])));
      const tbody = el("tbody");
      rows.slice(0, 200).forEach((r) => {
        const d = new Date(r.ts);
        tbody.append(el("tr", {}, [
          el("td", { class: "table__time", text: d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) }),
          el("td", {}, el("span", { class: "badge", text: labelOf(r.type) })),
          el("td", { text: r.detail || "—" }),
        ]));
      });
      table.append(tbody);
      logCard.append(table);
      if (rows.length > 200) logCard.append(el("p", { class: "stat__sub", style: "margin-top:10px", text: `Hiển thị 200 / ${rows.length} thao tác gần nhất.` }));
    }
    root.append(logCard);

    // ---- Lịch sử đăng nhập ----
    const sessRows = sessions.filter((a) => a.ts >= start).sort((a, b) => b.ts - a.ts).slice(0, 30);
    if (sessRows.length) {
      const sc = el("div", { class: "card", style: "margin-top:16px" });
      sc.append(el("div", { class: "card__title", text: "🔑 Lịch sử đăng nhập" }));
      const list = el("ul", { class: "list" });
      sessRows.forEach((s) => {
        const d = new Date(s.ts);
        list.append(el("li", { class: "item" }, [
          el("span", { text: "🔑" }),
          el("span", { class: "item__text", text: d.toLocaleString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) }),
        ]));
      });
      sc.append(list);
      root.append(sc);
    }
  }

  function tile(icon, label, value) {
    return el("div", { class: "stat" }, [
      el("div", { class: "stat__label" }, [el("span", { text: icon }), el("span", { text: label })]),
      el("div", { class: "stat__value", text: value }),
    ]);
  }
  function card(title, body) {
    return el("div", { class: "card", style: "margin-top:16px" }, [el("div", { class: "card__title", text: title }), body]);
  }

  window.Views = window.Views || {};
  window.Views.stats = { render };
})();
