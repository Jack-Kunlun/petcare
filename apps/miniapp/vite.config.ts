import Uni from "@uni-helper/plugin-uni";
import UniHelperComponents from "@uni-helper/vite-plugin-uni-components";
import UniHelperManifest from "@uni-helper/vite-plugin-uni-manifest";
import UniHelperPages from "@uni-helper/vite-plugin-uni-pages";
import UnoCSS from "unocss/vite";
import AutoImport from "unplugin-auto-import/vite";
import { defineConfig } from "vite";
import { WotResolver } from "./src/resolver";

export default defineConfig({
  base: "./",
  plugins: [
    UniHelperManifest(),
    UniHelperPages({
      dts: "src/uni-pages.d.ts",
    }),
    UniHelperComponents({
      resolvers: [WotResolver()],
      dts: "src/components.d.ts",
    }),
    UnoCSS({
      mode: "per-module",
    }),
    Uni(),
    AutoImport({
      imports: ["vue", "uni-app"],
      dts: "src/auto-imports.d.ts",
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
