# PetCare Miniapp Logout and Account Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 Miniapp 当前设备退出登录和不可自动恢复的账户注销流程，并确保注销后所有旧访问令牌与刷新令牌立即失效。

**Architecture:** 普通退出继续调用现有 `/auth/wechat/logout`，但客户端无论网络结果都清空本机并写入 `manualLogout`。账户注销扩展 `MiniappAccountService`：先检查发布方/服务方进行中订单，再按已绑定手机号要求用途隔离的短信验证码，最后在 Serializable 事务内复查订单并原子更新 `status = inactive`、`sessionVersion += 1`；现有令牌校验据此拒绝所有设备旧会话。

**Tech Stack:** NestJS、Prisma、PostgreSQL、Redis、Aliyun SMS、UniApp、Vue 3、TypeScript、Vitest、Jest。

**Spec:** `docs/plans/2026-08-24-miniapp-account-and-support-content-design.md`

## Global Constraints

- 本计划依赖 `2026-08-24-miniapp-silent-login-profile.md` 已完成的 `MiniappAccountService`、用途隔离验证码、Miniapp 会话单例和可空手机号契约。
- 普通退出只撤销当前刷新会话；不修改账户状态，不承诺提前失效其他设备已签发的短期访问令牌。
- 本机退出即使断网也必须成功清除本地令牌和用户数据。
- 注销必须同时检查用户作为 `ownerId` 和 `providerId` 的订单。
- 阻止状态固定为 `pending_confirm`、`confirmed`、`in_progress`、`disputed`；`completed` 和 `cancelled` 不阻止。
- 已绑定手机号必须消费 `miniapp_cancel_account` 用途验证码；未绑定手机号依赖当前有效微信会话和二次确认。
- 注销前检查不能替代事务内复查；事务内复查是订单竞态的最终边界。
- 注销只停用账户并保留 `openid`、订单、投诉和审计关联；不物理删除、不匿名化、不实现冷静期或自助恢复。
- 注销后不清空或复用 `openid`，再次微信登录必须返回 `AUTH_ACCOUNT_DISABLED`，不能创建第二个账户。
- 不增加注销记录表、后台恢复功能、令牌黑名单集合或 Redis 全库扫描。

## File Map

### Shared and Server

- Modify: `packages/shared-types/src/api/miniapp-account.ts`
- Modify: `packages/shared-types/src/api/miniapp-account.spec.ts`
- Modify: `apps/server/src/modules/user/dto/miniapp-account.dto.ts`
- Modify: `apps/server/src/modules/user/miniapp-account.controller.ts`
- Modify: `apps/server/src/modules/user/miniapp-account.service.ts`
- Modify: `apps/server/src/modules/user/miniapp-account.service.spec.ts`
- Modify: `apps/server/src/auth/verification-code.service.spec.ts`
- Modify: `apps/server/src/auth/session-validation.service.spec.ts`
- Modify: `apps/server/src/auth/token.service.spec.ts`
- Modify: `apps/server/src/auth/wechat-auth.service.spec.ts`
- Modify: `apps/server/test/wechat-auth.e2e-spec.ts`

### Miniapp

- Modify: `apps/miniapp/src/api/user.ts`
- Modify: `apps/miniapp/src/api/auth.ts`
- Modify: `apps/miniapp/src/state/session.ts`
- Modify: `apps/miniapp/src/state/session.spec.ts`
- Create: `apps/miniapp/src/pages-account/account/cancel.vue`
- Create: `apps/miniapp/src/pages-account/account/cancellation.ts`
- Create: `apps/miniapp/src/pages-account/account/cancellation.spec.ts`
- Modify: `apps/miniapp/src/pages/profile/index.vue`
- Modify: `apps/miniapp/pages.config.ts`
- Modify: `apps/miniapp/pages-config.spec.ts`
- Generated: `apps/miniapp/src/pages.json`
- Generated: `apps/miniapp/src/uni-pages.d.ts`

---

### Task 1: Define cancellation errors and the active-order policy

**Interfaces:**

- Adds stable `CANCELLATION_CODE_NOT_REQUIRED` and `CANCELLATION_CODE_REQUIRED` errors.
- Exposes one server-owned `ACTIVE_CANCELLATION_BLOCKING_STATUSES` constant for both preliminary and transactional checks.
- Does not add a public status enum solely for this flow.

- [ ] **Step 1: Add a failing shared error-code assertion**

Extend `packages/shared-types/src/api/miniapp-account.spec.ts`:

```ts
it("publishes stable cancellation recovery codes", () => {
  expect(MINIAPP_ACCOUNT_ERROR_CODE.ACTIVE_ORDER_EXISTS).toBe("ACTIVE_ORDER_EXISTS");
  expect(MINIAPP_ACCOUNT_ERROR_CODE.CANCELLATION_CODE_REQUIRED).toBe("CANCELLATION_CODE_REQUIRED");
  expect(MINIAPP_ACCOUNT_ERROR_CODE.CANCELLATION_CODE_NOT_REQUIRED).toBe(
    "CANCELLATION_CODE_NOT_REQUIRED",
  );
});
```

- [ ] **Step 2: Run the focused contract test and confirm failure**

Run:

```powershell
pnpm --filter @petcare/shared-types exec vitest run src/api/miniapp-account.spec.ts
```

Expected: FAIL because the two cancellation codes are absent.

- [ ] **Step 3: Add only the two missing error codes**

Extend `MINIAPP_ACCOUNT_ERROR_CODE`:

```ts
CANCELLATION_CODE_REQUIRED: "CANCELLATION_CODE_REQUIRED",
CANCELLATION_CODE_NOT_REQUIRED: "CANCELLATION_CODE_NOT_REQUIRED",
```

Keep `CancelMiniappAccountRequest.code?: string` unchanged.

- [ ] **Step 4: Define the server-local blocking status tuple**

At the top of `miniapp-account.service.ts`:

```ts
const ACTIVE_CANCELLATION_BLOCKING_STATUSES = [
  "pending_confirm",
  "confirmed",
  "in_progress",
  "disputed",
] as const;
```

Use this tuple in every cancellation order query. Also update the Prisma schema's order-status comment to include `disputed` so documentation matches the already-existing shared enum; no migration is needed for a comment-only schema change.

- [ ] **Step 5: Verify and commit the policy contract**

Run:

```powershell
pnpm --filter @petcare/shared-types exec vitest run src/api/miniapp-account.spec.ts
pnpm --filter @petcare/shared-types typecheck
git diff --check
```

Expected: checks PASS.

```powershell
git add packages/shared-types apps/server/prisma/schema.prisma apps/server/src/modules/user/miniapp-account.service.ts
git commit -m "feat(user): 定义账户注销阻断规则"
```

### Task 2: Add cancellation-code delivery and transactional cancellation

**Interfaces:**

- `sendCancellationCode(userId): Promise<void>` sends only to the current bound phone.
- `cancelAccount(userId, code?): Promise<void>` performs preliminary and Serializable transactional checks.
- `POST /users/me/cancellation/code` and `POST /users/me/cancel` both require `AccessTokenGuard`.

- [ ] **Step 1: Write failing cancellation service tests**

Extend `apps/server/src/modules/user/miniapp-account.service.spec.ts` with these observable cases:

```ts
it("blocks cancellation before sending SMS when an active order exists", async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: "user-1",
    phone: "13800138000",
    status: "active",
  });
  prisma.order.count.mockResolvedValue(1);

  await expect(service.sendCancellationCode("user-1")).rejects.toMatchObject({
    code: "ACTIVE_ORDER_EXISTS",
  });
  expect(verificationCodeService.send).not.toHaveBeenCalled();
});

it("sends a cancellation-purpose code only to the account phone", async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: "user-1",
    phone: "13800138000",
    status: "active",
  });
  prisma.order.count.mockResolvedValue(0);

  await service.sendCancellationCode("user-1");

  expect(verificationCodeService.send).toHaveBeenCalledWith({
    phone: "13800138000",
    purpose: "miniapp_cancel_account",
    subject: "user-1",
  });
});
```

Add tests for an invalid/missing code, unbound-account cancellation without a code, bound-account cancellation, active order found in the transaction, and a user acting as provider.

