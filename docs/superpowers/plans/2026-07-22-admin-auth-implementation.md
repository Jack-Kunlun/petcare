# Admin Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a seeded default administrator and a complete Admin login flow supporting SMS verification codes and phone/username plus password.

**Architecture:** Extend the existing `User` identity and RBAC models, add a focused NestJS `AuthModule`, store OTP and refresh-session state in Redis, and keep the refresh token in an HttpOnly cookie. The React Admin app owns only the short-lived access token in memory and restores sessions through `/auth/refresh`.

**Tech Stack:** Node.js 22, pnpm 11.15.1, NestJS 11, Prisma 7.8, PostgreSQL 15, Redis 7, Argon2id, Passport JWT, Jest, React 19, React Router 7, Axios, Vitest, Testing Library.

## Global Constraints

- All server configuration is accessed through `ConfigService`; production code must not read `process.env` directly.
- Prisma/TypeScript names remain PascalCase/camelCase; PostgreSQL tables and columns remain plural snake_case through `@@map` and `@map`.
- Access tokens expire after 15 minutes; refresh tokens expire after 7 days and rotate on refresh.
- OTP codes contain 6 digits, expire after 300 seconds, have a 60-second send cooldown, allow 5 sends per hour, and allow 5 failed verification attempts.
- `SMS_DEV_CODE` is accepted only outside production; API responses never expose the code.
- Seed requires `DEFAULT_ADMIN_PHONE` and `DEFAULT_ADMIN_PASSWORD`; it never falls back to a public password.
- Default identity is username `admin`, phone `17679141878`, role `super_admin`, status `active`.
- Passwords use Argon2id; database and Redis must never contain raw passwords or raw OTP codes.
- Existing dirty-worktree changes are user-owned and must not be reset or overwritten.
- Every behavior change follows Red-Green-Refactor and is committed only with its directly related files.

---

### Task 1: Authentication schema, dependencies, and typed configuration

**Files:**

- Modify: `apps/server/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/server/prisma/schema.prisma`
- Modify: `apps/server/src/config/config.service.ts`
- Create: `apps/server/src/config/config.service.spec.ts`
- Modify: `.env.example`
- Modify: `docker-compose.yml`

**Interfaces:**

- Produces: `User.username?: string`, `User.passwordHash?: string`.
- Produces: typed configuration getters `jwtAccessExpiresIn`, `jwtRefreshExpiresIn`, `refreshTokenTtlSeconds`, `smsDevCode`, `smsCodeTtlSeconds`, `smsSendCooldownSeconds`, `smsHourlyLimit`, `smsMaxAttempts`, `defaultAdminUsername`, `defaultAdminPhone`, and `defaultAdminPassword`.

- [ ] **Step 1: Install authentication runtime and test dependencies**

Run:

```powershell
pnpm --filter @petcare/server add argon2 cookie-parser
pnpm --filter @petcare/server add -D @types/cookie-parser supertest @types/supertest
```

Expected: policy-compatible stable releases are added and `pnpm-lock.yaml` remains valid under the configured minimum-release-age policy.

- [ ] **Step 2: Write failing configuration tests**

Create `config.service.spec.ts` with isolated environment setup and assertions equivalent to:

```ts
describe("ConfigService authentication configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns the documented authentication defaults", () => {
    const config = new ConfigService();

    expect(config.jwtAccessExpiresIn).toBe("15m");
    expect(config.jwtRefreshExpiresIn).toBe("7d");
    expect(config.refreshTokenTtlSeconds).toBe(604800);
    expect(config.smsCodeTtlSeconds).toBe(300);
    expect(config.smsSendCooldownSeconds).toBe(60);
    expect(config.smsHourlyLimit).toBe(5);
    expect(config.smsMaxAttempts).toBe(5);
  });

  it("rejects a production development SMS code", () => {
    process.env.NODE_ENV = "production";
    process.env.SMS_DEV_CODE = "246810";

    expect(() => new ConfigService().smsDevCode).toThrow(
      "SMS_DEV_CODE must not be configured in production",
    );
  });
});
```

- [ ] **Step 3: Run the configuration test and verify RED**

Run: `pnpm --filter @petcare/server test -- config/config.service.spec.ts --runInBand`

