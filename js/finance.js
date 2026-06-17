// finance.js — Quản lý tài chính cá nhân: tài khoản, giao dịch, ngân sách, tiết kiệm, báo cáo
(function () {
  const { el } = U;
  let tab = "overview"; // overview | tx | budget | accounts | savings
  let monthOffset = 0;
  let filter = { type: "all", cat: "all", acc: "all", q: "" };
  const ICONS = ["💵", "🏦", "💳", "📱", "🐷", "💰", "🪙", "🏠", "🚗", "🍜", "🛍️", "🎁", "📈", "🎮", "💊", "📚", "🧾", "✈️", "📦"];
  const TABS = [["overview", "Tổng quan"], ["tx", "Giao dịch"], ["budget", "Ngân sách"], ["accounts", "Tài khoản"], ["savings", "Tiết kiệm"]];

  const F = () => Store.get("finance");
  const settings = () => Store.get("settings");
  const accountById = (id) => F().accounts.find((a) => a.id === id);
  const catById = (id) => F().categories.find((c) => c.id === id);

  function fmtMoney(n) {
    const cur = settings().currency || "₫";
    const neg = n < 0; const v = Math.abs(n);
    const s = cur === "₫"
      ? Math.round(v).toLocaleString("vi-VN") + " ₫"
      : cur + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg ? "−" : "") + s;
  }
  function parseAmount(str) {
    const n = parseFloat(String(str).replace(/[^\d.]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  function monthInfo(off) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + off);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    return { key: `${y}-${U.pad(m)}`, label: `Tháng ${m}/${y}` };
  }
  function txOfMonth(key) { return F().tx.filter((t) => t.date && t.date.slice(0, 7) === key); }
  function accountBalance(id) {
    const a = accountById(id); if (!a) return 0;
    let bal = a.initial || 0;
    F().tx.forEach((t) => {
      if (t.type === "income" && t.accountId === id) bal += t.amount;
      else if (t.type === "expense" && t.accountId === id) bal -= t.amount;
      else if (t.type === "transfer") { if (t.accountId === id) bal -= t.amount; if (t.toAccountId === id) bal += t.amount; }
    });
    return bal;
  }
  const netWorth = () => F().accounts.reduce((s, a) => s + accountBalance(a.id), 0);

  // ===================== ENTRY =====================
  function render(root) {
    root.innerHTML = "";
    root.append(el("div", { class: "page-head" }, [
      el("h2", { text: "💰 Tài chính" }),
      el("p", { text: "Quản lý thu chi, tài khoản, ngân sách và tiết kiệm — kèm báo cáo chi tiết." }),
    ]));
    const pills = el("div", { class: "pills" });
    TABS.forEach(([id, label]) => {
      const p = el("button", { class: "pill" + (tab === id ? " is-active" : ""), text: label });
      p.addEventListener("click", () => { tab = id; render(root); });
      pills.append(p);
    });
    root.append(pills);
    const host = el("div");
    root.append(host);
    ({ overview: renderOverview, tx: renderTx, budget: renderBudget, accounts: renderAccounts, savings: renderSavings }[tab])(host, root);
  }

  function monthNav(host, root) {
    const info = monthInfo(monthOffset);
    const prev = el("button", { class: "weeknav__btn", text: "◀", onClick: () => { monthOffset--; render(root); } });
    const next = el("button", { class: "weeknav__btn", text: "▶", onClick: () => { monthOffset++; render(root); } });
    const label = el("div", { class: "weeknav__label", text: info.label });
    const nav = el("div", { class: "weeknav" }, [prev, label, next]);
    if (monthOffset !== 0) nav.append(el("button", { class: "btn btn--sm btn--ghost", text: "Tháng này", onClick: () => { monthOffset = 0; render(root); } }));
    host.append(nav);
    return info;
  }

  // ===================== OVERVIEW =====================
  function renderOverview(host, root) {
    const info = monthNav(host, root);
    const monthTx = txOfMonth(info.key);
    const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    host.append(el("div", { class: "grid grid--stats" }, [
      tile("📥", "Thu nhập", fmtMoney(income), "in"),
      tile("📤", "Chi tiêu", fmtMoney(expense), "out"),
      tile("⚖️", "Chênh lệch", fmtMoney(income - expense), income - expense >= 0 ? "in" : "out"),
      tile("🏦", "Tổng tài sản", fmtMoney(netWorth()), "neutral"),
    ]));

    // Phân bổ chi tiêu theo danh mục
    const byCat = {};
    monthTx.filter((t) => t.type === "expense").forEach((t) => (byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount));
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const catCard = el("div", { class: "card", style: "margin-top:16px" }, [el("div", { class: "card__title", text: "📊 Chi tiêu theo danh mục" })]);
    if (cats.length === 0) catCard.append(el("p", { class: "empty", text: "Chưa có chi tiêu trong tháng này." }));
    else cats.forEach(([cid, amt]) => {
      const c = catById(cid) || { icon: "📦", name: "Khác" };
      const pct = Math.round((amt / expense) * 100);
      catCard.append(el("div", { class: "fin-bar" }, [
        el("span", { class: "fin-bar__icon", text: c.icon }),
        el("div", { class: "fin-bar__main" }, [
          el("div", { class: "fin-bar__top" }, [el("span", { text: `${c.name} · ${pct}%` }), el("span", { class: "amount amount--out", text: fmtMoney(amt) })]),
          el("div", { class: "progress" }, [el("div", { class: "progress__bar", style: "width:" + pct + "%;background:var(--danger)" })]),
        ]),
      ]));
    });
    host.append(catCard);

    // Xu hướng 6 tháng
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(monthInfo(monthOffset - i));
    const series = months.map((m) => {
      const tx = txOfMonth(m.key);
      return { label: m.label.replace("Tháng ", "T"), in: tx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), out: tx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0) };
    });
    const max = Math.max(1, ...series.flatMap((s) => [s.in, s.out]));
    const chart = el("div", { class: "fin-chart" });
    series.forEach((s) => {
      chart.append(el("div", { class: "fin-chart__col" }, [
        el("div", { class: "fin-chart__bars" }, [
          el("div", { class: "fin-chart__bar in", style: `height:${Math.round((s.in / max) * 100)}%`, title: "Thu: " + fmtMoney(s.in) }),
          el("div", { class: "fin-chart__bar out", style: `height:${Math.round((s.out / max) * 100)}%`, title: "Chi: " + fmtMoney(s.out) }),
        ]),
        el("div", { class: "fin-chart__label", text: s.label }),
      ]));
    });
    host.append(el("div", { class: "card", style: "margin-top:16px" }, [
      el("div", { class: "card__title", text: "📈 Thu chi 6 tháng" }), chart,
      el("div", { class: "legend" }, [
        el("span", {}, [el("span", { class: "dot dot--in" }), "Thu nhập"]),
        el("span", {}, [el("span", { class: "dot dot--out" }), "Chi tiêu"]),
      ]),
    ]));

    // Giao dịch gần đây
    const recent = [...monthTx].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 6);
    const rc = el("div", { class: "card", style: "margin-top:16px" }, [
      el("div", { class: "card__title" }, [el("span", { text: "🧾 Giao dịch gần đây" }), el("button", { class: "btn btn--sm btn--ghost", text: "Xem tất cả", onClick: () => { tab = "tx"; render(root); } })]),
    ]);
    if (recent.length === 0) rc.append(el("p", { class: "empty", text: "Chưa có giao dịch." }));
    else { const list = el("ul", { class: "list" }); recent.forEach((t) => list.append(txItem(t, root))); rc.append(list); }
    host.append(rc);
  }

  // ===================== TRANSACTIONS =====================
  function renderTx(host, root) {
    // ----- Form thêm -----
    const draft = { type: "expense" };
    const formHost = el("div", { class: "card" });
    host.append(formHost);

    function renderForm() {
      formHost.innerHTML = "";
      const seg = el("div", { class: "seg", style: "margin-bottom:14px" }, [
        segBtn("expense", "Chi", "out"), segBtn("income", "Thu", "in"), segBtn("transfer", "Chuyển khoản", ""),
      ]);
      function segBtn(t, label, cls) {
        const b = el("button", { class: "seg__btn " + cls + (draft.type === t ? " is-active" : ""), text: label });
        b.addEventListener("click", () => { draft.type = t; renderForm(); });
        return b;
      }
      const amount = el("input", { class: "input", type: "number", min: "0", step: "any", placeholder: "Số tiền", value: draft.amount || "" });
      amount.addEventListener("input", () => (draft.amount = amount.value));
      const date = el("input", { class: "input", type: "date", value: draft.date || U.today() });
      date.addEventListener("input", () => (draft.date = date.value));
      const note = el("input", { class: "input", placeholder: "Ghi chú", value: draft.note || "" });
      note.addEventListener("input", () => (draft.note = note.value));

      const accounts = F().accounts;
      const fields = [];
      if (draft.type === "transfer") {
        const from = el("select", { class: "select" }, accounts.map((a) => el("option", { value: a.id, text: a.icon + " " + a.name })));
        const to = el("select", { class: "select" }, accounts.map((a) => el("option", { value: a.id, text: a.icon + " " + a.name })));
        if (accounts[1]) to.value = accounts[1].id;
        draft._from = from; draft._to = to;
        fields.push(f("Từ tài khoản", from), f("Đến tài khoản", to));
      } else {
        const cats = F().categories.filter((c) => c.kind === draft.type);
        const cat = el("select", { class: "select" }, cats.map((c) => el("option", { value: c.id, text: c.icon + " " + c.name })));
        const acc = el("select", { class: "select" }, accounts.map((a) => el("option", { value: a.id, text: a.icon + " " + a.name })));
        draft._cat = cat; draft._acc = acc;
        fields.push(f("Danh mục", cat), f("Tài khoản", acc));
      }
      const addBtn = el("button", { class: "btn", text: "Thêm giao dịch" });
      addBtn.addEventListener("click", () => {
        const amt = parseAmount(draft.amount);
        if (amt <= 0) return U.toast("Nhập số tiền hợp lệ", "err");
        if (draft.type === "transfer" && draft._from.value === draft._to.value) return U.toast("Hai tài khoản phải khác nhau", "err");
        Store.update((d) => d.finance.tx.push({
          id: U.uid(), type: draft.type, amount: amt,
          accountId: draft.type === "transfer" ? draft._from.value : draft._acc.value,
          toAccountId: draft.type === "transfer" ? draft._to.value : null,
          categoryId: draft.type === "transfer" ? null : draft._cat.value,
          date: date.value || U.today(), note: note.value.trim(), createdAt: Date.now(),
        }));
        App.log("finance_tx_add", `${draft.type === "income" ? "Thu" : draft.type === "expense" ? "Chi" : "Chuyển"} ${fmtMoney(amt)}`);
        draft.amount = ""; draft.note = "";
        U.toast("Đã thêm giao dịch");
        render(root);
      });

      formHost.append(seg);
      formHost.append(el("div", { class: "row" }, [f("Số tiền", amount), f("Ngày", date)]));
      formHost.append(el("div", { class: "row", style: "margin-top:10px" }, fields));
      formHost.append(el("div", { style: "margin-top:10px" }, [f("Ghi chú", note)]));
      formHost.append(el("div", { style: "margin-top:12px" }, [addBtn]));
    }
    renderForm();

    // ----- Bộ lọc -----
    const info = monthNav(host, root);
    const typeSel = el("select", { class: "select" }, [["all", "Tất cả loại"], ["expense", "Chi"], ["income", "Thu"], ["transfer", "Chuyển khoản"]].map(([v, t]) => el("option", { value: v, text: t, selected: filter.type === v })));
    typeSel.value = filter.type;
    typeSel.addEventListener("change", () => { filter.type = typeSel.value; render(root); });
    const catSel = el("select", { class: "select" }, [el("option", { value: "all", text: "Tất cả danh mục" }), ...F().categories.map((c) => el("option", { value: c.id, text: c.icon + " " + c.name, selected: filter.cat === c.id }))]);
    catSel.value = filter.cat;
    catSel.addEventListener("change", () => { filter.cat = catSel.value; render(root); });
    const accSel = el("select", { class: "select" }, [el("option", { value: "all", text: "Tất cả tài khoản" }), ...F().accounts.map((a) => el("option", { value: a.id, text: a.icon + " " + a.name, selected: filter.acc === a.id }))]);
    accSel.value = filter.acc;
    accSel.addEventListener("change", () => { filter.acc = accSel.value; render(root); });
    const q = el("input", { id: "fin-q", class: "input", placeholder: "🔍 Tìm theo ghi chú...", value: filter.q });
    q.addEventListener("input", () => {
      filter.q = q.value;
      render(root);
      requestAnimationFrame(() => { const n = document.getElementById("fin-q"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
    });
    host.append(el("div", { class: "card" }, [
      el("div", { class: "row" }, [typeSel, catSel, accSel]),
      el("div", { style: "margin-top:10px" }, [q]),
    ]));

    // ----- Danh sách -----
    let rows = txOfMonth(info.key);
    if (filter.type !== "all") rows = rows.filter((t) => t.type === filter.type);
    if (filter.cat !== "all") rows = rows.filter((t) => t.categoryId === filter.cat);
    if (filter.acc !== "all") rows = rows.filter((t) => t.accountId === filter.acc || t.toAccountId === filter.acc);
    if (filter.q.trim()) rows = rows.filter((t) => (t.note || "").toLowerCase().includes(filter.q.toLowerCase()));
    rows = rows.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

    const tin = rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const tout = rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    host.append(el("div", { class: "grid grid--stats", style: "margin-top:16px" }, [
      tile("📥", "Thu (lọc)", fmtMoney(tin), "in"),
      tile("📤", "Chi (lọc)", fmtMoney(tout), "out"),
      tile("🧮", "Số giao dịch", String(rows.length), "neutral"),
    ]));

    if (rows.length === 0) { host.append(el("p", { class: "empty", text: "Không có giao dịch phù hợp." })); return; }
    const list = el("ul", { class: "list", style: "margin-top:16px" });
    rows.forEach((t) => list.append(txItem(t, root)));
    host.append(list);
  }

  function txItem(t, root) {
    const acc = accountById(t.accountId);
    let icon, title, amtCls, sign;
    if (t.type === "transfer") {
      const to = accountById(t.toAccountId);
      icon = "🔄"; title = `${acc ? acc.name : "?"} → ${to ? to.name : "?"}`; amtCls = "amount--neutral"; sign = "";
    } else {
      const c = catById(t.categoryId) || { icon: "📦", name: "Khác" };
      icon = c.icon; title = c.name; amtCls = t.type === "income" ? "amount--in" : "amount--out"; sign = t.type === "income" ? "+" : "−";
    }
    const sub = `${U.fmtVN(t.date)}${acc ? " · " + acc.name : ""}${t.note ? " · " + t.note : ""}`;
    const item = el("li", { class: "item", style: "cursor:pointer" }, [
      el("span", { style: "font-size:1.2rem", text: icon }),
      el("div", { style: "flex:1;min-width:0" }, [el("div", { class: "item__text", text: title }), el("div", { class: "item__sub", text: sub })]),
      el("span", { class: "amount " + amtCls, text: sign + fmtMoney(t.amount).replace("−", "") }),
    ]);
    item.addEventListener("click", () => openTxModal(t, root));
    return item;
  }

  function openTxModal(t, root) {
    const accounts = F().accounts;
    const amount = el("input", { class: "input", type: "number", value: t.amount });
    const date = el("input", { class: "input", type: "date", value: t.date });
    const note = el("input", { class: "input", value: t.note || "" });
    const body = el("div");
    body.append(f("Số tiền", amount), el("div", { class: "row", style: "margin-top:10px" }, [f("Ngày", date)]));
    let getRefs;
    if (t.type === "transfer") {
      const from = el("select", { class: "select" }, accounts.map((a) => el("option", { value: a.id, text: a.icon + " " + a.name, selected: a.id === t.accountId })));
      const to = el("select", { class: "select" }, accounts.map((a) => el("option", { value: a.id, text: a.icon + " " + a.name, selected: a.id === t.toAccountId })));
      from.value = t.accountId; to.value = t.toAccountId;
      body.append(el("div", { class: "row", style: "margin-top:10px" }, [f("Từ", from), f("Đến", to)]));
      getRefs = () => ({ accountId: from.value, toAccountId: to.value, categoryId: null });
    } else {
      const cats = F().categories.filter((c) => c.kind === t.type);
      const cat = el("select", { class: "select" }, cats.map((c) => el("option", { value: c.id, text: c.icon + " " + c.name, selected: c.id === t.categoryId })));
      const acc = el("select", { class: "select" }, accounts.map((a) => el("option", { value: a.id, text: a.icon + " " + a.name, selected: a.id === t.accountId })));
      cat.value = t.categoryId; acc.value = t.accountId;
      body.append(el("div", { class: "row", style: "margin-top:10px" }, [f("Danh mục", cat), f("Tài khoản", acc)]));
      getRefs = () => ({ accountId: acc.value, toAccountId: null, categoryId: cat.value });
    }
    body.append(el("div", { style: "margin-top:10px" }, [f("Ghi chú", note)]));
    const save = el("button", { class: "btn", text: "Lưu" });
    const del = el("button", { class: "btn btn--danger", text: "Xóa" });
    body.append(el("div", { class: "row", style: "margin-top:14px" }, [el("div", { style: "flex:0 0 auto" }, [save]), el("div", { style: "flex:0 0 auto" }, [del])]));
    const m = U.modal({ title: "Chi tiết giao dịch", body });
    save.addEventListener("click", () => {
      const amt = parseAmount(amount.value);
      if (amt <= 0) return U.toast("Số tiền không hợp lệ", "err");
      const refs = getRefs();
      Store.update((d) => { const x = d.finance.tx.find((q) => q.id === t.id); if (x) { x.amount = amt; x.date = date.value; x.note = note.value.trim(); Object.assign(x, refs); } });
      App.log("finance_tx_edit", "Sửa giao dịch " + fmtMoney(amt));
      m.close(); render(root);
    });
    del.addEventListener("click", () => {
      if (!confirm("Xóa giao dịch này?")) return;
      Store.update((d) => (d.finance.tx = d.finance.tx.filter((q) => q.id !== t.id)));
      App.log("finance_tx_delete", "Xóa giao dịch");
      m.close(); render(root);
    });
  }

  // ===================== BUDGET =====================
  function renderBudget(host, root) {
    const info = monthNav(host, root);
    const monthTx = txOfMonth(info.key);
    const spentByCat = {};
    monthTx.filter((t) => t.type === "expense").forEach((t) => (spentByCat[t.categoryId] = (spentByCat[t.categoryId] || 0) + t.amount));
    const cats = F().categories.filter((c) => c.kind === "expense");
    const budgets = F().budgets;

    const totalBudget = cats.reduce((s, c) => s + (budgets[c.id] || 0), 0);
    const totalSpent = cats.reduce((s, c) => s + (spentByCat[c.id] || 0), 0);
    const pct = totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0;
    host.append(el("div", { class: "card" }, [
      el("div", { class: "card__title" }, [el("span", { text: "Tổng ngân sách tháng" }), el("span", { class: "amount", text: fmtMoney(totalSpent) + " / " + fmtMoney(totalBudget) })]),
      el("div", { class: "progress" }, [el("div", { class: "progress__bar", style: "width:" + Math.min(100, pct) + "%;background:" + (pct > 100 ? "var(--danger)" : "var(--primary)") })]),
      el("p", { class: "stat__sub", style: "margin-top:8px", text: totalBudget ? (pct > 100 ? `Vượt ngân sách ${pct - 100}%` : `Đã dùng ${pct}%`) : "Đặt ngân sách cho từng danh mục bên dưới." }),
    ]));

    const card = el("div", { class: "card", style: "margin-top:16px" }, [el("div", { class: "card__title", text: "Ngân sách theo danh mục" })]);
    cats.forEach((c) => {
      const budget = budgets[c.id] || 0;
      const spent = spentByCat[c.id] || 0;
      const p = budget ? Math.round((spent / budget) * 100) : 0;
      const input = el("input", { class: "input", type: "number", min: "0", step: "any", value: budget || "", placeholder: "0", style: "max-width:140px" });
      input.addEventListener("change", () => {
        const v = parseAmount(input.value);
        Store.update((d) => { if (v > 0) d.finance.budgets[c.id] = v; else delete d.finance.budgets[c.id]; });
        App.log("finance_budget", `Ngân sách ${c.name}: ${fmtMoney(v)}`);
        render(root);
      });
      card.append(el("div", { class: "fin-bar" }, [
        el("span", { class: "fin-bar__icon", text: c.icon }),
        el("div", { class: "fin-bar__main" }, [
          el("div", { class: "fin-bar__top" }, [el("span", { text: c.name }), el("span", { class: "amount " + (p > 100 ? "amount--out" : "amount--neutral"), text: fmtMoney(spent) + (budget ? " / " + fmtMoney(budget) : "") })]),
          budget ? el("div", { class: "progress" }, [el("div", { class: "progress__bar", style: "width:" + Math.min(100, p) + "%;background:" + (p > 100 ? "var(--danger)" : p > 80 ? "var(--warn)" : "var(--success)") })]) : null,
        ]),
        input,
      ]));
    });
    host.append(card);
  }

  // ===================== ACCOUNTS =====================
  function renderAccounts(host, root) {
    host.append(el("div", { class: "card" }, [
      el("div", { class: "card__title" }, [el("span", { text: "Tổng tài sản ròng" }), el("span", { class: "amount amount--in", text: fmtMoney(netWorth()) })]),
    ]));

    const grid = el("div", { class: "grid grid--2", style: "margin-top:16px" });
    F().accounts.forEach((a) => {
      const bal = accountBalance(a.id);
      const edit = el("button", { class: "icon-btn", text: "✏️", style: "color:var(--muted)", onClick: () => openAccountModal(a, root) });
      const del = el("button", { class: "icon-btn", text: "🗑️" });
      del.addEventListener("click", () => {
        const used = F().tx.some((t) => t.accountId === a.id || t.toAccountId === a.id);
        if (used) return U.toast("Tài khoản đang có giao dịch, không thể xóa", "err");
        if (F().accounts.length <= 1) return U.toast("Phải còn ít nhất 1 tài khoản", "err");
        if (!confirm(`Xóa tài khoản "${a.name}"?`)) return;
        Store.update((d) => (d.finance.accounts = d.finance.accounts.filter((x) => x.id !== a.id)));
        render(root);
      });
      grid.append(el("div", { class: "fin-acc" }, [
        el("span", { class: "fin-acc__icon", text: a.icon }),
        el("div", { style: "flex:1" }, [el("div", { class: "fin-acc__name", text: a.name }), el("div", { class: "amount " + (bal >= 0 ? "amount--in" : "amount--out"), text: fmtMoney(bal) })]),
        edit, del,
      ]));
    });
    host.append(grid);

    // Thêm tài khoản
    const name = el("input", { class: "input", placeholder: "Tên tài khoản (vd: Vietcombank)" });
    const icon = el("select", { class: "select", style: "max-width:90px;flex:0 0 90px" }, ICONS.map((i) => el("option", { value: i, text: i })));
    const init = el("input", { class: "input", type: "number", step: "any", placeholder: "Số dư ban đầu" });
    const add = el("button", { class: "btn", text: "Thêm" });
    add.addEventListener("click", () => {
      if (!name.value.trim()) return;
      Store.update((d) => d.finance.accounts.push({ id: U.uid(), name: name.value.trim(), icon: icon.value, type: "other", initial: parseAmount(init.value), createdAt: Date.now() }));
      App.log("finance_account", "Thêm tài khoản: " + name.value.trim());
      render(root);
    });
    host.append(el("div", { class: "card", style: "margin-top:16px" }, [
      el("div", { class: "card__title", text: "Thêm tài khoản / ví" }),
      el("div", { class: "row" }, [name, icon, init, el("div", { style: "flex:0 0 auto" }, [add])]),
    ]));
  }

  function openAccountModal(a, root) {
    const name = el("input", { class: "input", value: a.name });
    const icon = el("select", { class: "select" }, ICONS.map((i) => el("option", { value: i, text: i, selected: i === a.icon })));
    icon.value = a.icon;
    const init = el("input", { class: "input", type: "number", step: "any", value: a.initial });
    const save = el("button", { class: "btn", text: "Lưu" });
    const body = el("div", {}, [f("Tên", name), el("div", { class: "row", style: "margin-top:10px" }, [f("Biểu tượng", icon), f("Số dư ban đầu", init)]), el("div", { style: "margin-top:14px" }, [save])]);
    const m = U.modal({ title: "Sửa tài khoản", body });
    save.addEventListener("click", () => {
      if (!name.value.trim()) return;
      Store.update((d) => { const x = d.finance.accounts.find((q) => q.id === a.id); if (x) { x.name = name.value.trim(); x.icon = icon.value; x.initial = parseAmount(init.value); } });
      App.log("finance_account", "Sửa tài khoản: " + name.value.trim());
      m.close(); render(root);
    });
  }

  // ===================== SAVINGS =====================
  function renderSavings(host, root) {
    const savings = F().savings;
    if (savings.length === 0) host.append(el("p", { class: "empty", text: "Chưa có mục tiêu tiết kiệm nào." }));
    const grid = el("div", { class: "grid grid--2" });
    savings.forEach((s) => {
      const pct = s.target ? Math.min(100, Math.round((s.saved / s.target) * 100)) : 0;
      const add = el("button", { class: "btn btn--sm", text: "＋ Nạp" });
      add.addEventListener("click", () => {
        const v = parseAmount(prompt("Số tiền nạp vào '" + s.name + "':", ""));
        if (v <= 0) return;
        Store.update((d) => { const x = d.finance.savings.find((q) => q.id === s.id); if (x) x.saved += v; });
        App.log("finance_saving", `Nạp ${fmtMoney(v)} vào ${s.name}`);
        render(root);
      });
      const sub = el("button", { class: "btn btn--sm btn--ghost", text: "－ Rút" });
      sub.addEventListener("click", () => {
        const v = parseAmount(prompt("Số tiền rút khỏi '" + s.name + "':", ""));
        if (v <= 0) return;
        Store.update((d) => { const x = d.finance.savings.find((q) => q.id === s.id); if (x) x.saved = Math.max(0, x.saved - v); });
        render(root);
      });
      const del = el("button", { class: "icon-btn", text: "🗑️", onClick: () => { if (confirm("Xóa mục tiêu này?")) { Store.update((d) => (d.finance.savings = d.finance.savings.filter((q) => q.id !== s.id))); render(root); } } });
      grid.append(el("div", { class: "card" }, [
        el("div", { class: "card__title" }, [el("span", { text: s.icon + " " + s.name }), del]),
        el("div", { class: "amount", style: "margin-bottom:6px", text: fmtMoney(s.saved) + " / " + fmtMoney(s.target) }),
        el("div", { class: "progress" }, [el("div", { class: "progress__bar", style: "width:" + pct + "%;background:var(--success)" })]),
        el("p", { class: "stat__sub", style: "margin-top:6px", text: pct + "%" + (s.deadline ? " · hạn " + U.fmtVN(s.deadline) : "") }),
        el("div", { class: "row", style: "margin-top:10px" }, [el("div", { style: "flex:0 0 auto" }, [add]), el("div", { style: "flex:0 0 auto" }, [sub])]),
      ]));
    });
    host.append(grid);

    // Thêm mục tiêu
    const name = el("input", { class: "input", placeholder: "Tên (vd: Mua laptop)" });
    const icon = el("select", { class: "select", style: "max-width:90px;flex:0 0 90px" }, ICONS.map((i) => el("option", { value: i, text: i })));
    icon.value = "🐷";
    const target = el("input", { class: "input", type: "number", step: "any", placeholder: "Mục tiêu (số tiền)" });
    const deadline = el("input", { class: "input", type: "date" });
    const add = el("button", { class: "btn", text: "Thêm" });
    add.addEventListener("click", () => {
      if (!name.value.trim() || parseAmount(target.value) <= 0) return U.toast("Nhập tên & số tiền mục tiêu", "err");
      Store.update((d) => d.finance.savings.push({ id: U.uid(), name: name.value.trim(), icon: icon.value, target: parseAmount(target.value), saved: 0, deadline: deadline.value || null, createdAt: Date.now() }));
      App.log("finance_saving", "Thêm mục tiêu tiết kiệm: " + name.value.trim());
      render(root);
    });
    host.append(el("div", { class: "card", style: "margin-top:16px" }, [
      el("div", { class: "card__title", text: "Thêm mục tiêu tiết kiệm" }),
      el("div", { class: "row" }, [name, icon]),
      el("div", { class: "row", style: "margin-top:10px" }, [target, deadline, el("div", { style: "flex:0 0 auto" }, [add])]),
    ]));
  }

  // ===================== helpers =====================
  function tile(icon, label, value, cls) {
    return el("div", { class: "stat" }, [
      el("div", { class: "stat__label" }, [el("span", { text: icon }), el("span", { text: label })]),
      el("div", { class: "stat__value amount--" + (cls || "neutral"), text: value, style: "font-size:1.4rem" }),
    ]);
  }
  function f(label, control) {
    return el("div", { class: "field", style: "margin:0;flex:1" }, [el("label", { text: label }), control]);
  }

  window.Views = window.Views || {};
  window.Views.finance = { render };
})();
