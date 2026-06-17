// app.js — router + khởi tạo. Chạy sau cùng. Expose qua window.App
window.App = (function () {
  const { el, $ } = U;

  const ROUTES = [
    { id: "dashboard", name: "Tổng quan", icon: "🏠" },
    { id: "tasks", name: "Công việc", icon: "✅" },
    { id: "habits", name: "Thói quen", icon: "🔥" },
    { id: "goals", name: "Mục tiêu", icon: "🎯" },
    { id: "finance", name: "Tài chính", icon: "💰" },
    { id: "sleep", name: "Giấc ngủ", icon: "😴" },
    { id: "focus", name: "Tập trung", icon: "⏱️" },
    { id: "journal", name: "Nhật ký", icon: "📔" },
    { id: "notes", name: "Ghi chú", icon: "📝" },
    { id: "stats", name: "Thống kê", icon: "📊" },
    { id: "settings", name: "Cài đặt", icon: "⚙️" },
  ];

  let current = "dashboard";

  function buildNav() {
    const nav = $("#nav");
    nav.innerHTML = "";
    ROUTES.forEach((r) => {
      const btn = el("button", {
        class: "nav__item" + (r.id === current ? " is-active" : ""),
        onClick: () => go(r.id),
      }, [el("span", { class: "nav__icon", text: r.icon }), el("span", { text: r.name })]);
      nav.append(btn);
    });
  }

  function go(id) {
    if (!Views[id]) return;
    current = id;
    buildNav();
    const route = ROUTES.find((r) => r.id === id);
    $("#topbar-title").textContent = route ? route.name : "Life Hub";
    log("navigate", "Mở trang: " + (route ? route.name : id));
    const view = $("#view");
    view.innerHTML = "";
    Views[id].render(view);
    window.scrollTo(0, 0);
    if (window.innerWidth <= 820) closeSidebar();
  }

  // Vẽ lại trang hiện tại (không ghi log điều hướng) — dùng khi nạp dữ liệu từ file
  function rerender() {
    const view = $("#view");
    if (!view || !Views[current]) return;
    view.innerHTML = "";
    Views[current].render(view);
  }

  // ---- Nhật ký hoạt động ----
  function log(type, detail) {
    Store.update((d) => {
      d.activity.push({ id: U.uid(), ts: Date.now(), type, detail: detail || "" });
      if (d.activity.length > 4000) d.activity = d.activity.slice(-4000);
    });
  }

  // ---- Theme ----
  function applyTheme() {
    const theme = Store.get("settings").theme || "light";
    document.documentElement.setAttribute("data-theme", theme);
    const icon = theme === "dark" ? "☀️" : "🌙";
    $("#theme-toggle").textContent = icon;
    $("#theme-toggle-m").textContent = icon;
  }
  function toggleTheme() {
    Store.update((d) => (d.settings.theme = d.settings.theme === "dark" ? "light" : "dark"));
    applyTheme();
  }

  // ---- Sidebar (thu gọn / overlay) ----
  function toggleSidebar() {
    if (window.innerWidth <= 820) {
      const open = $("#sidebar").classList.toggle("open");
      $("#backdrop").classList.toggle("show", open);
    } else {
      $("#layout").classList.toggle("collapsed");
    }
  }
  function closeSidebar() {
    $("#sidebar").classList.remove("open");
    $("#backdrop").classList.remove("show");
  }

  // ---- Đồng hồ ----
  function startClock() {
    const c = $("#clock");
    const tick = () => {
      const now = new Date();
      const date = now.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
      const time = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      c.innerHTML = `<span class="clock__time">${time}</span><span class="clock__date">${date}</span>`;
    };
    tick();
    setInterval(tick, 1000);
  }

  function init() {
    applyTheme();
    startClock();
    buildNav();
    log("session_start", "Mở ứng dụng");
    $("#theme-toggle").addEventListener("click", toggleTheme);
    $("#theme-toggle-m").addEventListener("click", toggleTheme);
    $("#menu-btn").addEventListener("click", toggleSidebar);
    $("#backdrop").addEventListener("click", closeSidebar);
    go("dashboard");
    if (window.FileSync) FileSync.init();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();

  return { go, toggleTheme, applyTheme, log, rerender };
})();