Expected: FAIL because the authentication getters do not exist.

- [ ] **Step 4: Add schema fields and minimal typed getters**

Add to `User`:

```prisma
username     String? @unique
passwordHash String? @map("password_hash")
```

Add getters to `ConfigService` using the existing positive-integer helper. `defaultAdminPhone` and `defaultAdminPassword` must throw when missing; `defaultAdminUsername` defaults to `admin`; `smsDevCode` validates `/^\d{6}$/` and rejects production use.

- [ ] **Step 5: Document and pass configuration into Docker**

Add the following names to `.env.example` and the `server.environment` section of `docker-compose.yml`:

```dotenv
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REFRESH_TOKEN_TTL_SECONDS=604800
SMS_DEV_CODE=246810
SMS_CODE_TTL_SECONDS=300
SMS_SEND_COOLDOWN_SECONDS=60
SMS_HOURLY_LIMIT=5
SMS_MAX_ATTEMPTS=5
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PHONE=17679141878
DEFAULT_ADMIN_PASSWORD=CHANGE_ME_TO_A_STRONG_RANDOM_PASSWORD
```

- [ ] **Step 6: Verify GREEN and Prisma schema validity**

Run:

```powershell
pnpm --filter @petcare/server test -- config/config.service.spec.ts --runInBand
pnpm --filter @petcare/server exec prisma format
pnpm --filter @petcare/server exec prisma validate
pnpm --filter @petcare/server exec prisma generate
```

Expected: configuration tests PASS and Prisma commands exit 0.

---

### Task 2: Password hashing service

**Files:**

- Create: `apps/server/src/auth/password.service.ts`
- Create: `apps/server/src/auth/password.service.spec.ts`

**Interfaces:**

- Produces: `PasswordService.hash(password: string): Promise<string>`.
- Produces: `PasswordService.verify(hash: string, password: string): Promise<boolean>`.

- [ ] **Step 1: Write failing password behavior tests**

```ts
describe("PasswordService", () => {
  const service = new PasswordService();

  it("stores an Argon2id hash instead of plaintext", async () => {
    const hash = await service.hash("Correct-Horse-Battery-Staple!42");

    expect(hash).not.toContain("Correct-Horse-Battery-Staple!42");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("accepts the correct password and rejects a wrong password", async () => {
    const hash = await service.hash("Correct-Horse-Battery-Staple!42");

    await expect(service.verify(hash, "Correct-Horse-Battery-Staple!42")).resolves.toBe(true);
    await expect(service.verify(hash, "wrong-password")).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run the password test and verify RED**

Run: `pnpm --filter @petcare/server test -- auth/password.service.spec.ts --runInBand`

Expected: FAIL because `PasswordService` does not exist.

- [ ] **Step 3: Implement the minimal Argon2id wrapper**

Use `argon2.hash(password, { type: argon2.argon2id })` and `argon2.verify(hash, password)`. Reject passwords shorter than 12 characters before hashing so seed cannot create a weak default password.

- [ ] **Step 4: Run the password test and verify GREEN**

Run: `pnpm --filter @petcare/server test -- auth/password.service.spec.ts --runInBand`

Expected: 2 tests PASS.

---

### Task 3: Idempotent production-safe seed

**Files:**

- Create: `apps/server/src/seed/seed-initial-data.ts`
- Create: `apps/server/src/seed/seed-initial-data.spec.ts`
- Replace: `apps/server/prisma/seed.ts`
- Update: `apps/server/prisma/SEED-GUIDE.md`

**Interfaces:**

- Consumes: `PasswordService.hash`, `ConfigService.defaultAdmin*`, Prisma delegates.
- Produces: `seedInitialData(prisma, options): Promise<void>` where options contain `username`, `phone`, `password`, and `nickname`.

- [ ] **Step 1: Write failing seed tests with a stateful fake Prisma client**

The fake must implement `permission.upsert/findMany`, `role.upsert`, `rolePermission.upsert`, `user.upsert`, and `userRole.upsert`. Tests assert:

```ts
it("creates one super admin and assigns all permissions", async () => {
  await seedInitialData(prisma, {
    username: "admin",
    phone: "17679141878",
    password: "Correct-Horse-Battery-Staple!42",
    nickname: "系统管理员",
  });

  expect(prisma.roles).toHaveLength(1);
  expect(prisma.roles[0].roleName).toBe("super_admin");
  expect(prisma.users[0]).toMatchObject({ username: "admin", phone: "17679141878" });
  expect(prisma.users[0].passwordHash).toMatch(/^\$argon2id\$/);
  expect(prisma.userRoles).toHaveLength(1);
  expect(prisma.rolePermissions).toHaveLength(prisma.permissions.length);
});

