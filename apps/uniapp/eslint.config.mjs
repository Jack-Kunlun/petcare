import { createBaseRulesConfig } from "@petcare/eslint-config-base";
import uni from "@uni-helper/eslint-config";

const vuePrettierCompatibility = {
  // Synced from eslint-plugin-vue 10.10.0 no-layout-rules; root Prettier owns Vue formatting.
  files: ["**/*.vue"],
  rules: {
    quotes: "off",
    "vue/array-bracket-newline": "off",
    "vue/array-bracket-spacing": "off",
    "vue/array-element-newline": "off",
    "vue/arrow-spacing": "off",
    "vue/block-spacing": "off",
    "vue/block-tag-newline": "off",
    "vue/brace-style": "off",
    "vue/comma-dangle": "off",
    "vue/comma-spacing": "off",
    "vue/comma-style": "off",
    "vue/define-macros-order": "off",
    "vue/dot-location": "off",
    "vue/first-attribute-linebreak": "off",
    "vue/func-call-spacing": "off",
    "vue/html-closing-bracket-newline": "off",
    "vue/html-closing-bracket-spacing": "off",
    "vue/html-comment-content-newline": "off",
    "vue/html-comment-content-spacing": "off",
    "vue/html-comment-indent": "off",
    "vue/html-indent": "off",
    "vue/html-quotes": "off",
    "vue/html-self-closing": "off",
    "vue/key-spacing": "off",
    "vue/keyword-spacing": "off",
    "vue/max-attributes-per-line": "off",
    "vue/max-len": "off",
    "vue/multiline-html-element-content-newline": "off",
    "vue/multiline-ternary": "off",
    "vue/mustache-interpolation-spacing": "off",
    "vue/new-line-between-multi-line-property": "off",
    "vue/no-extra-parens": "off",
    "vue/no-multi-spaces": "off",
    "vue/no-spaces-around-equal-signs-in-attribute": "off",
    "vue/object-curly-newline": "off",
    "vue/object-curly-spacing": "off",
    "vue/object-property-newline": "off",
    "vue/operator-linebreak": "off",
    "vue/padding-line-between-blocks": "off",
    "vue/padding-line-between-tags": "off",
    "vue/padding-lines-in-component-definition": "off",
    "vue/quote-props": "off",
    "vue/script-indent": "off",
    "vue/singleline-html-element-content-newline": "off",
    "vue/space-in-parens": "off",
    "vue/space-infix-ops": "off",
    "vue/space-unary-ops": "off",
    "vue/template-curly-spacing": "off",
    "vue/v-for-delimiter-style": "off",
  },
};

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
      // PetCare import/order remains the sole import ordering authority.
      "perfectionist/sort-imports": "off",
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
  vuePrettierCompatibility,
);
