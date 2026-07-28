import baseConfig from "@petcare/eslint-config-base";

export default [
  ...baseConfig,
  {
    ignores: ["dist", "node_modules", "test"],
  },
  {
    files: ["**/*.ts"],
    rules: {
      // Server特定规则扩展
    },
  },
];
