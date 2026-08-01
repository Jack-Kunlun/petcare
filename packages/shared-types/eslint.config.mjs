import baseConfig from "@petcare/eslint-config-base";

export default [
  ...baseConfig,
  {
    ignores: ["dist", "node_modules"],
  },
];
