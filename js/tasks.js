// tasks.js — Bảng Kanban: cột tùy chỉnh, tìm kiếm, thời gian hoàn thành
(function () {
  const { el } = U;
  let query = "";
  let dragId = null; // id công việc đang được kéo

  const PRI = {
    high: { label: "Cao", cls: "tag--high" },
    med: { label: "Vừa", cls: "tag--med" },
    low: { label: "Thấp", cls: "tag--low" },
  };
  const KIND_MARK = { plan: " 💡", done: " ✓", cancel: " ✕", pending: " ⏸", doing: " ▶" };
  let layout = "board"; // board | list | table
  let filter = { priority: "all", status: "all", due: "all" };

  function fmtDateTime(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d)) return v;
    return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  function fmtDuration(ms) {
    return U.fmtMinutes(Math.max(0, ms) / 60000);
  }

  function isDoneCol(colId) {
    const c = Store.get("taskColumns").find((x) => x.id === colId);
    return !!(c && c.isDone);
  }

  // Đổi cột + tự ghi mốc thời gian + LƯU LỊCH SỬ mọi lần đổi trạng thái
  function applyColumn(d, t, colId) {
    const prevCol = t.columnId;
    const col = d.taskColumns.find((c) => c.id === colId);
    const kind = col ? col.kind : null;
    t.columnId = colId;
    t.done = !!(col && col.isDone);
    if (kind === "doing" && !t.startedAt) t.startedAt = Date.now();       // thời gian bắt đầu làm
    t.completedAt = col && col.isDone ? (t.completedAt || Date.now()) : null; // thời gian hoàn thành
    t.cancelledAt = kind === "cancel" ? (t.cancelledAt || Date.now()) : null; // thời gian hủy
    if (prevCol !== colId) {
      t.history = t.history || [];
      t.history.push({ from: prevCol, to: colId, at: Date.now() });
    }
  }

  function openDetail(task, root) {
    const cols = Store.get("taskColumns");
    const text = el("input", { class: "input", value: task.text, maxlength: "200" });
    const desc = el("textarea", { class: "textarea", placeholder: "Mô tả chi tiết...", style: "min-height:120px" });
    desc.value = task.description || "";
    const pri = el("select", { class: "select" },
      [["high", "Cao"], ["med", "Vừa"], ["low", "Thấp"]].map(([v, t]) => el("option", { value: v, text: "Ưu tiên: " + t, selected: v === task.priority }))
    );
    pri.value = task.priority;
    const due = el("input", { class: "input", type: "datetime-local", value: task.due || "" });
    const colSel = el("select", { class: "select" }, cols.map((c) => el("option", { value: c.id, text: c.name, selected: c.id === task.columnId })));
    colSel.value = task.columnId;

    const infoLines = [el("div", { text: "🗓️ Tạo: " + new Date(task.createdAt).toLocaleString("vi-VN") })];
    if (task.startedAt) infoLines.push(el("div", { text: "▶ Bắt đầu làm: " + new Date(task.startedAt).toLocaleString("vi-VN") }));
    if (task.completedAt) infoLines.push(el("div", { text: "✓ Hoàn thành: " + new Date(task.completedAt).toLocaleString("vi-VN") }));
    if (task.startedAt && task.completedAt) infoLines.push(el("div", { text: "⏱ Thời gian làm: " + fmtDuration(task.completedAt - task.startedAt) }));
    if (task.cancelledAt) infoLines.push(el("div", { text: "✕ Đã hủy: " + new Date(task.cancelledAt).toLocaleString("vi-VN") }));
    const info = el("div", { class: "stat__sub", style: "line-height:1.7" }, infoLines);

    // Lịch sử mọi lần đổi trạng thái
    const colName = (id) => { const c = cols.find((x) => x.id === id); return c ? c.name : (id ? "(cột đã xóa)" : "Tạo mới"); };
    const hist = task.history || [];
    const histEl = el("div", { class: "stat__sub", style: "margin-top:10px;line-height:1.7" }, [
      el("div", { style: "font-weight:700;color:var(--text);margin-bottom:4px", text: "🔄 Lịch sử trạng thái (" + hist.length + ")" }),
    ]);
    if (hist.length === 0) histEl.append(el("div", { text: "(chưa có thay đổi)" }));
    else [...hist].reverse().forEach((h) => {
      const when = new Date(h.at).toLocaleString("vi-VN");
      const label = h.from == null ? `Tạo ở "${colName(h.to)}"` : `"${colName(h.from)}" → "${colName(h.to)}"`;
      histEl.append(el("div", { text: `${when} · ${label}` }));
    });

    const saveBtn = el("button", { class: "btn", text: "Lưu" });
    const delBtn = el("button", { class: "btn btn--danger", text: "Xóa" });

    const body = el("div", {}, [
      el("div", { class: "field" }, [el("label", { text: "Tên công việc" }), text]),
      el("div", { class: "field" }, [el("label", { text: "Mô tả" }), desc]),
      el("div", { class: "row" }, [
        el("div", { class: "field", style: "margin:0" }, [el("label", { text: "Cột" }), colSel]),
        el("div", { class: "field", style: "margin:0" }, [el("label", { text: "Ưu tiên" }), pri]),
      ]),
      el("div", { class: "field" }, [el("label", { text: "Thời gian hoàn thành dự kiến" }), due]),
      info,
      histEl,
      el("div", { class: "row", style: "margin-top:10px" }, [el("div", { style: "flex:0 0 auto" }, [saveBtn]), el("div", { style: "flex:0 0 auto" }, [delBtn])]),
    ]);

    const m = U.modal({ title: "Chi tiết công việc", body });

    saveBtn.addEventListener("click", () => {
      if (!text.value.trim()) return U.toast("Tên không được trống", "err");
      let moveDetail = "";
      Store.update((d) => {
        const t = d.todos.find((x) => x.id === task.id);
        if (!t) return;
        t.text = text.value.trim();
        t.description = desc.value.trim();
        t.priority = pri.value;
        t.due = due.value || null;
        if (t.columnId !== colSel.value) {
          const fromName = (d.taskColumns.find((x) => x.id === t.columnId) || {}).name || "?";
          applyColumn(d, t, colSel.value);
          const toName = (d.taskColumns.find((x) => x.id === colSel.value) || {}).name || "?";
          moveDetail = `"${t.text}": ${fromName} → ${toName}`;
        }
      });
      if (moveDetail) App.log("task_move", moveDetail);
      App.log("task_edit", "Sửa công việc: " + text.value.trim());
      m.close();
      render(root);
    });
    delBtn.addEventListener("click", () => {
      if (!confirm("Xóa công việc này?")) return;
      Store.update((d) => (d.todos = d.todos.filter((x) => x.id !== task.id)));
      App.log("task_delete", "Xóa công việc: " + task.text);
      m.close();
      render(root);
    });
  }

  function moveTask(taskId, colId, root) {
    let detail = "";
    Store.update((d) => {
      const t = d.todos.find((x) => x.id === taskId);
      if (!t) return;
      const fromName = (d.taskColumns.find((x) => x.id === t.columnId) || {}).name || "?";
      applyColumn(d, t, colId);
      const toName = (d.taskColumns.find((x) => x.id === colId) || {}).name || "?";
      detail = `"${t.text}": ${fromName} → ${toName}`;
    });
    App.log("task_move", detail);
    render(root);
  }

  function render(root) {
    const db = Store.all();
    root.innerHTML = "";
    root.append(
      el("div", { class: "page-head" }, [
        el("h2", { text: "✅ Công việc" }),
        el("p", { text: "Kéo–thả qua các cột, nhiều kiểu hiển thị (Bảng / Danh sách / Bảng kê), lọc & theo dõi thời gian." }),
      ])
    );

    // ---- Form thêm việc ----
    const input = el("input", { class: "input", placeholder: "Thêm việc mới...", maxlength: "200" });
    const pri = el("select", { class: "select" }, [
      el("option", { value: "med", text: "Ưu tiên: Vừa" }),
      el("option", { value: "high", text: "Ưu tiên: Cao" }),
      el("option", { value: "low", text: "Ưu tiên: Thấp" }),
    ]);
    const due = el("input", { class: "input", type: "datetime-local", title: "Thời gian hoàn thành dự kiến" });
    const colSel = el("select", { class: "select" },
      db.taskColumns.map((c) => el("option", { value: c.id, text: c.name }))
    );
    const addBtn = el("button", { class: "btn", text: "Thêm" });

    function add() {
      const text = input.value.trim();
      if (!text) return;
      Store.update((d) => {
        const t = { id: U.uid(), text, description: "", priority: pri.value, due: due.value || null, columnId: null, done: false, startedAt: null, completedAt: null, cancelledAt: null, history: [], createdAt: Date.now() };
        applyColumn(d, t, colSel.value);
        d.todos.unshift(t);
      });
      App.log("task_add", "Thêm công việc: " + text);
      input.value = ""; due.value = "";
      render(root);
      input.focus();
    }
    addBtn.addEventListener("click", add);
    input.addEventListener("keydown", (e) => e.key === "Enter" && add());

    root.append(
      el("div", { class: "card" }, [
        el("div", { class: "field", style: "margin:0" }, [el("label", { text: "Việc mới" }), input]),
        el("div", { class: "row", style: "margin-top:10px" }, [
          colField("Cột", colSel), colField("Ưu tiên", pri), colField("Thời gian hoàn thành", due),
          el("div", { style: "flex:0 0 auto;display:flex;align-items:flex-end" }, [addBtn]),
        ]),
      ])
    );

    // ---- Thanh công cụ: layout + bộ lọc ----
    layout = Store.get("settings").taskLayout || "board";
    const colOf = (id) => db.taskColumns.find((c) => c.id === id);

    const addColBtn = el("button", { class: "btn btn--ghost", text: "＋ Thêm cột" });
    addColBtn.addEventListener("click", () => {
      const name = prompt("Tên cột mới:");
      if (!name || !name.trim()) return;
      Store.update((d) => d.taskColumns.push({ id: U.uid(), name: name.trim() }));
      App.log("column_add", "Thêm cột: " + name.trim());
      render(root);
    });

    // Chọn layout
    function segBtn(id, label) {
      const b = el("button", { class: "seg__btn" + (layout === id ? " is-active" : ""), text: label });
      b.addEventListener("click", () => { Store.update((d) => (d.settings.taskLayout = id)); layout = id; render(root); });
      return b;
    }
    const layoutSeg = el("div", { class: "seg" }, [segBtn("board", "▦ Bảng"), segBtn("list", "☰ Danh sách"), segBtn("table", "▤ Bảng kê")]);

    // Bộ lọc
    const search = el("input", { id: "task-q", class: "input", placeholder: "🔍 Tìm theo tên...", value: query });
    search.addEventListener("input", () => {
      query = search.value; renderContent();
      requestAnimationFrame(() => { const n = document.getElementById("task-q"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
    });
    const fPri = el("select", { class: "select" }, [["all", "Mọi ưu tiên"], ["high", "Ưu tiên cao"], ["med", "Ưu tiên vừa"], ["low", "Ưu tiên thấp"]].map(([v, t]) => el("option", { value: v, text: t, selected: filter.priority === v })));
    fPri.value = filter.priority;
    fPri.addEventListener("change", () => { filter.priority = fPri.value; renderContent(); });
    const fStatus = el("select", { class: "select" }, [el("option", { value: "all", text: "Mọi trạng thái" }), ...db.taskColumns.map((c) => el("option", { value: c.id, text: c.name, selected: filter.status === c.id }))]);
    fStatus.value = filter.status;
    fStatus.addEventListener("change", () => { filter.status = fStatus.value; renderContent(); });
    const fDue = el("select", { class: "select" }, [["all", "Mọi hạn"], ["overdue", "Quá hạn"], ["today", "Hôm nay"], ["has", "Có hạn"], ["none", "Không hạn"]].map(([v, t]) => el("option", { value: v, text: t, selected: filter.due === v })));
    fDue.value = filter.due;
    fDue.addEventListener("change", () => { filter.due = fDue.value; renderContent(); });
    const clearBtn = el("button", { class: "btn btn--sm btn--ghost", text: "Xóa lọc", onClick: () => { query = ""; filter = { priority: "all", status: "all", due: "all" }; render(root); } });

    root.append(el("div", { class: "card" }, [
      el("div", { class: "row", style: "align-items:center" }, [el("div", { style: "flex:0 0 auto" }, [layoutSeg]), search, el("div", { style: "flex:0 0 auto" }, [addColBtn])]),
      el("div", { class: "row", style: "margin-top:10px" }, [fPri, fStatus, fDue, el("div", { style: "flex:0 0 auto;display:flex;align-items:flex-end" }, [clearBtn])]),
    ]));

    const content = el("div");
    root.append(content);

    // Lọc 1 công việc theo bộ lọc hiện tại
    function passFilter(t) {
      if (query.trim() && !t.text.toLowerCase().includes(query.trim().toLowerCase())) return false;
      if (filter.priority !== "all" && t.priority !== filter.priority) return false;
      if (filter.status !== "all" && t.columnId !== filter.status) return false;
      if (filter.due !== "all") {
        const has = !!t.due;
        if (filter.due === "none" && has) return false;
        if (filter.due === "has" && !has) return false;
        if (filter.due === "overdue") { if (!has || t.done || t.cancelledAt || new Date(t.due) >= new Date()) return false; }
        if (filter.due === "today") { if (!has) return false; if (new Date(t.due).toDateString() !== new Date().toDateString()) return false; }
      }
      return true;
    }
    const ORDER = { high: 0, med: 1, low: 2 };
    function sortedFiltered() {
      const colIndex = {}; db.taskColumns.forEach((c, i) => (colIndex[c.id] = i));
      return db.todos.filter(passFilter).sort((a, b) => (colIndex[a.columnId] - colIndex[b.columnId]) || (ORDER[a.priority] - ORDER[b.priority]));
    }

    function renderContent() {
      content.innerHTML = "";
      if (layout === "list") renderList();
      else if (layout === "table") renderTable();
      else renderBoard();
    }

    // Select chuyển cột (dùng cho list/table)
    function moveSelect(t, extraStyle) {
      const m = el("select", { class: "tcard__move", style: extraStyle || "" }, db.taskColumns.map((c) => el("option", { value: c.id, text: c.name, selected: c.id === t.columnId })));
      m.value = t.columnId;
      m.addEventListener("change", () => moveTask(t.id, m.value, root));
      return m;
    }
    function delBtn(t) {
      const b = el("button", { class: "icon-btn", text: "✕", title: "Xóa" });
      b.addEventListener("click", () => { Store.update((d) => (d.todos = d.todos.filter((x) => x.id !== t.id))); App.log("task_delete", "Xóa công việc: " + t.text); render(root); });
      return b;
    }
    function metaTags(t) {
      const m = [];
      const p = PRI[t.priority];
      if (p) m.push(el("span", { class: "tag " + p.cls, text: p.label }));
      if (t.due) { const overdue = !t.done && !t.cancelledAt && new Date(t.due) < new Date(); m.push(el("span", { class: "tag", text: "🎯 " + fmtDateTime(t.due), style: overdue ? "color:var(--danger)" : "" })); }
      if (t.completedAt) m.push(el("span", { class: "tag tag--ok", text: "✓ " + fmtDateTime(t.completedAt) }));
      if (t.cancelledAt) m.push(el("span", { class: "tag tag--high", text: "✕" }));
      if (t.description) m.push(el("span", { class: "tag", text: "📝" }));
      return m;
    }

    // -------- LAYOUT: DANH SÁCH --------
    function renderList() {
      const rows = sortedFiltered();
      if (!rows.length) { content.append(el("p", { class: "empty", text: "Không có công việc phù hợp." })); return; }
      const list = el("ul", { class: "list" });
      rows.forEach((t) => {
        const col = colOf(t.columnId);
        const textEl = el("span", { class: "item__text", text: t.text, style: "cursor:pointer" });
        textEl.addEventListener("click", () => openDetail(t, root));
        list.append(el("li", { class: "item" + (t.done || t.cancelledAt ? " done" : "") }, [
          el("span", { class: "badge", text: col ? col.name : "?" }),
          textEl,
          ...metaTags(t),
          moveSelect(t, "flex:0 0 130px"),
          delBtn(t),
        ]));
      });
      content.append(list);
    }

    // -------- LAYOUT: BẢNG KÊ --------
    function renderTable() {
      const rows = sortedFiltered();
      if (!rows.length) { content.append(el("p", { class: "empty", text: "Không có công việc phù hợp." })); return; }
      const table = el("table", { class: "table" });
      table.append(el("thead", {}, el("tr", {}, [
        el("th", { text: "Công việc" }), el("th", { text: "Trạng thái" }), el("th", { text: "Ưu tiên" }),
        el("th", { text: "Hạn" }), el("th", { text: "Hoàn thành" }), el("th", { text: "" }),
      ])));
      const tbody = el("tbody");
      rows.forEach((t) => {
        const p = PRI[t.priority];
        const nameEl = el("span", { text: t.text, style: "cursor:pointer;" + (t.done || t.cancelledAt ? "color:var(--muted);text-decoration:line-through" : "") });
        nameEl.addEventListener("click", () => openDetail(t, root));
        tbody.append(el("tr", {}, [
          el("td", {}, [nameEl, t.description ? el("span", { text: " 📝" }) : null]),
          el("td", {}, moveSelect(t, "max-width:140px")),
          el("td", {}, p ? el("span", { class: "tag " + p.cls, text: p.label }) : null),
          el("td", { class: "table__time", text: t.due ? fmtDateTime(t.due) : "—" }),
          el("td", { class: "table__time", text: t.completedAt ? fmtDateTime(t.completedAt) : (t.cancelledAt ? "Đã hủy" : "—") }),
          el("td", {}, delBtn(t)),
        ]));
      });
      table.append(tbody);
      content.append(el("div", { style: "overflow-x:auto" }, [table]));
    }

    // -------- LAYOUT: BẢNG KANBAN --------
    function renderBoard() {
      const board = el("div", { class: "board" });

      db.taskColumns.forEach((col, idx) => {
        let cards = db.todos.filter((t) => t.columnId === col.id && passFilter(t));
        cards = [...cards].sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);

        const colEl = el("div", { class: "column", dataset: { colid: col.id } });

        // Kéo–thả: cho phép thả vào cột này
        colEl.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; colEl.classList.add("drop-over"); });
        colEl.addEventListener("dragleave", (e) => { if (!colEl.contains(e.relatedTarget)) colEl.classList.remove("drop-over"); });
        colEl.addEventListener("drop", (e) => {
          e.preventDefault();
          colEl.classList.remove("drop-over");
          const id = dragId || (e.dataTransfer && e.dataTransfer.getData("text/plain"));
          if (id) moveTask(id, col.id, root);
        });

        // Header: tên + đếm + đổi tên + xóa
        const rename = el("button", { class: "icon-btn", text: "✏️", title: "Đổi tên cột" });
        rename.style.color = "var(--muted)";
        rename.addEventListener("click", () => {
          const name = prompt("Đổi tên cột:", col.name);
          if (!name || !name.trim()) return;
          Store.update((d) => { const c = d.taskColumns.find((x) => x.id === col.id); if (c) c.name = name.trim(); });
          render(root);
        });
        const delCol = el("button", { class: "icon-btn", text: "🗑️", title: "Xóa cột" });
        delCol.addEventListener("click", () => {
          if (db.taskColumns.length <= 1) return U.toast("Phải còn ít nhất 1 cột", "err");
          const count = db.todos.filter((t) => t.columnId === col.id).length;
          if (count && !confirm(`Cột "${col.name}" có ${count} việc. Chúng sẽ chuyển sang cột đầu tiên. Tiếp tục?`)) return;
          Store.update((d) => {
            const target = d.taskColumns.find((c) => c.id !== col.id).id;
            d.todos.forEach((t) => { if (t.columnId === col.id) t.columnId = target; });
            d.taskColumns = d.taskColumns.filter((c) => c.id !== col.id);
          });
          App.log("column_delete", "Xóa cột: " + col.name);
          render(root);
        });

        colEl.append(
          el("div", { class: "column__head" }, [
            el("span", { class: "column__name", text: col.name + (KIND_MARK[col.kind] || "") }),
            el("span", { class: "column__count", text: String(cards.length) }),
            rename, delCol,
          ])
        );

        const cardsEl = el("div", { class: "column__cards" });
        cards.forEach((t) => cardsEl.append(taskCard(t, idx)));
        colEl.append(cardsEl);

        // Nút thêm nhanh vào cột này
        const quick = el("button", { class: "column__add", text: "＋ Thêm việc" });
        quick.addEventListener("click", () => {
          const text = prompt("Việc mới trong cột " + col.name + ":");
          if (!text || !text.trim()) return;
          Store.update((d) => {
            const t = { id: U.uid(), text: text.trim(), description: "", priority: "med", due: null, columnId: null, done: false, startedAt: null, completedAt: null, cancelledAt: null, history: [], createdAt: Date.now() };
            applyColumn(d, t, col.id);
            d.todos.unshift(t);
          });
          App.log("task_add", "Thêm công việc: " + text.trim());
          render(root);
        });
        colEl.append(quick);
        board.append(colEl);
      });

      // Nút thêm cột ở cuối bảng
      const addCol = el("button", { class: "add-column", text: "＋", title: "Thêm cột" });
      addCol.addEventListener("click", () => addColBtn.click());
      board.append(addCol);

      content.append(board);
    }

    function taskCard(t, colIdx) {
      const meta = [];
      const p = PRI[t.priority];
      if (p) meta.push(el("span", { class: "tag " + p.cls, text: p.label }));
      if (t.due) {
        const overdue = !t.done && !t.cancelledAt && new Date(t.due) < new Date();
        meta.push(el("span", { class: "tag", text: "🎯 " + fmtDateTime(t.due), style: overdue ? "color:var(--danger)" : "" }));
      }
      if (t.startedAt && !t.completedAt && !t.cancelledAt)
        meta.push(el("span", { class: "tag", text: "▶ " + fmtDateTime(t.startedAt) }));
      if (t.completedAt) meta.push(el("span", { class: "tag tag--ok", text: "✓ " + fmtDateTime(t.completedAt) }));
      if (t.startedAt && t.completedAt) meta.push(el("span", { class: "tag", text: "⏱ " + fmtDuration(t.completedAt - t.startedAt) }));
      if (t.cancelledAt) meta.push(el("span", { class: "tag tag--high", text: "✕ " + fmtDateTime(t.cancelledAt) }));

      // chọn cột để di chuyển
      const move = el("select", { class: "tcard__move" },
        Store.get("taskColumns").map((c) => el("option", { value: c.id, text: c.name, selected: c.id === t.columnId }))
      );
      move.value = t.columnId;
      move.addEventListener("change", () => moveTask(t.id, move.value, root));

      const del = el("button", { class: "icon-btn", text: "✕", title: "Xóa" });
      del.addEventListener("click", () => {
        Store.update((d) => (d.todos = d.todos.filter((x) => x.id !== t.id)));
        App.log("task_delete", "Xóa công việc: " + t.text);
        render(root);
      });

      const textEl = el("div", { class: "tcard__text", text: t.text, style: "cursor:pointer", title: "Bấm để xem & sửa chi tiết" });
      textEl.addEventListener("click", () => openDetail(t, root));
      if (t.description) meta.unshift(el("span", { class: "tag", text: "📝" }));

      const card = el("div", { class: "tcard" + (t.done ? " done" : "") + (t.cancelledAt ? " cancelled" : ""), draggable: "true" }, [
        textEl,
        meta.length ? el("div", { class: "tcard__meta" }, meta) : null,
        el("div", { class: "tcard__foot" }, [move, del]),
      ]);
      // Kéo–thả
      card.addEventListener("dragstart", (e) => {
        dragId = t.id;
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", t.id); } catch (_) {}
        setTimeout(() => card.classList.add("dragging"), 0);
      });
      card.addEventListener("dragend", () => {
        dragId = null;
        card.classList.remove("dragging");
        U.$$(".column.drop-over").forEach((c) => c.classList.remove("drop-over"));
      });
      return card;
    }

    renderContent();
  }

  function colField(label, control) {
    return el("div", { class: "field", style: "margin:0" }, [el("label", { text: label }), control]);
  }

  // Mở tab Công việc và bật popup chi tiết của 1 công việc theo id (dùng cho liên kết từ Mục tiêu)
  function openTaskById(id) {
    const t = Store.get("todos").find((x) => x.id === id);
    if (!t) { U.toast("Công việc không còn tồn tại", "err"); return; }
    App.go("tasks");
    openDetail(t, document.getElementById("view"));
  }

  window.Views = window.Views || {};
  window.Views.tasks = { render, openTaskById };
})();
