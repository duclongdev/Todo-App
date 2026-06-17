// focus.js — Đồng hồ tập trung (Pomodoro/stopwatch) + log giờ làm việc
(function () {
  const { el, fmtMinutes } = U;

  // trạng thái timer giữ trong bộ nhớ phiên
  let seconds = 0;
  let running = false;
  let ticker = null;
  let displayEl = null;

  function fmtClock(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${U.pad(m)}:${U.pad(sec)}`;
  }

  function tick() {
    seconds++;
    if (displayEl) displayEl.textContent = fmtClock(seconds);
  }

  function render(root) {
    const db = Store.all();
    root.innerHTML = "";
    root.append(
      el("div", { class: "page-head" }, [
        el("h2", { text: "⏱️ Tập trung & Giờ làm việc" }),
        el("p", { text: "Bấm giờ một phiên làm việc, hoặc nhập thủ công thời gian đã làm." }),
      ])
    );

    // Timer card
    displayEl = el("div", { class: "timer__display", text: fmtClock(seconds) });
    const startBtn = el("button", { class: "btn", text: running ? "Tạm dừng" : "Bắt đầu" });
    const stopBtn = el("button", { class: "btn btn--ghost", text: "Dừng & Lưu" });
    const projInput = el("input", { class: "input", placeholder: "Đang làm gì? (vd: Học tiếng Anh)", style: "max-width:280px;margin:14px auto 0" });

    startBtn.addEventListener("click", () => {
      running = !running;
      if (running) {
        ticker = setInterval(tick, 1000);
        startBtn.textContent = "Tạm dừng";
      } else {
        clearInterval(ticker);
        startBtn.textContent = "Tiếp tục";
      }
    });
    stopBtn.addEventListener("click", () => {
      clearInterval(ticker);
      running = false;
      const min = Math.round(seconds / 60);
      if (min < 1) {
        U.toast("Phiên quá ngắn (< 1 phút)", "err");
        seconds = 0;
        displayEl.textContent = fmtClock(0);
        startBtn.textContent = "Bắt đầu";
        return;
      }
      Store.update((d) =>
        d.work.push({
          id: U.uid(),
          date: U.today(),
          minutes: min,
          project: projInput.value.trim() || "Tập trung",
          note: "",
          createdAt: Date.now(),
        })
      );
      App.log("focus_log", `Phiên tập trung ${min} phút: ${projInput.value.trim() || "Tập trung"}`);
      seconds = 0;
      U.toast(`Đã lưu ${min} phút tập trung 🎉`);
      render(root);
    });

    root.append(
      el("div", { class: "card" }, [
        el("div", { class: "timer" }, [
          displayEl,
          el("div", { class: "timer__controls" }, [startBtn, stopBtn]),
        ]),
        el("div", { style: "text-align:center" }, [projInput]),
      ])
    );

    // Manual log
    const mProj = el("input", { class: "input", placeholder: "Công việc" });
    const mMin = el("input", { class: "input", type: "number", min: "1", placeholder: "Số phút" });
    const mDate = el("input", { class: "input", type: "date", value: U.today() });
    const mBtn = el("button", { class: "btn", text: "Thêm" });
    mBtn.addEventListener("click", () => {
      const min = parseInt(mMin.value, 10);
      if (!min || min < 1) return U.toast("Nhập số phút hợp lệ", "err");
      Store.update((d) =>
        d.work.push({
          id: U.uid(),
          date: mDate.value,
          minutes: min,
          project: mProj.value.trim() || "Làm việc",
          note: "",
          createdAt: Date.now(),
        })
      );
      App.log("focus_log", `Nhập tay ${min} phút: ${mProj.value.trim() || "Làm việc"}`);
      mProj.value = ""; mMin.value = "";
      render(root);
    });
    root.append(
      el("div", { class: "card" }, [
        el("div", { class: "card__title" }, el("span", { text: "✍️ Nhập thủ công" })),
        el("div", { class: "row" }, [mProj, mMin, mDate, el("div", { style: "flex:0 0 auto" }, [mBtn])]),
      ])
    );

    // Today total + history
    const t = U.today();
    const todayMin = db.work.filter((w) => w.date === t).reduce((s, w) => s + w.minutes, 0);
    root.append(
      el("div", { class: "grid grid--stats", style: "margin-top:16px" }, [
        el("div", { class: "stat" }, [
          el("div", { class: "stat__label" }, [el("span", { text: "⏱️" }), el("span", { text: "Tổng hôm nay" })]),
          el("div", { class: "stat__value", text: todayMin ? fmtMinutes(todayMin) : "—" }),
        ]),
      ])
    );

    const all = [...db.work].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 30);
    if (all.length === 0) {
      root.append(el("p", { class: "empty", text: "Chưa có phiên làm việc nào." }));
      return;
    }
    const list = el("ul", { class: "list", style: "margin-top:16px" });
    all.forEach((w) => {
      const del = el("button", { class: "icon-btn", text: "✕" });
      del.addEventListener("click", () => {
        Store.update((d) => (d.work = d.work.filter((x) => x.id !== w.id)));
        render(root);
      });
      list.append(
        el("li", { class: "item" }, [
          el("div", { style: "flex:1" }, [
            el("div", { class: "item__text", text: w.project }),
            el("div", { class: "item__sub", text: `${U.fmtVN(w.date)} · ${fmtMinutes(w.minutes)}` }),
          ]),
          del,
        ])
      );
    });
    root.append(list);
  }

  window.Views = window.Views || {};
  window.Views.focus = { render };
})();
