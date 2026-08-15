import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { port: 8080 },
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ["@petcare/shared-types"],
    },
  },
});
