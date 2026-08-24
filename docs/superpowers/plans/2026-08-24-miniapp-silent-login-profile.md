# PetCare Miniapp Silent Login and Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Miniapp 可静默创建或恢复微信会话、展示和编辑真实个人资料，并在用户通过阿里云短信绑定手机号前阻止真实写操作。

**Architecture:** 复用现有微信登录、JWT、Redis 验证码、Prisma 用户模型和公共头像存储。Server 以 `phone !== null` 推导 `profileComplete`，Miniapp 用原生 `uni.request` 和一个 Vue `reactive` 单例管理会话；发布悬赏同时受客户端引导和服务端 Guard 保护。微信头像昵称只通过用户主动触发的 `chooseAvatar` 与 `input type="nickname"` 获取。

**Tech Stack:** NestJS、Prisma、PostgreSQL、Redis、Aliyun SMS、Tencent COS、UniApp、Vue 3、TypeScript、Vitest、Jest。

**Spec:** `docs/plans/2026-08-24-miniapp-account-and-support-content-design.md`

## Global Constraints

- 用户可匿名浏览；只有已有真实后端写接口的操作接入资料完善门禁。
- `profileComplete` 只由 Server 根据已验证手机号推导，客户端不自行推断。
- Miniapp 响应、JWT 和应用日志不得包含完整手机号。
- 首次微信登录直接创建活动账户；不再要求微信手机号快捷能力。
- 昵称使用 Node.js `crypto.randomInt` 生成“宠友”加六位数字；默认头像由随机用户 ID 稳定映射到现有头像资产，不新增头像表或配置。
- 手机验证码按 `admin_login`、`miniapp_bind_phone`、`miniapp_cancel_account` 隔离；本计划实现前两种，第三种由注销计划消费同一接口。
- 头像继续执行 2 MiB、文件头、MIME 和扩展名校验；对象目录由 Server 决定。
- 不引入 Axios、Pinia、表单库或新的运行时依赖；Miniapp 仅新增工作区依赖 `@petcare/shared-types`。
- 不实现已绑定手机号的自助更换，不启用当前仍为静态占位的接单、评论、收藏、关注或聊天发送按钮。
- 固定 `/users/me` 路由与公开 `/users/:id` 分离，公开详情不得返回手机号。
- Prisma 迁移只能由 CLI 生成，不手写 `migration.sql`。

## File Map

### Shared contracts

- Create: `packages/shared-types/src/api/miniapp-account.ts`
- Create: `packages/shared-types/src/api/miniapp-account.spec.ts`
- Modify: `packages/shared-types/src/api/auth.ts`
- Modify: `packages/shared-types/src/api/index.ts`
- Modify: `packages/shared-types/src/api/admin.ts`
- Modify: `packages/shared-types/src/api/user.ts`
- Modify: `packages/shared-types/src/api/provider-certification.ts`
- Modify: `packages/shared-types/src/api/complaint-dispute.ts`

### Server data and authentication

- Modify: `apps/server/prisma/schema.prisma`
- Generated: `apps/server/prisma/migrations/*_miniapp_optional_phone_profile_bio/migration.sql`
- Modify: `apps/server/src/auth/auth.types.ts`
- Modify: `apps/server/src/auth/token.service.ts`
- Modify: `apps/server/src/auth/token.service.spec.ts`
- Modify: `apps/server/src/auth/jwt.strategy.spec.ts`
- Modify: `apps/server/src/auth/auth.service.ts`
- Modify: `apps/server/src/auth/auth.service.spec.ts`
- Modify: `apps/server/src/auth/verification-code.service.ts`
- Modify: `apps/server/src/auth/verification-code.service.spec.ts`
- Modify: `apps/server/src/auth/wechat-auth.service.ts`
- Modify: `apps/server/src/auth/wechat-auth.service.spec.ts`
- Modify: `apps/server/src/auth/wechat-auth.controller.ts`
- Modify: `apps/server/src/auth/wechat-auth.controller.spec.ts`
- Modify: `apps/server/src/auth/dto/wechat-auth.dto.ts`
- Modify: `apps/server/src/auth/dto/wechat-auth-response.dto.ts`
- Modify: `apps/server/src/auth/wechat-api.client.ts`
- Modify: `apps/server/src/auth/wechat-api.client.spec.ts`
- Modify: `apps/server/src/auth/auth.module.ts`
- Modify: `apps/server/test/wechat-auth.e2e-spec.ts`

### Server profile, avatar, and write guard

