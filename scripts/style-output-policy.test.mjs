import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { checkAdminOutput } from "./style-output-policy.mjs";

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
