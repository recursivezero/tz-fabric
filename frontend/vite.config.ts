import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_URL = `${process.env.VITE_API_URL}:${process.env.VITE_API_PORT}`;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/v1": {
        target: TARGET_URL,
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 2000
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
