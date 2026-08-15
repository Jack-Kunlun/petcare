import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

async function readManifest(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

test("非 Miniapp 工具链依赖族保持一致", async () => {
  const root = await readManifest("package.json");
  const admin = await readManifest("apps/admin/package.json");
  const server = await readManifest("apps/server/package.json");

  assert.equal(root.devDependencies["@eslint/js"], root.devDependencies.eslint);
  assert.equal(root.devDependencies.eslint, "9.39.5");
  assert.equal(admin.devDependencies.eslint, root.devDependencies.eslint);
  assert.equal(server.devDependencies.eslint, root.devDependencies.eslint);

  const typescriptEslint = root.devDependencies["typescript-eslint"];
  assert.equal(typescriptEslint, "8.66.0");
  for (const manifest of [admin, server]) {
    assert.equal(manifest.devDependencies["@typescript-eslint/eslint-plugin"], typescriptEslint);
    assert.equal(manifest.devDependencies["@typescript-eslint/parser"], typescriptEslint);
  }
  assert.equal(admin.devDependencies["typescript-eslint"], typescriptEslint);
});

test("Admin React 依赖族保持一致", async () => {
  const admin = await readManifest("apps/admin/package.json");

  assert.equal(admin.dependencies.react, admin.dependencies["react-dom"]);
  assert.equal(admin.dependencies.react, "19.2.8");
  assert.equal(admin.devDependencies["@types/react"], "19.2.18");
  assert.equal(admin.devDependencies["@types/react-dom"], "19.2.4");
});

test("Server Prisma 依赖族保持一致", async () => {
  const server = await readManifest("apps/server/package.json");

  assert.equal(server.dependencies["@prisma/client"], server.dependencies["@prisma/adapter-pg"]);
  assert.equal(server.devDependencies.prisma, server.dependencies["@prisma/client"]);
  assert.equal(server.devDependencies.prisma, "7.9.1");
});
