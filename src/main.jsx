import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { StoreProvider } from "./store/StoreContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";

// CSS toàn cục được import ngay tại entry point — Vite sẽ bundle & inject.
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ToastProvider>
  </React.StrictMode>
);
