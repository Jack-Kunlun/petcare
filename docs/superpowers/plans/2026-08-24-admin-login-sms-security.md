# Admin 登录短信交互与防爆破 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将图形验证码移入发送短信前的弹窗，让发送按钮准确显示服务端给出的 60 秒冷却，并为密码登录增加 Redis 原子防爆破限制。

**Architecture:** 短信发送响应通过共享契约返回 `cooldownSeconds`，Admin 只消费该值。图形验证码仅在 Radix Dialog 打开后加载并只保护短信发送；密码登录在任何用户查询和 Argon2 校验前，通过按标准化账号 HMAC 分桶的 Redis 固定窗口消耗额度。

**Tech Stack:** React 19、Radix Dialog、Axios、NestJS 11、Redis Lua、Node `crypto`、Vitest、Jest、Testing Library

**Spec:** `docs/superpowers/specs/2026-08-23-admin-auth-and-classroom-publishing-design.md`

## Global Constraints

- 短信登录默认不请求、不显示图形验证码。
- 有效手机号点击“发送验证码”后先打开弹窗，弹窗打开后才请求图形验证码。
- 图形验证码只提交到 `/auth/sms/send`；最终 `/auth/login/sms` 仍只包含 `phone` 和 `code`。
- 发送成功使用 Server `cooldownSeconds`，按钮显示 `60秒后重发 -> 59秒后重发 -> ... -> 1秒后重发 -> 发送验证码`。
- 冷却期间按钮的视觉、指针、`disabled` 和点击行为必须一致。
- 保留每手机号 60 秒发送冷却、每小时 5 次短信、单个短信验证码 5 次失败、单个图形验证码 5 次失败。
- 密码登录固定窗口默认 900 秒，前 5 次允许校验，第 6 次起返回 429；成功登录清除窗口。
- 密码限流在数据库查询和密码哈希校验前执行，未知账号与真实账号走同一限流和错误响应流程。
- Redis key 不保存手机号、用户名或密码明文；使用 JWT secret 做 HMAC。
- 不增加 IP 限流，直到 Server 建立可信代理解析边界。
- 安全边界必须留下可运行测试；所有配置经 `ConfigService` 读取。

---

### Task 1: 短信发送冷却共享契约

**Files:**

- Modify: `packages/shared-types/src/api/auth.ts`
- Create: `packages/shared-types/src/api/auth.spec.ts`
- Modify: `apps/server/src/auth/dto/auth-response.dto.ts`
- Modify: `apps/server/src/auth/auth.controller.ts`
- Modify: `apps/server/src/auth/auth.controller.spec.ts`
- Modify: `apps/admin/src/api/auth.ts`
- Modify: `apps/admin/src/api/auth.test.ts`
- Modify: `apps/admin/src/auth/auth.context.ts`
- Modify: `apps/admin/src/auth/AuthProvider.test.tsx`

**Interfaces:**

- Produces: `SendSmsCodeResponse { message: string; cooldownSeconds: number }`
- Changes: `sendSmsCode(phone, captchaId, captchaCode): Promise<SendSmsCodeResponse>`

- [ ] **Step 1: Write failing contract and controller tests**

```ts
// packages/shared-types/src/api/auth.spec.ts
import { expect, it } from "vitest";
import type { SendSmsCodeResponse } from "./auth";

it("defines the SMS cooldown returned by Server", () => {
  const response: SendSmsCodeResponse = {
    message: "如果该手机号可用于后台登录，验证码将会发送",
    cooldownSeconds: 60,
  };

  expect(response.cooldownSeconds).toBe(60);
});

// apps/server/src/auth/auth.controller.spec.ts
it("returns the configured cooldown after an accepted SMS request", async () => {
  await expect(
    controller.sendSmsCode({
      phone: "13800138000",
      captchaId: "0123456789abcdef",
      captchaCode: "2345",
    }),
  ).resolves.toEqual({ message: "sent", cooldownSeconds: 60 });
});
```

