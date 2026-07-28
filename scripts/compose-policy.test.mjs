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