- Modify: `apps/server/src/public-avatar-storage/public-avatar-storage.types.ts`
- Modify: `apps/server/src/public-avatar-storage/tencent-cos-public-avatar.storage.ts`
- Modify: `apps/server/src/public-avatar-storage/tencent-cos-public-avatar.storage.spec.ts`
- Modify: `apps/server/src/modules/admin-account/admin-account.service.ts`
- Modify: `apps/server/src/modules/admin-account/admin-account.service.spec.ts`
- Create: `apps/server/src/modules/user/dto/miniapp-account.dto.ts`
- Create: `apps/server/src/modules/user/miniapp-account.controller.ts`
- Create: `apps/server/src/modules/user/miniapp-account.service.ts`
- Create: `apps/server/src/modules/user/miniapp-account.service.spec.ts`
- Modify: `apps/server/src/modules/user/user.controller.ts`
- Modify: `apps/server/src/modules/user/user.service.ts`
- Modify: `apps/server/src/modules/user/dto/user-response.dto.ts`
- Modify: `apps/server/src/modules/user/user.module.ts`
- Create: `apps/server/src/auth/profile-complete.guard.ts`
- Create: `apps/server/src/auth/profile-complete.guard.spec.ts`
- Modify: `apps/server/src/modules/order/order.controller.ts`
- Create: `apps/server/src/modules/order/order.controller.spec.ts`
- Modify: `apps/server/src/modules/complaint-dispute/complaint.controller.ts`
- Modify: `apps/server/src/modules/complaint-dispute/complaint.controller.spec.ts`
- Modify nullable-phone consumers: `apps/server/src/modules/order/dto/order-response.dto.ts`, `apps/server/src/modules/content/dto/content-response.dto.ts`, `apps/server/src/modules/content/content.service.ts`, `apps/server/src/modules/provider-certification/dto/provider-certification-response.dto.ts`, `apps/server/src/modules/provider-certification/provider-certification.service.ts`, `apps/server/src/modules/complaint-dispute/dto/complaint-response.dto.ts`, `apps/server/src/modules/complaint-dispute/complaint-query.service.ts`

### Miniapp

- Modify: `apps/miniapp/package.json`
- Modify generated dependency lock: `pnpm-lock.yaml`
- Modify: `.env.example`
- Modify: `docs/environment-variables.md`
- Modify: `apps/miniapp/src/env.d.ts`
- Create: `apps/miniapp/src/api/request.ts`
- Create: `apps/miniapp/src/api/request.spec.ts`
- Create: `apps/miniapp/src/api/auth.ts`
- Create: `apps/miniapp/src/api/user.ts`
- Create: `apps/miniapp/src/state/session.ts`
- Create: `apps/miniapp/src/state/session.spec.ts`
- Create: `apps/miniapp/src/state/default-avatar.ts`
- Create: `apps/miniapp/src/state/default-avatar.spec.ts`
- Modify: `apps/miniapp/src/App.vue`
- Modify: `apps/miniapp/src/pages/auth/index.vue`
- Modify: `apps/miniapp/src/pages/profile/index.vue`
- Modify: `apps/miniapp/src/pages-account/profile/info.vue`
- Modify: `apps/miniapp/src/pages-account/profile/edit.vue`
- Modify: `apps/miniapp/src/pages/bounty/index.vue`

---

### Task 1: Define the Miniapp account contract

**Interfaces:**

- Produces `MiniappUserProfile` with masked phone and Server-owned `profileComplete`.
- Produces update, phone-code, and cancellation request contracts shared by this plan and the next plan.
- Replaces the two-state WeChat login union with an authenticated session.

- [ ] **Step 1: Write the failing shared contract test**

Create `packages/shared-types/src/api/miniapp-account.spec.ts`:

```ts
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  MINIAPP_ACCOUNT_ERROR_CODE,
  type BindMiniappPhoneRequest,
  type MiniappUserProfile,
} from "./miniapp-account";

describe("miniapp account contract", () => {
  it("keeps full phone numbers out of the profile response", () => {
    const profile: MiniappUserProfile = {
      id: "user-1",
      nickname: "宠友123456",
      avatar: null,
      phoneMasked: "138****8000",
      profileComplete: true,
      userType: "pet_owner",
      region: null,
      bio: null,
    };

    expect(profile.phoneMasked).toBe("138****8000");
    expect("phone" in profile).toBe(false);
    expect(MINIAPP_ACCOUNT_ERROR_CODE.PROFILE_INCOMPLETE).toBe("PROFILE_INCOMPLETE");
    expectTypeOf<BindMiniappPhoneRequest>().toEqualTypeOf<{ phone: string; code: string }>();
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run:

```powershell
pnpm --filter @petcare/shared-types exec vitest run src/api/miniapp-account.spec.ts
```

Expected: FAIL because `./miniapp-account` does not exist.

- [ ] **Step 3: Add the smallest complete account contract**

Create `packages/shared-types/src/api/miniapp-account.ts` with JSDoc on every public field:

```ts
/** Stable Miniapp account errors used by clients for recovery behavior. */
export const MINIAPP_ACCOUNT_ERROR_CODE = {
  PROFILE_INCOMPLETE: "PROFILE_INCOMPLETE",
  PHONE_ALREADY_BOUND: "PHONE_ALREADY_BOUND",
  PHONE_CONFLICT: "PHONE_CONFLICT",
  VERIFICATION_CODE_INVALID: "VERIFICATION_CODE_INVALID",
  ACTIVE_ORDER_EXISTS: "ACTIVE_ORDER_EXISTS",
} as const;