it("is idempotent", async () => {
  await seedInitialData(prisma, options);
  await seedInitialData(prisma, options);

  expect(prisma.roles).toHaveLength(1);
  expect(prisma.users).toHaveLength(1);
  expect(prisma.userRoles).toHaveLength(1);
});
```

- [ ] **Step 2: Run seed tests and verify RED**

Run: `pnpm --filter @petcare/server test -- seed/seed-initial-data.spec.ts --runInBand`

Expected: FAIL because `seedInitialData` does not exist.

- [ ] **Step 3: Implement minimal seed orchestration**

Move the existing permission definitions into `seed-initial-data.ts`, remove demo users and non-default roles, upsert `super_admin`, assign all permissions, hash the configured password, upsert the admin by phone, and upsert the user-role relation. Update existing records with current descriptions, username, nickname, status, and password hash.

Replace `prisma/seed.ts` with a thin composition root that constructs Prisma, ConfigService, and calls `seedInitialData`.

- [ ] **Step 4: Run seed tests and verify GREEN**

Run: `pnpm --filter @petcare/server test -- seed/seed-initial-data.spec.ts --runInBand`

Expected: seed tests PASS twice without duplicate fake state.

---

### Task 4: Redis verification-code service and SMS abstraction

**Files:**

- Create: `apps/server/src/auth/sms/sms-sender.ts`
- Create: `apps/server/src/auth/sms/development-sms.sender.ts`
- Create: `apps/server/src/auth/verification-code.service.ts`
- Create: `apps/server/src/auth/verification-code.service.spec.ts`
- Modify: `apps/server/src/config/redis.service.ts`

**Interfaces:**

- Produces: `SmsSender.sendCode(phone: string, code: string): Promise<void>`.
- Produces: `VerificationCodeService.send(phone: string): Promise<void>`.
- Produces: `VerificationCodeService.verifyAndConsume(phone: string, code: string): Promise<boolean>`.

- [ ] **Step 1: Write failing OTP tests using a deterministic in-memory Redis fake**

Cover these exact behaviors:

```ts
it("stores only a digest and sends the configured six-digit code", async () => {
  await service.send("17679141878");
  expect(sender.sendCode).toHaveBeenCalledWith("17679141878", "246810");
  expect(redis.values.get("auth:otp:17679141878")).not.toContain("246810");
});

it("consumes a correct code once", async () => {
  await service.send("17679141878");
  await expect(service.verifyAndConsume("17679141878", "246810")).resolves.toBe(true);
  await expect(service.verifyAndConsume("17679141878", "246810")).resolves.toBe(false);
});

it("blocks the sixth failed attempt", async () => {
  await service.send("17679141878");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(service.verifyAndConsume("17679141878", "000000")).resolves.toBe(false);
  }
  await expect(service.verifyAndConsume("17679141878", "246810")).resolves.toBe(false);
});

