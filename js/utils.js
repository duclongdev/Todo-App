// utils.js — helper dùng chung, expose qua window.U
(function () {
  const pad = (n) => String(n).padStart(2, "0");

  /** Tạo DOM element gọn gàng: el('div', {class:'x', onClick:fn}, [children]) */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k === "dataset") Object.assign(node.dataset, v);
        else if (k.startsWith("on") && typeof v === "function")
          node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v === true ? "" : v);
      }
    }
    if (children != null) {
      const arr = Array.isArray(children) ? children : [children];
      for (const c of arr) {
        if (c == null || c === false) continue;
        node.append(c.nodeType ? c : document.createTextNode(String(c)));
      }
    }
    return node;
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---- Date helpers ----
  const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => toKey(new Date());
  function parseKey(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  function lastNDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(toKey(addDays(new Date(), -i)));
    return out;
  }
  function startOfWeek(d) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // Mon = 0
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  const dayKey = (d = new Date()) => "D:" + toKey(d);
  const weekKey = (d = new Date()) => "W:" + toKey(startOfWeek(d));
  const monthKey = (d = new Date()) => "M:" + d.getFullYear() + "-" + pad(d.getMonth() + 1);
  const yearKey = (d = new Date()) => "Y:" + d.getFullYear();

  function fmtVN(s) {
    return parseKey(s).toLocaleDateString("vi-VN", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
    });
  }
  function fmtFull(d = new Date()) {
    return d.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  function fmtMinutes(min) {
    min = Math.round(min);
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h && m) return `${h}h ${m}p`;
    if (h) return `${h}h`;
    return `${m}p`;
  }
  /** Khoảng cách phút giữa 2 giờ "HH:MM", xử lý qua đêm */
  function minutesBetween(start, end) {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let diff = eh * 60 + em - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    return diff;
  }

  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function periodLabel(scope) {
    const now = new Date();
    if (scope === "day") return "Hôm nay · " + fmtFull(now);
    if (scope === "week") {
      const s = startOfWeek(now);
      const e = addDays(s, 6);
      return `Tuần này · ${toKey(s).slice(5)} → ${toKey(e).slice(5)}`;
    }
    if (scope === "month")
      return "Tháng " + (now.getMonth() + 1) + "/" + now.getFullYear();
    return "Năm " + now.getFullYear();
  }
  function periodKey(scope) {
    if (scope === "day") return dayKey();
    if (scope === "week") return weekKey();
    if (scope === "month") return monthKey();
    return yearKey();
  }

  // ---- Toast ----
  function toast(msg, type = "ok") {
    const wrap = $("#toast-wrap");
    if (!wrap) return;
    const t = el("div", { class: "toast toast--" + type, text: msg });
    wrap.append(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, 2600);
  }

  // 7 ngày của tuần (Thứ 2 -> CN) theo offset tuần (0 = tuần này)
  function weekDays(offset = 0) {
    const start = startOfWeek(addDays(new Date(), offset * 7));
    const out = [];
    for (let i = 0; i < 7; i++) out.push(toKey(addDays(start, i)));
    return out;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function placeCaretEnd(node) {
    if (!node) return;
    node.focus();
    try {
      const r = document.createRange();
      r.selectNodeContents(node);
      r.collapse(false);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch (_) {}
  }

  // Modal popup dùng chung
  function modal(opts) {
    opts = opts || {};
    const overlay = el("div", { class: "modal-overlay" });
    const box = el("div", { class: "modal" });
    if (opts.width) box.style.maxWidth = opts.width;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const close = () => {
      overlay.classList.remove("show");
      document.removeEventListener("keydown", onKey);
      setTimeout(() => overlay.remove(), 180);
      opts.onClose && opts.onClose();
    };
    const closeBtn = el("button", { class: "icon-btn", text: "✕", onClick: close, style: "font-size:1.1rem" });
    box.append(el("div", { class: "modal__head" }, [el("h3", { class: "modal__title", text: opts.title || "" }), closeBtn]));
    const content = el("div", { class: "modal__body" });
    if (opts.body) content.append(opts.body);
    box.append(content);
    overlay.append(box);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));
    return { close, body: content, box };
  }

  window.U = {
    el, $, $$, toKey, today, parseKey, addDays, lastNDays, startOfWeek,
    dayKey, weekKey, monthKey, yearKey, fmtVN, fmtFull, fmtMinutes,
    minutesBetween, uid, periodLabel, periodKey, toast, pad,
    weekDays, escapeHtml, placeCaretEnd, modal,
  };
})();
