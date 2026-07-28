# PetCare Engineering Baseline Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立统一、跨平台且可由 CI 重复执行的 PetCare 工程命令、配置校验、E2E、Docker 和仓库治理基线。

**Architecture:** 根目录以 pnpm 和 Turbo 统一调度三个应用与四个共享包，Node 脚本承担跨平台工具逻辑。Server 继续以现有 `ConfigService` 作为唯一配置入口，并在监听端口前集中校验；GitHub Actions 分层运行质量、测试、构建、E2E 和镜像验证。

**Tech Stack:** Node.js 22、pnpm 11.15.1、Turborepo、TypeScript 6、NestJS 11、Jest 30、Vitest 4、Playwright 1、Docker Compose、GitHub Actions

## Global Constraints

- Node.js 锁定 22.x，`packageManager` 锁定 `pnpm@11.15.1`。
- Admin 本地端口固定为 `8986`，Server 本地端口固定为 `3000`。
- 根目录 `.env` 是本地标准配置入口，`.env.example` 是可提交模板。
- Server 配置只能通过现有 `ConfigService` 访问，不新增配置框架。
- 微信和阿里云 OSS 未配置时保持可选；提供任意一项时必须校验完整字段组。
- 生产 Docker 不提供数据库密码、Redis 密码、JWT 密钥和默认管理员密码的弱回退值。
- CI 只能使用隔离测试凭据，不写入真实 AppSecret 或生产密钥。
- Commit 格式为 `type(scope): 中文描述`，`scope` 可省略。
- 所有新增或修改的文本默认 LF，`.bat` 和 `.cmd` 使用 CRLF。
- 共享包不参加根级 `pnpm dev` 常驻监听。
- 不新增 `rimraf`、配置框架或浏览器测试依赖；Playwright 只运行 Chromium。

---

## File Responsibility Map

| 文件                                       | 职责                                        |
| ------------------------------------------ | ------------------------------------------- |
| `scripts/clean.mjs`                        | 安全、跨平台删除明确列出的可再生产物        |
| `scripts/clean.test.mjs`                   | 验证清理边界和实际删除行为                  |
| `scripts/workspace-contract.test.mjs`      | 验证根目录和各工作区生命周期命令契约        |
| `scripts/repository-policy.test.mjs`       | 验证中文提交、Hooks 和换行符策略            |
| `scripts/compose-policy.test.mjs`          | 静态验证 Compose 必填密钥和生产短信策略     |
| `commitlint.config.js`                     | Conventional Commits 与中文主题规则         |
| `package.json`、各工作区 `package.json`    | 暴露统一生命周期和根级聚合命令              |
| `turbo.json`                               | 定义任务依赖、缓存、输出和环境输入          |
| `apps/server/src/config/config.service.ts` | 提供集中启动校验和既有类型化 getter         |
| `apps/server/src/main.ts`                  | 在监听端口前触发启动校验                    |
| `apps/server/test/health.e2e-spec.ts`      | 验证真实 Nest 应用健康接口和统一响应        |
| `apps/server/test/jest-e2e.json`           | 隔离 Server E2E 的 Jest 配置                |
| `apps/admin/e2e/dashboard.spec.ts`         | 使用真实默认管理员登录后验证控制台导航      |
| `apps/admin/playwright.config.ts`          | 在 `3000`/`8986` 启动两端服务并收集失败产物 |
| `docker-compose.yml`                       | 提供无弱密钥回退的生产容器编排              |
| `.github/workflows/ci.yml`                 | 分层执行质量、单测、构建、E2E 和镜像验证    |
| `.github/dependabot.yml`                   | 每周维护 pnpm、Docker 和 Actions 依赖       |
| `README.md`、环境变量与部署文档            | 记录唯一有效的本地和 CI 操作路径            |

### Task 1: 固化中文提交与仓库文件策略

**Files:**

- Create: `scripts/repository-policy.test.mjs`
- Modify: `commitlint.config.js`
- Modify: `.husky/commit-msg`
- Modify: `.husky/pre-commit`
- Modify: `.gitattributes`
- Modify: `package.json`

**Interfaces:**

- Consumes: 根目录现有 `@commitlint/cli`、Husky 和 lint-staged。
- Produces: `subject-contains-chinese` Commitlint 规则；可被根级 `test:tooling` 调用的仓库策略测试。

- [ ] **Step 1: 写入会因纯英文主题和现有 Hooks 而失败的策略测试**

```js
// scripts/repository-policy.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const commitlintCli = resolve(root, "node_modules/@commitlint/cli/cli.js");

function lintCommit(message) {
  return spawnSync(process.execPath, [commitlintCli, "--color=false"], {
    cwd: root,
    encoding: "utf8",
    input: `${message}\n`,
  });
}

test("接受 Conventional Commits 中文主题", () => {
  assert.equal(lintCommit("fix(server): 修复启动配置校验").status, 0);
});

test("拒绝纯英文主题和非法 type", () => {
  assert.notEqual(lintCommit("fix: update server config").status, 0);
  assert.notEqual(lintCommit("change: 更新服务配置").status, 0);
});

test("Hooks 使用 pnpm exec，换行策略为 Windows 脚本保留 CRLF", async () => {
  const commitMsg = await readFile(resolve(root, ".husky/commit-msg"), "utf8");
  const preCommit = await readFile(resolve(root, ".husky/pre-commit"), "utf8");
  const attributes = await readFile(resolve(root, ".gitattributes"), "utf8");

  assert.match(commitMsg, /pnpm exec commitlint --edit/);
  assert.match(preCommit, /pnpm exec lint-staged/);
  assert.doesNotMatch(`${commitMsg}\n${preCommit}`, /\bnpx\b/);
  assert.match(attributes, /^\*\.bat text eol=crlf$/m);
  assert.match(attributes, /^\*\.cmd text eol=crlf$/m);
});
```

