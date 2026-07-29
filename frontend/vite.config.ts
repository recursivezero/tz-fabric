import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendTarget = (
  process.env.VITE_API_PROXY_TARGET ||
  'http://localhost:8002'
).replace(/\/$/, '');


// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/v1": {
        target: backendTarget,
        changeOrigin: true
      },
      "/static": {
        target: backendTarget,
        changeOrigin: true
      },
      "/assets/images": {
        target: backendTarget,
        changeOrigin: true
      },
      "/assets/audios": {
        target: backendTarget,
        changeOrigin: true
      }
    }
  },
  esbuild: {
    // Keep diagnostics during development, but do not leak chat/API payloads
    // or debugger statements in production bundles.
    drop: ["console", "debugger"],
  },
  build: {
    chunkSizeWarningLimit: 500,
  },
  preview: {
    allowedHosts: ["pro.threadzip.com"],
    host: true
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@assets": path.resolve(__dirname, "src/assets")
    }
  }
});