it("enforces cooldown and hourly send limits", async () => {
  await service.send("17679141878");
  await expect(service.send("17679141878")).rejects.toMatchObject({ status: 429 });
});
```

- [ ] **Step 2: Run OTP tests and verify RED**

Run: `pnpm --filter @petcare/server test -- auth/verification-code.service.spec.ts --runInBand`

Expected: FAIL because the OTP service does not exist.

- [ ] **Step 3: Implement digest storage and atomic Redis operations**

Hash codes with an HMAC-SHA256 key derived from the JWT secret. Use Redis keys `auth:otp:<phone>`, `auth:otp:attempts:<phone>`, `auth:otp:cooldown:<phone>`, and `auth:otp:hour:<phone>`. Add focused RedisService wrappers for `setNx`, `incr`, `expire`, `ttl`, and transactional delete; do not expose the raw client to auth code.

- [ ] **Step 4: Run OTP tests and verify GREEN**

Run: `pnpm --filter @petcare/server test -- auth/verification-code.service.spec.ts --runInBand`

Expected: all OTP lifecycle and limit tests PASS.

---

### Task 5: JWT sessions, password/SMS login, guards, and HTTP endpoints

**Files:**

- Create: `apps/server/src/auth/dto/send-sms-code.dto.ts`
- Create: `apps/server/src/auth/dto/password-login.dto.ts`
- Create: `apps/server/src/auth/dto/sms-login.dto.ts`
- Create: `apps/server/src/auth/auth.types.ts`
- Create: `apps/server/src/auth/token.service.ts`
- Create: `apps/server/src/auth/token.service.spec.ts`
- Create: `apps/server/src/auth/auth.service.ts`
- Create: `apps/server/src/auth/auth.service.spec.ts`
- Create: `apps/server/src/auth/jwt.strategy.ts`
- Create: `apps/server/src/auth/access-token.guard.ts`
- Create: `apps/server/src/auth/admin.guard.ts`
- Create: `apps/server/src/auth/admin.guard.spec.ts`
- Create: `apps/server/src/auth/auth.controller.ts`
- Create: `apps/server/src/auth/auth.module.ts`
- Create: `apps/server/src/auth/auth.controller.spec.ts`
- Modify: `apps/server/src/app.module.ts`
- Modify: `apps/server/src/main.ts`

**Interfaces:**

- Produces: `AuthService.loginWithPassword(identifier, password)`, `loginWithSms(phone, code)`, `refresh(refreshToken)`, `logout(sessionId)`, `getCurrentUser(userId)`, and `sendSmsCode(phone)`.
- Produces: HTTP endpoints from the approved design.
- Produces: access-token principal `{ sub, username, phone, roles, type: "access" }`.

- [ ] **Step 1: Write failing token rotation tests**

Tests must assert 15-minute access signing, 7-day refresh signing, Redis session creation, refresh-session rotation, and deletion on logout. A second refresh using the old token must fail with `UnauthorizedException`.

- [ ] **Step 2: Run token tests and verify RED**

Run: `pnpm --filter @petcare/server test -- auth/token.service.spec.ts --runInBand`

Expected: FAIL because `TokenService` does not exist.

- [ ] **Step 3: Implement TokenService and verify GREEN**

Use `JwtService.signAsync` with explicit `type` and `sid` claims. Store only a SHA-256 digest of the refresh token at `auth:session:<sid>` with 604800-second TTL. Rotate by deleting the old session and writing a new session before returning tokens.

Run: `pnpm --filter @petcare/server test -- auth/token.service.spec.ts --runInBand`

Expected: token tests PASS.

- [ ] **Step 4: Write failing AuthService tests**

Test password lookup with an OR query over phone and username, SMS verification, active status, and `super_admin` membership. Assert all invalid credential/status/role paths throw the same `UnauthorizedException("账号或凭据错误")`.

- [ ] **Step 5: Run AuthService tests and verify RED**

Run: `pnpm --filter @petcare/server test -- auth/auth.service.spec.ts --runInBand`

Expected: FAIL because `AuthService` does not exist.

- [ ] **Step 6: Implement AuthService and AdminGuard, then verify GREEN**

Select only `id`, `username`, `phone`, `nickname`, `status`, `passwordHash`, and role names. Never return `passwordHash`. `sendSmsCode` returns a generic result even when the phone is not an active administrator.

Run:

```powershell
pnpm --filter @petcare/server test -- auth/auth.service.spec.ts --runInBand
pnpm --filter @petcare/server test -- auth/admin.guard.spec.ts --runInBand
```

Expected: service and guard tests PASS.

- [ ] **Step 7: Write failing controller tests**

Test validation, `Set-Cookie` attributes (`HttpOnly`, `SameSite=Lax`, `Path=/api/auth`), cookie clearing on logout, access-token response shape, and `/auth/me` exclusion of passwordHash.

- [ ] **Step 8: Implement controller/module/strategy and verify GREEN**

Register `PassportModule`, `JwtModule`, auth providers, strategy and guards. Use `cookie-parser` in `main.ts`. Add `AuthModule` to `AppModule`.

Run: `pnpm --filter @petcare/server test -- auth/auth.controller.spec.ts --runInBand`

Expected: controller tests PASS.

---

### Task 6: Admin authentication client, context, and protected routing

**Files:**

- Create: `apps/admin/src/auth/auth.types.ts`
- Create: `apps/admin/src/auth/auth.api.ts`
- Create: `apps/admin/src/auth/AuthProvider.tsx`
- Create: `apps/admin/src/auth/ProtectedRoute.tsx`
- Create: `apps/admin/src/auth/AuthProvider.test.tsx`
- Create: `apps/admin/src/auth/ProtectedRoute.test.tsx`
- Modify: `apps/admin/src/App.tsx`

**Interfaces:**

- Produces: `AuthContextValue` with `status`, `user`, `loginWithPassword`, `loginWithSms`, `sendSmsCode`, and `logout`.
- Produces: a singleton Axios client using `baseURL: "/api"` and `withCredentials: true`.

- [ ] **Step 1: Write failing session restoration and route tests**

Use Testing Library and `MemoryRouter` to assert:

```tsx
it("restores a session before rendering protected content", async () => {
  server.post("/auth/refresh", () => HttpResponse.json({ accessToken: "access" }));
  server.get("/auth/me", () => HttpResponse.json(adminUser));

  renderAuthApp("/");
  expect(screen.getByText("正在恢复登录状态…")).toBeInTheDocument();
  expect(await screen.findByText("仪表盘")).toBeInTheDocument();
});