- [ ] **Step 2: 运行测试并确认现有策略不能全部通过**

Run: `node --test scripts/repository-policy.test.mjs`  
Expected: FAIL，纯英文主题仍被接受，Hooks 仍包含 `npx`，且 `.gitattributes` 缺少批处理规则。

- [ ] **Step 3: 实现中文主题规则并统一 Hooks、发布提交和换行策略**

```js
// commitlint.config.js 中新增规则函数与插件
const subjectContainsChinese = ({ subject }) => [
  typeof subject === "string" && /\p{Script=Han}/u.test(subject),
  "subject must contain Chinese characters",
];

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "subject-contains-chinese": subjectContainsChinese,
      },
    },
  ],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "perf", "test", "chore", "ci"],
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "scope-case": [2, "always", "lower-case"],
    "subject-case": [0],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "subject-contains-chinese": [2, "always"],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
  },
};
```

```sh
# .husky/commit-msg
#!/usr/bin/env sh

pnpm exec commitlint --edit
```

```sh
# .husky/pre-commit
#!/usr/bin/env sh

pnpm exec lint-staged
```

```gitattributes
* text=auto eol=lf
*.bat text eol=crlf
*.cmd text eol=crlf
```

将根目录 `package.json` 的 `release` 脚本改为：

```json
"release": "pnpm changelog && git add CHANGELOG.md && git commit -m \"docs: 更新发布变更日志\" && git tag"
```

- [ ] **Step 4: 验证仓库策略**

Run: `node --test scripts/repository-policy.test.mjs`  
Expected: PASS，3 个测试全部通过。

Run: `git diff --check`  
Expected: PASS，无空白错误。

- [ ] **Step 5: 提交**

```bash
git add commitlint.config.js .husky/commit-msg .husky/pre-commit .gitattributes package.json scripts/repository-policy.test.mjs
git commit -m "chore: 统一中文提交与仓库文件策略"
```

### Task 2: 统一生命周期命令与 Turbo 任务图

**Files:**

- Create: `scripts/clean.mjs`
- Create: `scripts/clean.test.mjs`
- Create: `scripts/workspace-contract.test.mjs`
- Modify: `package.json`
- Modify: `turbo.json`
- Modify: `apps/admin/package.json`
- Modify: `apps/server/package.json`
- Modify: `apps/miniapp/package.json`
- Modify: `packages/api-client/package.json`
- Modify: `packages/shared-types/package.json`
- Modify: `packages/shared-utils/package.json`
- Modify: `packages/eslint-config-base/package.json`

**Interfaces:**

- Consumes: Task 1 的 `scripts/repository-policy.test.mjs`。
- Produces: 所有工作区的 `dev | build | typecheck | lint | test | test:coverage | clean` 契约；根级 `check`、`test:tooling` 和安全清理函数 `cleanPaths(root, relativePaths)`。

- [ ] **Step 1: 写入命令契约与清理安全测试**

```js
// scripts/workspace-contract.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const manifests = [
  "apps/admin/package.json",
  "apps/server/package.json",
  "apps/miniapp/package.json",
  "packages/api-client/package.json",
  "packages/shared-types/package.json",
  "packages/shared-utils/package.json",
  "packages/eslint-config-base/package.json",
];
const lifecycle = ["dev", "build", "typecheck", "lint", "test", "test:coverage", "clean"];

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

test("所有工作区暴露标准生命周期", async () => {
  for (const path of manifests) {
    const manifest = await readJson(path);
    for (const script of lifecycle) {
      assert.equal(typeof manifest.scripts?.[script], "string", `${path} 缺少 ${script}`);
    }
  }
});

test("根级命令覆盖质量门禁与三端开发", async () => {
  const manifest = await readJson("package.json");

  assert.equal(manifest.engines.node, ">=22.0.0 <23");
  assert.equal(manifest.engines.pnpm, ">=11.0.0 <12");
  assert.match(manifest.scripts.dev, /@petcare\/admin/);
  assert.match(manifest.scripts.dev, /@petcare\/server/);
  assert.match(manifest.scripts.dev, /@petcare\/miniapp/);
  assert.match(manifest.scripts.check, /format:check.*lint.*typecheck.*test.*build/);
});

test("Miniapp 内部脚本不嵌套 npm", async () => {
  const manifest = await readJson("apps/miniapp/package.json");
  assert.doesNotMatch(JSON.stringify(manifest.scripts), /\bnpm run\b/);
});
```

```js
// scripts/clean.test.mjs
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
```

- [ ] **Step 2: 运行测试并确认命令契约和清理模块尚未建立**

Run: `node --test scripts/workspace-contract.test.mjs scripts/clean.test.mjs`  
Expected: FAIL，报告缺少 `scripts/clean.mjs` 或标准生命周期。

- [ ] **Step 3: 实现安全清理脚本**

```js
// scripts/clean.mjs
import { rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function cleanPaths(root, relativePaths) {
  const resolvedRoot = resolve(root);

  for (const input of relativePaths) {
    const target = resolve(resolvedRoot, input);
    const pathFromRoot = relative(resolvedRoot, target);
    const isChild =
      input !== "." &&
      !isAbsolute(input) &&
      pathFromRoot !== "" &&
      pathFromRoot !== ".." &&
      !pathFromRoot.startsWith(`..\\`) &&
      !pathFromRoot.startsWith("../");

    if (!isChild) {
      throw new Error(`clean target must be a relative child path: ${input}`);
    }

    await rm(target, { recursive: true, force: true });
  }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  await cleanPaths(process.cwd(), process.argv.slice(2));
}
```

