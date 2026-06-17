// sleep.js — Nhật ký giấc ngủ
(function () {
  const { el, fmtMinutes, minutesBetween } = U;

  function render(root) {
    const db = Store.all();
    root.innerHTML = "";
    root.append(
      el("div", { class: "page-head" }, [
        el("h2", { text: "😴 Giấc ngủ" }),
        el("p", { text: "Ghi lại giờ đi ngủ, giờ thức dậy và chất lượng giấc ngủ." }),
      ])
    );

    // Form
    const date = el("input", { class: "input", type: "date", value: U.today() });
    const bed = el("input", { class: "input", type: "time", value: "23:00" });
    const wake = el("input", { class: "input", type: "time", value: "07:00" });
    const quality = el("select", { class: "select" },
      [["5", "⭐ Rất tốt"], ["4", "Tốt"], ["3", "Bình thường"], ["2", "Kém"], ["1", "Rất kém"]].map(
        ([v, t]) => el("option", { value: v, text: t })
      )
    );
    quality.value = "4";
    const note = el("input", { class: "input", placeholder: "Ghi chú (tùy chọn)" });
    const saveBtn = el("button", { class: "btn", text: "Lưu giấc ngủ" });

    saveBtn.addEventListener("click", () => {
      Store.update((d) => {
        d.sleep = d.sleep.filter((s) => s.date !== date.value); // 1 bản ghi / ngày
        d.sleep.push({
          id: U.uid(),
          date: date.value,
          bedtime: bed.value,
          waketime: wake.value,
          quality: Number(quality.value),
          note: note.value.trim(),
        });
      });
      App.log("sleep_log", "Ghi giấc ngủ ngày " + date.value);
      U.toast("Đã lưu giấc ngủ");
      render(root);
    });

    root.append(
      el("div", { class: "card" }, [
        el("div", { class: "row" }, [
          field("Ngày", date),
          field("Đi ngủ", bed),
          field("Thức dậy", wake),
          field("Chất lượng", quality),
        ]),
        el("div", { class: "field" }, [el("label", { text: "Ghi chú" }), note]),
        saveBtn,
      ])
    );

    // Stats: trung bình 7 đêm
    const recent = [...db.sleep].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    if (recent.length) {
      const avg = recent.reduce((s, r) => s + minutesBetween(r.bedtime, r.waketime), 0) / recent.length;
      const avgQ = (recent.reduce((s, r) => s + r.quality, 0) / recent.length).toFixed(1);
      root.append(
        el("div", { class: "grid grid--stats", style: "margin-top:16px" }, [
          tile("⏰", "TB thời lượng", fmtMinutes(avg), `${recent.length} đêm gần nhất`),
          tile("⭐", "TB chất lượng", avgQ + "/5", "đánh giá"),
        ])
      );
    }

    // History
    const all = [...db.sleep].sort((a, b) => b.date.localeCompare(a.date));
    if (all.length === 0) {
      root.append(el("p", { class: "empty", text: "Chưa có bản ghi giấc ngủ nào." }));
      return;
    }
    const stars = (n) => "⭐".repeat(n);
    const list = el("ul", { class: "list", style: "margin-top:16px" });
    all.forEach((s) => {
      const dur = minutesBetween(s.bedtime, s.waketime);
      const del = el("button", { class: "icon-btn", text: "✕" });
      del.addEventListener("click", () => {
        Store.update((d) => (d.sleep = d.sleep.filter((x) => x.id !== s.id)));
        render(root);
      });
      list.append(
        el("li", { class: "item" }, [
          el("div", { style: "flex:1" }, [
            el("div", { class: "item__text", text: `${U.fmtVN(s.date)} · ${fmtMinutes(dur)}` }),
            el("div", { class: "item__sub", text: `${s.bedtime} → ${s.waketime} · ${stars(s.quality)}${s.note ? " · " + s.note : ""}` }),
          ]),
          del,
        ])
      );
    });
    root.append(list);
  }

  function field(label, input) {
    return el("div", { class: "field", style: "margin:0" }, [el("label", { text: label }), input]);
  }
  function tile(icon, label, value, sub) {
    return el("div", { class: "stat" }, [
      el("div", { class: "stat__label" }, [el("span", { text: icon }), el("span", { text: label })]),
      el("div", { class: "stat__value", text: value }),
      el("div", { class: "stat__sub", text: sub }),
    ]);
  }

  window.Views = window.Views || {};
  window.Views.sleep = { render };
})();
