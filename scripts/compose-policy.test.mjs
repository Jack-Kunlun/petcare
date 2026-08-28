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

test("Server 容器使用依赖就绪探针", async () => {
  const compose = await readFile(resolve(root, "docker-compose.yml"), "utf8");
  const server = serviceBlock(compose, "server");

  assert.match(server, /http:\/\/localhost:3000\/ready/);
  assert.doesNotMatch(server, /http:\/\/localhost:3000\/health/);
});

test("本地媒体静态出口使用不可变缓存并让缺失对象落入标准 404", async () => {
  const main = await readFile(resolve(root, "apps/server/src/main.ts"), "utf8");

  assert.match(main, /publicMediaStorageProvider === "local"/);
  assert.match(main, /useStaticAssets\(configService\.localMediaPublicDirectory/);
  assert.match(main, /prefix: "\/media\/public"/);
  assert.match(main, /fallthrough: true/);
  assert.match(main, /immutable: true/);
  assert.match(main, /X-Content-Type-Options", "nosniff"/);
});

test("Server 容器接收可调密码登录限流配置", async () => {
  const compose = await readFile(resolve(root, "docker-compose.yml"), "utf8");
  const server = serviceBlock(compose, "server");

  assert.match(server, /AUTH_PASSWORD_MAX_ATTEMPTS: \$\{AUTH_PASSWORD_MAX_ATTEMPTS:-5\}/);
  assert.match(server, /AUTH_PASSWORD_WINDOW_SECONDS: \$\{AUTH_PASSWORD_WINDOW_SECONDS:-900\}/);
});

test("环境模板指向根目录 .env", async () => {
  const example = await readFile(resolve(root, ".env.example"), "utf8");

  assert.match(example, /复制此文件为根目录 `.env`/);
  assert.doesNotMatch(example, /复制此文件为 `.env\.local`/);
});

test("宿主机本地媒体不会进入 Git 或 Docker 构建上下文", async () => {
  const [gitignore, dockerignore] = await Promise.all([
    readFile(resolve(root, ".gitignore"), "utf8"),
    readFile(resolve(root, ".dockerignore"), "utf8"),
  ]);

  assert.match(gitignore, /^data\/media\/$/m);
  assert.match(dockerignore, /^data\/media$/m);
});

test("Server 运行镜像使用可移植生产依赖并保留 seed 源码", async () => {
  const dockerfile = await readFile(resolve(root, "Dockerfile.server"), "utf8");

  assert.match(
    dockerfile,
    /RUN pnpm --filter @petcare\/server --prod deploy --legacy \/app\/server-production/,
  );
  assert.match(dockerfile, /test -f \/app\/server-production\/src\/seed\/seed-initial-data\.ts/);
  assert.match(dockerfile, /COPY --from=server-builder \/app\/server-production \.\/apps\/server/);
  assert.doesNotMatch(dockerfile, /COPY --from=server-builder \/app\/node_modules/);
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

test("Compose 使用独立应用标签且只有边缘网关暴露公网端口", async () => {
  const [compose, environment] = await Promise.all([
    readFile(resolve(root, "docker-compose.yml"), "utf8"),
    readFile(resolve(root, ".env.example"), "utf8"),
  ]);

  assert.match(serviceBlock(compose, "server"), /server:\$\{SERVER_IMAGE_TAG:-local\}/);
  assert.match(serviceBlock(compose, "admin"), /admin:\$\{ADMIN_IMAGE_TAG:-local\}/);
  assert.match(serviceBlock(compose, "website"), /website:\$\{WEBSITE_IMAGE_TAG:-local\}/);
  assert.doesNotMatch(compose, /\$\{IMAGE_TAG/);

  const server = serviceBlock(compose, "server");
  const website = serviceBlock(compose, "website");
  assert.match(server, /API_BASE_URL: \$\{API_BASE_URL:\?API_BASE_URL is required\}/);
  assert.match(server, /ALLOWED_ORIGINS: \$\{ALLOWED_ORIGINS:\?ALLOWED_ORIGINS is required\}/);
  assert.match(
    server,
    /WEBSITE_PUBLIC_URL: \$\{WEBSITE_PUBLIC_URL:\?WEBSITE_PUBLIC_URL is required\}/,
  );
  assert.match(
    website,
    /WEBSITE_PUBLIC_URL: \$\{WEBSITE_PUBLIC_URL:\?WEBSITE_PUBLIC_URL is required\}/,
  );
  assert.match(
    website,
    /WEBSITE_CONTENT_API_BASE_URL: \$\{WEBSITE_CONTENT_API_BASE_URL:-http:\/\/server:3000\}/,
  );

  for (const service of ["postgres", "redis", "server", "website"]) {
    assert.doesNotMatch(
      serviceBlock(compose, service),
      /^ {4}ports:/m,
      `${service} 不得映射宿主机端口`,
    );
  }

  assert.match(serviceBlock(compose, "admin"), /127\.0\.0\.1:8986:80/);
  assert.match(
    serviceBlock(compose, "website-gateway"),
    /127\.0\.0\.1:\$\{WEBSITE_PORT:-8080\}:80/,
  );
  const edge = serviceBlock(compose, "edge-gateway");
  assert.match(edge, /- "80:80"/);
  assert.match(edge, /- "443:443"/);

  for (const name of ["SERVER_IMAGE_TAG", "ADMIN_IMAGE_TAG", "WEBSITE_IMAGE_TAG"]) {
    assert.match(environment, new RegExp(`^${name}=local$`, "m"));
  }
  assert.doesNotMatch(environment, /^IMAGE_TAG=/m);
});

test("生产 Compose 固定项目名并从同一仓库读取运行时镜像", async () => {
  const compose = await readFile(resolve(root, "docker-compose.yml"), "utf8");

  assert.match(compose, /^name: petcare$/m);
  assert.match(
    serviceBlock(compose, "postgres"),
    /image: \$\{IMAGE_REGISTRY:-docker\.io\/library\}\/postgres:15-alpine/,
  );
  assert.match(
    serviceBlock(compose, "redis"),
    /image: \$\{IMAGE_REGISTRY:-docker\.io\/library\}\/redis:7-alpine/,
  );

  for (const service of ["website-gateway", "edge-gateway"]) {
    assert.match(
      serviceBlock(compose, service),
      /image: \$\{IMAGE_REGISTRY:-docker\.io\/library\}\/nginx:alpine/,
    );
  }
});

test("边缘网关禁用旧 TLS 并发送安全响应头", async () => {
  const nginx = await readFile(resolve(root, "docker/edge-nginx.conf"), "utf8");
  const httpServer = nginx.slice(
    nginx.indexOf("# ---- HTTP"),
    nginx.indexOf("# ---- 通用 TLS 参数"),
  );

  assert.doesNotMatch(httpServer, /acme-challenge/);
  assert.match(
    httpServer,
    /listen 80;[\s\S]*server_name petcare-home\.com www\.petcare-home\.com admin\.petcare-home\.com;[\s\S]*location \/ \{[\s\S]*return 301 https:\/\/\$host\$request_uri;/,
  );
  assert.match(nginx, /ssl_protocols TLSv1\.2 TLSv1\.3/);
  assert.doesNotMatch(nginx, /3DES|DES-CBC/);
  assert.match(nginx, /Strict-Transport-Security "max-age=31536000" always/);
  assert.doesNotMatch(nginx, /includeSubDomains/);
  assert.match(nginx, /proxy_set_header X-Forwarded-Proto \$scheme/);
});

test("内部网关保留边缘传入的 HTTPS 协议", async () => {
  for (const path of ["docker/nginx.conf", "docker/website-nginx.conf"]) {
    const nginx = await readFile(resolve(root, path), "utf8");

    assert.match(nginx, /map \$http_x_forwarded_proto \$upstream_forwarded_proto/);
    assert.match(nginx, /proxy_set_header X-Forwarded-Proto \$upstream_forwarded_proto/);
    assert.doesNotMatch(nginx, /proxy_set_header X-Forwarded-Proto \$scheme/);
    assert.equal(
      (nginx.match(/proxy_set_header X-Forwarded-Proto \$upstream_forwarded_proto/g) ?? []).length,
      (nginx.match(/proxy_pass /g) ?? []).length,
      `${path} 的每个反向代理都必须传递协议`,
    );
  }
});

test("开发覆盖只把数据库和 Redis 绑定到本机回环", async () => {
  const override = await readFile(resolve(root, "docker-compose.dev.yml"), "utf8");

  assert.match(override, /127\.0\.0\.1:\$\{EXPOSE_DB_PORT:-5432\}:5432/);
  assert.match(override, /127\.0\.0\.1:\$\{EXPOSE_REDIS_PORT:-6379\}:6379/);
  assert.doesNotMatch(override, /(?:^|["'])0\.0\.0\.0:/m);
});

test("长期本地监测 Compose 隔离容器、数据卷、端口和生产 TLS", async () => {
  const compose = await readFile(resolve(root, "docker-compose.local.yml"), "utf8");

  assert.match(compose, /^name: petcare-local$/m);
  assert.match(compose, /127\.0\.0\.1:\$\{EXPOSE_DB_PORT:-55432\}:5432/);
  assert.match(compose, /127\.0\.0\.1:\$\{EXPOSE_REDIS_PORT:-56379\}:6379/);
  assert.match(compose, /127\.0\.0\.1:\$\{EXPOSE_SERVER_PORT:-3300\}:3000/);
  assert.match(compose, /127\.0\.0\.1:\$\{EXPOSE_ADMIN_PORT:-8986\}:80/);
  assert.doesNotMatch(compose, /(?:^|["'])0\.0\.0\.0:/m);

  const migrate = serviceBlock(compose, "migrate");
  assert.match(migrate, /prisma:migrate:deploy/);
  assert.match(migrate, /condition: service_healthy/);
  assert.match(serviceBlock(compose, "server"), /condition: service_completed_successfully/);
  assert.match(serviceBlock(compose, "server"), /PUBLIC_MEDIA_STORAGE_PROVIDER: local/);
  assert.match(serviceBlock(compose, "server"), /media-data:\/app\/data\/media/);
  assert.match(serviceBlock(compose, "edge-gateway"), /profiles: \["production-tls"\]/);
  assert.match(compose, /name: petcare-local-postgres-data/);
  assert.match(compose, /name: petcare-local-redis-data/);
  assert.match(compose, /name: petcare-local-media-data/);
});

test("Website 镜像以非 root 身份运行独立 SSR 并提供健康检查", async () => {
  const dockerfile = await readFile(resolve(root, "Dockerfile.website"), "utf8");

  assert.match(dockerfile, /^FROM node:24\.19-alpine AS website-builder$/m);
  assert.match(dockerfile, /^FROM node:24\.19-alpine AS website-runner$/m);
  assert.match(dockerfile, /RUN pnpm --filter @petcare\/shared-types build/);
  assert.match(dockerfile, /RUN pnpm --filter @petcare\/website build/);
  assert.match(
    dockerfile,
    /COPY --from=website-builder --chown=node:node \/app\/packages\/shared-types\/package\.json \.\/node_modules\/@petcare\/shared-types\//,
  );
  assert.match(
    dockerfile,
    /COPY --from=website-builder --chown=node:node \/app\/packages\/shared-types\/dist \.\/node_modules\/@petcare\/shared-types\/dist/,
  );
  assert.match(dockerfile, /^EXPOSE 4321$/m);
  assert.match(dockerfile, /^USER node$/m);
  assert.match(dockerfile, /^HEALTHCHECK .*\/healthz/m);
  assert.doesNotMatch(dockerfile, /\b(?:ARG|ENV)\s+\w*(?:SECRET|PASSWORD|TOKEN|KEY)/i);
  assert.doesNotMatch(dockerfile, /\.env\b/i);
});

test("官网网关只暴露 Website 页面和已发布公共内容接口", async () => {
  const nginx = await readFile(resolve(root, "docker/website-nginx.conf"), "utf8");

  assert.match(nginx, /resolver 127\.0\.0\.11 valid=10s ipv6=off/);
  assert.match(nginx, /set \$website_upstream http:\/\/website:4321/);
  assert.match(nginx, /set \$server_upstream http:\/\/server:3000/);
  assert.equal((nginx.match(/proxy_pass \$website_upstream/g) ?? []).length, 3);
  assert.equal((nginx.match(/proxy_pass \$server_upstream/g) ?? []).length, 4);
  assert.doesNotMatch(nginx, /proxy_pass http:\/\/(?:website|server):/);
  assert.match(nginx, /location \^~ \/website-content\/previews\//);
  assert.match(nginx, /location \^~ \/website-content\/previews\/[\s\S]*?return 404/);
  assert.match(nginx, /location \^~ \/website-content\/[\s\S]*?proxy_pass \$server_upstream/);
  assert.match(nginx, /location = \/content\/articles[\s\S]*?proxy_pass \$server_upstream/);
  assert.match(nginx, /location \^~ \/content\/articles\/[\s\S]*?proxy_pass \$server_upstream/);
  assert.match(nginx, /location \^~ \/media\/[\s\S]*?proxy_pass \$server_upstream/);
  assert.match(nginx, /location \^~ \/media\/[\s\S]*?X-Content-Type-Options "nosniff"/);
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
  assert.match(
    server,
    /PUBLIC_MEDIA_STORAGE_PROVIDER: \$\{PUBLIC_MEDIA_STORAGE_PROVIDER:-disabled\}/,
  );
  assert.match(server, /LOCAL_MEDIA_DIRECTORY: \$\{LOCAL_MEDIA_DIRECTORY:-\/app\/data\/media\}/);
  assert.match(gateway, /- "127\.0\.0\.1:\$\{WEBSITE_PORT:-8080\}:80"/);
  assert.match(gateway, /website-nginx\.conf/);
  assert.doesNotMatch(
    server,
    /^ {4}ports:/m,
    "全容器部署不得绕过官网网关直接暴露 Nest 的管理或 Swagger 路由",
  );
  assert.match(admin, /dockerfile: Dockerfile\.admin/);
  assert.match(admin, /- "127\.0\.0\.1:8986:80"/);

  // HTTPS 边缘网关是唯一公网入口，80/443 之外的端口必须绑定本机回环
  const edgeGateway = serviceBlock(compose, "edge-gateway");
  assert.match(edgeGateway, /edge-nginx\.conf/);
  assert.match(edgeGateway, /- "80:80"/);
  assert.match(edgeGateway, /- "443:443"/);
  assert.match(edgeGateway, /\.\/certs:\/etc\/nginx\/certs:ro/);
  assert.match(admin, /127\.0\.0\.1:8986:80/);
  assert.match(gateway, /127\.0\.0\.1:\$\{WEBSITE_PORT:-8080\}:80/);

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