- [ ] **Step 4: 更新根目录和全部工作区脚本**

根目录保留现有按应用快捷命令，并将核心脚本设置为：

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --filter=@petcare/admin --filter=@petcare/server --filter=@petcare/miniapp",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test:tooling": "node --test scripts/repository-policy.test.mjs scripts/clean.test.mjs scripts/workspace-contract.test.mjs",
    "test": "pnpm test:tooling && turbo run test",
    "test:coverage": "turbo run test:coverage",
    "test:e2e": "pnpm --filter @petcare/server test:e2e && pnpm --filter @petcare/admin test:e2e",
    "check": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build",
    "clean": "turbo run clean && node scripts/clean.mjs node_modules .turbo"
  },
  "engines": {
    "node": ">=22.0.0 <23",
    "pnpm": ">=11.0.0 <12"
  }
}
```

应用脚本使用以下确切语义：

`apps/admin/package.json`：

```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "clean": "node ../../scripts/clean.mjs dist coverage playwright-report test-results .turbo"
}
```

`apps/server/package.json`：

```json
{
  "dev": "pnpm start:dev",
  "build": "nest build",
  "typecheck": "tsc --noEmit -p tsconfig.json",
  "lint": "eslint .",
  "test": "jest",
  "test:coverage": "jest --coverage",
  "clean": "node ../../scripts/clean.mjs dist coverage .turbo"
}
```

`apps/miniapp/package.json`：

```json
{
  "dev": "pnpm dev:weapp",
  "dev:weapp": "pnpm build:weapp -- --watch",
  "dev:h5": "pnpm build:h5 -- --watch",
  "build": "pnpm build:weapp",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "test": "jest",
  "test:coverage": "jest --coverage",
  "clean": "node ../../scripts/clean.mjs dist coverage .temp .turbo"
}
```

三个 TypeScript 共享包保留 `tsc` 构建和现有测试命令，并统一增加：

```json
{
  "typecheck": "tsc --noEmit",
  "clean": "node ../../scripts/clean.mjs dist coverage .turbo"
}
```

ESLint 配置包使用真实的轻量语法验证：

```json
{
  "scripts": {
    "dev": "node --check index.js",
    "build": "node --check index.js",
    "typecheck": "node --check index.js",
    "lint": "node --check index.js",
    "test": "node --check index.js",
    "test:coverage": "node --check index.js",
    "clean": "node ../../scripts/clean.mjs .turbo"
  }
}
```

- [ ] **Step 5: 精确配置 Turbo 的任务输入输出**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", ".env.*"],
  "globalEnv": ["CI", "NODE_ENV"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "env": ["VITE_*", "TARO_APP_*"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test:coverage": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false,
      "outputs": ["playwright-report/**", "test-results/**"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 6: 验证契约、类型检查任务图和 Miniapp 构建归属**

Run: `node --test scripts/workspace-contract.test.mjs scripts/clean.test.mjs`  
Expected: PASS。

Run: `pnpm turbo run typecheck --dry=json`  
Expected: PASS，输出包含 7 个工作区的 `typecheck`。

Run: `pnpm turbo run build --dry=json`  
Expected: PASS，输出包含 `@petcare/miniapp#build`。

- [ ] **Step 7: 提交**

```bash
git add package.json turbo.json apps/admin/package.json apps/server/package.json apps/miniapp/package.json packages/api-client/package.json packages/shared-types/package.json packages/shared-utils/package.json packages/eslint-config-base/package.json scripts/clean.mjs scripts/clean.test.mjs scripts/workspace-contract.test.mjs
git commit -m "chore: 统一工作区命令与任务缓存"
```

### Task 3: 为 Server 增加集中式启动配置校验

**Files:**

- Modify: `apps/server/src/config/config.service.spec.ts`
- Modify: `apps/server/src/config/config.service.ts`
- Modify: `apps/server/src/main.ts`
- Rename: `apps/server/eslint.config.js` → `apps/server/eslint.config.mjs`

**Interfaces:**

- Consumes: 现有 `ConfigService` getter 和根目录 `.env` 加载方式。
- Produces: `ConfigService.validateForStartup(): void`；`main.ts` 在 `app.listen()` 前调用；可选集成采用完整字段组校验。

- [ ] **Step 1: 为必填配置、可选字段组和生产安全规则写失败测试**

在 `config.service.spec.ts` 增加测试辅助值和以下用例：

