// utils.js — helper thuần (date, format, id). KHÔNG thao tác DOM.
// Phần dựng DOM (el/$, modal, toast) của bản gốc đã được thay bằng JSX + React.

export const pad = (n) => String(n).padStart(2, "0");

// ---- Date helpers ----
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toKey(new Date());

export function parseKey(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function lastNDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(toKey(addDays(new Date(), -i)));
  return out;
}
export function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export const dayKey = (d = new Date()) => "D:" + toKey(d);
export const weekKey = (d = new Date()) => "W:" + toKey(startOfWeek(d));
export const monthKey = (d = new Date()) => "M:" + d.getFullYear() + "-" + pad(d.getMonth() + 1);
export const yearKey = (d = new Date()) => "Y:" + d.getFullYear();

export function fmtVN(s) {
  return parseKey(s).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}
export function fmtFull(d = new Date()) {
  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
export function fmtMinutes(min) {
  min = Math.round(min);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}p`;
  if (h) return `${h}h`;
  return `${m}p`;
}

/** Khoảng cách phút giữa 2 giờ "HH:MM", xử lý qua đêm */
export function minutesBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function periodLabel(scope) {
  const now = new Date();
  if (scope === "day") return "Hôm nay · " + fmtFull(now);
  if (scope === "week") {
    const s = startOfWeek(now);
    const e = addDays(s, 6);
    return `Tuần này · ${toKey(s).slice(5)} → ${toKey(e).slice(5)}`;
  }
  if (scope === "month") return "Tháng " + (now.getMonth() + 1) + "/" + now.getFullYear();
  return "Năm " + now.getFullYear();
}
export function periodKey(scope) {
  if (scope === "day") return dayKey();
  if (scope === "week") return weekKey();
  if (scope === "month") return monthKey();
  return yearKey();
}

// ---- Tiền tệ ----
export function formatMoney(n, currency = "₫") {
  const neg = n < 0;
  const v = Math.abs(n);
  const s =
    currency === "₫"
      ? Math.round(v).toLocaleString("vi-VN") + " ₫"
      : currency + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (neg ? "−" : "") + s;
}

export function parseAmount(str) {
  const n = parseFloat(String(str).replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

// 7 ngày của tuần (Thứ 2 -> CN) theo offset tuần (0 = tuần này)
export function weekDays(offset = 0) {
  const start = startOfWeek(addDays(new Date(), offset * 7));
  const out = [];
  for (let i = 0; i < 7; i++) out.push(toKey(addDays(start, i)));
  return out;
}