/** Current Miniapp profile without a raw phone number. */
export interface MiniappUserProfile {
  /** User identifier. */
  id: string;
  /** User-selected or generated display name. */
  nickname: string;
  /** Public avatar URL, or null when the bundled default should be used. */
  avatar: string | null;
  /** Masked verified phone number, or null before binding. */
  phoneMasked: string | null;
  /** Whether the verified-phone requirement is satisfied. */
  profileComplete: boolean;
  /** Current business user type. */
  userType: string;
  /** Optional user-entered region. */
  region: string | null;
  /** Optional user-entered biography. */
  bio: string | null;
}

/** Editable text profile fields. */
export interface UpdateMiniappProfileRequest {
  /** Display name after trimming, 1 to 24 characters. */
  nickname: string;
  /** Optional region text. */
  region: string | null;
  /** Optional biography text. */
  bio: string | null;
}

/** Requests a binding code for an unbound account. */
export interface SendMiniappPhoneCodeRequest {
  /** Mainland China mobile number to verify. */
  phone: string;
}

/** Consumes a code and binds the verified phone. */
export interface BindMiniappPhoneRequest {
  /** Mainland China mobile number to bind. */
  phone: string;
  /** Six-digit SMS verification code. */
  code: string;
}

/** Confirms cancellation after any required SMS verification. */
export interface CancelMiniappAccountRequest {
  /** Cancellation SMS code; omitted for accounts without a bound phone. */
  code?: string;
}
```

Update `packages/shared-types/src/api/auth.ts` so `WechatSession.user` is `MiniappUserProfile`, `WechatLoginResult` is the authenticated session shape, and obsolete `WechatBindPhoneRequest` is deleted. Export the new module from `packages/shared-types/src/api/index.ts`.

- [ ] **Step 4: Make existing phone-bearing admin/query contracts nullable**

Change only user records whose database phone can now be absent:

```ts
/** Verified phone number, or null for a Miniapp account that has not completed its profile. */
phone: string | null;
```

Apply that field to `AdminUserListItem`, `AdminOrderUserSummary`, legacy `User` responses, provider-certification user summaries, and complaint/dispute participant summaries. Keep `AdminSessionUser.phone` as `string` because only a phone-bearing administrator can log in.

- [ ] **Step 5: Verify and commit the shared contract**

Run:

```powershell
pnpm --filter @petcare/shared-types test
pnpm --filter @petcare/shared-types typecheck
pnpm --filter @petcare/shared-types lint
git diff --check
```

Expected: all commands PASS.

```powershell
git add packages/shared-types
git commit -m "feat(auth): 定义小程序账户契约"
```

### Task 2: Make phone optional in persistence and generated types

**Interfaces:**

- `User.phone` becomes nullable while retaining `@unique`.
- `UserProfile.bio` becomes nullable.
- Existing rows remain valid without a data rewrite.

- [ ] **Step 1: Add a failing WeChat service fixture for a null phone**

In `apps/server/src/auth/wechat-auth.service.spec.ts`, change the record helper to accept `phone: string | null` and add an expectation that an unbound active user can be issued a session without leaking a phone.

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/auth/wechat-auth.service.spec.ts
```

Expected: FAIL because generated Prisma types and the current session principal require `phone: string`.

- [ ] **Step 2: Update the Prisma schema**

Change the two model fields in `apps/server/prisma/schema.prisma`:

```prisma
phone String? @unique
bio   String?
```

- [ ] **Step 3: Generate the migration with Prisma CLI**

Run:

```powershell
pnpm --filter @petcare/server prisma:migrate:create -- --name miniapp_optional_phone_profile_bio
```

Expected: Prisma creates one migration that drops the phone `NOT NULL` constraint and adds nullable `bio`. Inspect the generated SQL; do not edit it by hand.

- [ ] **Step 4: Propagate nullability through server read models**

Update the exact DTO/service files listed in the File Map. Preserve phone search predicates because PostgreSQL simply excludes null values. Update `AdminAccountService.maskPhone` to fail closed:

```ts
private maskPhone(phone: string | null): string {
  return phone && /^\d{11}$/.test(phone)
    ? `${phone.slice(0, 3)}****${phone.slice(-4)}`
    : "****";
}
```

In `AuthService`, keep the administrator principal strict by narrowing after the active-admin check:

```ts
type ActiveAdministrator = AuthUserRecord & { phone: string };

private isActiveAdministrator(user: AuthUserRecord | null): user is ActiveAdministrator {
  return Boolean(user && user.status === "active" && user.phone && user.roles.length > 0);
}
```

- [ ] **Step 5: Generate types, typecheck, and commit**

Run:

```powershell
pnpm --filter @petcare/server prisma:generate
pnpm --filter @petcare/server typecheck
git diff --check
```

Expected: generated types and Server typecheck PASS.

```powershell
git add apps/server/prisma apps/server/src packages/shared-types
git commit -m "feat(user): 允许小程序账户延后绑定手机"
```

### Task 3: Replace first-login phone binding with automatic account creation

**Interfaces:**

- `WechatAuthService.login(loginCode): Promise<WechatSession>`.
- Unknown `openid` creates one active `pet_owner` account in a transaction.
- Inactive `openid` returns `AUTH_ACCOUNT_DISABLED` and never creates a replacement.
- Access-token payload no longer contains `phone`.

