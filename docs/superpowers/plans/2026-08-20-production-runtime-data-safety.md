# Production Runtime and Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production Server send verification codes through Aliyun SMS, expose dependency-aware readiness, preserve operator-managed seed data, and initialize the empty production database through a committed Prisma migration.

**Architecture:** Keep development SMS behavior unchanged and select one singleton Aliyun `SendSms` client in production through the existing `SmsSender` seam. Keep `/health` as process liveness, add a separate `/ready` controller for PostgreSQL and Redis, make seed writes create-only for the administrator, and generate one Prisma baseline migration from the current schema for `migrate deploy`.

**Tech Stack:** NestJS 11, official Aliyun Dysmsapi SDK, Prisma 7.9.1, PostgreSQL 15, Redis 7, Jest 30, Node.js built-in policy tests, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-20-production-deployment-release-design.md`

## Global Constraints

- Node.js is `24.19.0`; supported Node.js versions are `>=24.12.0 <25`.
- Production must not configure or expose `SMS_DEV_CODE` and must not emit a fixed code, fake success, or OTP in logs.
- Production requires all four `ALIYUN_SMS_*` values; missing configuration must fail Server startup and therefore fail deployment readiness.
- Aliyun uses the fixed China endpoint `dysmsapi.aliyuncs.com`, template parameter name `code`, and no application-level retry because `SendSms` is not idempotent.
- SDK failures and non-`OK` responses return only `503 SMS_DELIVERY_FAILED`; phone numbers, OTP values, AccessKeys, and complete provider requests never enter client responses or logs.
- `/health` remains liveness; `/ready` succeeds only after a PostgreSQL query and Redis `PING` both succeed.
- The initial production schema is applied with `prisma migrate deploy`; production must never run `prisma db push`.
- The default administrator's password, status, username, and nickname are written only when that user does not exist.
- Existing role assignments, system-setting versions, and website content edited through Admin must not be overwritten by a repeated seed.
- Generate migration SQL with Prisma CLI; do not hand-edit generated migration SQL.

---

### Task 1: Send production verification codes through Aliyun SMS

**Files:**

- Create: `apps/server/src/auth/sms/aliyun-sms.sender.ts`
- Create: `apps/server/src/auth/sms/aliyun-sms.sender.spec.ts`
- Modify: `apps/server/src/auth/auth.module.ts`
- Modify: `apps/server/src/auth/auth.module.spec.ts`
- Modify: `apps/server/src/auth/verification-code.service.spec.ts`
- Modify: `apps/server/src/config/config.service.ts`
- Modify: `apps/server/src/config/config.service.spec.ts`
- Modify: `apps/server/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`
- Modify: `docker-compose.yml`

**Interfaces:**

- Consumes: the existing `SmsSender.sendCode(phone, code)` interface and `VerificationCodeService` cleanup path.
- Produces: `AliyunSmsSender` and exported `createSmsSender(configService)` used by the existing Nest provider.
- Configuration: `ALIYUN_SMS_ACCESS_KEY_ID`, `ALIYUN_SMS_ACCESS_KEY_SECRET`, `ALIYUN_SMS_SIGN_NAME`, and `ALIYUN_SMS_TEMPLATE_CODE`.

- [ ] **Step 1: Write one failing vertical slice at each approved seam**

Create `apps/server/src/auth/sms/aliyun-sms.sender.spec.ts` with a mock at the external SDK seam:

```typescript
import { AliyunSmsSender } from "./aliyun-sms.sender";