Set the controller test ConfigService double to include `smsSendCooldownSeconds: 60`.

- [ ] **Step 2: Run the shared and controller tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/shared-types exec vitest run src/api/auth.spec.ts
pnpm --filter @petcare/server exec jest src/auth/auth.controller.spec.ts --runInBand
```

Expected: FAIL because `SendSmsCodeResponse` and `cooldownSeconds` do not exist.

- [ ] **Step 3: Add the shared response and Swagger DTO**

```ts
// packages/shared-types/src/api/auth.ts
/** 已接受的后台登录短信发送请求。 */
export interface SendSmsCodeResponse {
  /** 防止暴露手机号是否存在的统一安全文案。 */
  message: string;
  /** 前端发送按钮必须执行的冷却秒数。 */
  cooldownSeconds: number;
}

// apps/server/src/auth/dto/auth-response.dto.ts
export class SendSmsCodeResponseDto implements SendSmsCodeResponse {
  @ApiProperty({ example: "如果该手机号可用于后台登录，验证码将会发送" })
  message: string;

  @ApiProperty({ example: 60, minimum: 1 })
  cooldownSeconds: number;
}
```

Replace the now-unused `MessageResponseDto` import/declaration with `SendSmsCodeResponseDto`; no generic response DTO remains solely for this endpoint.

No barrel edit is needed: `packages/shared-types/src/api/index.ts` already exports `./auth`.

- [ ] **Step 4: Return the configured cooldown at the controller boundary**

```ts
// apps/server/src/auth/auth.controller.ts
@ApiSuccessResponse(SendSmsCodeResponseDto)
async sendSmsCode(@Body() dto: SendSmsCodeDto): Promise<SendSmsCodeResponse> {
  const result = await this.authService.sendSmsCode(dto.phone, dto.captchaId, dto.captchaCode);

  return {
    ...result,
    cooldownSeconds: this.configService.smsSendCooldownSeconds,
  };
}
```

Keep the same response for known and unknown phone numbers.

- [ ] **Step 5: Propagate the response through Admin API and AuthContext**

```ts
// apps/admin/src/api/auth.ts
import type { SendSmsCodeResponse } from "@petcare/shared-types";

export async function sendSmsCode(
  phone: string,
  captchaId: string,
  captchaCode: string,
): Promise<SendSmsCodeResponse> {
  const request: SendSmsCodeRequest = { phone, captchaId, captchaCode };
  const response = await apiClient.post<SendSmsCodeResponse>("/auth/sms/send", request);

  return response.data;
}

// apps/admin/src/auth/auth.context.ts
import type { SendSmsCodeResponse } from "@petcare/shared-types";

sendSmsCode(
  phone: string,
  captchaId: string,
  captchaCode: string,
): Promise<SendSmsCodeResponse>;
```

Update the existing Admin API and AuthProvider delegation tests with this response; `auth.types.ts` remains unchanged:

```ts
const sent = { message: "如果该手机号可用于后台登录，验证码将会发送", cooldownSeconds: 60 };
axiosMocks.client.post.mockResolvedValue({ data: sent });
const authModule = await import("./auth");

await expect(authModule.sendSmsCode("13800138000", "0123456789abcdef", "2345")).resolves.toEqual(
  sent,
);
expect(axiosMocks.client.post).toHaveBeenCalledWith("/auth/sms/send", {
  phone: "13800138000",
  captchaId: "0123456789abcdef",
  captchaCode: "2345",
});

