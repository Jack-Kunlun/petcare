import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const serverPort = Number(process.env.ADMIN_E2E_SERVER_PORT || 3000);
const adminPort = Number(process.env.ADMIN_E2E_ADMIN_PORT || 8986);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["@petcare/shared-types"],
  },
  server: {
    port: adminPort,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${serverPort}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