- [ ] **Step 2: Run the focused service test and confirm missing methods**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/modules/user/miniapp-account.service.spec.ts
```

Expected: FAIL because cancellation methods do not exist.

- [ ] **Step 3: Implement the shared active-order check**

Use one helper for owner and provider:

```ts
private async hasBlockingOrders(
  order: Prisma.TransactionClient["order"],
  userId: string,
): Promise<boolean> {
  const count = await order.count({
    where: {
      status: { in: [...ACTIVE_CANCELLATION_BLOCKING_STATUSES] },
      OR: [{ ownerId: userId }, { providerId: userId }],
    },
  });

  return count > 0;
}
```

Pass `this.prisma.order` for preliminary checks and `transaction.order` inside the cancellation transaction. Do not duplicate the query.

- [ ] **Step 4: Implement code delivery**

`sendCancellationCode` must:

1. Read `id`, `status`, and `phone`.
2. Reject missing/inactive users as `AUTH_SESSION_EXPIRED`.
3. Reject a null phone with `CANCELLATION_CODE_NOT_REQUIRED`.
4. Reject any blocking order with `ACTIVE_ORDER_EXISTS`.
5. Send using `purpose: "miniapp_cancel_account"` and `subject: userId`.

Never accept the destination phone from the request body.

- [ ] **Step 5: Implement cancellation with recheck and session-version invalidation**

Perform a cheap blocking-order check before consuming a code. For a bound account, reject a missing code with `CANCELLATION_CODE_REQUIRED` and consume:

```ts
const valid = await this.verificationCodeService.verifyAndConsume({
  phone: user.phone,
  code,
  purpose: "miniapp_cancel_account",
});

