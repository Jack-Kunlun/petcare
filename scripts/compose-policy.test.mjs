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

test("Docker 构建镜像在安装依赖前复制 pnpm 守卫脚本", async () => {
  for (const path of ["Dockerfile.admin", "Dockerfile.server", "Dockerfile.website"]) {
    const dockerfile = await readFile(resolve(root, path), "utf8");
    const guardCopy = dockerfile.indexOf(
      "COPY scripts/enforce-pnpm.mjs ./scripts/enforce-pnpm.mjs",
    );
    const install = dockerfile.indexOf("RUN pnpm install --frozen-lockfile");

    assert.notEqual(guardCopy, -1, `${path} 必须复制 pnpm 守卫脚本`);
    assert.ok(guardCopy < install, `${path} 必须在安装依赖前复制 pnpm 守卫脚本`);
  }
});

test("Compose 包含独立的 Website SSR 与公网网关", async () => {
  const compose = await readFile(resolve(root, "docker-compose.yml"), "utf8");

  assert.match(compose, /^ {2}website:\s*$/m);
  assert.match(compose, /^ {2}website-gateway:\s*$/m);
  assert.match(compose, /dockerfile:\s*Dockerfile\.website/);
  assert.match(compose, /website-nginx\.conf/);
});

test("Website 镜像以非 root 身份运行独立 SSR 并提供健康检查", async () => {
  const dockerfile = await readFile(resolve(root, "Dockerfile.website"), "utf8");

  assert.match(dockerfile, /^FROM node:24\.19-alpine AS website-builder$/m);
  assert.match(dockerfile, /^FROM node:24\.19-alpine AS website-runner$/m);
  assert.match(dockerfile, /RUN pnpm --filter @petcare\/shared-types build/);
  assert.match(dockerfile, /RUN pnpm --filter @petcare\/website build/);
  assert.match(dockerfile, /^EXPOSE 4321$/m);
  assert.match(dockerfile, /^USER node$/m);
  assert.match(dockerfile, /^HEALTHCHECK .*\/healthz/m);
  assert.doesNotMatch(dockerfile, /\b(?:ARG|ENV)\s+\w*(?:SECRET|PASSWORD|TOKEN|KEY)/i);
  assert.doesNotMatch(dockerfile, /\.env\b/i);
});

test("官网网关只暴露 Website 页面和已发布公共内容接口", async () => {
  const nginx = await readFile(resolve(root, "docker/website-nginx.conf"), "utf8");

  assert.match(nginx, /proxy_pass http:\/\/website:4321/);
  assert.match(nginx, /location \^~ \/website-content\/previews\//);
  assert.match(nginx, /location \^~ \/website-content\/previews\/[\s\S]*?return 404/);
  assert.match(nginx, /location \^~ \/website-content\/[\s\S]*?proxy_pass http:\/\/server:3000/);
  assert.match(nginx, /location = \/content\/articles[\s\S]*?proxy_pass http:\/\/server:3000/);
  assert.match(nginx, /location \^~ \/content\/articles\/[\s\S]*?proxy_pass http:\/\/server:3000/);
  assert.doesNotMatch(nginx, /location\s+(?:=\s*)?(?:\^~\s*)?\/(?:admin|api-docs|api(?:\/|\s))/);
  assert.match(nginx, /location \^~ \/_astro\/[\s\S]*?max-age=31536000, immutable/);
  assert.match(nginx, /location \/ \{[\s\S]*?add_header Cache-Control "no-store" always/);
});

test("Compose 将官网 SSR 保持在内部网络并仅传递所需运行变量", async () => {
  const [compose, environment] = await Promise.all([
    readFile(resolve(root, "docker-compose.yml"), "utf8"),
    readFile(resolve(root, ".env.example"), "utf8"),
  ]);
  const website = serviceBlock(compose, "website");
  const server = serviceBlock(compose, "server");
  const gateway = serviceBlock(compose, "website-gateway");
  const admin = serviceBlock(compose, "admin");

  assert.match(website, /dockerfile: Dockerfile\.website/);
  assert.doesNotMatch(website, /^ {4}ports:/m);
  assert.match(
    website,
    /WEBSITE_CONTENT_API_BASE_URL: \$\{WEBSITE_CONTENT_API_BASE_URL:-http:\/\/server:3000\}/,
  );
  assert.doesNotMatch(server, /WEBSITE_CONTENT_API_BASE_URL/);
  assert.match(gateway, /- "\$\{WEBSITE_PORT:-8080\}:80"/);
  assert.match(gateway, /website-nginx\.conf/);
  assert.doesNotMatch(
    server,
    /^ {4}ports:/m,
    "全容器部署不得绕过官网网关直接暴露 Nest 的管理或 Swagger 路由",
  );
  assert.match(admin, /dockerfile: Dockerfile\.admin/);
  assert.match(admin, /- "8986:80"/);

  for (const [name, value] of [
    ["WEBSITE_PUBLIC_URL", "http://localhost:8080"],
    ["WEBSITE_CONTENT_API_BASE_URL", "http://server:3000"],
    ["WEBSITE_PREVIEW_TTL_SECONDS", "600"],
    ["WEBSITE_CONTENT_CACHE_TTL_SECONDS", "86400"],
    ["WEBSITE_LAST_SUCCESS_TTL_SECONDS", "300"],
    ["WEBSITE_PORT", "8080"],
  ]) {
    assert.match(environment, new RegExp(`^${name}=${value}$`, "m"));
  }
});

function serviceBlock(compose, name) {
  const start = compose.indexOf(`\n  ${name}:\n`);

  assert.notEqual(start, -1, `Compose 缺少 ${name} 服务`);

  const remainder = compose.slice(start + 1);
  const nextService = /\n {2}[A-Za-z][\w-]*:\n/g;

  nextService.lastIndex = `  ${name}:\n`.length;
  const match = nextService.exec(remainder);

  return remainder.slice(0, match?.index);
}
