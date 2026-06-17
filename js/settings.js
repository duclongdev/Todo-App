// settings.js — Tên, giao diện, sao lưu/khôi phục dữ liệu
(function () {
  const { el } = U;

  function render(root) {
    const db = Store.all();
    root.innerHTML = "";
    root.append(
      el("div", { class: "page-head" }, [
        el("h2", { text: "⚙️ Cài đặt" }),
        el("p", { text: "Cá nhân hóa và quản lý dữ liệu của bạn." }),
      ])
    );

    // Name
    const nameIn = el("input", { class: "input", placeholder: "Tên của bạn", value: db.settings.name || "" });
    const nameBtn = el("button", { class: "btn", text: "Lưu" });
    nameBtn.addEventListener("click", () => {
      Store.update((d) => (d.settings.name = nameIn.value.trim()));
      U.toast("Đã lưu");
    });
    root.append(
      el("div", { class: "card" }, [
        el("div", { class: "card__title", text: "👤 Hồ sơ" }),
        el("div", { class: "row" }, [nameIn, el("div", { style: "flex:0 0 auto" }, [nameBtn])]),
      ])
    );

    // Theme
    const themeBtn = el("button", { class: "btn btn--ghost", text: db.settings.theme === "dark" ? "☀️ Chuyển sáng" : "🌙 Chuyển tối" });
    themeBtn.addEventListener("click", () => { App.toggleTheme(); render(root); });
    root.append(
      el("div", { class: "card" }, [
        el("div", { class: "card__title", text: "🎨 Giao diện" }),
        themeBtn,
      ])
    );

    // Currency
    const curSel = el("select", { class: "select", style: "max-width:220px" },
      [["₫", "₫ — VND (Việt Nam)"], ["$", "$ — USD"], ["€", "€ — EUR"], ["£", "£ — GBP"], ["¥", "¥ — JPY/CNY"]].map(
        ([v, t]) => el("option", { value: v, text: t, selected: (db.settings.currency || "₫") === v })
      )
    );
    curSel.value = db.settings.currency || "₫";
    curSel.addEventListener("change", () => { Store.update((d) => (d.settings.currency = curSel.value)); U.toast("Đã đổi đơn vị tiền tệ"); });
    root.append(
      el("div", { class: "card" }, [
        el("div", { class: "card__title", text: "💱 Đơn vị tiền tệ" }),
        curSel,
      ])
    );

    // File sync (.json thật trên máy)
    const fs = window.FileSync;
    const fsCard = el("div", { class: "card" }, [el("div", { class: "card__title", text: "🔗 File dữ liệu (.json)" })]);
    if (fs && fs.supported) {
      fsCard.append(el("p", { class: "stat__sub", style: "margin-bottom:12px" },
        fs.connected
          ? `Đang đồng bộ với file: ${fs.name}. Tự lưu khi thay đổi & khi đóng app, tự nạp khi mở lại.`
          : "Kết nối một file .json để tự động lưu khi đóng và tự nạp khi mở app."
      ));
      const connectBtn = el("button", { class: "btn", text: fs.connected ? "Đổi / tạo file mới" : "Tạo & kết nối file .json" });
      connectBtn.addEventListener("click", async () => { await fs.connectNew(); render(root); });
      const openBtn = el("button", { class: "btn btn--ghost", text: "Mở file có sẵn & nạp dữ liệu" });
      openBtn.addEventListener("click", async () => { await fs.openExisting(); render(root); });
      const row = el("div", { class: "row", style: "flex-direction:column" }, [connectBtn, openBtn]);
      if (fs.connected) {
        const discBtn = el("button", { class: "btn btn--ghost", text: "Ngắt kết nối file" });
        discBtn.addEventListener("click", async () => { await fs.disconnect(); render(root); });
        row.append(discBtn);
      }
      fsCard.append(row);
    } else {
      fsCard.append(el("p", { class: "stat__sub", text: "Trình duyệt này không hỗ trợ lưu trực tiếp ra file (.json). Hãy dùng Chrome/Edge, hoặc dùng Xuất/Nhập dữ liệu bên dưới. Dữ liệu vẫn được lưu an toàn trong trình duyệt." }));
    }
    root.append(fsCard);

    // Data management
    const exportBtn = el("button", { class: "btn btn--ghost", text: "⬇️ Xuất dữ liệu (.json)" });
    exportBtn.addEventListener("click", () => {
      const blob = new Blob([Store.export()], { type: "application/json" });
      const a = el("a", { href: URL.createObjectURL(blob), download: `life-hub-backup-${U.today()}.json` });
      a.click();
      U.toast("Đã xuất file sao lưu");
    });

    const importInput = el("input", { type: "file", accept: "application/json", style: "display:none" });
    importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Store.import(JSON.parse(reader.result));
          U.toast("Đã khôi phục dữ liệu");
          App.applyTheme();
          render(root);
        } catch {
          U.toast("File không hợp lệ", "err");
        }
      };
      reader.readAsText(file);
    });
    const importBtn = el("button", { class: "btn btn--ghost", text: "⬆️ Nhập dữ liệu" });
    importBtn.addEventListener("click", () => importInput.click());

    const resetBtn = el("button", { class: "btn btn--danger", text: "🗑️ Xóa toàn bộ dữ liệu" });
    resetBtn.addEventListener("click", () => {
      if (!confirm("Xóa TẤT CẢ dữ liệu? Hành động này không thể hoàn tác.")) return;
      Store.reset();
      U.toast("Đã xóa toàn bộ dữ liệu");
      App.applyTheme();
      render(root);
    });

    root.append(
      el("div", { class: "card" }, [
        el("div", { class: "card__title", text: "💾 Dữ liệu" }),
        el("p", { class: "stat__sub", style: "margin-bottom:14px", text: "Mọi dữ liệu được lưu ngay trên trình duyệt này. Nên xuất file sao lưu định kỳ." }),
        el("div", { class: "row", style: "flex-direction:column" }, [exportBtn, importBtn, importInput, resetBtn]),
      ])
    );

    root.append(el("p", { class: "stat__sub", style: "text-align:center;margin-top:24px", text: "Life Hub · Dữ liệu của bạn, riêng tư trên máy bạn." }));
  }

  window.Views = window.Views || {};
  window.Views.settings = { render };
})();