it("redirects an anonymous user to login", async () => {
  server.post("/auth/refresh", () => new HttpResponse(null, { status: 401 }));
  renderAuthApp("/users");
  expect(await screen.findByRole("heading", { name: "登录 PetCare" })).toBeInTheDocument();
});
```

Use lightweight Axios mocks if MSW is not already installed; do not add MSW solely for these tests.

- [ ] **Step 2: Run Admin auth tests and verify RED**

Run: `pnpm --filter @petcare/admin test:run -- src/auth/AuthProvider.test.tsx src/auth/ProtectedRoute.test.tsx`

Expected: FAIL because auth components do not exist.

- [ ] **Step 3: Implement the in-memory access-token flow**

On mount, call refresh once and then `/auth/me`. Queue at most one concurrent refresh when requests receive 401. Do not store tokens in localStorage or sessionStorage. ProtectedRoute renders a stable loading state during restoration and redirects anonymous users with `replace`.

- [ ] **Step 4: Run Admin auth tests and verify GREEN**

Run: `pnpm --filter @petcare/admin test:run -- src/auth/AuthProvider.test.tsx src/auth/ProtectedRoute.test.tsx`

Expected: auth context and route tests PASS.

---

### Task 7: Dual-mode login UI and logout integration

**Files:**

- Create: `apps/admin/src/pages/Login.tsx`
- Create: `apps/admin/src/pages/Login.test.tsx`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/components/Header.tsx`
- Create: `apps/admin/src/components/Header.test.tsx`

**Interfaces:**

- Consumes: `AuthContextValue` from Task 6.
- Produces: `/login` page with password and verification-code modes.

- [ ] **Step 1: Write failing login-page tests**

Cover mode switching, Chinese mobile validation, password submission, SMS send cooldown, SMS submission, API error display, and successful navigation:

```tsx
it("submits an account or phone with a password", async () => {
  const user = userEvent.setup();
  renderLogin({ loginWithPassword });

  await user.type(screen.getByLabelText("手机号或账号"), "admin");
  await user.type(screen.getByLabelText("密码"), "Correct-Horse-Battery-Staple!42");
  await user.click(screen.getByRole("button", { name: "登录" }));

  expect(loginWithPassword).toHaveBeenCalledWith("admin", "Correct-Horse-Battery-Staple!42");
});
```

- [ ] **Step 2: Run Login tests and verify RED**

Run: `pnpm --filter @petcare/admin test:run -- src/pages/Login.test.tsx`

Expected: FAIL because Login does not exist.

- [ ] **Step 3: Implement accessible login forms**