vi.mocked(authApi.sendSmsCode).mockResolvedValue(sent);
```

- [ ] **Step 6: Run focused contract tests**

Run:

```powershell
pnpm --filter @petcare/shared-types exec vitest run src/api/auth.spec.ts
pnpm --filter @petcare/server exec jest src/auth/auth.controller.spec.ts --runInBand
pnpm --filter @petcare/admin exec vitest run src/api/auth.test.ts src/auth/AuthProvider.test.tsx --pool=forks --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- packages/shared-types/src/api/auth.ts packages/shared-types/src/api/auth.spec.ts apps/server/src/auth/dto/auth-response.dto.ts apps/server/src/auth/auth.controller.ts apps/server/src/auth/auth.controller.spec.ts apps/admin/src/api/auth.ts apps/admin/src/api/auth.test.ts apps/admin/src/auth/auth.context.ts apps/admin/src/auth/AuthProvider.test.tsx
git commit -m "feat(auth): 返回短信发送冷却时间"
```

### Task 2: Redis 固定窗口与认证配置

**Files:**

- Modify: `apps/server/src/config/config.service.ts`
- Modify: `apps/server/src/config/config.service.spec.ts`
- Modify: `apps/server/src/config/redis.service.ts`
- Modify: `apps/server/src/config/redis.service.spec.ts`
- Modify: `.env.example`
- Modify: `docs/environment-variables.md`

**Interfaces:**

- Produces: `ConfigService.authPasswordMaxAttempts: number`
- Produces: `ConfigService.authPasswordWindowSeconds: number`
- Produces: `RedisService.consumeFixedWindow(key: string, maxAttempts: number, windowSeconds: number): Promise<boolean>`

- [ ] **Step 1: Write failing configuration and Redis tests**

```ts
// apps/server/src/config/config.service.spec.ts
it("returns documented password login limiter defaults", () => {
  const config = new ConfigService();

  expect(config.authPasswordMaxAttempts).toBe(5);
  expect(config.authPasswordWindowSeconds).toBe(900);
});

it("rejects a partially numeric password limiter value", () => {
  process.env.AUTH_PASSWORD_MAX_ATTEMPTS = "5x";
  expect(() => new ConfigService().authPasswordMaxAttempts).toThrow(
    "AUTH_PASSWORD_MAX_ATTEMPTS must be a positive integer",
  );
});

// apps/server/src/config/redis.service.spec.ts
it("consumes a fixed-window attempt with one atomic script", async () => {
  const { service, evalMock } = createService(1);

  await expect(service.consumeFixedWindow("auth:password:hash", 5, 900)).resolves.toBe(true);
  expect(evalMock).toHaveBeenCalledWith(expect.any(String), {
    keys: ["auth:password:hash"],
    arguments: ["5", "900"],
  });
});

