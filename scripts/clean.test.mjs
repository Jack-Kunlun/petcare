import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { cleanPaths } from "./clean.mjs";

test("只删除工作目录内明确列出的路径", async () => {
  const root = await mkdtemp(join(tmpdir(), "petcare-clean-"));
  const target = join(root, "dist");
  const keep = join(root, "src");

  await mkdir(target);
  await mkdir(keep);
  await writeFile(join(target, "artifact.js"), "generated");
  await writeFile(join(keep, "index.ts"), "source");

  await cleanPaths(root, ["dist"]);

  await assert.rejects(access(target));
  await access(keep);
  await rm(root, { recursive: true, force: true });
});

test("拒绝绝对路径、父目录和当前目录", async () => {
  await assert.rejects(cleanPaths(process.cwd(), [process.cwd()]), /relative child path/);
  await assert.rejects(cleanPaths(process.cwd(), ["../outside"]), /relative child path/);
  await assert.rejects(cleanPaths(process.cwd(), ["."]), /relative child path/);
});