Use native labels and inputs, disable submit while pending, keep server errors in an `aria-live` region, and start a 60-second resend countdown only after a successful send. Passwords remain controlled only for the current form lifetime.

- [ ] **Step 4: Run Login tests and verify GREEN**

Run: `pnpm --filter @petcare/admin test:run -- src/pages/Login.test.tsx`

Expected: login-page tests PASS.

- [ ] **Step 5: Write failing logout Header test, implement, and verify**

Assert Header renders the current nickname and calls `logout` before navigating to `/login`.

Run: `pnpm --filter @petcare/admin test:run -- src/components/Header.test.tsx`

Expected after implementation: Header test PASS.

---

### Task 8: Local credentials, database initialization, integration verification, and docs

**Files:**

- Modify: `.env` (Git-ignored; secret value only)
- Modify: `docs/environment-variables.md`
- Modify: `README.md`
- Modify: `apps/server/prisma/SEED-GUIDE.md`
- Create: `apps/server/src/auth/auth.integration.spec.ts`

**Interfaces:**

- Consumes all earlier tasks.
- Produces a locally usable default administrator and verified end-to-end authentication contract.

- [ ] **Step 1: Generate and write local-only credentials**

Generate a password with at least 24 random printable characters using Node `crypto.randomBytes`. Write it only to root `.env` as `DEFAULT_ADMIN_PASSWORD`; also write `DEFAULT_ADMIN_USERNAME=admin`, `DEFAULT_ADMIN_PHONE=17679141878`, and `SMS_DEV_CODE=246810`. Do not print the generated password in command output or add it to any tracked file.

- [ ] **Step 2: Write failing integration tests**

Use a Nest testing application with deterministic in-memory Prisma and Redis adapters while keeping the real controller, DTO validation, AuthService, TokenService, guards, cookie handling, and HTTP transport to cover:

- password login by `admin` and by `17679141878`;
- SMS send and login with `246810`;
- `/auth/me` with the returned access token;
- refresh rotation and rejection of the old refresh token;
- logout and rejection of the logged-out refresh token;
- generic 401 for a non-admin user.

- [ ] **Step 3: Run integration tests and verify RED, then complete missing wiring**

Run: `pnpm --filter @petcare/server test -- auth/auth.integration.spec.ts --runInBand`

Expected first run: FAIL at the first incomplete HTTP contract. Implement only the missing wiring, rerun until all integration cases PASS.

- [ ] **Step 4: Synchronize the local schema and run seed twice**

Load root `.env`, force `DB_HOST=localhost`, then run:

```powershell
pnpm --filter @petcare/server exec prisma db push
pnpm --filter @petcare/server prisma:seed
pnpm --filter @petcare/server prisma:seed
```

Expected: both seed runs exit 0. Query PostgreSQL and assert exactly one user with username `admin`, one `super_admin` role, one matching user-role record, and no plaintext password column/value.

- [ ] **Step 5: Update documentation**

Document both login modes, local fixed-code behavior, all new environment variables, seed command, credential rotation, and the rule that production must remove `SMS_DEV_CODE` and supply a real `SmsSender`.

- [ ] **Step 6: Run the full fresh verification suite**

Run:

```powershell
pnpm --filter @petcare/server exec prisma validate
pnpm --filter @petcare/server test -- --runInBand
pnpm --filter @petcare/admin test:run
pnpm --filter @petcare/server lint
pnpm --filter @petcare/admin lint
pnpm build:server
pnpm build:admin
git diff --check
```

Expected: all commands exit 0 with zero failed tests, zero lint errors, and successful Server/Admin builds.

## Plan Self-Review

- Spec coverage: schema, seed, Argon2id, OTP policy, SMS abstraction, JWT rotation, HttpOnly cookie, Admin UI, route protection, logout, documentation, and all required test categories map to Tasks 1-8.
- Placeholder scan: every task names concrete files, interfaces, commands, assertions, and expected results; generated secrets are deliberately produced at execution time and never embedded in tracked documentation.
- Type consistency: `PasswordService`, `VerificationCodeService`, `TokenService`, `AuthService`, `AuthContextValue`, DTO fields, and endpoint names are consistent across producer and consumer tasks.