it("returns false after the fixed-window limit", async () => {
  const { service } = createService(0);
  await expect(service.consumeFixedWindow("auth:password:hash", 5, 900)).resolves.toBe(false);
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/config/config.service.spec.ts src/config/redis.service.spec.ts --runInBand
```

Expected: FAIL because the getters and Redis method do not exist.

- [ ] **Step 3: Add positive integer configuration getters and startup checks**

```ts
// apps/server/src/config/config.service.ts
get authPasswordMaxAttempts(): number {
  return this.getPositiveInteger("AUTH_PASSWORD_MAX_ATTEMPTS", 5);
}

get authPasswordWindowSeconds(): number {
  return this.getPositiveInteger("AUTH_PASSWORD_WINDOW_SECONDS", 900);
}
```

In the existing `getPositiveInteger`, replace `Number.parseInt(value, 10)` with `Number(value)` so every optional positive-integer setting rejects partially numeric input instead of silently accepting it.

Add both startup checks beside the other authentication checks and clear both variables in the test setup:

```ts
check("AUTH_PASSWORD_MAX_ATTEMPTS", () => this.authPasswordMaxAttempts);
check("AUTH_PASSWORD_WINDOW_SECONDS", () => this.authPasswordWindowSeconds);

// config.service.spec.ts beforeEach
delete process.env.AUTH_PASSWORD_MAX_ATTEMPTS;
delete process.env.AUTH_PASSWORD_WINDOW_SECONDS;
```

- [ ] **Step 4: Implement the atomic fixed-window script**

```ts
// apps/server/src/config/redis.service.ts
async consumeFixedWindow(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<boolean> {
  const result = await this.client.eval(
    `
      local count = redis.call("INCR", KEYS[1])
      local ttl = redis.call("TTL", KEYS[1])
      if ttl < 0 then
        redis.call("EXPIRE", KEYS[1], tonumber(ARGV[2]))
      end
      if count <= tonumber(ARGV[1]) then
        return 1
      end
      return 0
    `,
    {
      keys: [key],
      arguments: [String(maxAttempts), String(windowSeconds)],
    },
  );

  return Number(result) === 1;
}
```

The `ttl < 0` branch repairs a counter without an expiry and prevents permanent lockout.

- [ ] **Step 5: Document the exact environment variables**

```dotenv
# .env.example
AUTH_PASSWORD_MAX_ATTEMPTS=5
AUTH_PASSWORD_WINDOW_SECONDS=900
```

Add these rows beside the existing SMS/CAPTCHA variables in `docs/environment-variables.md`:

```md
| `AUTH_PASSWORD_MAX_ATTEMPTS` | 否 | `5` | 密码登录固定窗口允许次数 |
| `AUTH_PASSWORD_WINDOW_SECONDS` | 否 | `900` | 密码登录固定窗口秒数 |
```

- [ ] **Step 6: Run focused tests and verify they pass**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/config/config.service.spec.ts src/config/redis.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- apps/server/src/config/config.service.ts apps/server/src/config/config.service.spec.ts apps/server/src/config/redis.service.ts apps/server/src/config/redis.service.spec.ts .env.example docs/environment-variables.md
git commit -m "feat(auth): 增加密码登录限流配置"
```

### Task 3: 密码登录防爆破服务与 AuthService 接线

**Files:**

- Create: `apps/server/src/auth/password-login-attempt.service.ts`
- Create: `apps/server/src/auth/password-login-attempt.service.spec.ts`
- Modify: `apps/server/src/auth/auth.service.ts`
- Modify: `apps/server/src/auth/auth.service.spec.ts`
- Modify: `apps/server/src/auth/auth.module.ts`
- Modify: `apps/server/src/auth/auth.module.spec.ts`
- Modify: `apps/server/src/auth/auth.controller.ts`

**Interfaces:**

- Consumes: `RedisService.consumeFixedWindow(...)` from Task 2
- Produces: `PasswordLoginAttemptService.assertAllowed(identifier: string): Promise<void>`
- Produces: `PasswordLoginAttemptService.clear(identifier: string): Promise<void>`

- [ ] **Step 1: Write failing limiter service tests**

```ts
// apps/server/src/auth/password-login-attempt.service.spec.ts
it("hashes a normalized identifier before consuming the window", async () => {
  redis.consumeFixedWindow.mockResolvedValue(true);

  await service.assertAllowed("  Admin  ");

  expect(redis.consumeFixedWindow).toHaveBeenCalledWith(
    expect.stringMatching(/^auth:password:attempts:[a-f0-9]{64}$/u),
    5,
    900,
  );
  expect(redis.consumeFixedWindow.mock.calls[0][0]).not.toContain("admin");
});

it("returns a stable 429 after the limit", async () => {
  redis.consumeFixedWindow.mockResolvedValue(false);

  await expect(service.assertAllowed("admin")).rejects.toMatchObject({
    code: "RATE_LIMIT_EXCEEDED",
    clientMessage: "登录尝试过于频繁，请稍后重试",
    status: 429,
  });
});
```

Use this focused setup for those tests:

```ts
const redis = {
  consumeFixedWindow: jest.fn(),
  del: jest.fn().mockResolvedValue(undefined),
};
const config = {
  jwtSecret: "test-secret",
  authPasswordMaxAttempts: 5,
  authPasswordWindowSeconds: 900,
};
const service = new PasswordLoginAttemptService(
  redis as unknown as RedisService,
  config as unknown as ConfigService,
);
```

- [ ] **Step 2: Run the service test and verify it fails**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/auth/password-login-attempt.service.spec.ts --runInBand
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the focused limiter service**

```ts
// apps/server/src/auth/password-login-attempt.service.ts
import { createHmac } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../common/http/api-exception";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";

@Injectable()
export class PasswordLoginAttemptService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async assertAllowed(identifier: string): Promise<void> {
    const allowed = await this.redis.consumeFixedWindow(
      this.key(identifier),
      this.config.authPasswordMaxAttempts,
      this.config.authPasswordWindowSeconds,
    );

    if (!allowed) {
      throw new ApiException(
        "RATE_LIMIT_EXCEEDED",
        "登录尝试过于频繁，请稍后重试",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  clear(identifier: string): Promise<void> {
    return this.redis.del(this.key(identifier));
  }

  private key(identifier: string): string {
    const normalized = identifier.normalize("NFKC").trim().toLowerCase();
    const digest = createHmac("sha256", this.config.jwtSecret).update(normalized).digest("hex");

    return `auth:password:attempts:${digest}`;
  }
}
```

- [ ] **Step 4: Write failing AuthService ordering tests**

```ts
import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../common/http/api-exception";

it("consumes a password attempt before looking up the account", async () => {
  await service.loginWithPassword("admin", "Correct-Horse-Battery-Staple!42");

  expect(passwordAttempts.assertAllowed).toHaveBeenCalledWith("admin");
  expect(passwordAttempts.assertAllowed.mock.invocationCallOrder[0]).toBeLessThan(
    prisma.user.findFirst.mock.invocationCallOrder[0],
  );
});

it("does no account lookup or password work after the limiter blocks", async () => {
  passwordAttempts.assertAllowed.mockRejectedValue(
    new ApiException(
      "RATE_LIMIT_EXCEEDED",
      "登录尝试过于频繁，请稍后重试",
      HttpStatus.TOO_MANY_REQUESTS,
    ),
  );

  await expect(
    service.loginWithPassword("unknown-account", "wrong-password-value"),
  ).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED", status: 429 });
  expect(prisma.user.findFirst).not.toHaveBeenCalled();
  expect(passwordService.verify).not.toHaveBeenCalled();
});

it("clears the attempt window only after valid credentials", async () => {
  await service.loginWithPassword("admin", "Correct-Horse-Battery-Staple!42");
  expect(passwordAttempts.clear).toHaveBeenCalledWith("admin");
  expect(tokenService.issue.mock.invocationCallOrder[0]).toBeLessThan(
    passwordAttempts.clear.mock.invocationCallOrder[0],
  );

  passwordService.verify.mockResolvedValue(false);
  await expect(service.loginWithPassword("admin", "wrong-password-value")).rejects.toBeDefined();
  expect(passwordAttempts.clear).toHaveBeenCalledTimes(1);
});
```

Add the limiter as the final constructor dependency in the existing AuthService setup:

```ts
let passwordAttempts: { assertAllowed: jest.Mock; clear: jest.Mock };

passwordAttempts = {
  assertAllowed: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
};
service = new AuthService(
  prisma as unknown as PrismaService,
  passwordService as unknown as PasswordService,
  verificationCodeService as unknown as VerificationCodeService,
  tokenService as unknown as TokenService,
  captchaService as unknown as CaptchaService,
  passwordAttempts as unknown as PasswordLoginAttemptService,
);
```

- [ ] **Step 5: Wire the limiter into password login and AuthModule**

```ts
// apps/server/src/auth/auth.service.ts
async loginWithPassword(identifier: string, password: string): Promise<LoginResult> {
  await this.passwordLoginAttempts.assertAllowed(identifier);
  const user = await this.prismaService.user.findFirst({
    where: { OR: [{ phone: identifier }, { username: identifier }] },
    select: adminUserSelect,
  });

  if (!this.isActiveAdministrator(user) || !user.passwordHash) throw this.invalidCredentials();
  if (!(await this.passwordService.verify(user.passwordHash, password))) {
    throw this.invalidCredentials();
  }

  const result = await this.issueSession(user);
  await this.passwordLoginAttempts.clear(identifier);
  return result;
}
```

Register `PasswordLoginAttemptService` in `AuthModule.providers`, inject it into `AuthService`, and change the password endpoint errors to `@ApiStandardErrors(400, 401, 429, 500)`. Add this module assertion:

```ts
expect(providers).toEqual(
  expect.arrayContaining([
    PasswordService,
    PasswordLoginAttemptService,
    TokenService,
    SessionValidationService,
  ]),
);
```

- [ ] **Step 6: Run all backend authentication tests**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/auth/password-login-attempt.service.spec.ts src/auth/auth.service.spec.ts src/auth/auth.module.spec.ts src/auth/auth.controller.spec.ts src/config/redis.service.spec.ts src/config/config.service.spec.ts --runInBand
```

Expected: PASS; the existing generic invalid-credentials cases remain unchanged.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- apps/server/src/auth/password-login-attempt.service.ts apps/server/src/auth/password-login-attempt.service.spec.ts apps/server/src/auth/auth.service.ts apps/server/src/auth/auth.service.spec.ts apps/server/src/auth/auth.module.ts apps/server/src/auth/auth.module.spec.ts apps/server/src/auth/auth.controller.ts
git commit -m "feat(auth): 防止密码登录爆破"
```

### Task 4: 图形验证码弹窗与按钮倒计时

**Files:**

- Create: `apps/admin/src/pages/Login/CaptchaDialog.tsx`
- Modify: `apps/admin/src/pages/Login/index.tsx`
- Modify: `apps/admin/src/pages/Login/index.test.tsx`

**Interfaces:**

- Consumes: `AuthContextValue.sendSmsCode(...): Promise<SendSmsCodeResponse>` from Task 1
- Consumes: `showApiError(error)` from the global-error plan
- Produces: `CaptchaDialog` controlled by `open`, challenge/loading/error/sending state and explicit callbacks

- [ ] **Step 1: Replace existing Login tests with failing modal and cooldown expectations**

```tsx
it("loads captcha only after the send dialog opens", async () => {
  const user = userEvent.setup();
  renderLogin();

  await user.click(screen.getByRole("tab", { name: "验证码登录" }));
  expect(auth.getCaptcha).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("图形验证码")).not.toBeInTheDocument();

  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.click(screen.getByRole("button", { name: "发送验证码" }));

  expect(await screen.findByRole("dialog", { name: "发送短信验证码" })).toBeInTheDocument();
  expect(auth.getCaptcha).toHaveBeenCalledOnce();
  expect(await screen.findByRole("img", { name: "图形验证码" })).toHaveAttribute(
    "src",
    firstCaptcha.image,
  );
});

it("starts from the server cooldown and counts down on the send button", async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  auth.sendSmsCode.mockResolvedValue({ message: "sent", cooldownSeconds: 60 });
  renderLogin();

  await user.click(screen.getByRole("tab", { name: "验证码登录" }));
  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.click(screen.getByRole("button", { name: "发送验证码" }));
  await user.type(await screen.findByLabelText("图形验证码"), "2345");
  await user.click(screen.getByRole("button", { name: "确认发送" }));

  expect(screen.getByRole("button", { name: "60秒后重发" })).toBeDisabled();
  act(() => vi.advanceTimersByTime(1_000));
  expect(screen.getByRole("button", { name: "59秒后重发" })).toBeDisabled();
  act(() => vi.advanceTimersByTime(59_000));
  expect(screen.getByRole("button", { name: "发送验证码" })).toBeEnabled();
  vi.useRealTimers();
});

it("keeps captcha out of the final SMS login request", async () => {
  const user = userEvent.setup();
  renderLogin();
  await user.click(screen.getByRole("tab", { name: "验证码登录" }));
  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.type(screen.getByLabelText("验证码"), "246810");
  await user.click(screen.getByRole("button", { name: "登录" }));

  expect(auth.loginWithSms).toHaveBeenCalledWith("13800138000", "246810");
});
```

Add `act` to Testing Library imports and restore real timers in `afterEach` so failures cannot leak fake timers.

- [ ] **Step 2: Run Login tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/Login/index.test.tsx --pool=forks --maxWorkers=1
```

Expected: FAIL because captcha still loads inline and the send method returns no cooldown.

- [ ] **Step 3: Implement the controlled Radix captcha dialog**

```tsx
// apps/admin/src/pages/Login/CaptchaDialog.tsx
import * as Dialog from "@radix-ui/react-dialog";
import type { CaptchaChallenge } from "@petcare/shared-types";

interface CaptchaDialogProps {
  open: boolean;
  challenge: CaptchaChallenge | null;
  code: string;
  loading: boolean;
  loadError: boolean;
  sending: boolean;
  onOpenChange(open: boolean): void;
  onCodeChange(code: string): void;
  onRefresh(): void;
  onConfirm(): void;
}

export function CaptchaDialog(props: CaptchaDialogProps) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45" />
        <Dialog.Content
          aria-describedby="captcha-dialog-description"
          className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl"
        >
          <Dialog.Title className="text-lg font-semibold text-slate-950">
            发送短信验证码
          </Dialog.Title>
          <Dialog.Description
            id="captcha-dialog-description"
            className="mt-1 text-sm text-slate-600"
          >
            输入图形验证码后再发送短信。
          </Dialog.Description>
          <label className="mt-5 block text-sm font-medium text-slate-700">
            图形验证码
            <input
              inputMode="numeric"
              maxLength={4}
              value={props.code}
              disabled={props.sending}
              onChange={(event) => props.onCodeChange(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3"
            />
          </label>
          <button
            type="button"
            aria-label={props.loadError ? "重新加载图形验证码" : "图形验证码，点击换一张"}
            disabled={props.loading || props.sending}
            onClick={props.onRefresh}
            className="mt-3 h-14 w-full cursor-pointer rounded-lg border border-slate-300 disabled:cursor-not-allowed"
          >
            {props.challenge ? (
              <img
                src={props.challenge.image}
                alt="图形验证码"
                className="h-full w-full object-contain"
              />
            ) : props.loadError ? (
              "加载失败，点击重试"
            ) : (
              "正在加载…"
            )}
          </button>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={props.sending}
                className="min-h-11 rounded-lg border px-4"
              >
                取消
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={props.sending || !props.challenge || !/^[2-9]{4}$/u.test(props.code)}
              onClick={props.onConfirm}
              className="min-h-11 rounded-lg bg-brand-primary px-4 text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {props.sending ? "发送中…" : "确认发送"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Move captcha lifecycle into the dialog-open flow**

```tsx
// apps/admin/src/pages/Login/index.tsx
const [captchaOpen, setCaptchaOpen] = useState(false);

useEffect(() => {
  if (captchaOpen) void loadCaptcha();
}, [captchaOpen, loadCaptcha]);

function openCaptchaDialog() {
  setError(null);
  if (!mobilePattern.test(phone)) {
    setError("请输入正确的手机号");
    return;
  }
  if (cooldown === 0) setCaptchaOpen(true);
}

async function confirmSendCode() {
  if (!captcha || !/^[2-9]{4}$/u.test(captchaCode)) return;
  setSendingCode(true);
  try {
    const result = await auth.sendSmsCode(phone, captcha.captchaId, captchaCode);
    setCooldown(result.cooldownSeconds);
    setCaptchaOpen(false);
    setCaptcha(null);
    setCaptchaCode("");
  } catch (error) {
    showApiError(error);
    setCaptchaCode("");
    await loadCaptcha();
  } finally {
    setSendingCode(false);
  }
}

function changeCaptchaOpen(open: boolean): void {
  if (sendingCode) return;
  setCaptchaOpen(open);
  if (!open) setCaptchaCode("");
}

<button
  type="button"
  data-testid="send-code-button"
  disabled={sendingCode || cooldown > 0}
  onClick={openCaptchaDialog}
  className="h-12 cursor-pointer rounded-lg border border-border px-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
>
  {getSendCodeLabel(cooldown, sendingCode)}
</button>

<CaptchaDialog
  open={captchaOpen}
  challenge={captcha}
  code={captchaCode}
  loading={captchaLoading}
  loadError={captchaLoadError}
  sending={sendingCode}
  onOpenChange={changeCaptchaOpen}
  onCodeChange={setCaptchaCode}
  onRefresh={() => void loadCaptcha()}
  onConfirm={() => void confirmSendCode()}
/>
```

Delete the `mode === "sms"` captcha-loading effect and the inline captcha label/row. Keep only phone and SMS code fields in the SMS panel.

- [ ] **Step 5: Add failure behavior to the tests**

```tsx
it("keeps the dialog open and refreshes captcha after send failure", async () => {
  const failure = { response: { data: { message: "图形验证码错误或已过期" } } };
  auth.getCaptcha.mockResolvedValueOnce(firstCaptcha).mockResolvedValueOnce(secondCaptcha);
  auth.sendSmsCode.mockRejectedValue(failure);
  const user = userEvent.setup();
  renderLogin();

  await user.click(screen.getByRole("tab", { name: "验证码登录" }));
  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.click(screen.getByRole("button", { name: "发送验证码" }));
  await user.type(await screen.findByLabelText("图形验证码"), "2345");
  await user.click(screen.getByRole("button", { name: "确认发送" }));

  expect(screen.getByRole("dialog", { name: "发送短信验证码" })).toBeInTheDocument();
  expect(showApiError).toHaveBeenCalledWith(failure);
  expect(screen.getByLabelText("图形验证码")).toHaveValue("");
  await waitFor(() => expect(auth.getCaptcha).toHaveBeenCalledTimes(2));
});
```

- [ ] **Step 6: Run Login tests and verify they pass**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/Login/index.test.tsx --pool=forks --maxWorkers=1
```

Expected: PASS, including `60 -> 59 -> 0` and no captcha in final login.

- [ ] **Step 7: Commit Task 4**

```powershell
git add -- apps/admin/src/pages/Login/CaptchaDialog.tsx apps/admin/src/pages/Login/index.tsx apps/admin/src/pages/Login/index.test.tsx
git commit -m "feat(admin): 发送短信前弹窗校验图形验证码"
```

### Task 5: 登录安全范围验证

**Files:**

- Verify only; no source file is created by this task.

**Interfaces:**

- Verifies all interfaces produced by Tasks 1 through 4.

- [ ] **Step 1: Run shared contract checks**

```powershell
pnpm --filter @petcare/shared-types test
pnpm --filter @petcare/shared-types typecheck
```

Expected: both commands exit 0.

- [ ] **Step 2: Run focused Server authentication tests**

```powershell
pnpm --filter @petcare/server exec jest src/auth src/config/config.service.spec.ts src/config/redis.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run Admin authentication tests**

```powershell
pnpm --filter @petcare/admin exec vitest run src/api/auth.test.ts src/auth/AuthProvider.test.tsx src/pages/Login/index.test.tsx --pool=forks --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 4: Run affected quality gates**

```powershell
pnpm --filter @petcare/server lint
pnpm --filter @petcare/server typecheck
pnpm --filter @petcare/server build
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin typecheck
pnpm --filter @petcare/admin build
git diff --check
```

Expected: all commands exit 0. Do not run full repository E2E unless these checks reveal a real cross-runtime gap.