```ts
const validStartupEnv = {
  NODE_ENV: "development",
  PORT: "3000",
  DB_HOST: "localhost",
  DB_PORT: "5432",
  DB_USERNAME: "user",
  DB_PASSWORD: "local-database-password",
  DB_NAME: "petcare",
  DB_SCHEMA: "public",
  REDIS_HOST: "localhost",
  REDIS_PORT: "6379",
  JWT_SECRET: "local-jwt-secret-with-at-least-32-characters",
  DEFAULT_ADMIN_USERNAME: "admin",
  DEFAULT_ADMIN_PHONE: "13800138000",
  DEFAULT_ADMIN_PASSWORD: "Local-Admin-Password-2026!",
  ALLOWED_ORIGINS: "http://localhost:8986",
  WECHAT_APP_ID: "",
  WECHAT_APP_SECRET: "",
  ALIYUN_OSS_ACCESS_KEY_ID: "",
  ALIYUN_OSS_ACCESS_KEY_SECRET: "",
  ALIYUN_OSS_BUCKET: "",
  ALIYUN_OSS_REGION: "",
};

it("accepts complete startup configuration with disabled optional integrations", () => {
  process.env = { ...originalEnv, ...validStartupEnv };

  expect(() => new ConfigService().validateForStartup()).not.toThrow();
});

it("reports all missing required startup variables without exposing values", () => {
  process.env = { NODE_ENV: "development" };

  expect(() => new ConfigService().validateForStartup()).toThrow(
    /DB_HOST.*DB_PASSWORD.*JWT_SECRET.*DEFAULT_ADMIN_PHONE/s,
  );
});

it("rejects partially configured WeChat and OSS integrations", () => {
  process.env = {
    ...originalEnv,
    ...validStartupEnv,
    WECHAT_APP_ID: "wx3bdad4ab652f0d1d",
    ALIYUN_OSS_BUCKET: "petcare-test",
  };

  expect(() => new ConfigService().validateForStartup()).toThrow(
    /WECHAT_APP_SECRET.*ALIYUN_OSS_ACCESS_KEY_ID.*ALIYUN_OSS_REGION/s,
  );
});

it("rejects malformed complete WeChat and OSS integrations", () => {
  process.env = {
    ...originalEnv,
    ...validStartupEnv,
    WECHAT_APP_ID: "invalid-app-id",
    WECHAT_APP_SECRET: "invalid-secret",
    ALIYUN_OSS_ACCESS_KEY_ID: "test-access-key",
    ALIYUN_OSS_ACCESS_KEY_SECRET: "test-access-secret",
    ALIYUN_OSS_BUCKET: "Invalid_Bucket",
    ALIYUN_OSS_REGION: "cn-hangzhou",
  };

  expect(() => new ConfigService().validateForStartup()).toThrow(
    /WECHAT_APP_ID.*ALIYUN_OSS_BUCKET/s,
  );
});

it("requires Redis authentication and rejects development SMS codes in production", () => {
  process.env = {
    ...originalEnv,
    ...validStartupEnv,
    NODE_ENV: "production",
    SMS_DEV_CODE: "246810",
  };

  expect(() => new ConfigService().validateForStartup()).toThrow(/REDIS_PASSWORD.*SMS_DEV_CODE/s);
});
```

- [ ] **Step 2: 运行 ConfigService 测试并确认缺少集中校验**

Run: `pnpm --filter @petcare/server test -- config/config.service.spec.ts --runInBand`  
Expected: FAIL，`validateForStartup` 尚不存在。

- [ ] **Step 3: 实现聚合校验且不泄露配置值**

在 `ConfigService` 中增加：

```ts
validateForStartup(): void {
  const errors: string[] = [];
  const check = (name: string, reader: () => unknown): void => {
    try {
      reader();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${name} is invalid`);
    }
  };

  const required = [
    "DB_HOST",
    "DB_USERNAME",
    "DB_PASSWORD",
    "DB_NAME",
    "DB_SCHEMA",
    "REDIS_HOST",
    "DEFAULT_ADMIN_USERNAME",
  ] as const;

  for (const name of required) {
    check(name, () => this.getRequiredString(name));
  }

  check("NODE_ENV", () => this.validateNodeEnv());
  check("PORT", () => this.port);
  check("DB_PORT", () => this.getRequiredPositiveInteger("DB_PORT"));
  check("REDIS_PORT", () => this.getRequiredPositiveInteger("REDIS_PORT"));
  check("JWT_SECRET", () => this.jwtSecret);
  check("DEFAULT_ADMIN_PHONE", () => this.defaultAdminPhone);
  check("DEFAULT_ADMIN_PASSWORD", () => this.validateAdminPassword());
  check("ALLOWED_ORIGINS", () => this.validateAllowedOrigins());
  check("WECHAT", () => this.validateWechatConfiguration());
  check("ALIYUN_OSS", () => this.validateOssConfiguration());

  if (this.nodeEnv === "production") {
    check("REDIS_PASSWORD", () => this.getRequiredString("REDIS_PASSWORD"));
    check("SMS_DEV_CODE", () => this.smsDevCode);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join("\n- ")}`);
  }
}
```

同一类中实现这些私有方法，所有错误只包含变量名和约束：

```ts
private getRequiredPositiveInteger(name: string): number {
  const value = this.getRequiredString(name);

  if (!/^\d+$/.test(value) || Number(value) <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return Number(value);
}

private validateNodeEnv(): void {
  if (!["development", "test", "production"].includes(this.nodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }
}

private validateAdminPassword(): void {
  if (this.defaultAdminPassword.length < 12) {
    throw new Error("DEFAULT_ADMIN_PASSWORD must be at least 12 characters long");
  }
}

private validateAllowedOrigins(): void {
  for (const origin of this.allowedOrigins.split(",").map((value) => value.trim())) {
    try {
      new URL(origin);
    } catch {
      throw new Error("ALLOWED_ORIGINS must contain valid absolute URLs");
    }
  }
}

private validateOptionalGroup(names: readonly string[]): boolean {
  const configured = names.filter((name) => Boolean(process.env[name]?.trim()));

  if (configured.length === 0) {
    return false;
  }

  const missing = names.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`${missing.join(", ")} are required when this integration is configured`);
  }

  return true;
}

private validateWechatConfiguration(): void {
  if (!this.validateOptionalGroup(["WECHAT_APP_ID", "WECHAT_APP_SECRET"])) {
    return;
  }

  if (!/^wx[a-zA-Z0-9]{16}$/.test(this.wechatAppId)) {
    throw new Error("WECHAT_APP_ID has an invalid format");
  }

  if (!/^[a-f0-9]{32}$/i.test(this.wechatAppSecret)) {
    throw new Error("WECHAT_APP_SECRET has an invalid format");
  }
}

private validateOssConfiguration(): void {
  if (
    !this.validateOptionalGroup([
      "ALIYUN_OSS_ACCESS_KEY_ID",
      "ALIYUN_OSS_ACCESS_KEY_SECRET",
      "ALIYUN_OSS_BUCKET",
      "ALIYUN_OSS_REGION",
    ])
  ) {
    return;
  }

  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(this.aliyunOssBucket)) {
    throw new Error("ALIYUN_OSS_BUCKET has an invalid format");
  }

  if (!/^[a-z0-9-]+$/.test(this.aliyunOssRegion)) {
    throw new Error("ALIYUN_OSS_REGION has an invalid format");
  }
}
```

