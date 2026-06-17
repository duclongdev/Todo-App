// notes.js — Ghi chú dạng block kiểu Notion: gõ "/" để chọn kiểu (heading, toggle, to-do...)
(function () {
  const { el } = U;
  let mode = "list"; // list | edit
  let noteId = null;
  let query = "";       // ô tìm kiếm ở danh sách
  let slashQuery = "";  // từ khóa sau dấu "/"
  let blocksEl = null;
  let focusReq = null; // block id cần focus sau khi vẽ lại
  let slash = null; // { block, edit, items, active, menu }
  let saveTimer = null;

  const TYPES = [
    { type: "text", icon: "¶", label: "Văn bản", hint: "Đoạn văn thường", kw: "text van ban paragraph p" },
    { type: "h1", icon: "H₁", label: "Tiêu đề 1", hint: "Lớn", kw: "h1 heading tieu de lon" },
    { type: "h2", icon: "H₂", label: "Tiêu đề 2", hint: "Vừa", kw: "h2 heading tieu de" },
    { type: "h3", icon: "H₃", label: "Tiêu đề 3", hint: "Nhỏ", kw: "h3 heading tieu de nho" },
    { type: "bullet", icon: "•", label: "Danh sách", hint: "Gạch đầu dòng", kw: "bullet list danh sach" },
    { type: "number", icon: "1.", label: "Danh sách số", hint: "Đánh số", kw: "number list so danh sach" },
    { type: "todo", icon: "☑", label: "To-do", hint: "Ô đánh dấu", kw: "todo checkbox check viec" },
    { type: "toggle", icon: "▸", label: "Toggle", hint: "Thu gọn được", kw: "toggle thu gon collapse" },
    { type: "quote", icon: "❝", label: "Trích dẫn", hint: "Quote", kw: "quote trich dan" },
    { type: "divider", icon: "―", label: "Đường kẻ", hint: "Phân cách", kw: "divider duong ke line hr" },
  ];

  const getNote = () => Store.get("notes").find((n) => n.id === noteId);
  const placeholderOf = (b) =>
    b.type === "h1" ? "Tiêu đề 1" : b.type === "h2" ? "Tiêu đề 2" : b.type === "h3" ? "Tiêu đề 3" :
    b.type === "quote" ? "Trích dẫn" : b.type === "toggle" ? "Toggle" : "Gõ '/' để chọn kiểu, hoặc nhập văn bản...";

  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      Store.update((d) => { const n = d.notes.find((x) => x.id === noteId); if (n) n.updatedAt = Date.now(); });
      App.log("note_save", "Cập nhật ghi chú");
    }, 700);
  }

  // ---------- Caret helpers ----------
  function caretOffset(node) {
    const sel = getSelection();
    if (!sel.rangeCount) return 0;
    const r = sel.getRangeAt(0).cloneRange();
    const pre = r.cloneRange();
    pre.selectNodeContents(node);
    pre.setEnd(r.endContainer, r.endOffset);
    return pre.toString().length;
  }

  // ================= LIST MODE =================
  function renderList(root) {
    const db = Store.all();
    root.innerHTML = "";
    root.append(el("div", { class: "page-head" }, [
      el("h2", { text: "📝 Ghi chú" }),
      el("p", { text: "Soạn thảo dạng block — gõ \"/\" để thêm tiêu đề, to-do, toggle, trích dẫn..." }),
    ]));

    const newBtn = el("button", { class: "btn", text: "＋ Ghi chú mới" });
    newBtn.addEventListener("click", () => {
      const id = U.uid();
      Store.update((d) => d.notes.unshift({ id, title: "", blocks: [{ id: U.uid(), type: "text", text: "" }], pinned: false, updatedAt: Date.now() }));
      App.log("note_save", "Tạo ghi chú mới");
      noteId = id; mode = "edit"; render(root);
    });
    const search = el("input", { class: "input", placeholder: "🔍 Tìm ghi chú...", value: query });
    search.addEventListener("input", () => { query = search.value; renderGrid(); search.focus(); });
    root.append(el("div", { class: "row", style: "margin-bottom:16px" }, [search, el("div", { style: "flex:0 0 auto" }, [newBtn])]));

    const gridWrap = el("div");
    root.append(gridWrap);

    function preview(n) {
      return (n.blocks || []).map((b) => b.text).filter(Boolean).join(" · ").slice(0, 90);
    }
    function renderGrid() {
      gridWrap.innerHTML = "";
      let notes = [...db.notes];
      if (query.trim()) {
        const q = query.toLowerCase();
        notes = notes.filter((n) => (n.title + " " + preview(n)).toLowerCase().includes(q));
      }
      notes.sort((a, b) => b.pinned - a.pinned || b.updatedAt - a.updatedAt);
      if (notes.length === 0) {
        gridWrap.append(el("p", { class: "empty", text: query ? "Không tìm thấy ghi chú." : "Chưa có ghi chú nào." }));
        return;
      }
      const grid = el("div", { class: "grid grid--2" });
      notes.forEach((n) => {
        const pin = el("button", { class: "icon-btn", text: n.pinned ? "📌" : "📍", title: "Ghim" });
        pin.addEventListener("click", (e) => { e.stopPropagation(); Store.update((d) => { const x = d.notes.find((m) => m.id === n.id); if (x) x.pinned = !x.pinned; }); renderGrid(); });
        const del = el("button", { class: "icon-btn", text: "🗑️", title: "Xóa" });
        del.addEventListener("click", (e) => { e.stopPropagation(); if (!confirm("Xóa ghi chú này?")) return; Store.update((d) => (d.notes = d.notes.filter((m) => m.id !== n.id))); renderGrid(); });
        const card = el("div", { class: "card notecard", style: "cursor:pointer" }, [
          el("div", { class: "notecard__title", text: n.title || "(không tiêu đề)" }),
          el("div", { class: "notecard__body", text: preview(n) || "Trống" }),
          el("div", { class: "notecard__foot" }, [
            el("span", { class: "item__sub", text: new Date(n.updatedAt).toLocaleDateString("vi-VN") }),
            el("div", {}, [pin, del]),
          ]),
        ]);
        card.addEventListener("click", () => { noteId = n.id; mode = "edit"; render(document.getElementById("view")); });
        grid.append(card);
      });
      gridWrap.append(grid);
    }
    renderGrid();
  }

  // ================= EDIT MODE =================
  function renderEditor(root) {
    const note = getNote();
    if (!note) { mode = "list"; renderList(root); return; }
    root.innerHTML = "";

    const back = el("button", { class: "btn btn--sm btn--ghost", text: "← Tất cả ghi chú", onClick: () => { closeSlash(); mode = "list"; render(root); } });
    root.append(el("div", { style: "margin-bottom:14px" }, [back]));

    const title = el("input", { class: "input", placeholder: "Tiêu đề ghi chú", value: note.title, style: "font-size:1.4rem;font-weight:800;border:none;padding:6px 2px;box-shadow:none" });
    title.addEventListener("input", () => { note.title = title.value; saveSoon(); });

    blocksEl = el("div", { class: "blocks" });
    root.append(el("div", { class: "card" }, [title, blocksEl]));
    root.append(el("p", { class: "stat__sub", style: "margin-top:10px", text: "Mẹo: gõ \"/\" để chèn tiêu đề, danh sách, to-do, toggle... · Enter để xuống dòng mới." }));

    renderBlocks();
  }

  function renderBlocks() {
    const note = getNote();
    blocksEl.innerHTML = "";
    let numCount = 0;
    note.blocks.forEach((b, i) => {
      if (b.type === "number") { numCount++; } else { numCount = 0; }
      blocksEl.append(buildBlock(note, b, numCount));
    });
    if (focusReq) {
      const target = blocksEl.querySelector('.block[data-bid="' + focusReq + '"] .block__edit');
      if (target) U.placeCaretEnd(target);
      focusReq = null;
    }
  }

  function buildBlock(note, b, num) {
    const row = el("div", { class: "block block--" + b.type, dataset: { bid: b.id } });

    // handle + delete
    const del = el("button", { class: "icon-btn block__handle", text: "⋮⋮", title: "Xóa block" });
    del.addEventListener("click", () => { removeBlock(b.id); });
    row.append(del);

    if (b.type === "divider") {
      row.append(el("hr", { class: "block__divider" }));
      return row;
    }

    // prefix theo loại
    if (b.type === "bullet") row.append(el("span", { class: "block__bullet", text: "•" }));
    if (b.type === "number") row.append(el("span", { class: "block__bullet", text: num + "." }));
    if (b.type === "todo") {
      const cb = el("input", { type: "checkbox", class: "check", style: "flex:0 0 20px;height:20px" });
      cb.checked = !!b.checked;
      cb.addEventListener("change", () => { b.checked = cb.checked; edit.classList.toggle("checked", cb.checked); Store.update(() => {}); });
      row.append(cb);
    }
    if (b.type === "toggle") {
      const tg = el("button", { class: "block__toggle-btn", text: b.collapsed ? "▸" : "▾" });
      tg.addEventListener("click", () => { b.collapsed = !b.collapsed; Store.update(() => {}); renderBlocks(); });
      row.append(tg);
    }

    const edit = el("div", { class: "block__edit" + (b.type === "todo" && b.checked ? " checked" : ""), contenteditable: "true", "data-ph": placeholderOf(b) });
    edit.textContent = b.text || "";
    attachEditable(edit, note, b);
    row.append(edit);

    // nội dung con của toggle
    if (b.type === "toggle" && !b.collapsed) {
      const child = el("div", { class: "toggle-children" });
      const cEdit = el("div", { class: "block__edit", contenteditable: "true", "data-ph": "Nội dung bên trong toggle..." });
      cEdit.textContent = b.content || "";
      cEdit.addEventListener("input", () => { b.content = cEdit.textContent; saveSoon(); });
      child.append(cEdit);
      row.append(child);
    }
    return row;
  }

  function attachEditable(edit, note, b) {
    edit.addEventListener("input", () => {
      b.text = edit.textContent;
      const off = caretOffset(edit);
      const before = b.text.slice(0, off);
      const m = before.match(/(?:^|\s)\/([\p{L}\w]*)$/u);
      if (m) openSlash(b, edit, m[1]);
      else closeSlash();
      saveSoon();
    });

    edit.addEventListener("keydown", (e) => {
      if (slash) {
        if (e.key === "ArrowDown") { e.preventDefault(); slash.active = (slash.active + 1) % Math.max(1, slash.items.length); renderMenu(); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); slash.active = (slash.active - 1 + slash.items.length) % Math.max(1, slash.items.length); renderMenu(); return; }
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); selectActive(); return; }
        if (e.key === "Escape") { e.preventDefault(); closeSlash(); return; }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const off = caretOffset(edit);
        const text = b.text;
        const before = text.slice(0, off), after = text.slice(off);
        b.text = before;
        const carry = (b.type === "bullet" || b.type === "number" || b.type === "todo") ? b.type : "text";
        // nếu block rỗng và đang là list -> hạ về text
        if (!before && (b.type === "bullet" || b.type === "number" || b.type === "todo")) {
          b.type = "text"; Store.update(() => {}); focusReq = b.id; renderBlocks(); return;
        }
        const nb = { id: U.uid(), type: carry, text: after, checked: false };
        const idx = note.blocks.indexOf(b);
        note.blocks.splice(idx + 1, 0, nb);
        Store.update(() => {});
        focusReq = nb.id; renderBlocks();
        return;
      }
      if (e.key === "Backspace") {
        const off = caretOffset(edit);
        if (off === 0) {
          if (b.type !== "text") { e.preventDefault(); b.type = "text"; Store.update(() => {}); focusReq = b.id; renderBlocks(); return; }
          const idx = note.blocks.indexOf(b);
          if (idx > 0) {
            e.preventDefault();
            const prev = note.blocks[idx - 1];
            if (prev.type === "divider") { note.blocks.splice(idx - 1, 1); Store.update(() => {}); focusReq = b.id; renderBlocks(); return; }
            prev.text = (prev.text || "") + b.text;
            note.blocks.splice(idx, 1);
            Store.update(() => {});
            focusReq = prev.id; renderBlocks();
          }
        }
      }
    });
  }

  function removeBlock(id) {
    const note = getNote();
    if (note.blocks.length <= 1) { note.blocks[0].text = ""; note.blocks[0].type = "text"; }
    else note.blocks = note.blocks.filter((x) => x.id !== id);
    Store.update(() => {});
    renderBlocks();
  }

  // ---------- Slash menu ----------
  function openSlash(block, edit, q) {
    slashQuery = q || "";
    if (!slash) {
      const menu = el("div", { class: "slash-menu" });
      document.body.append(menu);
      slash = { block, edit, menu, active: 0, items: [] };
      // đặt vị trí theo caret
      const sel = getSelection();
      let rect;
      if (sel.rangeCount) rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (!rect.top && !rect.left)) rect = edit.getBoundingClientRect();
      menu.style.left = (window.scrollX + rect.left) + "px";
      menu.style.top = (window.scrollY + rect.bottom + 6) + "px";
    }
    slash.block = block; slash.edit = edit;
    slash.active = 0;
    renderMenu();
  }

  function renderMenu() {
    if (!slash) return;
    const q = slashQuery.toLowerCase();
    slash.items = TYPES.filter((t) => !q || (t.label + " " + t.kw).toLowerCase().includes(q));
    if (slash.active >= slash.items.length) slash.active = 0;
    slash.menu.innerHTML = "";
    slash.menu.append(el("div", { class: "slash-menu__group", text: "Loại block" }));
    if (slash.items.length === 0) { slash.menu.append(el("div", { class: "slash-menu__item", text: "Không có kết quả" })); return; }
    slash.items.forEach((it, i) => {
      const item = el("div", { class: "slash-menu__item" + (i === slash.active ? " active" : "") }, [
        el("span", { class: "slash-menu__icon", text: it.icon }),
        el("div", {}, [el("div", { class: "slash-menu__label", text: it.label }), el("div", { class: "slash-menu__hint", text: it.hint })]),
      ]);
      item.addEventListener("mousedown", (e) => { e.preventDefault(); slash.active = i; selectActive(); });
      slash.menu.append(item);
    });
  }

  function selectActive() {
    if (!slash || !slash.items.length) return;
    const it = slash.items[slash.active];
    const block = slash.block, edit = slash.edit;
    // bỏ phần "/query" trong text
    const text = block.text;
    const off = caretOffset(edit);
    const before = text.slice(0, off).replace(/(?:^|\s)\/[\p{L}\w]*$/u, (mm) => (mm[0] === " " ? " " : ""));
    const after = text.slice(off);
    block.text = before + after;
    closeSlash();

    if (it.type === "divider") {
      block.type = "divider"; block.text = "";
      const note = getNote();
      const nb = { id: U.uid(), type: "text", text: "" };
      const idx = note.blocks.indexOf(block);
      note.blocks.splice(idx + 1, 0, nb);
      focusReq = nb.id;
    } else {
      block.type = it.type;
      if (it.type === "todo" && block.checked === undefined) block.checked = false;
      if (it.type === "toggle") { block.collapsed = false; if (block.content === undefined) block.content = ""; }
      focusReq = block.id;
    }
    Store.update(() => {});
    App.log("note_save", "Thêm block: " + it.label);
    renderBlocks();
  }

  function closeSlash() {
    if (slash) { slash.menu.remove(); slash = null; }
    slashQuery = "";
  }

  // ================= ENTRY =================
  function render(root) {
    closeSlash();
    if (mode === "edit" && getNote()) renderEditor(root);
    else { mode = "list"; renderList(root); }
  }

  window.Views = window.Views || {};
  window.Views.notes = { render };
})();