- [ ] **Step 1: Replace legacy bind-flow tests with creation and privacy tests**

In `apps/server/src/auth/wechat-auth.service.spec.ts` add tests for:

```ts
it("creates an active unbound account and returns a session on first login", async () => {
  wechatApiClient.exchangeLoginCode.mockResolvedValue({ openid: "openid-1" });
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.user.create.mockResolvedValue({
    ...activeUser,
    openid: "openid-1",
    phone: null,
    nickname: "宠友123456",
  });

  await expect(service.login("wx-code")).resolves.toMatchObject({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    user: { phoneMasked: null, profileComplete: false },
  });
});
```

Also test an existing active account, a concurrent `P2002` retry that reads the winning row, and an inactive account rejection. Delete bind-token and WeChat-phone-number tests.

- [ ] **Step 2: Run focused auth tests and confirm failures**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/auth/wechat-auth.service.spec.ts src/auth/token.service.spec.ts src/auth/wechat-auth.controller.spec.ts
```

Expected: FAIL because login still returns `phone_required` and token issuance still requires phone.

- [ ] **Step 3: Remove phone from JWT principal and payload**

Change `SessionPrincipal` and `AccessTokenPayload` in `apps/server/src/auth/auth.types.ts`:

```ts
export interface SessionPrincipal {
  userId: string;
  username: string | null;
  roles: string[];
  sessionVersion: number;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  sessionVersion: number;
  username: string | null;
  roles: string[];
  type: "access";
}
```

Delete the `phone` claim from `TokenService.issue`, remove `phone` from the principal passed by both `AuthService` and `WechatAuthService`, and update token/JWT tests to assert `expect(payload).not.toHaveProperty("phone")`.

- [ ] **Step 4: Implement transactional first-login creation**

Use `randomInt` from `node:crypto` and one private creator:

```ts
private createNickname(): string {
  return `宠友${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
}
```

`login` must exchange the code, return an existing active user, or create:

```ts
const created = await this.prismaService.user.create({
  data: {
    openid,
    phone: null,
    nickname: this.createNickname(),
    userType: "pet_owner",
    status: "active",
  },
  select: miniappUserSelect,
});
```

If creation raises `P2002`, re-read by `openid` and issue that active account's session. Do not convert conflicts into a second account. Map profiles with masked phone, `profileComplete: user.phone !== null`, `profile?.address ?? null`, and `profile?.bio ?? null`.

- [ ] **Step 5: Delete the obsolete public bind-phone route**

Remove `bindPhone` and `me` from `WechatAuthController`, remove `bindPhone` and `getCurrentUser` from `WechatAuthService`, delete `WechatBindPhoneDto` and obsolete standalone Miniapp-user response branches, stop injecting `RedisService` into `WechatAuthService`, and delete `WechatApiClient.getPhoneNumber` plus its tests. The current-profile route is replaced by `GET /users/me` in Task 5. Verify with:

```powershell
rg -n "bindPhone|getPhoneNumber|phone_required|bindToken" apps packages
```

Expected: no production Miniapp/auth flow references remain.

- [ ] **Step 6: Update E2E and commit**

Update `apps/server/test/wechat-auth.e2e-spec.ts` so first login returns HTTP 200 with an authenticated session and `profileComplete: false`.

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/auth/wechat-auth.service.spec.ts src/auth/token.service.spec.ts src/auth/jwt.strategy.spec.ts src/auth/wechat-auth.controller.spec.ts
pnpm --filter @petcare/server exec jest --config ./test/jest-e2e.json --runInBand test/wechat-auth.e2e-spec.ts
pnpm --filter @petcare/server typecheck
git diff --check
```

Expected: focused unit, E2E, and type checks PASS.

```powershell
git add apps/server packages/shared-types
git commit -m "feat(auth): 支持小程序首次静默建号"
```

### Task 4: Isolate SMS codes by server-owned purpose

**Interfaces:**

- `VerificationPurpose = "admin_login" | "miniapp_bind_phone" | "miniapp_cancel_account"`.
- `send({ phone, purpose, subject? })` and `verifyAndConsume({ phone, code, purpose })`.
- Redis keys and HMAC digest include purpose; optional `subject` adds a per-account hourly limiter.

- [ ] **Step 1: Write failing purpose-isolation tests**

Extend `apps/server/src/auth/verification-code.service.spec.ts`:

```ts
it("does not consume a code issued for another purpose", async () => {
  await service.send({ phone: "13800138000", purpose: "admin_login" });

  await expect(
    service.verifyAndConsume({
      phone: "13800138000",
      code: "123456",
      purpose: "miniapp_bind_phone",
    }),
  ).resolves.toBe(false);
});

it("limits one Miniapp subject across different destination phones", async () => {
  for (let index = 0; index < 5; index += 1) {
    await service.send({
      phone: `1760000000${index}`,
      purpose: "miniapp_bind_phone",
      subject: "user-1",
    });
  }

  await expect(
    service.send({
      phone: "17600000009",
      purpose: "miniapp_bind_phone",
      subject: "user-1",
    }),
  ).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED" });
});
```

Use the configured hourly limit in the fixture rather than hard-coding five if the fixture differs.

- [ ] **Step 2: Run the focused test and confirm signature/key failures**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/auth/verification-code.service.spec.ts
```

Expected: FAIL because current methods accept positional strings and keys omit purpose.

- [ ] **Step 3: Implement purpose-aware keys and digest**

Define the input types beside the service and make keys Server-owned:

```ts
export type VerificationPurpose =
  | "admin_login"
  | "miniapp_bind_phone"
  | "miniapp_cancel_account";

private otpKey(phone: string, purpose: VerificationPurpose): string {
  return `auth:otp:${purpose}:${phone}`;
}

private digest(phone: string, code: string, purpose: VerificationPurpose): string {
  return createHmac("sha256", this.configService.jwtSecret)
    .update(`${purpose}:${phone}:${code}`)
    .digest("hex");
}

private subjectHourlyKey(subject: string, purpose: VerificationPurpose): string {
  return `auth:otp:subject-hour:${purpose}:${subject}`;
}
```

Reuse the existing atomic Redis helpers. A failed SMS send must delete the OTP and cooldown keys; the subject counter may remain because it measures attempted abuse.

- [ ] **Step 4: Update Admin SMS callers explicitly**

Change `AuthService` calls to:

```ts
await this.verificationCodeService.send({ phone, purpose: "admin_login" });
const valid = await this.verificationCodeService.verifyAndConsume({
  phone,
  code,
  purpose: "admin_login",
});
```

Do not reuse the Admin captcha controller for Miniapp phone binding; only the internal verification service is shared.

Add `VerificationCodeService` to `AuthModule.exports` so `UserModule` can inject the existing service instead of registering a second instance.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/auth/verification-code.service.spec.ts src/auth/auth.service.spec.ts src/auth/auth.controller.spec.ts
pnpm --filter @petcare/server typecheck
git diff --check
```

Expected: all focused checks PASS.

```powershell
git add apps/server/src/auth
git commit -m "feat(auth): 隔离短信验证码用途"
```

### Task 5: Add current-profile, avatar, and phone-binding APIs

**Interfaces:**

- `GET /users/me` returns `MiniappUserProfile`.
- `PATCH /users/me` updates nickname, region, and bio.
- `PUT /users/me/avatar` accepts one validated multipart file.
- `POST /users/me/phone/code` sends a binding code for an unbound account.
- `PUT /users/me/phone` consumes the code and atomically binds a unique phone.

- [ ] **Step 1: Write failing profile service tests**

Create `apps/server/src/modules/user/miniapp-account.service.spec.ts` with one test per trust boundary:

```ts
it("returns only a masked phone and the derived completion state", async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: "user-1",
    nickname: "宠友123456",
    avatar: null,
    avatarObjectKey: null,
    phone: "13800138000",
    userType: "pet_owner",
    status: "active",
    profile: { address: "上海市", bio: "爱猫人士" },
  });

  await expect(service.getProfile("user-1")).resolves.toMatchObject({
    phoneMasked: "138****8000",
    profileComplete: true,
  });
});
```

Also cover nickname/control-character validation, unbound-only SMS send, invalid code, `P2002` phone conflict, and avatar cleanup restricted to `public/user-avatars/{userId}/`.

- [ ] **Step 2: Run the test and confirm the missing service**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/modules/user/miniapp-account.service.spec.ts
```

