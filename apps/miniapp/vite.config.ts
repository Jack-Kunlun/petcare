import process from "node:process";
import Uni from "@uni-helper/plugin-uni";
import UniHelperComponents from "@uni-helper/vite-plugin-uni-components";
import UniHelperManifest from "@uni-helper/vite-plugin-uni-manifest";
import UniHelperPages from "@uni-helper/vite-plugin-uni-pages";
import UnoCSS from "unocss/vite";
import AutoImport from "unplugin-auto-import/vite";
import { defineConfig } from "vite";
import { WotResolver } from "./src/resolver";

const e2e = Boolean(process.env.ADMIN_E2E_MINIAPP_URL);

export default defineConfig({
  base: "./",
  cacheDir: process.env.ADMIN_E2E_MINIAPP_VITE_CACHE_DIR || "node_modules/.vite",
  plugins: [
    ...(e2e ? [] : [UniHelperManifest()]),
    UniHelperPages({
      dts: e2e ? false : "src/uni-pages.d.ts",
      outDir: e2e ? process.env.ADMIN_E2E_MINIAPP_VITE_CACHE_DIR : "src",
    }),
    UniHelperComponents({
      resolvers: [WotResolver()],
      dts: e2e ? false : "src/components.d.ts",
    }),
    UnoCSS({
      mode: "per-module",
    }),
    Uni(),
    AutoImport({
      imports: ["vue", "uni-app"],
      dts: e2e ? false : "src/auto-imports.d.ts",
      vueTemplate: true,
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
        silenceDeprecations: ["legacy-js-api"],
      },
    },
  },
});