- [ ] **Step 4: 在监听端口前执行校验并修正 ESLint 模块扩展名**

```ts
// apps/server/src/main.ts，取得 ConfigService 后立即执行
const configService = app.get(ConfigService);

configService.validateForStartup();
```

将 `apps/server/eslint.config.js` 重命名为 `apps/server/eslint.config.mjs`，内容不变。

- [ ] **Step 5: 验证单元测试、类型和 ESLint 启动无模块告警**

Run: `pnpm --filter @petcare/server test -- config/config.service.spec.ts --runInBand`  
Expected: PASS。

Run: `pnpm --filter @petcare/server typecheck`  
Expected: PASS。

Run: `pnpm --filter @petcare/server lint`  
Expected: PASS，输出不再包含 ESM 模块类型告警。

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/config/config.service.ts apps/server/src/config/config.service.spec.ts apps/server/src/main.ts apps/server/eslint.config.mjs
git add -u apps/server/eslint.config.js
git commit -m "feat(server): 增加集中式启动配置校验"
```

### Task 4: 加固 Docker Compose 与环境变量模板

**Files:**

- Create: `scripts/compose-policy.test.mjs`
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `package.json`

**Interfaces:**

- Consumes: Task 3 的 Server 生产配置校验。
- Produces: 需要显式提供敏感值的生产 Compose；本地 `.env` 模板约定；供根级工具测试执行的 Compose 策略测试。

- [ ] **Step 1: 写入会因现有弱回退值而失败的 Compose 策略测试**

```js
// scripts/compose-policy.test.mjs
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
  assert.doesNotMatch(compose, /password\}/i);
  assert.doesNotMatch(compose, /ChangeMeToStrongPassword/);
});

test("环境模板指向根目录 .env", async () => {
  const example = await readFile(resolve(root, ".env.example"), "utf8");

  assert.match(example, /复制此文件为 `.env`/);
  assert.doesNotMatch(example, /复制此文件为 `.env\.local`/);
});
```

- [ ] **Step 2: 运行策略测试并确认弱默认值被检出**

Run: `node --test scripts/compose-policy.test.mjs`  
Expected: FAIL，Compose 仍包含 `password`、默认 Redis 密码和默认 JWT 密钥。

- [ ] **Step 3: 移除生产敏感值回退并隔离开发短信码**

在 `docker-compose.yml` 中使用：

```yaml
postgres:
  environment:
    POSTGRES_DB: ${DB_NAME:-petcare}
    POSTGRES_USER: ${DB_USERNAME:-user}
    POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD is required}
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME:-user} -d ${DB_NAME:-petcare}"]

redis:
  command:
    - redis-server
    - --appendonly
    - "yes"
    - --maxmemory
    - 256mb
    - --maxmemory-policy
    - allkeys-lru
    - --requirepass
    - ${REDIS_PASSWORD:?REDIS_PASSWORD is required}
  healthcheck:
    test: ["CMD-SHELL", 'redis-cli -a "$$REDIS_PASSWORD" ping | grep PONG']
  environment:
    REDIS_PASSWORD: ${REDIS_PASSWORD:?REDIS_PASSWORD is required}

server:
  environment:
    DB_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD is required}
    REDIS_PASSWORD: ${REDIS_PASSWORD:?REDIS_PASSWORD is required}
    JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}
    DEFAULT_ADMIN_PHONE: ${DEFAULT_ADMIN_PHONE:?DEFAULT_ADMIN_PHONE is required}
    DEFAULT_ADMIN_PASSWORD: ${DEFAULT_ADMIN_PASSWORD:?DEFAULT_ADMIN_PASSWORD is required}
    SMS_DEV_CODE: ""
    NODE_ENV: production