Expected: FAIL because `MiniappAccountService` does not exist.

- [ ] **Step 3: Generalize the existing avatar storage namespace**

Add a closed union to `PublicAvatarUpload`:

```ts
/** Server-selected object namespace. */
scope: "admin-avatars" | "user-avatars";
```

Build the COS key from that union:

```ts
const objectKey = `public/${input.scope}/${input.userId}/${randomUUID()}.${input.extension}`;
```

Pass `scope: "admin-avatars"` from `AdminAccountService` and `scope: "user-avatars"` from the new Miniapp service. Update storage/admin tests; do not make the scope a client field.

- [ ] **Step 4: Implement the profile service**

Use one selected record shape and these normalizers:

```ts
private normalizeRequiredText(value: string, maxLength: number, field: string): string {
  const normalized = value.trim();

  if (!normalized || normalized.length > maxLength || /\p{Cc}/u.test(normalized)) {
    throw new ApiException("VALIDATION_FAILED", `${field}格式无效`, HttpStatus.BAD_REQUEST);
  }

  return normalized;
}

private normalizeOptionalText(
  value: string | null,
  maxLength: number,
  field: string,
): string | null {
  if (value === null || value.trim() === "") return null;
  return this.normalizeRequiredText(value, maxLength, field);
}
```

Use limits: nickname 24, region 80, bio 200. `updateProfile` updates `User.nickname` and upserts `UserProfile.address/bio`. `sendPhoneCode` first confirms `phone === null`, then calls:

```ts
await this.verificationCodeService.send({
  phone,
  purpose: "miniapp_bind_phone",
  subject: userId,
});
```

Map the phone only through:

```ts
private maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  return /^\d{11}$/u.test(phone)
    ? `${phone.slice(0, 3)}****${phone.slice(-4)}`
    : "****";
}
```

