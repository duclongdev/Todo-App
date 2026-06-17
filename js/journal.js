// journal.js — Nhật ký theo ngày + tâm trạng + lòng biết ơn
(function () {
  const { el } = U;
  const MOODS = ["😄", "🙂", "😐", "😕", "😢"];
  let activeDate = U.today();

  function render(root) {
    const db = Store.all();
    root.innerHTML = "";
    root.append(
      el("div", { class: "page-head" }, [
        el("h2", { text: "📔 Nhật ký" }),
        el("p", { text: "Ghi lại một ngày của bạn — cảm xúc, suy nghĩ và điều biết ơn." }),
      ])
    );

    const entry = db.journal[activeDate] || { mood: "", text: "", gratitude: "" };

    // Date picker
    const datePick = el("input", { class: "input", type: "date", value: activeDate, max: U.today(), style: "max-width:200px" });
    datePick.addEventListener("change", () => { activeDate = datePick.value; render(root); });

    // Mood
    const moodRow = el("div", { class: "moods" });
    let selectedMood = entry.mood;
    MOODS.forEach((m) => {
      const b = el("button", { class: "mood" + (selectedMood === m ? " is-active" : ""), text: m });
      b.addEventListener("click", () => {
        selectedMood = selectedMood === m ? "" : m;
        U.$$(".mood", moodRow).forEach((x) => x.classList.toggle("is-active", x.textContent === selectedMood));
      });
      moodRow.append(b);
    });

    const text = el("textarea", { class: "textarea", placeholder: "Hôm nay của bạn thế nào?" });
    text.value = entry.text || "";
    const grat = el("textarea", { class: "textarea", placeholder: "3 điều bạn biết ơn hôm nay...", style: "min-height:70px" });
    grat.value = entry.gratitude || "";

    const saveBtn = el("button", { class: "btn", text: "Lưu nhật ký" });
    saveBtn.addEventListener("click", () => {
      Store.update((d) => {
        d.journal[activeDate] = { mood: selectedMood, text: text.value.trim(), gratitude: grat.value.trim() };
        if (!selectedMood && !text.value.trim() && !grat.value.trim()) delete d.journal[activeDate];
      });
      App.log("journal_save", "Lưu nhật ký ngày " + activeDate);
      U.toast("Đã lưu nhật ký");
      render(root);
    });

    root.append(
      el("div", { class: "card" }, [
        el("div", { class: "field" }, [el("label", { text: "Ngày" }), datePick]),
        el("div", { class: "field" }, [el("label", { text: "Tâm trạng" }), moodRow]),
        el("div", { class: "field" }, [el("label", { text: "Nhật ký" }), text]),
        el("div", { class: "field" }, [el("label", { text: "Lòng biết ơn" }), grat]),
        saveBtn,
      ])
    );

    // Past entries
    const dates = Object.keys(db.journal).sort((a, b) => b.localeCompare(a));
    if (dates.length === 0) {
      root.append(el("p", { class: "empty", text: "Chưa có trang nhật ký nào." }));
      return;
    }
    root.append(el("div", { class: "card__title", style: "margin-top:22px", text: "📖 Các trang đã viết" }));
    const list = el("ul", { class: "list" });
    dates.forEach((ds) => {
      const e = db.journal[ds];
      const item = el("li", { class: "item", style: "cursor:pointer" }, [
        el("span", { style: "font-size:1.3rem", text: e.mood || "📝" }),
        el("div", { style: "flex:1" }, [
          el("div", { class: "item__text", text: U.fmtVN(ds) }),
          el("div", { class: "item__sub", text: (e.text || e.gratitude || "").slice(0, 60) || "(trống)" }),
        ]),
      ]);
      item.addEventListener("click", () => { activeDate = ds; render(root); window.scrollTo(0, 0); });
      list.append(item);
    });
    root.append(list);
  }

  window.Views = window.Views || {};
  window.Views.journal = { render };
})();
