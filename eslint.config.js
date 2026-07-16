import baseConfig from "@petcare/eslint-config-base";

/**
 * 根目录ESLint配置
 * 用于检查根目录的配置文件（turbo.json、pnpm-workspace.yaml等）
 */
export default [
  ...baseConfig,
  {
    ignores: [
      "node_modules",
      "dist",
      "build",
      ".next",
      "coverage",
      "*.min.js",
      "apps",
      "packages",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      "no-console": "off",
    },
  },
];