`bindPhone` first confirms the account is still unbound, verifies the code, and then runs:

```ts
const result = await transaction.user.updateMany({
  where: { id: userId, phone: null, status: "active" },
  data: { phone },
});

if (result.count !== 1) {
  throw new ApiException(
    MINIAPP_ACCOUNT_ERROR_CODE.PHONE_ALREADY_BOUND,
    "当前账户已绑定手机号",
    HttpStatus.CONFLICT,
  );
}
```

Map `P2002` to `PHONE_CONFLICT` and return `getProfile(userId)` after the transaction.

- [ ] **Step 5: Add DTOs and authenticated controller routes**

Create DTOs with `class-validator` and Swagger metadata. Add `PublicAvatarStorageModule` and `LoggingModule` to `UserModule.imports`, register `MiniappAccountService` in providers, and register `MiniappAccountController` before `UserController` so `me` cannot be interpreted as an ID.

Use:

```ts
type MiniappRequest = Request & { user?: AccessTokenPayload };

private requireUserId(request: MiniappRequest): string {
  const userId = request.user?.sub;
  if (!userId) {
    throw new ApiException(
      "AUTH_SESSION_EXPIRED",
      "登录状态已失效，请重新登录",
      HttpStatus.UNAUTHORIZED,
    );
  }
  return userId;
}
```

Apply `@UseGuards(AccessTokenGuard)` to the controller. Reuse the existing `avatar-file.ts` detector and upload interceptor configuration from `AdminAccountController` rather than duplicating byte validation.

- [ ] **Step 6: Sanitize the legacy public user endpoint**

Change `UserService.findOne` and `UserResponseDto` so public `GET /users/:id` returns only `id`, `nickname`, `avatar`, `userType`, `status`, and public profile fields. Remove `phone` and password metadata from its select/response.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/public-avatar-storage/tencent-cos-public-avatar.storage.spec.ts src/modules/admin-account/admin-account.service.spec.ts src/modules/user/miniapp-account.service.spec.ts src/modules/user/user.service.spec.ts
pnpm --filter @petcare/server typecheck
pnpm --filter @petcare/server lint
git diff --check
```

Expected: focused tests, typecheck, lint, and diff check PASS.

```powershell
git add apps/server/src/public-avatar-storage apps/server/src/modules/admin-account apps/server/src/modules/user
git commit -m "feat(user): 提供小程序资料与手机绑定接口"
```

### Task 6: Enforce profile completion on the real reward-order write

**Interfaces:**

- `ProfileCompleteGuard` returns 401 through `AccessTokenGuard` for anonymous requests.
- Authenticated users with `phone === null` receive HTTP 403 and `PROFILE_INCOMPLETE`.
- `POST /orders/reward` uses `request.user.sub` instead of the current mock owner.

- [ ] **Step 1: Write failing guard and controller tests**

Create `apps/server/src/auth/profile-complete.guard.spec.ts`:

```ts
it("rejects an authenticated account without a verified phone", async () => {
  prisma.user.findUnique.mockResolvedValue({ phone: null, status: "active" });

  await expect(guard.canActivate(contextWithUser({ sub: "user-1" }))).rejects.toMatchObject({
    code: "PROFILE_INCOMPLETE",
    status: 403,
  });
});
```

In the new order controller test, assert `createRewardOrder(dto, "user-1")`. In `complaint.controller.spec.ts`, assert `ProfileCompleteGuard` metadata is present on `create`, `respond`, `appeal`, and `withdraw` but absent from `findMine` and `findOne`.

- [ ] **Step 2: Run focused tests and confirm failures**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/auth/profile-complete.guard.spec.ts src/modules/order/order.controller.spec.ts src/modules/complaint-dispute/complaint.controller.spec.ts
```

Expected: FAIL because the Guard is absent and the controller still hard-codes the owner.

- [ ] **Step 3: Implement the database-backed write guard**

```ts
@Injectable()
export class ProfileCompleteGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const userId = request.user?.sub;
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { phone: true, status: true },
        })
      : null;

    if (!userId || !user || user.status !== "active") {
      throw new ApiException(
        "AUTH_SESSION_EXPIRED",
        "登录状态已失效，请重新登录",
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!user.phone) {
      throw new ApiException(
        MINIAPP_ACCOUNT_ERROR_CODE.PROFILE_INCOMPLETE,
        "请先完善手机号",
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
```

Export the Guard from `AuthModule`.

- [ ] **Step 4: Protect reward creation and use the authenticated owner**

Apply guards in order:

```ts
@Post("reward")
@UseGuards(AccessTokenGuard, ProfileCompleteGuard)
createRewardOrder(@Req() request: AuthRequest, @Body() dto: CreateRewardOrderDto) {
  return this.orderService.createRewardOrder(dto, request.user.sub);
}
```

Keep public order reads unchanged. Do not add guards to nonexistent accept/comment/favorite/chat endpoints.

- [ ] **Step 5: Protect existing user complaint writes**

