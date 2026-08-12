import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

test("clean:modules 删除根目录和所有 workspace 的 node_modules", async () => {
  const root = await mkdtemp(join(tmpdir(), "petcare-clean-modules-"));
  const moduleDirectories = [
    join(root, "node_modules"),
    join(root, "apps", "admin", "node_modules"),
    join(root, "packages", "shared-types", "node_modules"),
  ];
  const sourceDirectory = join(root, "apps", "admin", "src");

  for (const directory of [...moduleDirectories, sourceDirectory]) {
    await mkdir(directory, { recursive: true });
  }

  const result = spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, "clean.mjs"), "--modules"],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  for (const directory of moduleDirectories) {
    await assert.rejects(access(directory));
  }
  await access(sourceDirectory);
  await rm(root, { recursive: true, force: true });
});
