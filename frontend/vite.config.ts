import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/v1": {
        target: process.env.VITE_API_URL,
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