Keep `AccessTokenGuard` at the controller level and add `@UseGuards(ProfileCompleteGuard)` only to `create`, `respond`, `appeal`, and `withdraw`. Complaint list/detail reads remain available to an authenticated incomplete account.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/auth/profile-complete.guard.spec.ts src/modules/order/order.controller.spec.ts src/modules/complaint-dispute/complaint.controller.spec.ts
pnpm --filter @petcare/server typecheck
git diff --check
```

Expected: focused checks PASS and `rg -n "mock-owner-id" apps/server/src/modules/order` returns no matches.

```powershell
git add apps/server/src/auth apps/server/src/modules/order apps/server/src/modules/complaint-dispute
git commit -m "feat(order): 校验小程序资料完善状态"
```

### Task 7: Add the native Miniapp request and session layer

**Interfaces:**

- `rawRequest<T>(path, options): Promise<T>` unwraps `ApiResponse<T>` and supports 204.
- `rawUpload<T>(path, filePath, fieldName, headers): Promise<T>`.
- `bootstrapSession()` restores refresh first, otherwise performs silent `uni.login` unless `manualLogout` is set.
- `authorizedRequest` refreshes once on 401 and replays once.
- `loginInteractively()` clears `manualLogout` only after the user chooses to log in.
- `requireProfile(returnUrl)` gates real writes.

- [ ] **Step 1: Add dependency and environment contract**

Add `"@petcare/shared-types": "workspace:*"` to Miniapp dependencies, then run:

```powershell
pnpm install --lockfile-only
```

Add to `.env.example`:

```dotenv
VITE_MINIAPP_API_BASE_URL=http://localhost:3000
```

Document that production must use the HTTPS API gateway in `docs/environment-variables.md` and add the typed env field:

```ts
interface ImportMetaEnv {
  readonly VITE_MINIAPP_API_BASE_URL: string;
}
```

- [ ] **Step 2: Write failing envelope and refresh tests**

Create `apps/miniapp/src/api/request.spec.ts` to cover success, error envelope, and 204. Create `apps/miniapp/src/state/session.spec.ts` with a mocked `uni` object and this concurrency check:

```ts
it("shares one refresh across concurrent 401 responses", async () => {
  const first = authorizedRequest("/users/me");
  const second = authorizedRequest("/users/me");

  await Promise.all([first, second]);

  expect(refreshWechatSession).toHaveBeenCalledTimes(1);
});
```

Also test `manualLogout` suppresses silent `uni.login` and a failed refresh clears stored tokens.

- [ ] **Step 3: Run focused tests and confirm missing modules**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- src/api/request.spec.ts src/state/session.spec.ts
```

Expected: FAIL because the request and session modules do not exist.

- [ ] **Step 4: Implement the raw request boundary**

Use `uni.request` directly and expose a typed error:

```ts
export class MiniappApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
```

`rawRequest` joins the configured base URL with a leading-slash path, resolves `response.data.data` for 2xx, resolves `undefined as T` for 204, and throws `MiniappApiError` using the response envelope for non-2xx. `rawUpload` applies the same unwrapping to `uni.uploadFile`. Do not add a generic HTTP client class.

- [ ] **Step 5: Implement the session singleton without Pinia**

Persist only these keys:

```ts
const STORAGE_KEY = {
  accessToken: "petcare.accessToken",
  refreshToken: "petcare.refreshToken",
  user: "petcare.user",
  manualLogout: "petcare.manualLogout",
} as const;
```

Use one module-level `refreshPromise: Promise<void> | null` to serialize refresh. `authorizedRequest` and `authorizedUpload` attach `Authorization: Bearer {token}`, catch only a first 401, await refresh, and retry once. A second 401 clears the local session.

Validate return paths with:

```ts
function safeReturnUrl(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/pages/profile/index";
}
```

- [ ] **Step 6: Bootstrap on launch and wire the explicit login button**

In `App.vue`:

```ts
onLaunch(() => {
  void bootstrapSession();
});
```

In `pages/auth/index.vue`, bind the existing button to `loginInteractively`, disable it while pending, and switch to `/pages/index/index` only after success. Loading visual, `disabled`, `aria-disabled`, and click behavior must agree.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- src/api/request.spec.ts src/state/session.spec.ts
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
git diff --check
```

Expected: focused tests, typecheck, lint, and diff check PASS.

```powershell
git add .env.example docs/environment-variables.md apps/miniapp/package.json apps/miniapp/src pnpm-lock.yaml
git commit -m "feat(miniapp): 建立静默登录会话"
```

### Task 8: Connect real profile editing, WeChat avatar/nickname, and phone binding

**Interfaces:**

- `getProfile`, `updateProfile`, `uploadAvatar`, `sendPhoneCode`, and `bindPhone` call the new Server endpoints.
- WeChat uses `button open-type="chooseAvatar"` and `input type="nickname"`.
- H5/App uses a normal text input and `uni.chooseImage`.
- SMS button has a local 60-second display countdown but Server remains the authoritative limiter.

- [ ] **Step 1: Write failing default-avatar and profile-gate tests**

Create `apps/miniapp/src/state/default-avatar.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getDefaultAvatar } from "./default-avatar";

