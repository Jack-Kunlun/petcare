import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { checkAdminOutput, checkMiniappOutput } from "./style-output-policy.mjs";

const outputRoots = [];

after(async () => {
  await Promise.all(outputRoots.map((root) => rm(root, { recursive: true, force: true })));
});

async function createOutput(files) {
  const root = await mkdtemp(path.join(tmpdir(), "petcare-style-output-"));
  outputRoots.push(root);

  for (const [relativePath, source] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, source, "utf8");
  }

  return root;
}

test("Miniapp 接受纯 px WXSS", async () => {
  const root = await createOutput({
    "app.wxss": "page{font-size:14px}.h-mm{height:20px}",
    "app.js": "App({})",
    "pages/index/index.wxss": ".w-action{width:240px;border-radius:12px}",
  });

  assert.deepEqual(await checkMiniappOutput(root), []);
});

test("Miniapp 拒绝 rpx、非法选择器和运行时 process", async () => {
  const root = await createOutput({
    "app.wxss": String.raw`.h-\[20px\]{height:20rpx}*{box-sizing:border-box}`,
    "app.js": "process.env.NODE_ENV",
  });

  const violations = await checkMiniappOutput(root);

  assert.ok(violations.some((item) => item.includes("rpx")));
  assert.ok(violations.some((item) => item.includes("转义")));
  assert.ok(violations.some((item) => item.includes("process")));
  assert.ok(violations.some((item) => item.includes("通用选择器")));
});

test("Miniapp 拒绝 NaN 构建产物和缺失的关键 px 声明", async () => {
  const root = await createOutput({
    "app.wxss": "page{font-size:14px}",
    "app.js": "const size = NaN",
  });

  const violations = await checkMiniappOutput(root);

  assert.ok(violations.some((item) => item.includes("NaN")));
  assert.ok(violations.some((item) => item.includes("width:240px")));
  assert.ok(violations.some((item) => item.includes("border-radius:12px")));
});

test("Admin 接受 14px 基线并拒绝 rem", async () => {
  const validRoot = await createOutput({
    "assets/index.css": "html{font-size:14px}.p-6{padding:24px}",
  });
  const invalidRoot = await createOutput({
    "assets/index.css": "html{font-size:.875rem}",
  });

  assert.deepEqual(await checkAdminOutput(validRoot), []);
  assert.ok((await checkAdminOutput(invalidRoot)).some((item) => item.includes("rem")));
});
