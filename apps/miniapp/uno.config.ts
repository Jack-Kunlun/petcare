/*
 * @Author: weisheng
 * @Date: 2025-11-25 19:57:54
 * @LastEditTime: 2026-04-13 18:44:19
 * @LastEditors: weisheng
 * @Description:
 * @FilePath: /wot-starter/uno.config.ts
 * 记得注释
 */
import { presetUni } from "@uni-helper/unocss-preset-uni";
import { presetWot } from "@wot-ui/unocss-preset";
import { defineConfig, transformerDirectives, transformerVariantGroup } from "unocss";
import { miniappDesignTokens } from "./src/config/design-tokens";

export default defineConfig({
  presets: [
    presetUni({
      attributify: false,
      remRpx: false,
    }),
    presetWot({
      preflight: false,
    }),
  ],
  theme: {
    colors: miniappDesignTokens.colors,
    spacing: miniappDesignTokens.spacing,
    width: miniappDesignTokens.sizes,
    height: miniappDesignTokens.sizes,
    borderRadius: miniappDesignTokens.radii,
    fontSize: miniappDesignTokens.fontSizes,
    lineHeight: miniappDesignTokens.lineHeights,
  },
  transformers: [transformerDirectives(), transformerVariantGroup()],
});
