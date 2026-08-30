import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import Uni from "@uni-helper/plugin-uni";
import UniHelperComponents from "@uni-helper/vite-plugin-uni-components";
import UniHelperManifest from "@uni-helper/vite-plugin-uni-manifest";
import UniHelperPages from "@uni-helper/vite-plugin-uni-pages";
import UnoCSS from "unocss/vite";
import AutoImport from "unplugin-auto-import/vite";
import { defineConfig, loadEnv } from "vite";
import { createMiniappPagesConfig, removeGeneratedSubPackage } from "./pages.config";
import { WotResolver } from "./src/resolver";

function removeSubPackage(pagesJsonPath: string, root: string): void {
  const source = readFileSync(pagesJsonPath, "utf8");
  const next = removeGeneratedSubPackage(source, root);

  if (next !== source) {
    writeFileSync(pagesJsonPath, next, "utf8");
  }
}

export default defineConfig(({ mode }) => {
  const e2e = Boolean(process.env.ADMIN_E2E_MINIAPP_URL);
  const environment = loadEnv(mode, import.meta.dirname, "VITE_");
  const commercialServicesEnabled =
    (process.env.VITE_COMMERCIAL_SERVICES_ENABLED ?? environment.VITE_COMMERCIAL_SERVICES_ENABLED)
      ?.trim()
      .toLowerCase() === "true";
  const pagesOutDir = e2e ? process.env.ADMIN_E2E_MINIAPP_VITE_CACHE_DIR : "src";

  return {
    base: "./",
    cacheDir: process.env.ADMIN_E2E_MINIAPP_VITE_CACHE_DIR || "node_modules/.vite",
    plugins: [
      ...(e2e ? [] : [UniHelperManifest()]),
      UniHelperPages({
        dts: e2e ? false : "src/uni-pages.d.ts",
        outDir: pagesOutDir,
        onBeforeLoadUserConfig(context) {
          if (!commercialServicesEnabled) {
            removeSubPackage(context.resolvedPagesJSONPath, "pages-bounty");
          }
        },
        onAfterLoadUserConfig(context) {
          context.pagesGlobConfig = createMiniappPagesConfig(commercialServicesEnabled);
        },
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
  };
});