```

保留非敏感的端口、TTL、队列和用户名默认值。

- [ ] **Step 4: 将环境模板说明统一为根目录 `.env`**

将 `.env.example` 开头改为：

```dotenv
# PetCare 环境变量配置示例
# 复制此文件为根目录 `.env` 并填写本地值
# 示例值仅用于本地开发；生产环境必须由部署平台注入独立强密钥
```

保留微信和 OSS 空值，以验证未启用时可启动；保留 `SMS_DEV_CODE=246810` 供本地直接运行 Server，生产 Compose 会显式覆盖为空。

同时将根目录 `package.json` 的工具测试入口扩展为：

```json
"test:tooling": "node --test scripts/repository-policy.test.mjs scripts/clean.test.mjs scripts/workspace-contract.test.mjs scripts/compose-policy.test.mjs"
```

- [ ] **Step 5: 验证策略与 Compose 解析**

Run: `node --test scripts/compose-policy.test.mjs`  
Expected: PASS。

Run: `docker compose --env-file .env.example config --quiet`  
Expected: PASS。

Run:

```powershell
New-Item -ItemType File -Force .compose-empty.env
docker compose --env-file .compose-empty.env config --quiet
Remove-Item -LiteralPath .compose-empty.env
```

Expected: FAIL，并明确指出第一个缺失变量。

- [ ] **Step 6: 提交**

```bash
git add .env.example docker-compose.yml package.json scripts/compose-policy.test.mjs
git commit -m "fix(docker): 移除生产环境弱密钥回退"
```

### Task 5: 建立真实 Server E2E 基线

**Files:**

- Create: `apps/server/test/jest-e2e.json`
- Create: `apps/server/test/health.e2e-spec.ts`
- Modify: `apps/server/package.json`

**Interfaces:**

- Consumes: PostgreSQL、Redis、Prisma Schema、`AppModule` 和统一响应拦截器。
- Produces: `pnpm --filter @petcare/server test:e2e`；验证 `/health` 的真实 HTTP 测试。

- [ ] **Step 1: 写入健康接口 E2E**

```ts
// apps/server/test/health.e2e-spec.ts
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("HealthController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns the unified response envelope", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);

    expect(response.body).toEqual({
      code: "SUCCESS",
      message: "操作成功",
      data: { status: "ok" },
      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
    expect(response.headers["x-request-id"]).toBe(response.body.meta.requestId);
    expect(Number.isNaN(Date.parse(response.body.meta.timestamp))).toBe(false);
  });
});
```

- [ ] **Step 2: 写入隔离的 E2E Jest 配置**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

- [ ] **Step 3: 在数据库服务未就绪时确认测试能准确失败**

Run:

```powershell
powershell -NoProfile -Command '$env:DB_PORT = "1"; $env:REDIS_PORT = "1"; pnpm --filter @petcare/server test:e2e'
```

Expected: FAIL，错误指向 PostgreSQL 或 Redis 连接，而不是缺少 Jest 配置文件。

- [ ] **Step 4: 补充 Prisma 测试准备命令**

在 `apps/server/package.json` 增加：

```json
{
  "prisma:push": "node --env-file-if-exists=../../.env node_modules/prisma/build/index.js db push",
  "test:e2e": "jest --config ./test/jest-e2e.json --runInBand"
}
```

- [ ] **Step 5: 启动基础设施并验证 Server E2E**

Run: `docker compose up -d postgres redis`  
Expected: PostgreSQL 与 Redis 进入 healthy。

Run: `pnpm --filter @petcare/server prisma:push`  
Expected: Prisma Schema 同步成功。

Run: `pnpm --filter @petcare/server prisma:seed`  
Expected: 默认管理员与角色初始化成功。

Run: `pnpm --filter @petcare/server test:e2e`  
Expected: PASS，健康接口响应、请求 ID 和时间戳断言通过。

- [ ] **Step 6: 提交**

```bash
git add apps/server/test/jest-e2e.json apps/server/test/health.e2e-spec.ts apps/server/package.json
git commit -m "test(server): 建立健康接口端到端基线"
```

### Task 6: 让 Admin Playwright 覆盖真实管理员登录

**Files:**

- Modify: `apps/admin/e2e/dashboard.spec.ts`
- Modify: `apps/admin/playwright.config.ts`
- Modify: `apps/admin/package.json`
- Modify: `apps/admin/e2e/README.md`

**Interfaces:**

- Consumes: Task 5 的已初始化数据库、Server `3000`、Admin `8986`、`DEFAULT_ADMIN_USERNAME` 和 `DEFAULT_ADMIN_PASSWORD`。
- Produces: 自动启动两端服务、真实登录后验证控制台的 Chromium E2E。

- [ ] **Step 1: 将用例改为每次先执行真实密码登录**

```ts
// apps/admin/e2e/dashboard.spec.ts
import { expect, test } from "@playwright/test";

function requiredEnv(name: "DEFAULT_ADMIN_USERNAME" | "DEFAULT_ADMIN_PASSWORD"): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for Admin E2E`);
  }

  return value;
}

test.describe("PetCare Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("手机号或账号").fill(requiredEnv("DEFAULT_ADMIN_USERNAME"));
    await page.getByLabel("密码").fill(requiredEnv("DEFAULT_ADMIN_PASSWORD"));
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.getByRole("heading", { name: "仪表盘" })).toBeVisible();
  });

  test("显示控制台统计数据", async ({ page }) => {
    await expect(page).toHaveTitle(/PetCare/);
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByText("总用户数")).toBeVisible();
    await expect(page.getByText("今日订单")).toBeVisible();
    await expect(page.getByText("本月收入")).toBeVisible();
    await expect(page.getByText("待处理纠纷")).toBeVisible();
  });

  for (const destination of [
    { link: "用户管理", path: /\/users$/, heading: "用户管理" },
    { link: "订单管理", path: /\/orders$/, heading: "订单管理" },
    { link: "系统设置", path: /\/settings$/, heading: "系统设置" },
  ]) {
    test(`导航到${destination.heading}`, async ({ page }) => {
      await page.getByRole("link", { name: destination.link }).click();
      await expect(page).toHaveURL(destination.path);
      await expect(page.getByRole("heading", { name: destination.heading })).toBeVisible();
    });
  }
});
```

- [ ] **Step 2: 在旧端口配置下运行并确认测试失败**

Run: `pnpm --filter @petcare/admin test:e2e`  
Expected: FAIL，Playwright 仍等待错误的 `3000` Admin 端口或无法完成登录。

