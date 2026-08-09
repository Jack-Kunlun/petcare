import { createBaseRulesConfig } from "@petcare/eslint-config-base";
import uni from "@uni-helper/eslint-config";

const petcareRules = createBaseRulesConfig({
  files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue}"],
  pluginAliases: {
    "@typescript-eslint": "petcare-ts",
    unicorn: "petcare-unicorn",
    import: "petcare-import",
  },
  ruleOverrides: {
    // Official starter demos intentionally log CI, router, request, and theme behavior.
    "no-console": "off",
    // UniApp virtual modules and conditional exports cannot be resolved reliably by static analysis.
    "import/named": "off",
  },
});

export default uni(
  {
    unocss: true,
    // Root Prettier and PetCare rules are the sole formatting authority.
    stylistic: false,
    rules: {
      "eslint-comments/no-unlimited-disable": "off",
    },
    ignores: [
      "src/uni_modules/**/*",
      "src/auto-imports.d.ts",
      "src/components.d.ts",
      "src/uni-pages.d.ts",
      "docs/.vitepress/dist",
      "docs/.vitepress/cache",
      "**/*.md",
    ],
  },
  petcareRules,
);
