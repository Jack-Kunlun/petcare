import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import eslintPluginImport from "eslint-plugin-import";

const pluginImplementations = {
  "@typescript-eslint": tseslint.plugin,
  unicorn: eslintPluginUnicorn,
  import: eslintPluginImport,
};

const baseRules = {
  // ===== 基础规则 =====
  "no-await-in-loop": "error",
  "no-empty-function": "error",
  "no-useless-catch": "error",
  "no-var": "error",
  "no-console": "error",
  "no-debugger": "error",
  "arrow-body-style": "off",
  "prefer-arrow-callback": "off",
  semi: ["error", "always"],
  quotes: ["error", "double"],
  eqeqeq: ["error", "always"],
  "object-shorthand": ["error", "always"],
  "no-sequences": ["error", { allowInParentheses: false }],
  "prefer-template": "error",
  curly: "error",

  // ===== 代码格式 =====
  "padding-line-between-statements": [
    "error",
    {
      blankLine: "always",
      prev: ["function", "class", "const", "let", "var", "block-like"],
      next: "*",
    },
    { blankLine: "always", prev: "*", next: ["return", "block-like"] },
    { blankLine: "any", prev: ["const", "let", "var"], next: ["const", "let", "var"] },
  ],
  "padded-blocks": ["error", "never"],

  // ===== TypeScript规则 =====
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      args: "all",
      argsIgnorePattern: "^_",
      caughtErrors: "all",
      caughtErrorsIgnorePattern: "^_",
      destructuredArrayIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      ignoreRestSiblings: true,
    },
  ],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/explicit-function-return-type": "off",

  // ===== Unicorn规则 =====
  "unicorn/no-for-loop": "error",
  "unicorn/consistent-function-scoping": "error",
  "unicorn/explicit-length-check": "error",
  "unicorn/prefer-array-find": "error",
  "unicorn/prefer-includes": "error",
  "unicorn/prefer-string-slice": "error",
  "unicorn/consistent-destructuring": "error",
  "unicorn/no-nested-ternary": "error",

  // ===== Import规则 =====
  "import/order": [
    "error",
    {
      groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
      pathGroups: [{ pattern: "~/**", group: "internal" }],
      alphabetize: { order: "asc", caseInsensitive: true },
      "newlines-between": "never",
    },
  ],
  "import/named": "error",
  "import/no-duplicates": "error",
  "import/no-useless-path-segments": ["error", { noUselessIndex: true }],
  "import/newline-after-import": "error",
};

function rewriteRuleId(ruleId, aliases) {
  const separatorIndex = ruleId.indexOf("/");
  if (separatorIndex === -1) {
    return ruleId;
  }

  const pluginName = ruleId.slice(0, separatorIndex);
  const alias = aliases[pluginName];

  return alias === undefined ? ruleId : `${alias}${ruleId.slice(separatorIndex)}`;
}

function rewriteRules(rules, aliases) {
  return Object.fromEntries(
    Object.entries(rules).map(([ruleId, setting]) => [rewriteRuleId(ruleId, aliases), setting]),
  );
}

export function createBaseRulesConfig({
  files = ["**/*.{ts,tsx,js,jsx}"],
  pluginAliases = {},
  ruleOverrides = {},
} = {}) {
  const aliases = Object.fromEntries(
    Object.keys(pluginImplementations).map((pluginName) => [
      pluginName,
      pluginAliases[pluginName] ?? pluginName,
    ]),
  );
  const plugins = Object.fromEntries(
    Object.entries(pluginImplementations).map(([pluginName, implementation]) => [
      aliases[pluginName],
      implementation,
    ]),
  );

  return {
    files,
    plugins,
    rules: {
      ...rewriteRules(baseRules, aliases),
      ...rewriteRules(ruleOverrides, aliases),
    },
  };
}

/**
 * PetCare项目基础ESLint配置
 * 所有子项目应基于此配置进行扩展
 */
export default [
  {
    ignores: ["node_modules", "dist", "build", ".next", "coverage", "*.min.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      unicorn: pluginImplementations.unicorn,
      import: pluginImplementations.import,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: baseRules,
  },
];