- [ ] **Step 3: 修正 Playwright 端口、双服务启动和失败产物**

```ts
// apps/admin/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8986",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @petcare/server start",
      url: "http://127.0.0.1:3000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm dev --host 127.0.0.1",
      url: "http://127.0.0.1:8986",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
```

将 Admin E2E 脚本改为通过 Node 22 加载根目录 `.env`，现有 CI 环境变量保持更高优先级：

```json
"test:e2e": "node --env-file-if-exists=../../.env node_modules/@playwright/test/cli.js test"
```

- [ ] **Step 4: 更新 E2E 使用说明**

在 `apps/admin/e2e/README.md` 明确写入：

```markdown
1. `docker compose up -d postgres redis`
2. `pnpm --filter @petcare/server prisma:push`
3. `pnpm --filter @petcare/server prisma:seed`
4. `pnpm --filter @petcare/admin exec playwright install chromium`
5. `pnpm --filter @petcare/admin test:e2e`

Playwright 自动启动 Server `3000` 与 Admin `8986`，登录凭据读取根目录 `.env` 的
`DEFAULT_ADMIN_USERNAME` 和 `DEFAULT_ADMIN_PASSWORD`。
```

- [ ] **Step 5: 验证真实登录与控制台导航**

Run: `pnpm --filter @petcare/admin test:e2e`  
Expected: PASS，4 个 Chromium 用例均通过；若失败，生成 `playwright-report/` 与 `test-results/`。

- [ ] **Step 6: 提交**

```bash
git add apps/admin/e2e/dashboard.spec.ts apps/admin/playwright.config.ts apps/admin/package.json apps/admin/e2e/README.md
git commit -m "test(admin): 覆盖真实管理员登录与导航"
```

### Task 7: 建立分层 GitHub Actions 与 Dependabot

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`

**Interfaces:**

- Consumes: Tasks 1–6 的根级命令、测试环境配置、Prisma 初始化和 Playwright。
- Produces: PR 四层门禁；`master` 额外 Docker 构建；三类每周依赖更新。

- [ ] **Step 1: 创建 CI 工作流公共触发器和四个 PR Job**

```yaml
# .github/workflows/ci.yml
name: 持续集成

on:
  pull_request:
  push:
    branches:
      - master

permissions:
  contents: read

env:
  NODE_VERSION: "22"
  PNPM_VERSION: "11.15.1"

jobs:
  quality:
    name: 代码质量
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm typecheck
      - name: 校验提交信息
        shell: bash
        run: |
          if [[ "${{ github.event_name }}" == "pull_request" ]]; then
            pnpm exec commitlint --from "${{ github.event.pull_request.base.sha }}" --to "${{ github.sha }}" --verbose
          elif [[ "${{ github.event.before }}" =~ ^0+$ ]]; then
            git log -1 --pretty=%B | pnpm exec commitlint
          else
            pnpm exec commitlint --from "${{ github.event.before }}" --to "${{ github.sha }}" --verbose
          fi

  unit-test:
    name: 单元测试
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    name: 构建
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

  e2e:
    name: 端到端测试
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: petcare_test
          POSTGRES_USER: petcare_test
          POSTGRES_PASSWORD: petcare-test-database-password
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U petcare_test -d petcare_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      NODE_ENV: test
      PORT: "3000"
      DB_HOST: 127.0.0.1
      DB_PORT: "5432"
      DB_USERNAME: petcare_test
      DB_PASSWORD: petcare-test-database-password
      DB_NAME: petcare_test
      DB_SCHEMA: public
      REDIS_HOST: 127.0.0.1
      REDIS_PORT: "6379"
      REDIS_PASSWORD: ""
      JWT_SECRET: petcare-test-jwt-secret-with-more-than-32-characters
      DEFAULT_ADMIN_USERNAME: admin
      DEFAULT_ADMIN_PHONE: "13800138000"
      DEFAULT_ADMIN_PASSWORD: PetCare-Test-Admin-2026!
      ALLOWED_ORIGINS: http://127.0.0.1:8986
      LOG_LEVEL: error
      LOG_DIR: logs/server-e2e
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @petcare/server prisma:generate
      - run: pnpm --filter @petcare/server prisma:push
      - run: pnpm --filter @petcare/server prisma:seed
      - run: pnpm --filter @petcare/admin exec playwright install --with-deps chromium
      - run: pnpm test:e2e
      - name: 上传 Playwright 诊断产物
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-artifacts
          path: |
            apps/admin/playwright-report
            apps/admin/test-results
          if-no-files-found: ignore
```

CI Redis 只绑定 Job 网络并使用空密码；`NODE_ENV=test` 允许该隔离配置。生产 Redis 认证由 Task 4 的 Compose 必填表达式保证。

- [ ] **Step 2: 增加仅在 `master` 执行的 Docker Job**

```yaml
docker:
  name: 容器构建
  if: github.event_name == 'push' && github.ref == 'refs/heads/master'
  needs: [quality, unit-test, build, e2e]
  runs-on: ubuntu-latest
  env:
    DB_PASSWORD: docker-test-database-password
    REDIS_PASSWORD: docker-test-redis-password
    JWT_SECRET: docker-test-jwt-secret-with-more-than-32-characters
    DEFAULT_ADMIN_PHONE: "13800138000"
    DEFAULT_ADMIN_PASSWORD: Docker-Test-Admin-2026!
  steps:
    - uses: actions/checkout@v4
    - run: docker compose config --quiet
    - run: docker compose build server admin
