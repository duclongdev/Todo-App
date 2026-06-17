// goals.js — Mục tiêu + công việc chi tiết liên kết tới task thật (tự cập nhật tiến độ)
(function () {
  const { el } = U;
  let scope = "day";
  const expanded = new Set();
  const SCOPES = [["day", "Ngày"], ["week", "Tuần"], ["month", "Tháng"], ["year", "Năm"]];

  // Trạng thái hoàn thành của 1 công việc con: nếu có liên kết task -> lấy theo task thật
  function subDone(s) {
    if (s.taskId) {
      const t = Store.get("todos").find((x) => x.id === s.taskId);
      return t ? t.done : s.done;
    }
    return s.done;
  }
  function hasLinked(g) {
    return (g.subtasks || []).some((s) => s.taskId);
  }
  function progressOf(g) {
    if (g.subtasks && g.subtasks.length) {
      const done = g.subtasks.filter(subDone).length;
      return Math.round((done / g.subtasks.length) * 100);
    }
    return g.progress || 0;
  }

  function render(root) {
    root.innerHTML = "";
    root.append(el("div", { class: "page-head" }, [
      el("h2", { text: "🎯 Mục tiêu" }),
      el("p", { text: "Liên kết công việc cụ thể — khi việc xong, tiến độ tự cập nhật." }),
    ]));

    const pills = el("div", { class: "pills" });
    SCOPES.forEach(([s, label]) => {
      const p = el("button", { class: "pill" + (scope === s ? " is-active" : ""), text: label });
      p.addEventListener("click", () => { scope = s; render(root); });
      pills.append(p);
    });
    root.append(pills);
    root.append(el("p", { class: "stat__sub", style: "margin:-6px 0 14px", text: U.periodLabel(scope) }));

    const input = el("input", { class: "input", placeholder: `Mục tiêu cho ${SCOPES.find((s) => s[0] === scope)[1].toLowerCase()} này...`, maxlength: "120" });
    const addBtn = el("button", { class: "btn", text: "Thêm" });
    function add() {
      const title = input.value.trim();
      if (!title) return;
      const id = U.uid();
      Store.update((d) => d.goals.push({ id, title, scope, period: U.periodKey(scope), done: false, progress: 0, subtasks: [], createdAt: Date.now() }));
      App.log("goal_add", "Thêm mục tiêu: " + title);
      input.value = "";
      expanded.add(id);
      render(root);
    }
    addBtn.addEventListener("click", add);
    input.addEventListener("keydown", (e) => e.key === "Enter" && add());
    root.append(el("div", { class: "card" }, [el("div", { class: "row" }, [input, el("div", { style: "flex:0 0 auto" }, [addBtn])])]));

    const cur = U.periodKey(scope);
    const goals = Store.get("goals").filter((g) => g.scope === scope && g.period === cur);
    if (goals.length === 0) {
      root.append(el("p", { class: "empty", text: "Chưa có mục tiêu nào cho kỳ này." }));
      return;
    }
    const wrap = el("div", { class: "grid", style: "margin-top:16px" });
    goals.forEach((g) => wrap.append(goalCard(g, root)));
    root.append(wrap);
  }

  function goalCard(g, root) {
    const pct = progressOf(g);
    const linked = hasLinked(g);
    const card = el("div", { class: "goal" });

    const cb = el("input", { type: "checkbox", class: "check" });
    cb.checked = pct === 100 || g.done;
    cb.addEventListener("change", () => {
      Store.update((d) => { const x = d.goals.find((q) => q.id === g.id); if (x) { x.done = cb.checked; if (!x.subtasks.length) x.progress = cb.checked ? 100 : 0; } });
      App.log("goal_complete", (cb.checked ? "Hoàn thành" : "Mở lại") + " mục tiêu: " + g.title);
      render(root);
    });
    const toggleBtn = el("button", { class: "icon-btn", text: expanded.has(g.id) ? "▾" : "▸", style: "color:var(--muted)" });
    toggleBtn.addEventListener("click", () => { expanded.has(g.id) ? expanded.delete(g.id) : expanded.add(g.id); render(root); });
    const del = el("button", { class: "icon-btn", text: "🗑️" });
    del.addEventListener("click", () => { Store.update((d) => (d.goals = d.goals.filter((x) => x.id !== g.id))); render(root); });

    const done100 = pct === 100;
    card.append(el("div", { class: "goal__head" }, [
      cb,
      el("span", { class: "goal__title", text: g.title, style: done100 ? "text-decoration:line-through;color:var(--muted)" : "" }),
      el("span", { class: "stat__sub", text: pct + "%" }),
      toggleBtn, del,
    ]));
    card.append(el("div", { class: "progress", style: "margin-top:10px" }, [el("div", { class: "progress__bar", style: "width:" + pct + "%" })]));

    if (expanded.has(g.id)) {
      const body = el("div", { class: "goal__body" });

      // Danh sách công việc con
      if (g.subtasks && g.subtasks.length) {
        g.subtasks.forEach((s) => {
          const isLinked = !!s.taskId;
          const linkedTask = isLinked ? Store.get("todos").find((x) => x.id === s.taskId) : null;
          const done = subDone(s);

          const scb = el("input", { type: "checkbox", class: "check" });
          scb.checked = done;
          scb.addEventListener("change", () => {
            Store.update((d) => {
              if (isLinked) {
                const t = d.todos.find((x) => x.id === s.taskId);
                if (t) {
                  t.done = scb.checked;
                  t.completedAt = scb.checked ? (t.completedAt || Date.now()) : null;
                  const doneCol = d.taskColumns.find((c) => c.isDone);
                  const firstCol = d.taskColumns[0];
                  if (scb.checked && doneCol) t.columnId = doneCol.id;
                  if (!scb.checked && t.columnId === (doneCol && doneCol.id)) t.columnId = firstCol.id;
                } else {
                  // task đã bị xóa -> bỏ liên kết, lưu trạng thái cục bộ
                  const ss = d.goals.find((q) => q.id === g.id).subtasks.find((q) => q.id === s.id);
                  ss.taskId = null; ss.done = scb.checked;
                }
              } else {
                const ss = d.goals.find((q) => q.id === g.id).subtasks.find((q) => q.id === s.id);
                ss.done = scb.checked;
              }
            });
            render(root);
          });

          const labelText = el("span", { class: "subtask__text", text: s.text });
          let linkTag = null;
          if (isLinked) {
            if (linkedTask) {
              const colName = (Store.get("taskColumns").find((c) => c.id === linkedTask.columnId) || {}).name || "";
              linkTag = el("button", { class: "tag tag--ok", style: "cursor:pointer;border:none", title: "Mở công việc này trong tab Công việc", text: "🔗 " + colName + " ↗" });
              linkTag.addEventListener("click", (e) => { e.stopPropagation(); Views.tasks.openTaskById(s.taskId); });
            } else {
              linkTag = el("span", { class: "tag", text: "🔗 task đã xóa" });
            }
          }

          // nút: liên kết / đẩy sang tasks / xóa
          const actions = [];
          if (!isLinked) {
            const push = el("button", { class: "icon-btn", text: "↗", title: "Tạo công việc & liên kết", style: "color:var(--primary)" });
            push.addEventListener("click", () => createAndLink(g.id, s.id, s.text, root));
            const linkExisting = el("button", { class: "icon-btn", text: "🔗", title: "Liên kết công việc có sẵn", style: "color:var(--primary)" });
            linkExisting.addEventListener("click", () => pickTask(g.id, s.id, root));
            actions.push(push, linkExisting);
          } else {
            const unlink = el("button", { class: "icon-btn", text: "⛓️‍💥", title: "Bỏ liên kết", style: "color:var(--muted)" });
            unlink.addEventListener("click", () => {
              Store.update((d) => { const ss = d.goals.find((q) => q.id === g.id).subtasks.find((q) => q.id === s.id); ss.taskId = null; ss.done = done; });
              render(root);
            });
            actions.push(unlink);
          }
          const sdel = el("button", { class: "icon-btn", text: "✕" });
          sdel.addEventListener("click", () => {
            Store.update((d) => { const gg = d.goals.find((q) => q.id === g.id); gg.subtasks = gg.subtasks.filter((q) => q.id !== s.id); });
            render(root);
          });

          body.append(el("div", { class: "subtask" + (done ? " done" : "") }, [scb, labelText, linkTag, ...actions, sdel]));
        });
      }

      // Tiến độ thủ công: CHỈ khi chưa có công việc con nào (và do đó chưa có liên kết)
      if (!g.subtasks || g.subtasks.length === 0) {
        const slider = el("input", { type: "range", class: "slider", min: "0", max: "100", step: "5", value: String(g.progress || 0) });
        const lbl = el("span", { class: "stat__sub", text: (g.progress || 0) + "%" });
        slider.addEventListener("input", () => { lbl.textContent = slider.value + "%"; });
        slider.addEventListener("change", () => {
          Store.update((d) => { const x = d.goals.find((q) => q.id === g.id); if (x) { x.progress = Number(slider.value); x.done = x.progress === 100; } });
          render(root);
        });
        body.append(el("div", { class: "field", style: "margin:0 0 10px" }, [
          el("label", { text: "Tiến độ thủ công (thêm công việc chi tiết để tính tự động)" }),
          el("div", { class: "row", style: "align-items:center" }, [slider, el("div", { style: "flex:0 0 50px" }, [lbl])]),
        ]));
      } else if (linked) {
        body.append(el("p", { class: "stat__sub", style: "margin:8px 0", text: "🔒 Đã liên kết công việc — tiến độ tự tính, không chỉnh tay." }));
      }

      // Thêm công việc chi tiết
      const stInput = el("input", { class: "input", placeholder: "Thêm công việc chi tiết...", maxlength: "120" });
      const stBtn = el("button", { class: "btn btn--sm", text: "Thêm" });
      function addSub() {
        const text = stInput.value.trim();
        if (!text) return;
        Store.update((d) => { const gg = d.goals.find((q) => q.id === g.id); gg.subtasks.push({ id: U.uid(), text, done: false, taskId: null }); });
        App.log("goal_subtask_add", "Thêm việc cho mục tiêu: " + g.title);
        render(root);
      }
      stBtn.addEventListener("click", addSub);
      stInput.addEventListener("keydown", (e) => e.key === "Enter" && addSub());
      body.append(el("div", { class: "row", style: "margin-top:10px" }, [stInput, el("div", { style: "flex:0 0 auto" }, [stBtn])]));

      const linkExist = el("button", { class: "btn btn--sm btn--ghost", text: "🔗 Liên kết công việc có sẵn", onClick: () => addLinkedFromExisting(g.id, root) });
      const openTasks = el("button", { class: "btn btn--sm btn--ghost", text: "Mở tab Công việc →", onClick: () => App.go("tasks") });
      body.append(el("div", { class: "row", style: "margin-top:10px" }, [el("div", { style: "flex:0 0 auto" }, [linkExist]), el("div", { style: "flex:0 0 auto" }, [openTasks])]));

      card.append(body);
    }
    return card;
  }

  // Tạo task mới ở cột đầu tiên và liên kết với subtask
  function createAndLink(goalId, subId, text, root) {
    const firstCol = Store.get("taskColumns")[0];
    const taskId = U.uid();
    const now = Date.now();
    Store.update((d) => {
      d.todos.unshift({ id: taskId, text, description: "", priority: "med", due: null, columnId: firstCol.id, done: false, startedAt: null, completedAt: null, cancelledAt: null, history: [{ from: null, to: firstCol.id, at: now }], createdAt: now });
      const ss = d.goals.find((q) => q.id === goalId).subtasks.find((q) => q.id === subId);
      if (ss) ss.taskId = taskId;
    });
    App.log("task_add", "Từ mục tiêu (liên kết) → " + text);
    U.toast("Đã tạo công việc & liên kết");
    render(root);
  }

  // Hộp chọn công việc (có ô tìm kiếm) — dùng chung
  function openTaskPicker(title, onPick) {
    const todos = Store.get("todos");
    if (!todos.length) { U.toast("Chưa có công việc nào trong tab Công việc để liên kết", "err"); return; }
    const cols = Store.get("taskColumns");
    const colName = (id) => (cols.find((c) => c.id === id) || {}).name || "";
    const search = el("input", { class: "input", placeholder: "🔍 Tìm công việc...", style: "margin-bottom:12px" });
    const list = el("ul", { class: "list" });
    const m = U.modal({ title, body: el("div", {}, [search, list]) });
    function draw() {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = "";
      const rows = todos.filter((t) => !q || t.text.toLowerCase().includes(q));
      if (!rows.length) { list.append(el("p", { class: "empty", text: "Không tìm thấy công việc." })); return; }
      rows.forEach((t) => {
        const item = el("li", { class: "item", style: "cursor:pointer" }, [
          el("span", { style: "font-size:1.1rem", text: t.done ? "✅" : "⬜" }),
          el("div", { style: "flex:1;min-width:0" }, [el("div", { class: "item__text", text: t.text }), el("div", { class: "item__sub", text: colName(t.columnId) })]),
        ]);
        item.addEventListener("click", () => { m.close(); onPick(t); });
        list.append(item);
      });
    }
    search.addEventListener("input", draw);
    draw();
    setTimeout(() => search.focus(), 50);
  }

  // Liên kết một công việc con SẴN CÓ với 1 task
  function pickTask(goalId, subId, root) {
    openTaskPicker("Chọn công việc để liên kết", (t) => {
      Store.update((d) => { const ss = d.goals.find((q) => q.id === goalId).subtasks.find((q) => q.id === subId); if (ss) ss.taskId = t.id; });
      U.toast("Đã liên kết công việc");
      render(root);
    });
  }

  // Liên kết TRỰC TIẾP: chọn task có sẵn -> tự tạo công việc con đã liên kết (1 bước)
  function addLinkedFromExisting(goalId, root) {
    openTaskPicker("Liên kết công việc vào mục tiêu", (t) => {
      const g = Store.get("goals").find((q) => q.id === goalId);
      if (g && g.subtasks.some((s) => s.taskId === t.id)) { U.toast("Công việc này đã được liên kết", "err"); return; }
      Store.update((d) => { d.goals.find((q) => q.id === goalId).subtasks.push({ id: U.uid(), text: t.text, done: false, taskId: t.id }); });
      App.log("goal_subtask_add", "Liên kết công việc vào mục tiêu: " + t.text);
      U.toast("Đã liên kết công việc");
      render(root);
    });
  }

  window.Views = window.Views || {};
  window.Views.goals = { render };
})();