describe("getDefaultAvatar", () => {
  it("maps one user id to one bundled avatar", () => {
    expect(getDefaultAvatar("user-1")).toBe(getDefaultAvatar("user-1"));
    expect(["/static/main/profile-cat.png", "/static/main/profile-dog.png"]).toContain(
      getDefaultAvatar("user-1"),
    );
  });
});
```

Extend `session.spec.ts` to assert an incomplete user is sent to `/pages-account/profile/edit?returnUrl=...` and a complete user returns `true`.

- [ ] **Step 2: Run tests and confirm missing behavior**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- src/state/default-avatar.spec.ts src/state/session.spec.ts
```

Expected: FAIL because avatar mapping and profile gating are missing.

- [ ] **Step 3: Implement the smallest user API and stable default avatar**

Create `apps/miniapp/src/api/user.ts` as five thin functions over `authorizedRequest`/`authorizedUpload`. Implement a deterministic hash over the random user ID:

```ts
const DEFAULT_AVATARS = ["/static/main/profile-cat.png", "/static/main/profile-dog.png"] as const;

export function getDefaultAvatar(userId: string): string {
  const hash = Array.from(userId).reduce((value, character) => value + character.charCodeAt(0), 0);
  return DEFAULT_AVATARS[hash % DEFAULT_AVATARS.length];
}
```

- [ ] **Step 4: Replace fixture data in Profile and Info**

Load `session.user` or `GET /users/me` and render nickname, resolved avatar, masked phone, region, and bio. Remove the fake “PetCare 信用 720” block from the personal header and info page. Leave unrelated pet/order/coupon/wallet fixtures unchanged because their APIs are outside this plan.

Show a clear “完善手机号” status when `profileComplete` is false. Loading, retry, and empty states must not fall back to the old profile fixture.

- [ ] **Step 5: Implement the edit form and official WeChat controls**

Use conditional compilation:

```vue
<!-- #ifdef MP-WEIXIN -->
<button open-type="chooseAvatar" @chooseavatar="handleChooseAvatar">
  <image :src="avatarUrl" mode="aspectFill" />
</button>
<input v-model="form.nickname" type="nickname" maxlength="24" />
<!-- #endif -->
<!-- #ifndef MP-WEIXIN -->
<view role="button" aria-label="选择头像" @click="chooseImage">
  <image :src="avatarUrl" mode="aspectFill" />
</view>
<input v-model="form.nickname" type="text" maxlength="24" />
<!-- #endif -->
```

Use this local event type because UniApp does not expose one consistently:

```ts
type ChooseAvatarEvent = { detail?: { avatarUrl?: string } };
```

Upload the chosen temp file immediately. Save nickname/region/bio separately; a failed text save does not delete a successfully uploaded avatar.

- [ ] **Step 6: Add first-time phone binding**

Render phone input, code input, and send button only when `phoneMasked === null`. Validate Mainland China mobile format before sending, lock duplicate submissions, and start the countdown only after a successful response. After `bindPhone` returns, replace `session.user` and, when a safe `returnUrl` exists, navigate back to it.

If the phone is already bound, render its masked value without an edit control.

- [ ] **Step 7: Gate the real publish entry**

Change only `openPublish` in `apps/miniapp/src/pages/bounty/index.vue`:

```ts
async function openPublish() {
  if (!(await requireProfile("/pages-bounty/publish/step1"))) return;
  await uni.navigateTo({ url: "/pages-bounty/publish/step1" });
}
```

Keep static accept/comment/favorite/follow/chat-send controls disabled until they have real APIs.

- [ ] **Step 8: Run Miniapp validation and commit**

Run sequentially because UniApp builds share generated page state:

```powershell
pnpm --filter @petcare/miniapp test
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp build:mp-weixin
git diff --check
```

Expected: all commands PASS. In WeChat DevTools verify `chooseAvatar`, nickname input, SMS states, refresh persistence, and the publish redirect.

```powershell
git add apps/miniapp
git commit -m "feat(miniapp): 对接个人资料完善流程"
```

## Final Acceptance Checklist

- [ ] First-time `uni.login` creates an active account with a six-digit generated nickname and no phone.
- [ ] An unbound user can browse and receives `PROFILE_INCOMPLETE` from direct reward creation.
- [ ] Binding an Aliyun SMS-verified phone changes `profileComplete` to `true` without exposing the raw phone.
- [ ] A phone code from Admin login cannot be consumed by Miniapp binding, and the reverse is also true.
- [ ] WeChat avatar/nickname controls require a direct user gesture; no deprecated silent profile API is called.
- [ ] H5/App builds expose ordinary nickname and image controls without pretending to read WeChat profile data.
- [ ] Public `GET /users/:id` contains no phone.
- [ ] Access JWTs contain no phone claim.
- [ ] Existing admin login still rejects users without a phone and continues to return a strict `AdminSessionUser`.
- [ ] Miniapp request replay refreshes at most once and concurrent 401 responses share one refresh operation.
- [ ] Static/unimplemented action controls remain visibly and behaviorally disabled.
- [ ] Shared Types, focused Server tests/E2E, Server typecheck/lint, Miniapp tests/typecheck/lint/MP build, and `git diff --check` pass.
