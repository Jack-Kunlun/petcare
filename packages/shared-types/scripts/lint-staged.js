#!/usr/bin/env node
// packages/shared-types/scripts/lint-staged.js
// 包装脚本：忽略lint-staged传递的文件参数，直接对整个项目执行eslint

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

try {
  execSync("eslint . --fix", {
    cwd: projectRoot,
    stdio: "inherit"
  });
} catch (error) {
  // eslint-disable-next-line no-undef
  process.exit(error.status || 1);
}
