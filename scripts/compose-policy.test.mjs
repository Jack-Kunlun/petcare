import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("生产 Compose 要求显式敏感值且禁用开发短信码", async () => {
  const compose = await readFile(resolve(root, "docker-compose.yml"), "utf8");

  for (const name of [
    "DB_PASSWORD",
    "REDIS_PASSWORD",
    "JWT_SECRET",
    "DEFAULT_ADMIN_PHONE",
    "DEFAULT_ADMIN_PASSWORD",
  ]) {
    assert.match(compose, new RegExp(`\\$\\{${name}:\\?`), `${name} 必须使用 Compose 必填表达式`);
  }

  assert.match(compose, /SMS_DEV_CODE:\s*""/);
  assert.doesNotMatch(compose, /\$\{DB_PASSWORD:-password\}/);
  assert.doesNotMatch(compose, /ChangeMeToStrongPassword/);
  assert.doesNotMatch(compose, /change-this-to-a-random-secret/);
});

test("环境模板指向根目录 .env", async () => {
  const example = await readFile(resolve(root, ".env.example"), "utf8");

  assert.match(example, /复制此文件为根目录 `.env`/);
  assert.doesNotMatch(example, /复制此文件为 `.env\.local`/);
});

test("Server 运行镜像保留 Prisma seed 所需源码", async () => {
  const dockerfile = await readFile(resolve(root, "Dockerfile.server"), "utf8");

  assert.match(
    dockerfile,
    /COPY --from=server-builder \/app\/apps\/server\/src \.\/apps\/server\/src/,
  );
});

test("Admin 构建镜像保留样式产物校验脚本", async () => {
  const dockerfile = await readFile(resolve(root, "Dockerfile.admin"), "utf8");

  assert.match(
    dockerfile,
    /COPY scripts\/style-output-policy\.mjs \.\/scripts\/style-output-policy\.mjs/,
  );
});

test("Server 构建镜像在编译应用前构建共享类型", async () => {
  const dockerfile = await readFile(resolve(root, "Dockerfile.server"), "utf8");
  const sharedTypesBuild = dockerfile.indexOf("RUN pnpm --filter @petcare/shared-types build");
  const serverBuild = dockerfile.indexOf("RUN pnpm --filter @petcare/server build");

  assert.notEqual(sharedTypesBuild, -1);
  assert.notEqual(serverBuild, -1);
  assert.ok(sharedTypesBuild < serverBuild);
});

test("Docker 从根 packageManager 读取 pnpm 版本", async () => {
  for (const path of ["Dockerfile.admin", "Dockerfile.server"]) {
    const dockerfile = await readFile(resolve(root, path), "utf8");

    assert.doesNotMatch(dockerfile, /pnpm@\d/);
    assert.match(dockerfile, /COPY package\.json .*\n(?:.*\n)*?RUN corepack enable/);
  }
});
