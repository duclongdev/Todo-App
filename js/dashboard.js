// dashboard.js — Tổng quan trong ngày
(function () {
  const { el, today, dayKey, fmtFull, fmtMinutes } = U;

  function greeting() {
    const h = new Date().getHours();
    if (h < 11) return "Chào buổi sáng";
    if (h < 14) return "Chào buổi trưa";
    if (h < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }

  function streakOf(habitId) {
    const logs = Store.get("habitLogs")[habitId] || {};
    let streak = 0;
    let d = new Date();
    // nếu hôm nay chưa tick, bắt đầu đếm từ hôm qua
    if (!logs[U.toKey(d)]) d = U.addDays(d, -1);
    while (logs[U.toKey(d)]) {
      streak++;
      d = U.addDays(d, -1);
    }
    return streak;
  }

  function render(root) {
    const db = Store.all();
    const t = today();

    // Tasks (bỏ qua việc đã hủy)
    const openTasks = db.todos.filter((x) => !x.done && !x.cancelledAt);
    const doneTasks = db.todos.filter((x) => x.done);

    // Habits
    const habitsDone = db.habits.filter(
      (h) => (db.habitLogs[h.id] || {})[t]
    ).length;
    const bestStreak = db.habits.reduce(
      (m, h) => Math.max(m, streakOf(h.id)),
      0
    );

    // Sleep (đêm gần nhất)
    const lastSleep = [...db.sleep].sort((a, b) => b.date.localeCompare(a.date))[0];
    const sleepMin = lastSleep
      ? U.minutesBetween(lastSleep.bedtime, lastSleep.waketime)
      : 0;

    // Focus hôm nay
    const focusToday = db.work
      .filter((w) => w.date === t)
      .reduce((s, w) => s + w.minutes, 0);

    // Goals hôm nay
    const dayGoals = db.goals.filter((g) => g.scope === "day" && g.period === dayKey());

    root.innerHTML = "";
    root.append(
      el("div", { class: "page-head" }, [
        el("h2", { text: `${greeting()}${db.settings.name ? ", " + db.settings.name : ""} 👋` }),
        el("p", { text: fmtFull() }),
      ])
    );

    // Stat tiles
    const stats = el("div", { class: "grid grid--stats" }, [
      stat("✅", "Công việc", `${openTasks.length}`, `còn lại · ${doneTasks.length} xong`),
      stat("🔥", "Thói quen", `${habitsDone}/${db.habits.length}`, `streak tốt nhất: ${bestStreak} ngày`),
      stat("😴", "Giấc ngủ", sleepMin ? fmtMinutes(sleepMin) : "—", lastSleep ? "đêm gần nhất" : "chưa ghi"),
      stat("⏱️", "Tập trung", focusToday ? fmtMinutes(focusToday) : "—", "hôm nay"),
    ]);
    root.append(stats);

    // Two columns
    const cols = el("div", { class: "grid grid--2", style: "margin-top:16px" });

    // Today's open tasks
    const taskCard = el("div", { class: "card" }, [
      el("div", { class: "card__title" }, [
        el("span", { text: "✅ Việc cần làm" }),
        el("button", { class: "btn btn--sm btn--ghost", onClick: () => App.go("tasks") }, "Mở"),
      ]),
    ]);
    if (openTasks.length === 0) {
      taskCard.append(el("p", { class: "empty", text: "Tuyệt! Không còn việc nào 🎉" }));
    } else {
      const list = el("ul", { class: "list" });
      openTasks.slice(0, 5).forEach((task) => {
        const cb = el("input", { type: "checkbox", class: "check" });
        cb.addEventListener("change", () => {
          Store.update((d) => {
            const it = d.todos.find((x) => x.id === task.id);
            if (it) {
              it.done = true;
              it.completedAt = Date.now();
              const doneCol = d.taskColumns.find((c) => c.isDone);
              if (doneCol) it.columnId = doneCol.id;
            }
          });
          App.log("task_move", "Hoàn thành việc từ Tổng quan");
          render(root);
        });
        list.append(el("li", { class: "item" }, [cb, el("span", { class: "item__text", text: task.text })]));
      });
      taskCard.append(list);
    }
    cols.append(taskCard);

    // Today's goals
    const goalCard = el("div", { class: "card" }, [
      el("div", { class: "card__title" }, [
        el("span", { text: "🎯 Mục tiêu hôm nay" }),
        el("button", { class: "btn btn--sm btn--ghost", onClick: () => App.go("goals") }, "Mở"),
      ]),
    ]);
    if (dayGoals.length === 0) {
      goalCard.append(el("p", { class: "empty", text: "Chưa đặt mục tiêu cho hôm nay." }));
    } else {
      const list = el("ul", { class: "list" });
      dayGoals.forEach((g) => {
        const cb = el("input", { type: "checkbox", class: "check" });
        cb.checked = g.done;
        cb.addEventListener("change", () => {
          Store.update((d) => {
            const it = d.goals.find((x) => x.id === g.id);
            if (it) it.done = cb.checked;
          });
          render(root);
        });
        list.append(
          el("li", { class: "item" + (g.done ? " done" : "") }, [
            cb,
            el("span", { class: "item__text", text: g.title }),
          ])
        );
      });
      goalCard.append(list);
    }
    cols.append(goalCard);

    root.append(cols);

    // Finance summary tháng này
    const fin = db.finance;
    if (fin) {
      const cur = db.settings.currency || "₫";
      const fmtM = (n) => (n < 0 ? "−" : "") + (cur === "₫" ? Math.round(Math.abs(n)).toLocaleString("vi-VN") + " ₫" : cur + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      const now = new Date();
      const mkey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
      const mtx = fin.tx.filter((x) => x.date && x.date.slice(0, 7) === mkey);
      const inc = mtx.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0);
      const exp = mtx.filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);
      const bal = (id) => {
        let b = (fin.accounts.find((a) => a.id === id) || {}).initial || 0;
        fin.tx.forEach((x) => {
          if (x.type === "income" && x.accountId === id) b += x.amount;
          else if (x.type === "expense" && x.accountId === id) b -= x.amount;
          else if (x.type === "transfer") { if (x.accountId === id) b -= x.amount; if (x.toAccountId === id) b += x.amount; }
        });
        return b;
      };
      const net = fin.accounts.reduce((s, a) => s + bal(a.id), 0);
      root.append(el("div", { class: "card", style: "margin-top:16px" }, [
        el("div", { class: "card__title" }, [el("span", { text: "💰 Tài chính tháng này" }), el("button", { class: "btn btn--sm btn--ghost", text: "Mở", onClick: () => App.go("finance") })]),
        el("div", { class: "grid grid--stats" }, [
          el("div", { class: "stat" }, [el("div", { class: "stat__label", text: "📥 Thu nhập" }), el("div", { class: "stat__value amount--in", style: "font-size:1.3rem", text: fmtM(inc) })]),
          el("div", { class: "stat" }, [el("div", { class: "stat__label", text: "📤 Chi tiêu" }), el("div", { class: "stat__value amount--out", style: "font-size:1.3rem", text: fmtM(exp) })]),
          el("div", { class: "stat" }, [el("div", { class: "stat__label", text: "🏦 Tổng tài sản" }), el("div", { class: "stat__value", style: "font-size:1.3rem", text: fmtM(net) })]),
        ]),
      ]));
    }

    // Quick mood today
    const j = db.journal[t];
    const moodCard = el("div", { class: "card" }, [
      el("div", { class: "card__title" }, [
        el("span", { text: "📔 Tâm trạng hôm nay" }),
        el("button", { class: "btn btn--sm btn--ghost", onClick: () => App.go("journal") }, "Viết nhật ký"),
      ]),
    ]);
    const moods = ["😄", "🙂", "😐", "😕", "😢"];
    const moodRow = el("div", { class: "moods" });
    moods.forEach((m) => {
      const b = el("button", { class: "mood" + (j && j.mood === m ? " is-active" : ""), text: m });
      b.addEventListener("click", () => {
        Store.update((d) => {
          d.journal[t] = Object.assign({ text: "", gratitude: "" }, d.journal[t], { mood: m });
        });
        U.toast("Đã ghi tâm trạng");
        render(root);
      });
      moodRow.append(b);
    });
    moodCard.append(moodRow);
    root.append(moodCard);
  }

  function stat(icon, label, value, sub) {
    return el("div", { class: "stat" }, [
      el("div", { class: "stat__label" }, [el("span", { text: icon }), el("span", { text: label })]),
      el("div", { class: "stat__value", text: value }),
      el("div", { class: "stat__sub", text: sub }),
    ]);
  }

  window.Views = window.Views || {};
  window.Views.dashboard = { render };
})();