if (!valid) {
  throw new ApiException(
    MINIAPP_ACCOUNT_ERROR_CODE.VERIFICATION_CODE_INVALID,
    "验证码错误或已失效",
    HttpStatus.BAD_REQUEST,
  );
}
```

For an unbound account, reject a supplied code with `CANCELLATION_CODE_NOT_REQUIRED` and continue without touching Redis.

Then use a Serializable transaction:

```ts
await this.prisma.$transaction(
  async (transaction) => {
    const current = await transaction.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    if (!current || current.status !== "active") {
      throw new ApiException("AUTH_ACCOUNT_DISABLED", "账号已被停用", HttpStatus.FORBIDDEN);
    }

    if (await this.hasBlockingOrders(transaction.order, userId)) {
      throw new ApiException(
        MINIAPP_ACCOUNT_ERROR_CODE.ACTIVE_ORDER_EXISTS,
        "存在进行中的订单，暂时无法注销",
        HttpStatus.CONFLICT,
      );
    }

    await transaction.user.update({
      where: { id: userId },
      data: {
        status: "inactive",
        sessionVersion: { increment: 1 },
      },
    });
  },
  { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
);
```

Reuse the existing bounded three-attempt `P2034` retry pattern from `AdminAccountService`; keep it private to this service rather than adding a transaction utility.

- [ ] **Step 6: Add DTO/controller routes**

Add `CancelMiniappAccountDto` with optional six-digit `code`. The code-delivery route has no body:

```ts
@Post("cancellation/code")
@HttpCode(204)
async sendCancellationCode(@Req() request: MiniappRequest): Promise<void> {
  await this.service.sendCancellationCode(this.requireUserId(request));
}

@Post("cancel")
@HttpCode(204)
async cancel(
  @Req() request: MiniappRequest,
  @Body() dto: CancelMiniappAccountDto,
): Promise<void> {
  await this.service.cancelAccount(this.requireUserId(request), dto.code);
}
```

Document 400, 401, 403, 409, 429, and 500 in Swagger.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/modules/user/miniapp-account.service.spec.ts src/auth/verification-code.service.spec.ts
pnpm --filter @petcare/server typecheck
pnpm --filter @petcare/server lint
git diff --check
```

Expected: focused tests and Server checks PASS.

```powershell
git add apps/server/src/modules/user apps/server/src/auth/verification-code.service.spec.ts
git commit -m "feat(user): 实现账户注销事务"
```

### Task 3: Prove every old session becomes invalid

**Interfaces:**

- Access tokens fail because `SessionValidationService` observes inactive status/version mismatch.
- Refresh tokens fail before Redis rotation because `TokenService.consumeRefresh` calls the same version check.
- Login with the retained inactive `openid` fails and does not create a user.

- [ ] **Step 1: Add the failing session invalidation integration assertions**

Extend `apps/server/src/auth/session-validation.service.spec.ts`:

```ts
it("rejects the previous version after account cancellation", async () => {
  prisma.user.findUnique.mockResolvedValue({
    status: "inactive",
    sessionVersion: 4,
  });

  await expect(service.assertActiveVersion("user-1", 3)).rejects.toMatchObject({
    code: "AUTH_SESSION_EXPIRED",
  });
});
```

Extend `token.service.spec.ts` so a refresh token carrying version 3 is rejected when the account is inactive/version 4 and its Redis session digest is not consumed.

- [ ] **Step 2: Run the focused auth tests**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/auth/session-validation.service.spec.ts src/auth/token.service.spec.ts src/auth/wechat-auth.service.spec.ts
```

Expected: tests should PASS if Task 2 correctly uses existing invalidation. If they expose a mismatch, fix only the existing validation call order; do not add token blacklists.

- [ ] **Step 3: Add an E2E cancellation sequence**

Extend `apps/server/test/wechat-auth.e2e-spec.ts` with this real boundary sequence:

1. Seed one active user with `openid`, a bound phone, no blocking orders, and the configured development SMS code.
2. Login and retain access/refresh token A.
3. Call `POST /users/me/cancellation/code` and assert 204.
4. Call `POST /users/me/cancel` with the development code and assert 204.
5. Assert `GET /users/me` with access token A returns 401.
6. Assert `POST /auth/wechat/refresh` with refresh token A returns 401.
7. Assert a new login for the same `openid` returns 403 `AUTH_ACCOUNT_DISABLED`.

Use existing test Redis/Prisma setup and SMS development code; do not bypass the account service.

- [ ] **Step 4: Run the E2E and commit**

Run:

```powershell
pnpm --filter @petcare/server exec jest --config ./test/jest-e2e.json --runInBand test/wechat-auth.e2e-spec.ts
pnpm --filter @petcare/server typecheck
git diff --check
```

Expected: the complete invalidation sequence PASS.

```powershell
git add apps/server/src/auth apps/server/test/wechat-auth.e2e-spec.ts
git commit -m "test(auth): 验证注销后全会话失效"
```

### Task 4: Implement offline-safe current-device logout

**Interfaces:**

- `logout(): Promise<void>` attempts remote revoke once, always clears local state, and writes `manualLogout = true`.
- Startup remains anonymous while `manualLogout` is true.
- An explicit successful login clears `manualLogout`.

- [ ] **Step 1: Write failing local-logout tests**

Extend `apps/miniapp/src/state/session.spec.ts`:

```ts
it("clears local session even when remote logout fails", async () => {
  logoutWechatSession.mockRejectedValue(new Error("offline"));
  seedStoredSession();

  await logout();

  expect(session.user).toBeNull();
  expect(uni.removeStorageSync).toHaveBeenCalledWith("petcare.accessToken");
  expect(uni.removeStorageSync).toHaveBeenCalledWith("petcare.refreshToken");
  expect(uni.setStorageSync).toHaveBeenCalledWith("petcare.manualLogout", true);
});
```

Also assert logout sends the current refresh token when present and does not call the API when absent.

- [ ] **Step 2: Run the focused Miniapp test and confirm failure**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- src/state/session.spec.ts
```

Expected: FAIL because public `logout` is not implemented.

- [ ] **Step 3: Add the thin auth API call**

In `apps/miniapp/src/api/auth.ts`:

```ts
export async function logoutWechatSession(refreshToken: string): Promise<void> {
  await rawRequest<void>("/auth/wechat/logout", {
    method: "POST",
    data: { refreshToken },
  });
}
```

- [ ] **Step 4: Implement finally-based local cleanup**

In `session.ts`:

```ts
export async function logout(): Promise<void> {
  const refreshToken = uni.getStorageSync(STORAGE_KEY.refreshToken) as string | undefined;

  try {
    if (refreshToken) await logoutWechatSession(refreshToken);
  } catch {
    // Local logout must still succeed while offline.
  } finally {
    clearSession(true);
  }
}
```

`clearSession(true)` must remove tokens/user, reset reactive state, and set `manualLogout`; `clearSession(false)` remains available for expired sessions without changing user intent.

- [ ] **Step 5: Enable the My-page logout control**

Replace the disabled block with a real button. During the request, set native disabled state, `aria-disabled`, loading copy, opacity, and click guard together. On completion:

```ts
await logout();
await uni.reLaunch({ url: "/pages/index/index" });
```

Do not redirect to the login page automatically; anonymous browsing remains allowed.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- src/state/session.spec.ts
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
git diff --check
```

Expected: checks PASS.

```powershell
git add apps/miniapp/src/api/auth.ts apps/miniapp/src/state apps/miniapp/src/pages/profile/index.vue
git commit -m "feat(miniapp): 完善当前设备退出登录"
```

### Task 5: Build the account-cancellation page and API flow

**Interfaces:**

- `sendCancellationCode(): Promise<void>` and `cancelAccount(code?): Promise<void>` use authenticated user APIs.
- The page derives whether SMS is required from `session.user.phoneMasked`.
- A successful cancellation clears local state without making a redundant logout call.
- One new account subpage raises the route-state total from 35 to 36.

- [ ] **Step 1: Write the failing cancellation-state test and route assertion**

Create `apps/miniapp/src/pages-account/account/cancellation.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getCancellationRequirement } from "./cancellation";

