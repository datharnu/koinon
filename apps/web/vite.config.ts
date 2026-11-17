import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const coordinator = process.env.KOINON_COORDINATOR ?? "http://127.0.0.1:8787";
const relay = process.env.KOINON_RELAY ?? "ws://127.0.0.1:8080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { global: "globalThis" },
  server: {
    port: 5173,
    proxy: {
      "/v1": { target: coordinator, changeOrigin: true },
      "/relay": { target: relay, ws: true, rewrite: () => "/" },
    },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
});
