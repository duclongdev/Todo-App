// habits.js — Thói quen + streak, xem theo tuần (chuyển tuần), sửa & ghi chú
(function () {
  const { el, toKey, today } = U;
  const ICONS = ["💧", "🏃", "📚", "🧘", "🥗", "💊", "🦷", "✍️", "🎸", "🌙", "☀️", "💪", "🚭", "🧹", "💰", "🎯"];
  let editingId = null;
  let weekOffset = 0; // 0 = tuần này

  function streakOf(habitId) {
    const logs = Store.get("habitLogs")[habitId] || {};
    let streak = 0, d = new Date();
    if (!logs[toKey(d)]) d = U.addDays(d, -1);
    while (logs[toKey(d)]) { streak++; d = U.addDays(d, -1); }
    return streak;
  }

  function toggle(habitId, dateStr, root) {
    Store.update((db) => {
      db.habitLogs[habitId] = db.habitLogs[habitId] || {};
      if (db.habitLogs[habitId][dateStr]) delete db.habitLogs[habitId][dateStr];
      else db.habitLogs[habitId][dateStr] = true;
    });
    App.log("habit_tick", "Cập nhật thói quen ngày " + dateStr);
    render(root);
  }

  function render(root) {
    const db = Store.all();
    root.innerHTML = "";
    root.append(el("div", { class: "page-head" }, [
      el("h2", { text: "🔥 Thói quen" }),
      el("p", { text: "Theo dõi theo tuần, chuyển qua các tuần khác và ghi chú cho từng thói quen." }),
    ]));

    // Add habit
    const nameIn = el("input", { class: "input", placeholder: "Tên thói quen (vd: Uống 2L nước)", maxlength: "60" });
    const iconSel = el("select", { class: "select", style: "max-width:90px;flex:0 0 90px" }, ICONS.map((i) => el("option", { value: i, text: i })));
    const addBtn = el("button", { class: "btn", text: "Thêm" });
    function add() {
      const name = nameIn.value.trim();
      if (!name) return;
      Store.update((d) => d.habits.push({ id: U.uid(), name, icon: iconSel.value, note: "", createdAt: Date.now() }));
      App.log("habit_add", "Thêm thói quen: " + name);
      nameIn.value = "";
      render(root);
    }
    addBtn.addEventListener("click", add);
    nameIn.addEventListener("keydown", (e) => e.key === "Enter" && add());
    root.append(el("div", { class: "card" }, [el("div", { class: "row" }, [nameIn, iconSel, el("div", { style: "flex:0 0 auto" }, [addBtn])])]));

    if (db.habits.length === 0) {
      root.append(el("p", { class: "empty", text: "Chưa có thói quen nào. Hãy thêm một thói quen tốt!" }));
      return;
    }

    // ---- Thanh chuyển tuần ----
    const days = U.weekDays(weekOffset);
    const start = U.parseKey(days[0]), end = U.parseKey(days[6]);
    const rangeLabel = `${toKey(start).slice(5)} → ${toKey(end).slice(5)}`;
    const prev = el("button", { class: "weeknav__btn", text: "◀", title: "Tuần trước", onClick: () => { weekOffset--; render(root); } });
    const next = el("button", { class: "weeknav__btn", text: "▶", title: "Tuần sau", onClick: () => { weekOffset++; render(root); } });
    const label = el("div", { class: "weeknav__label" }, [
      el("div", { text: weekOffset === 0 ? "Tuần này" : weekOffset === -1 ? "Tuần trước" : weekOffset === 1 ? "Tuần sau" : `${weekOffset > 0 ? "+" : ""}${weekOffset} tuần` }),
      el("div", { class: "stat__sub weeknav__today", text: rangeLabel }),
    ]);
    const navRow = el("div", { class: "weeknav", style: "margin-top:16px" }, [prev, label, next]);
    if (weekOffset !== 0) navRow.append(el("button", { class: "btn btn--sm btn--ghost", text: "Hôm nay", onClick: () => { weekOffset = 0; render(root); } }));
    root.append(navRow);

    const wrap = el("div", { class: "grid" });
    db.habits.forEach((h) => {
      const card = el("div", { class: "habit" });

      if (editingId === h.id) {
        const editName = el("input", { class: "input", value: h.name, maxlength: "60" });
        const editIcon = el("select", { class: "select", style: "max-width:80px;flex:0 0 80px" }, ICONS.map((i) => el("option", { value: i, text: i, selected: i === h.icon })));
        editIcon.value = h.icon;
        const editNote = el("textarea", { class: "textarea", placeholder: "Ghi chú cho thói quen này...", style: "min-height:60px;margin-top:8px" });
        editNote.value = h.note || "";
        const save = el("button", { class: "btn btn--sm", text: "Lưu" });
        save.addEventListener("click", () => {
          const name = editName.value.trim();
          if (!name) return;
          Store.update((d) => { const x = d.habits.find((q) => q.id === h.id); if (x) { x.name = name; x.icon = editIcon.value; x.note = editNote.value.trim(); } });
          App.log("habit_edit", "Sửa thói quen: " + name);
          editingId = null;
          render(root);
        });
        const cancel = el("button", { class: "btn btn--sm btn--ghost", text: "Hủy", onClick: () => { editingId = null; render(root); } });
        card.append(el("div", { class: "row" }, [editName, editIcon]));
        card.append(editNote);
        card.append(el("div", { class: "row", style: "margin-top:8px;justify-content:flex-start" }, [el("div", { style: "flex:0 0 auto" }, [save]), el("div", { style: "flex:0 0 auto" }, [cancel])]));
        wrap.append(card);
        return;
      }

      const logs = db.habitLogs[h.id] || {};
      const edit = el("button", { class: "icon-btn", text: "✏️", title: "Sửa / ghi chú", style: "color:var(--muted)" });
      edit.addEventListener("click", () => { editingId = h.id; render(root); });
      const del = el("button", { class: "icon-btn", text: "🗑️", title: "Xóa" });
      del.addEventListener("click", () => {
        if (!confirm(`Xóa thói quen "${h.name}"?`)) return;
        Store.update((d) => { d.habits = d.habits.filter((x) => x.id !== h.id); delete d.habitLogs[h.id]; });
        render(root);
      });
      card.append(el("div", { class: "habit__head" }, [
        el("span", { class: "habit__icon", text: h.icon }),
        el("span", { class: "habit__name", text: h.name }),
        el("span", { class: "habit__streak", text: "🔥 " + streakOf(h.id) }),
        edit, del,
      ]));
      if (h.note) card.append(el("div", { class: "habit__note", text: "📝 " + h.note }));

      const week = el("div", { class: "habit__week" });
      days.forEach((ds) => {
        const isFuture = U.parseKey(ds) > new Date();
        const cell = el("div", { class: "daycell" + (logs[ds] ? " on" : "") + (ds === today() ? " today" : ""), style: isFuture ? "opacity:.45" : "" }, [
          el("span", { class: "daycell__num", text: U.parseKey(ds).getDate() }),
          el("span", { text: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][U.parseKey(ds).getDay()] }),
        ]);
        cell.addEventListener("click", () => toggle(h.id, ds, root));
        week.append(cell);
      });
      card.append(week);
      wrap.append(card);
    });
    root.append(wrap);
  }

  window.Views = window.Views || {};
  window.Views.habits = { render };
})();
