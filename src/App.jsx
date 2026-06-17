import { useEffect, useMemo, useState } from "react";
import { useStore } from "./store/StoreContext.jsx";
import { useFileSync } from "./lib/useFileSync.js";
import { NavContext } from "./components/NavContext.jsx";
import Clock from "./components/Clock.jsx";

import Dashboard from "./views/Dashboard.jsx";
import Tasks from "./views/Tasks.jsx";
import Habits from "./views/Habits.jsx";
import Goals from "./views/Goals.jsx";
import Finance from "./views/Finance.jsx";
import Sleep from "./views/Sleep.jsx";
import Focus from "./views/Focus.jsx";
import Journal from "./views/Journal.jsx";
import Notes from "./views/Notes.jsx";
import Stats from "./views/Stats.jsx";
import Settings from "./views/Settings.jsx";

const ROUTES = [
  { id: "dashboard", name: "Tổng quan", icon: "🏠", Component: Dashboard },
  { id: "tasks", name: "Công việc", icon: "✅", Component: Tasks },
  { id: "habits", name: "Thói quen", icon: "🔥", Component: Habits },
  { id: "goals", name: "Mục tiêu", icon: "🎯", Component: Goals },
  { id: "finance", name: "Tài chính", icon: "💰", Component: Finance },
  { id: "sleep", name: "Giấc ngủ", icon: "😴", Component: Sleep },
  { id: "focus", name: "Tập trung", icon: "⏱️", Component: Focus },
  { id: "journal", name: "Nhật ký", icon: "📔", Component: Journal },
  { id: "notes", name: "Ghi chú", icon: "📝", Component: Notes },
  { id: "stats", name: "Thống kê", icon: "📊", Component: Stats },
  { id: "settings", name: "Cài đặt", icon: "⚙️", Component: Settings },
];

export default function App() {
  const { db, update, log } = useStore();
  const fileSync = useFileSync();

  const [current, setCurrent] = useState("dashboard");
  const [intent, setIntent] = useState(null); // payload cho view đích (vd mở task)
  const [sidebarOpen, setSidebarOpen] = useState(false); // overlay trên mobile
  const [collapsed, setCollapsed] = useState(false); // thu gọn trên desktop

  const theme = db.settings.theme || "light";

  // Áp theme lên thẻ <html> — side-effect hợp lệ qua useEffect.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Ghi log mở app một lần.
  useEffect(() => {
    log("session_start", "Mở ứng dụng");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = (id, payload = null) => {
    if (!ROUTES.some((r) => r.id === id)) return;
    const route = ROUTES.find((r) => r.id === id);
    setCurrent(id);
    setIntent(payload);
    log("navigate", "Mở trang: " + route.name);
    window.scrollTo(0, 0);
    if (window.innerWidth <= 820) setSidebarOpen(false);
  };

  const toggleTheme = () =>
    update((d) => (d.settings.theme = d.settings.theme === "dark" ? "light" : "dark"));

  const toggleSidebar = () => {
    if (window.innerWidth <= 820) setSidebarOpen((o) => !o);
    else setCollapsed((c) => !c);
  };

  const route = useMemo(() => ROUTES.find((r) => r.id === current), [current]);
  const ActiveView = route.Component;
  const themeIcon = theme === "dark" ? "☀️" : "🌙";

  return (
    <NavContext.Provider value={navigate}>
      <div className={`layout${collapsed ? " collapsed" : ""}`}>
        <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="brand">
            <span className="brand__logo">🌱</span>
            <span className="brand__name">Life Hub</span>
          </div>
          <nav className="nav">
            {ROUTES.map((r) => (
              <button
                key={r.id}
                className={"nav__item" + (r.id === current ? " is-active" : "")}
                onClick={() => navigate(r.id)}
              >
                <span className="nav__icon">{r.icon}</span>
                <span>{r.name}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar__foot">
            <button className="theme-toggle" title="Đổi giao diện" onClick={toggleTheme}>
              {themeIcon}
            </button>
            <span className="build-tag" title="Phiên bản bản dựng">
              React build
            </span>
          </div>
        </aside>

        <div className="content">
          <header className="topbar">
            <button
              className="topbar__menu"
              aria-label="Thu gọn menu"
              title="Thu gọn / mở menu"
              onClick={toggleSidebar}
            >
              ☰
            </button>
            <span className="topbar__title">{route.name}</span>
            <div className="topbar__right">
              <Clock />
              <button className="theme-toggle" title="Đổi giao diện" onClick={toggleTheme}>
                {themeIcon}
              </button>
            </div>
          </header>

          <main className="main">
            <ActiveView intent={intent} fileSync={fileSync} toggleTheme={toggleTheme} />
          </main>
        </div>
      </div>

      <div
        className={`backdrop${sidebarOpen ? " show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
    </NavContext.Provider>
  );
}
