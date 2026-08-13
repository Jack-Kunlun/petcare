import baseConfig from "@petcare/eslint-config-base";
import astro from "eslint-plugin-astro";

export default [
  ...baseConfig,
  {
    ignores: ["dist", "node_modules", ".astro", "coverage"],
  },
  ...astro.configs.recommended,
];