```

- [ ] **Step 3: 创建每周三类依赖更新**

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
  - package-ecosystem: docker
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
```

- [ ] **Step 4: 校验 YAML、工作流引用和测试凭据边界**

Run: `pnpm exec prettier --check .github/workflows/ci.yml .github/dependabot.yml`  
Expected: PASS。

Run: `rg -n "WECHAT_APP_SECRET|ALIYUN_OSS_ACCESS_KEY_SECRET" .github`  
Expected: 无匹配。

Run: `rg -n "quality|unit-test|build|e2e|docker" .github/workflows/ci.yml`  
Expected: 五个 Job 均存在，`docker` 仅在 `master` push 执行。

- [ ] **Step 5: 提交**

```bash
git add .github/workflows/ci.yml .github/dependabot.yml
git commit -m "ci: 建立分层质量门禁与依赖维护"
```

### Task 8: 同步文档并执行全量验收

**Files:**

- Modify: `README.md`
- Modify: `docs/environment-variables.md`
- Modify: `docs/08-deployment/deployment.md`
- Modify: `docs/08-deployment/02-deployment-guide.md`
- Modify: `apps/admin/e2e/README.md`

**Interfaces:**

- Consumes: Tasks 1–7 的最终命令、配置边界和 CI 行为。
- Produces: 与实际脚本一致的快速开始、环境变量和部署说明；全量验收记录。

- [ ] **Step 1: 更新根目录快速开始和质量命令**

在 `README.md` 中将本地流程统一为：

```markdown
cp .env.example .env
docker compose up -d postgres redis
pnpm --filter @petcare/server prisma:push
pnpm --filter @petcare/server prisma:seed
pnpm dev
```

并记录：

```markdown
- Admin：http://localhost:8986
- Server：http://localhost:3000
- Swagger：http://localhost:3000/api-docs
- 完整本地门禁：`pnpm check`
- 端到端测试：`pnpm test:e2e`
```

- [ ] **Step 2: 更新环境变量和部署说明**

`docs/environment-variables.md` 必须明确：

- 根目录 `.env` 是本地唯一标准入口；
- `DEFAULT_ADMIN_PASSWORD` 至少 12 位；
- `JWT_SECRET` 至少 32 位；
- 生产环境必须设置 `REDIS_PASSWORD`；
- 微信 AppID/AppSecret 必须同时为空或同时提供；
- OSS 四项必须全部为空或全部提供；
- `SMS_DEV_CODE` 只允许非生产环境；
- CI 示例凭据仅用于隔离测试。

两个部署文档必须明确：

```markdown
生产启动前必须由部署平台注入：
`DB_PASSWORD`、`REDIS_PASSWORD`、`JWT_SECRET`、
`DEFAULT_ADMIN_PHONE`、`DEFAULT_ADMIN_PASSWORD`。

`docker compose config --quiet` 应在构建前执行；缺少任一必填值时部署终止。
```

- [ ] **Step 3: 格式化并运行静态质量门禁**

Run: `pnpm format`  
Expected: 格式化成功。

Run: `pnpm lint`  
Expected: PASS，无 Server ESM 配置告警。

Run: `pnpm typecheck`  
Expected: PASS，全部工作区参与。

Run: `git diff --check`  
Expected: PASS。

- [ ] **Step 4: 运行单元测试和全部构建**

Run: `pnpm test`  
Expected: PASS，工具测试、Admin Vitest、Server Jest、Miniapp Jest 和共享包测试全部通过。

Run: `pnpm test:coverage`  
Expected: PASS，覆盖率只由该任务生成。

Run: `pnpm build`  
Expected: PASS，日志包含 Admin、Server、Miniapp 微信端和共享包。

Run: `pnpm check`  
Expected: PASS，完整质量入口可重复执行。

- [ ] **Step 5: 运行真实 E2E**

Run: `docker compose up -d postgres redis`  
Expected: 两个基础设施容器 healthy。

Run: `pnpm --filter @petcare/server prisma:push`  
Expected: PASS。

Run: `pnpm --filter @petcare/server prisma:seed`  
Expected: PASS。

Run: `pnpm test:e2e`  
Expected: Server 健康接口和 Admin Chromium 登录导航全部 PASS。

- [ ] **Step 6: 冒烟验证根级开发命令**

Run: `pnpm dev`  
Expected: 输出同时出现 Vite `http://localhost:8986`、Nest `server.started` 端口 `3000` 和 Taro 微信端监听构建成功。确认三者就绪后使用 `Ctrl+C` 停止，不遗留 Server 或 Admin 容器。

- [ ] **Step 7: 验证 Docker 安全与镜像构建**

Run: `docker compose --env-file .env.example config --quiet`  
Expected: PASS。

Run: `docker compose build server admin`  
Expected: 两个镜像构建成功。

Run:

```powershell
New-Item -ItemType File -Force .compose-empty.env
docker compose --env-file .compose-empty.env config --quiet
Remove-Item -LiteralPath .compose-empty.env
```

Expected: FAIL，提示缺少 `DB_PASSWORD`。

- [ ] **Step 8: 提交文档和最终修正**

```bash
git add README.md docs/environment-variables.md docs/08-deployment/deployment.md docs/08-deployment/02-deployment-guide.md apps/admin/e2e/README.md
git commit -m "docs: 完善工程基线运行与部署指南"
```

- [ ] **Step 9: 完成前审计**

Run: `git status --short`  
Expected: 无输出。

Run: `git log -8 --oneline`  
Expected: 本计划各阶段均为中文 Conventional Commits，且提交边界与 Task 交付物一致。
