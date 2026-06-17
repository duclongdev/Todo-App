import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Cấu hình Vite + React cho Life Hub.
export default defineConfig({
  plugins: [react()],
  server: { open: true },
});