describe("AliyunSmsSender", () => {
  const phone = "13800138000";
  const code = "246810";

  it("maps the approved code parameter and accepts only an OK response", async () => {
    const client = { sendSms: jest.fn().mockResolvedValue({ body: { code: "OK" } }) };
    const sender = new AliyunSmsSender(client as never, "宠伴", "SMS_123456789");

    await sender.sendCode(phone, code);

    expect(client.sendSms).toHaveBeenCalledTimes(1);
    expect(client.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumbers: phone,
        signName: "宠伴",
        templateCode: "SMS_123456789",
        templateParam: JSON.stringify({ code }),
      }),
    );
  });

  it.each([
    [{ body: { code: "isv.BUSINESS_LIMIT_CONTROL" } }, undefined],
    [undefined, new Error(`provider request contained ${phone} and ${code}`)],
  ])("returns one sanitized 503 without retrying", async (response, rejection) => {
    const client = {
      sendSms: rejection
        ? jest.fn().mockRejectedValue(rejection)
        : jest.fn().mockResolvedValue(response),
    };
    const sender = new AliyunSmsSender(client as never, "宠伴", "SMS_123456789");

    await expect(sender.sendCode(phone, code)).rejects.toMatchObject({
      code: "SMS_DELIVERY_FAILED",
      clientMessage: "短信发送失败，请稍后重试",
      status: 503,
    });
    expect(client.sendSms).toHaveBeenCalledTimes(1);
  });
});
```

Extend `apps/server/src/auth/auth.module.spec.ts`:

```typescript
it("selects Aliyun in production and development sender elsewhere", () => {
  const production = createSmsSender({
    nodeEnv: "production",
    aliyunSmsAccessKeyId: "test-access-key-id",
    aliyunSmsAccessKeySecret: "test-access-key-secret",
    aliyunSmsSignName: "宠伴",
    aliyunSmsTemplateCode: "SMS_123456789",
  } as ConfigService);
  const development = createSmsSender({ nodeEnv: "development" } as ConfigService);

  expect(production).toBeInstanceOf(AliyunSmsSender);
  expect(development).toBeInstanceOf(DevelopmentSmsSender);
});
```

Extend `apps/server/src/config/config.service.spec.ts`: delete the four Aliyun keys in `beforeEach`, then require each one only in a complete production environment:

```typescript
const validProductionSmsEnv = {
  ALIYUN_SMS_ACCESS_KEY_ID: "test-access-key-id",
  ALIYUN_SMS_ACCESS_KEY_SECRET: "test-access-key-secret",
  ALIYUN_SMS_SIGN_NAME: "宠伴",
  ALIYUN_SMS_TEMPLATE_CODE: "SMS_123456789",
};

