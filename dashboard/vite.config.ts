import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies to the bot so the dashboard can be worked on with
// hot reload while the real API answers on https://127.0.0.1:3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "https://127.0.0.1:3000", changeOrigin: true, secure: false },
      "/ws": { target: "wss://127.0.0.1:3000", ws: true, secure: false },
      // Without this the overlay preview falls back to the SPA shell, and its
      // event stream comes back as HTML.
      "/overlay": { target: "https://127.0.0.1:3000", changeOrigin: true, secure: false },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Charts are the heaviest dependency and only the overview needs them;
        // splitting keeps the rest of the bundle cacheable across releases.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
});