describe("getCancellationRequirement", () => {
  it("requires SMS only for a bound phone", () => {
    expect(getCancellationRequirement("138****8000")).toEqual({
      requiresCode: true,
      phoneLabel: "138****8000",
    });
    expect(getCancellationRequirement(null)).toEqual({
      requiresCode: false,
      phoneLabel: "未绑定手机号",
    });
  });
});
```

Append `pages-account/account/cancel` to `expectedSubPages` and change the total assertion to:

```ts
expect(6 + expectedSubPages.length + 2).toBe(36);
```

- [ ] **Step 2: Run the focused tests and confirm failures**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- src/pages-account/account/cancellation.spec.ts pages-config.spec.ts
```

Expected: FAIL because the helper and route are missing.

- [ ] **Step 3: Implement the pure requirement mapper and register the route**

```ts
export function getCancellationRequirement(phoneMasked: string | null) {
  return phoneMasked
    ? { requiresCode: true, phoneLabel: phoneMasked }
    : { requiresCode: false, phoneLabel: "未绑定手机号" };
}
```

Add `"account/cancel"` to the existing `pages-account` array in `pages.config.ts`. Build once later to regenerate `pages.json` and `uni-pages.d.ts`.

- [ ] **Step 4: Add the two authenticated API calls**

In `apps/miniapp/src/api/user.ts`:

```ts
export function sendCancellationCode(): Promise<void> {
  return authorizedRequest<void>("/users/me/cancellation/code", { method: "POST" });
}

export function cancelAccount(code?: string): Promise<void> {
  return authorizedRequest<void>("/users/me/cancel", {
    method: "POST",
    data: code ? { code } : {},
  });
}
```

Add a `completeCancellation()` session method that clears local tokens/user and writes `manualLogout = true` without calling `/logout`.

- [ ] **Step 5: Build the cancellation page**

Create `cancel.vue` with:

- permanent-loss warning;
- history-retention wording;
- “进行中订单会阻止注销” notice;
- masked phone, send-code button, and six-digit input only when bound;
- one destructive primary action;
- a second `uni.showModal` confirmation whose confirm text is “确认注销”.

On confirm:

```ts
try {
  await cancelAccount(requirement.requiresCode ? code.value : undefined);
  completeCancellation();
  await uni.showToast({ title: "账户已注销", icon: "success" });
  await uni.reLaunch({ url: "/pages/index/index" });
} catch (error) {
  errorMessage.value =
    error instanceof MiniappApiError && error.code === "ACTIVE_ORDER_EXISTS"
      ? "存在进行中的订单，完成或取消后才能注销"
      : error instanceof Error
        ? error.message
        : "注销失败，请重试";
}
```

Keep the destructive control locked while sending or cancelling. Do not clear local state when the Server rejects.

- [ ] **Step 6: Add the My-page entry**

Add a separate “注销账户” row or low-emphasis destructive link below logout:

```ts
function openCancellation() {
  uni.navigateTo({ url: "/pages-account/account/cancel" });
}
```

Show it only when authenticated. Anonymous users see the explicit login entry from the first plan, not logout/cancellation controls.

- [ ] **Step 7: Verify and commit**

Run sequentially:

```powershell
pnpm --filter @petcare/miniapp test
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp build:mp-weixin
git diff --check
```

Expected: all checks PASS and generated route files include `pages-account/account/cancel`.

```powershell
git add apps/miniapp
git commit -m "feat(miniapp): 完成账户注销流程"
```

## Final Acceptance Checklist

- [ ] Remote logout is attempted once when a refresh token exists.
- [ ] Network failure never prevents local logout or `manualLogout` persistence.
- [ ] Restart after logout stays anonymous; explicit login can clear the marker.
- [ ] Cancellation-code delivery never accepts a client-supplied destination phone.
- [ ] An account with any blocking owner/provider order cannot receive or consume a useful cancellation flow.
- [ ] Bound accounts require a valid `miniapp_cancel_account` code; unbound accounts do not.
- [ ] The transaction rechecks blocking orders before status mutation.
- [ ] Successful cancellation keeps `openid` and history, sets `inactive`, and increments `sessionVersion` once.
- [ ] Old access tokens, old refresh tokens, and fresh login attempts for the same inactive `openid` are rejected.
- [ ] Cancellation failures preserve the local session so the user can resolve the cause.
- [ ] The route contract reports 36 total pages/states after adding the cancellation page.
- [ ] Focused Server tests/E2E, Server typecheck/lint, Miniapp tests/typecheck/lint/MP build, Shared Types checks, and `git diff --check` pass.