it.each(Object.keys(validProductionSmsEnv))("requires %s for production startup", (missingName) => {
  process.env = {
    ...originalEnv,
    ...validStartupEnv,
    ...validProductionSmsEnv,
    NODE_ENV: "production",
    REDIS_PASSWORD: "production-redis-password",
  };
  delete process.env[missingName];

  expect(() => new ConfigService().validateForStartup()).toThrow(`${missingName} is required`);
});
```

Extend `apps/server/src/auth/verification-code.service.spec.ts` through the public `send()` seam:

```typescript
it("removes the OTP and cooldown when the provider rejects delivery", async () => {
  sender.sendCode.mockRejectedValue(
    Object.assign(new Error("短信发送失败，请稍后重试"), {
      code: "SMS_DELIVERY_FAILED",
      status: 503,
    }),
  );

  await expect(service.send("13800138000")).rejects.toMatchObject({
    code: "SMS_DELIVERY_FAILED",
  });
  expect(redis.values.has("auth:otp:13800138000")).toBe(false);
  expect(redis.values.has("auth:otp:cooldown:13800138000")).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests and verify the new contract is red**

Run:

```bash
pnpm --filter @petcare/server test -- aliyun-sms.sender.spec.ts auth.module.spec.ts config.service.spec.ts verification-code.service.spec.ts
```

Expected: FAIL because `AliyunSmsSender`, production configuration getters, and `createSmsSender` do not exist.

- [ ] **Step 3: Add the pinned official SDK dependencies**

Run:

```bash
pnpm --filter @petcare/server add --save-exact @alicloud/dysmsapi20170525 @alicloud/openapi-client
```

Do not add the legacy `alibabacloud-dysmsapi20170525` package, a custom RPC signer, or a second retry library.

- [ ] **Step 4: Implement the smallest production sender and ConfigService boundary**

Add four required getters to `ConfigService`, and in the existing production block of `validateForStartup()` call each through `check(...)`:

```typescript
get aliyunSmsAccessKeyId(): string {
  return this.getRequiredString("ALIYUN_SMS_ACCESS_KEY_ID");
}

get aliyunSmsAccessKeySecret(): string {
  return this.getRequiredString("ALIYUN_SMS_ACCESS_KEY_SECRET");
}

get aliyunSmsSignName(): string {
  return this.getRequiredString("ALIYUN_SMS_SIGN_NAME");
}

get aliyunSmsTemplateCode(): string {
  return this.getRequiredString("ALIYUN_SMS_TEMPLATE_CODE");
}
```

Create `apps/server/src/auth/sms/aliyun-sms.sender.ts`:

```typescript
import Dysmsapi20170525, * as $Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { SmsSender } from "./sms-sender";

type AliyunSmsClient = Pick<Dysmsapi20170525, "sendSms">;

@Injectable()
export class AliyunSmsSender implements SmsSender {
  constructor(
    private readonly client: AliyunSmsClient,
    private readonly signName: string,
    private readonly templateCode: string,
  ) {}

  async sendCode(phone: string, code: string): Promise<void> {
    try {
      const response = await this.client.sendSms(
        new $Dysmsapi20170525.SendSmsRequest({
          phoneNumbers: phone,
          signName: this.signName,
          templateCode: this.templateCode,
          templateParam: JSON.stringify({ code }),
        }),
      );

      if (response.body?.code !== "OK") {
        throw new Error("Aliyun SMS rejected the request");
      }
    } catch {
      throw new ApiException(
        "SMS_DELIVERY_FAILED",
        "短信发送失败，请稍后重试",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
```

Export a selector from `apps/server/src/auth/auth.module.ts` and reuse it in the existing provider:

```typescript
export function createSmsSender(configService: ConfigService): SmsSender {
  if (configService.nodeEnv !== "production") {
    return new DevelopmentSmsSender();
  }

  const clientConfig = new $OpenApi.Config({
    accessKeyId: configService.aliyunSmsAccessKeyId,
    accessKeySecret: configService.aliyunSmsAccessKeySecret,
  });
  clientConfig.endpoint = "dysmsapi.aliyuncs.com";

  return new AliyunSmsSender(
    new Dysmsapi20170525(clientConfig),
    configService.aliyunSmsSignName,
    configService.aliyunSmsTemplateCode,
  );
}
```

Use `@alicloud/openapi-client` as `$OpenApi` and the SDK default export. Replace the inline provider factory with `useFactory: createSmsSender`. Do not add retry logic or log caught SDK errors; the existing `VerificationCodeService` catch remains the single OTP/cooldown cleanup path.

- [ ] **Step 5: Pass only named runtime configuration into the Server container**

Add blank examples next to `SMS_DEV_CODE` in `.env.example`:

```dotenv
ALIYUN_SMS_ACCESS_KEY_ID=
ALIYUN_SMS_ACCESS_KEY_SECRET=
ALIYUN_SMS_SIGN_NAME=
ALIYUN_SMS_TEMPLATE_CODE=
```

Pass the same four names in the Server `environment` block of `docker-compose.yml` using empty defaults so local development remains unchanged:

```yaml
ALIYUN_SMS_ACCESS_KEY_ID: ${ALIYUN_SMS_ACCESS_KEY_ID:-}
ALIYUN_SMS_ACCESS_KEY_SECRET: ${ALIYUN_SMS_ACCESS_KEY_SECRET:-}
ALIYUN_SMS_SIGN_NAME: ${ALIYUN_SMS_SIGN_NAME:-}
ALIYUN_SMS_TEMPLATE_CODE: ${ALIYUN_SMS_TEMPLATE_CODE:-}
```

- [ ] **Step 6: Run focused Server verification**

Run:

```bash
pnpm --filter @petcare/server test -- aliyun-sms.sender.spec.ts auth.module.spec.ts config.service.spec.ts verification-code.service.spec.ts
pnpm --filter @petcare/server typecheck
node --test scripts/compose-policy.test.mjs
git diff --check
```

Expected: all selected tests, Server typecheck, Compose policy, and diff hygiene pass.

- [ ] **Step 7: Commit the production SMS behavior**

```bash
git add .env.example docker-compose.yml apps/server/package.json pnpm-lock.yaml apps/server/src/config/config.service.ts apps/server/src/config/config.service.spec.ts apps/server/src/auth/auth.module.ts apps/server/src/auth/auth.module.spec.ts apps/server/src/auth/verification-code.service.spec.ts apps/server/src/auth/sms/aliyun-sms.sender.ts apps/server/src/auth/sms/aliyun-sms.sender.spec.ts
git commit -m "feat(auth): 接入阿里云短信验证码"
```

---

### Task 2: Make repeated seed execution preserve production-owned data

**Files:**

- Modify: `apps/server/src/seed/seed-initial-data.ts`
- Modify: `apps/server/src/seed/seed-initial-data.spec.ts`
- Modify: `apps/server/src/seed/seed-system-settings.spec.ts`
- Modify: `apps/server/src/seed/seed-website-content.ts`
- Modify: `apps/server/src/seed/seed-website-content.spec.ts`

**Interfaces:**

- Consumes: `seedInitialData(prisma, options, passwordService)`, `seedSystemSettings(prisma, operatorId)`, and `seedWebsiteContent(prisma, operatorId)`.
- Produces: An idempotent seed contract where catalog data may be synchronized but existing administrator fields and published/draft pointers remain operator-owned.

- [ ] **Step 1: Add the failing administrator preservation test**

Append to `apps/server/src/seed/seed-initial-data.spec.ts`:

```typescript
it("does not reset an existing administrator's profile, password, or status", async () => {
  const state = createFakePrisma();

  await seedInitialData(state.prisma, options, passwordService);
  Object.assign(state.users[0], {
    username: "operator-renamed",
    nickname: "人工维护昵称",
    passwordHash: "$argon2id$v=19$operator-password",
    status: "disabled",
  });

  await seedInitialData(
    state.prisma,
    {
      ...options,
      username: "admin-reset",
      nickname: "系统管理员",
      password: "New-Seed-Password!42",
    },
    passwordService,
  );

  expect(state.users[0]).toMatchObject({
    username: "operator-renamed",
    nickname: "人工维护昵称",
    passwordHash: "$argon2id$v=19$operator-password",
    status: "disabled",
  });
});
```

Add this partial-pointer safety test to `apps/server/src/seed/seed-website-content.spec.ts`:

```typescript
it("does not replace an existing operator-owned website pointer", async () => {
  const state = createFakePrisma();

  await seedWebsiteContent(state.prisma, "admin-1");
  Object.assign(state.contents[0], {
    currentDraftVersionId: null,
    publishedVersionId: "operator-published",
  });
  await seedWebsiteContent(state.prisma, "admin-1");

  expect(state.contents[0]).toMatchObject({
    currentDraftVersionId: null,
    publishedVersionId: "operator-published",
  });
});
```

- [ ] **Step 2: Run the seed test and confirm the overwrite is reproduced**

Run:

```bash
pnpm --filter @petcare/server test -- seed-initial-data.spec.ts
```

Expected: FAIL because the current `user.upsert()` update branch rewrites administrator fields and the Website seed replaces an existing pointer when its sibling pointer is null.

- [ ] **Step 3: Make administrator fields create-only**

In `apps/server/src/seed/seed-initial-data.ts`, keep the existing password hash generation but use it only in `create`:

```typescript
const passwordHash = await passwordService.hash(options.password);
const user = await prisma.user.upsert({
  where: { phone: options.phone },
  update: {},
  create: {
    phone: options.phone,
    username: options.username,
    nickname: options.nickname,
    passwordHash,
    userType: "pet_owner",
    status: "active",
  },
});
```

Leave permission catalog synchronization and missing role links intact; they are platform-owned authorization data.

In `seedTemplate()` within `apps/server/src/seed/seed-website-content.ts`, treat either existing pointer as operator-owned:

```typescript
if (content.currentDraftVersionId !== null || content.publishedVersionId !== null) {
  return;
}
```

- [ ] **Step 4: Add a regression assertion for the already-safe system-setting seed**

In `apps/server/src/seed/seed-system-settings.spec.ts`, add:

```typescript
it("does not repoint an operator-managed published configuration", async () => {
  const state = createFakePrisma();

  await seedSystemSettings(state.prisma, "admin-1");
  state.pointers[0].publishedVersionId = "operator-published-version";
  await seedSystemSettings(state.prisma, "admin-1");

  expect(state.pointers[0].publishedVersionId).toBe("operator-published-version");
});
```

Use the existing fake Prisma state arrays; do not add a database fixture framework.

- [ ] **Step 5: Run all three seed suites**

Run:

```bash
pnpm --filter @petcare/server test -- seed-initial-data.spec.ts seed-system-settings.spec.ts seed-website-content.spec.ts
```

Expected: all selected suites pass; repeated seed creates no duplicate records and preserves operator-managed values.

- [ ] **Step 6: Commit the seed safety boundary**

```bash
git add apps/server/src/seed/seed-initial-data.ts apps/server/src/seed/seed-initial-data.spec.ts apps/server/src/seed/seed-system-settings.spec.ts apps/server/src/seed/seed-website-content.ts apps/server/src/seed/seed-website-content.spec.ts
git commit -m "fix(seed): 保留生产环境人工维护数据"
```

---

### Task 3: Add dependency-aware Server readiness

**Files:**

- Create: `apps/server/src/health/readiness.controller.ts`
- Create: `apps/server/src/health/readiness.controller.spec.ts`
- Modify: `apps/server/src/config/config.module.ts`
- Modify: `apps/server/src/auth/auth.module.ts`
- Modify: `apps/server/src/health/health.module.ts`
- Modify: `docker-compose.yml`
- Modify: `scripts/compose-policy.test.mjs`

**Interfaces:**

- Consumes: `PrismaService.$queryRaw`, `RedisService.getClient().ping()`, and `HealthResponseDto`.
- Produces: `GET /ready -> Promise<HealthResponseDto>` and a Server container healthcheck that calls `/ready`.

- [ ] **Step 1: Write failing unit tests for both dependencies**

Create `apps/server/src/health/readiness.controller.spec.ts`:

```typescript
import { RedisService } from "../config/redis.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReadinessController } from "./readiness.controller";

describe("ReadinessController", () => {
  const prisma = { $queryRaw: jest.fn() };
  const redisClient = { ping: jest.fn() };
  const redis = { getClient: () => redisClient };
  const controller = new ReadinessController(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ ready: 1 }]);
    redisClient.ping.mockResolvedValue("PONG");
  });

  it("reports ready only after PostgreSQL and Redis respond", async () => {
    await expect(controller.check()).resolves.toEqual({ status: "ok" });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(redisClient.ping).toHaveBeenCalledTimes(1);
  });

  it("rejects when either dependency is unavailable", async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(controller.check()).rejects.toThrow("database unavailable");
  });
});
```

Extend `scripts/compose-policy.test.mjs`:

```javascript
test("Server 容器使用依赖就绪探针", async () => {
  const compose = await readFile(resolve(root, "docker-compose.yml"), "utf8");
  const server = serviceBlock(compose, "server");

  assert.match(server, /http:\/\/localhost:3000\/ready/);
  assert.doesNotMatch(server, /http:\/\/localhost:3000\/health/);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
pnpm --filter @petcare/server test -- readiness.controller.spec.ts
node --test scripts/compose-policy.test.mjs
```

Expected: FAIL because the readiness controller is missing and Compose still probes `/health`.

- [ ] **Step 3: Implement the readiness controller**

Create `apps/server/src/health/readiness.controller.ts`:

```typescript
import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RedisService } from "../config/redis.service";
import { PrismaService } from "../prisma/prisma.service";
import { ApiStandardErrors, ApiSuccessResponse } from "../common/swagger/api-response.decorators";
import { HealthResponseDto } from "./dto/health-response.dto";

@ApiTags("health")
@Controller("ready")
export class ReadinessController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: "检查服务依赖就绪状态" })
  @ApiSuccessResponse(HealthResponseDto)
  @ApiStandardErrors(500)
  async check(): Promise<HealthResponseDto> {
    await Promise.all([this.prisma.$queryRaw`SELECT 1 AS ready`, this.redis.getClient().ping()]);

    return { status: "ok" };
  }
}
```

Move the existing `RedisService` registration from `AuthModule` into the global `ConfigModule` so readiness and authentication share one Redis connection:

```typescript
@Global()
@Module({
  providers: [ConfigService, RedisService],
  exports: [ConfigService, RedisService],
})
export class ConfigModule {}
```

Remove `RedisService` from `AuthModule.providers`, then register `ReadinessController` beside `HealthController` in `HealthModule`:

```typescript
@Module({
  controllers: [HealthController, ReadinessController],
})
export class HealthModule {}
```

Keep `HealthController.check()` synchronous and dependency-free.

- [ ] **Step 4: Point Compose at `/ready`**

Change only the Server healthcheck URL in `docker-compose.yml`:

```yaml
healthcheck:
  test:
    [
      "CMD-SHELL",
      'node -e "fetch(''http://localhost:3000/ready'').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"',
    ]
```

- [ ] **Step 5: Run focused verification**

Run:

```bash
pnpm --filter @petcare/server test -- readiness.controller.spec.ts
pnpm --filter @petcare/server typecheck
node --test scripts/compose-policy.test.mjs
docker compose --env-file .env config --quiet
```

Expected: all commands exit 0. The existing `/health` route remains unchanged; `/ready` calls both dependencies.

- [ ] **Step 6: Commit readiness**

```bash
git add apps/server/src/health/readiness.controller.ts apps/server/src/health/readiness.controller.spec.ts apps/server/src/config/config.module.ts apps/server/src/auth/auth.module.ts apps/server/src/health/health.module.ts docker-compose.yml scripts/compose-policy.test.mjs
git commit -m "feat(health): 增加服务依赖就绪探针"
```

---

### Task 4: Generate and enforce the initial Prisma migration

**Files:**

- Create with Prisma CLI, then rename the generated directory only: `apps/server/prisma/migrations/20260820000000_initial_schema/migration.sql`
- Create with Prisma CLI: `apps/server/prisma/migrations/migration_lock.toml`
- Modify: `.gitignore`
- Modify: `apps/server/package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/ci-policy.test.mjs`
- Modify: `scripts/workspace-contract.test.mjs`

**Interfaces:**

- Consumes: the current `apps/server/prisma/schema.prisma` and the root `.env` database fields.
- Produces: `pnpm --filter @petcare/server prisma:migrate:deploy`, a committed baseline migration, and CI that verifies migrations against an empty PostgreSQL database.

- [ ] **Step 1: Add failing policy assertions for migration-based initialization**

Extend `scripts/ci-policy.test.mjs`:

```javascript
test("CI initializes PostgreSQL through committed migrations", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");
  const e2eJob = workflow.slice(workflow.indexOf("\n  e2e:"), workflow.indexOf("\n  docker:"));

  assert.match(e2eJob, /pnpm --filter @petcare\/server prisma:migrate:deploy/);
  assert.doesNotMatch(e2eJob, /prisma:push|prisma db push/);
});
```

Update `scripts/workspace-contract.test.mjs` so the Server manifest must expose the exact command:

```javascript
assert.equal(
  server.scripts["prisma:migrate:deploy"],
  "node --env-file-if-exists=../../.env node_modules/prisma/build/index.js migrate deploy",
);
```

Replace the README startup expectation from `prisma:push` to `prisma:migrate:deploy`.

- [ ] **Step 2: Run the policy tests and confirm they fail**

Run:

```bash
node --test scripts/ci-policy.test.mjs scripts/workspace-contract.test.mjs
```

Expected: FAIL because the script is absent and CI still runs `prisma:push`.

- [ ] **Step 3: Stop ignoring migrations and add Prisma lifecycle scripts**

Remove only this line from `.gitignore`:

```gitignore
prisma/migrations/
```

Keep `apps/server/src/generated/` ignored. Add these scripts to `apps/server/package.json`:

```json
"prisma:migrate:create": "node --env-file-if-exists=../../.env node_modules/prisma/build/index.js migrate dev",
"prisma:migrate:deploy": "node --env-file-if-exists=../../.env node_modules/prisma/build/index.js migrate deploy",
"prisma:migrate:status": "node --env-file-if-exists=../../.env node_modules/prisma/build/index.js migrate status"
```

- [ ] **Step 4: Generate the baseline from the current schema with Prisma CLI**

Use two explicitly named scratch databases so no existing local or production data is touched:

```powershell
docker compose --env-file .env up -d postgres
docker compose --env-file .env exec -T postgres sh -lc 'dropdb -U "$POSTGRES_USER" --if-exists petcare_migration_source && createdb -U "$POSTGRES_USER" petcare_migration_source'
$env:DB_NAME = "petcare_migration_source"
pnpm --filter @petcare/server prisma:migrate:create -- --name initial_schema --create-only
$generatedMigration = Get-ChildItem -LiteralPath "apps/server/prisma/migrations" -Directory | Where-Object { $_.Name -like "*_initial_schema" }
if ($generatedMigration.Count -ne 1) { throw "Expected exactly one generated initial_schema migration" }
Move-Item -LiteralPath $generatedMigration.FullName -Destination "apps/server/prisma/migrations/20260820000000_initial_schema"
Remove-Item Env:DB_NAME
```

Expected: Prisma creates exactly one migration plus `migration_lock.toml`; only the generated directory is renamed to the deterministic committed path. Inspect, but do not edit, the generated SQL and confirm it defines the current schema's 47 models and two enums reported by Prisma.

- [ ] **Step 5: Switch CI E2E initialization to migration deploy**

In `.github/workflows/ci.yml`, replace the database push step with:

```yaml
- run: pnpm --filter @petcare/server prisma:migrate:deploy
- run: pnpm --filter @petcare/server prisma:seed
```

Keep shared-types build and Prisma Client generation before these steps.

- [ ] **Step 6: Apply the migration to a second empty database and prove repeatability**

Run:

```powershell
docker compose --env-file .env exec -T postgres sh -lc 'dropdb -U "$POSTGRES_USER" --if-exists petcare_migration_verify && createdb -U "$POSTGRES_USER" petcare_migration_verify'
$env:DB_NAME = "petcare_migration_verify"
pnpm --filter @petcare/server prisma:migrate:deploy
pnpm --filter @petcare/server prisma:migrate:deploy
pnpm --filter @petcare/server prisma:migrate:status
Remove-Item Env:DB_NAME
docker compose --env-file .env exec -T postgres sh -lc 'dropdb -U "$POSTGRES_USER" --if-exists petcare_migration_source && dropdb -U "$POSTGRES_USER" --if-exists petcare_migration_verify'
```

Expected: the first deploy applies one migration, the second reports no pending migration, and status reports the schema is up to date.

- [ ] **Step 7: Run focused migration policy verification**

Run:

```bash
node --test scripts/ci-policy.test.mjs scripts/workspace-contract.test.mjs
pnpm --filter @petcare/server prisma:generate
pnpm --filter @petcare/server typecheck
git diff --check
```

Expected: all commands exit 0 and `git status --short` shows the generated migration files as untracked until staged.

- [ ] **Step 8: Commit the migration baseline and CI contract**

```bash
git add .gitignore apps/server/package.json apps/server/prisma/migrations .github/workflows/ci.yml scripts/ci-policy.test.mjs scripts/workspace-contract.test.mjs
git commit -m "feat(database): 建立生产初始迁移基线"
```

---

### Task 5: Document the runtime and migration contract

**Files:**

- Modify: `README.md`
- Modify: `apps/server/prisma/SEED-GUIDE.md`
- Modify: `docker/README.md`
- Modify: `docs/05-database-design/01-database-schema.md`
- Modify: `docs/08-deployment/deployment.md`
- Modify: `docs/environment-variables.md`

**Interfaces:**

- Consumes: the commands and HTTP endpoints implemented in Tasks 1-4.
- Produces: one consistent operator path for local initialization, production migration, seed safety, liveness, readiness, and Aliyun production SMS.

- [ ] **Step 1: Replace obsolete production instructions with exact supported commands**

Use these command blocks consistently:

```bash
# Empty database initialization and every later production schema rollout
pnpm --filter @petcare/server prisma:migrate:deploy

# Explicit first-data initialization only
pnpm --filter @petcare/server prisma:seed
```

Document that `prisma:push` is restricted to disposable local schema experiments and is never part of deployment. Update the seed guide to state that repeated seed preserves administrator profile/password/status and existing website/system-setting pointers.

- [ ] **Step 2: Document the health endpoints and production SMS configuration**

Add this operator table to `docs/08-deployment/deployment.md`:

```markdown
| Endpoint  | Meaning               | Dependencies                    |
| --------- | --------------------- | ------------------------------- |
| `/health` | Nest process liveness | None                            |
| `/ready`  | Traffic readiness     | PostgreSQL query + Redis `PING` |
```

Update `docs/environment-variables.md` with the four required `ALIYUN_SMS_*` names, fixed endpoint `dysmsapi.aliyuncs.com`, template parameter `code`, and the rule that AccessKey values belong only in the root-owned production `.env`. State that `SMS_DEV_CODE` remains forbidden in production and provider rejection returns `503 SMS_DELIVERY_FAILED` without exposing vendor details.

Update `docs/08-deployment/deployment.md` to require an approved Aliyun SMS signature and verification template before first deployment. The template uses `${code}`. Document a dedicated RAM user restricted to `dysms:SendSms`; do not show or request real AccessKey values in any command example.

- [ ] **Step 3: Run documentation and diff hygiene checks**

Run:

```bash
pnpm exec prettier --check README.md apps/server/prisma/SEED-GUIDE.md docker/README.md docs/05-database-design/01-database-schema.md docs/08-deployment/deployment.md docs/environment-variables.md
rg -n "prisma:push|prisma db push" README.md apps/server/prisma/SEED-GUIDE.md docker/README.md docs/05-database-design/01-database-schema.md docs/08-deployment/deployment.md
rg -n "ALIYUN_SMS_ACCESS_KEY_ID|ALIYUN_SMS_ACCESS_KEY_SECRET|ALIYUN_SMS_SIGN_NAME|ALIYUN_SMS_TEMPLATE_CODE|SMS_DELIVERY_FAILED" .env.example docs/environment-variables.md docs/08-deployment/deployment.md
git diff --check
```

Expected: Prettier and diff checks pass. Any remaining `prisma:push` mention explicitly labels it disposable-local-only; no production procedure uses it.

- [ ] **Step 4: Commit the runtime documentation**

```bash
git add README.md apps/server/prisma/SEED-GUIDE.md docker/README.md docs/05-database-design/01-database-schema.md docs/08-deployment/deployment.md docs/environment-variables.md
git commit -m "docs(deploy): 说明迁移与运行时安全边界"
```
