# Admin Account Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Admin `/account` experience for viewing account data, editing nickname, managing a public Tencent COS avatar, and changing password with immediate all-device session invalidation.

**Architecture:** Add an `AdminAccountModule` at the `/admin/account/*` seam, backed by the existing `User` aggregate. Keep public-avatar storage behind a two-method adapter and keep token/session mechanics inside `AuthModule`; shared request and response contracts live in `@petcare/shared-types`. The common JWT strategy validates account status and `sessionVersion` for both Admin and Miniapp, while a dedicated Admin guard enforces the presence of an active backend role.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, Redis 6, `cos-nodejs-sdk-v5`, React 19, React Router 7, Axios, Tailwind CSS 4, Jest, Vitest, Testing Library.

## Global Constraints

- Use Node.js `24.19.0`; supported range is `>=24.12.0 <25`.
- Use the repository-pinned pnpm version and preserve any concurrent workspace changes.
- All shared request/response types belong in `@petcare/shared-types`; do not duplicate them in Admin or Server.
- Every shared field, business value, and public function requires purpose-focused JSDoc.
- Server runtime configuration must be read through `ConfigService`, never directly from `process.env` outside that module.
- Admin uses Tailwind utilities and the existing 14 px base size; do not add a Toast dependency or standalone SCSS.
- Public avatar uploads accept only JPEG, PNG, and WebP, at most `2 * 1024 * 1024` bytes.
- Tencent COS secrets stay server-side and must never appear in responses or logs.
- `.env` is local-only: append empty COS keys without reading out, overwriting, staging, or committing the file.
- Keep the refresh cookie path `/api/auth`; use the Access Token `sid` to revoke the current Redis session from `/admin/account/password`.
- Do not create an `AdminAccount`, `Credential`, or new administrator profile table.
- Do not generate or hand-edit `prisma/migrations`; this repository currently applies schema changes with `prisma:push`.
- Implement each behavior test-first using Red-Green-Refactor and commit only the files listed by that task.

---

## File Structure

### Shared contracts and data

- `packages/shared-types/src/api/admin-account.ts`: account request/response types and stable error-code catalog.
- `packages/shared-types/src/api/admin-account.spec.ts`: runtime assertions for exported error-code values.
- `packages/shared-types/src/api/auth.ts`: add `avatar` to `AdminSessionUser`.
- `packages/shared-types/src/api/index.ts`: export the account contract.
- `apps/server/prisma/schema.prisma`: add `avatarObjectKey` and `sessionVersion` to `User`.

### Authentication

- `apps/server/src/auth/session-validation.service.ts`: common active-account and token-version check; no Admin-role policy.
- `apps/server/src/auth/session-validation.service.spec.ts`: active, disabled, missing, and version mismatch behavior.
- `apps/server/src/auth/refresh-cookie.ts`: shared refresh-cookie name and options used by Auth and Admin Account controllers.
- `apps/server/src/auth/auth.types.ts`: add `sid` and `sessionVersion` to token payloads.
- `apps/server/src/auth/token.service.ts`: issue versioned tokens, consume versioned refresh sessions, revoke by `sid`.
- `apps/server/src/auth/jwt.strategy.ts`: asynchronously validate account state/version.
- `apps/server/src/auth/auth.service.ts`: select and issue Admin sessions with avatar and version.
- `apps/server/src/auth/wechat-auth.service.ts`: select and issue Miniapp sessions with version.
- `apps/server/src/auth/auth.module.ts`: register/export the new authentication interfaces.

### Tencent COS public-avatar storage

- `apps/server/src/public-avatar-storage/public-avatar-storage.types.ts`: narrow adapter interface and injection token.
- `apps/server/src/public-avatar-storage/tencent-cos-public-avatar.storage.ts`: COS implementation.
- `apps/server/src/public-avatar-storage/disabled-public-avatar.storage.ts`: explicit 503 implementation.
- `apps/server/src/public-avatar-storage/public-avatar-storage.module.ts`: select the adapter from validated configuration.
- `apps/server/src/public-avatar-storage/avatar-file.ts`: magic-number validation and detected extension/content type.
- Co-located `*.spec.ts` files: configuration, URL generation, adapter error mapping, and file validation.

### Admin account Server slice

- `apps/server/src/modules/admin-account/admin-account.module.ts`: imports Auth and avatar storage, exposes the controller.
- `apps/server/src/modules/admin-account/active-administrator.guard.ts`: require any active backend role.
- `apps/server/src/modules/admin-account/admin-account.service.ts`: profile, nickname, avatar lifecycle, and password operations.
- `apps/server/src/modules/admin-account/admin-account.controller.ts`: `/admin/account/*` endpoints.
- `apps/server/src/modules/admin-account/dto/admin-account.dto.ts`: request and Swagger response DTOs.
- Co-located `*.spec.ts` files: service, controller, guard, and DTO behavior.

### Admin frontend

- `apps/admin/src/api/admin-account.ts`: account API client.
- `apps/admin/src/api/admin-account.test.ts`: request method/path/body and multipart tests.
- `apps/admin/src/pages/Account/index.tsx`: page-level loading/retry orchestration.
- `apps/admin/src/pages/Account/ProfileCard.tsx`: avatar and nickname UI.
- `apps/admin/src/pages/Account/PasswordCard.tsx`: password form and focus target.
- `apps/admin/src/pages/Account/index.test.tsx`: page flows and accessibility feedback.
- `apps/admin/src/auth/AuthProvider.tsx` and context: narrow summary update and local session invalidation.
- `apps/admin/src/components/Header.tsx`: responsive account menu and avatar.
- `apps/admin/src/routes/registry.ts`: protected, menu-less `/account` route.

---

### Task 1: Shared Contracts and Prisma User Fields

**Files:**

- Create: `packages/shared-types/src/api/admin-account.ts`
- Create: `packages/shared-types/src/api/admin-account.spec.ts`
- Modify: `packages/shared-types/src/api/auth.ts`
- Modify: `packages/shared-types/src/api/index.ts`
- Modify: `apps/server/prisma/schema.prisma`

**Interfaces:**

- Produces: `AdminAccountProfile`, `UpdateAdminAccountProfileRequest`, `UpdateAdminAccountPasswordRequest`, `AdminAvatarResponse`, and `ADMIN_ACCOUNT_ERROR_CODE`.
- Produces: `AdminSessionUser.avatar: string | null`.
- Produces: Prisma `User.avatarObjectKey: string | null` and `User.sessionVersion: number`.

- [ ] **Step 1: Write the failing shared-contract test**

```ts
import { ADMIN_ACCOUNT_ERROR_CODE } from "./admin-account";

describe("ADMIN_ACCOUNT_ERROR_CODE", () => {
  it("exports stable public account error codes", () => {
    expect(ADMIN_ACCOUNT_ERROR_CODE).toEqual({
      PASSWORD_REUSED: "ACCOUNT_PASSWORD_REUSED",
      CURRENT_PASSWORD_INVALID: "ACCOUNT_CURRENT_PASSWORD_INVALID",
      PASSWORD_NOT_CONFIGURED: "ACCOUNT_PASSWORD_NOT_CONFIGURED",
      CONCURRENT_UPDATE: "ACCOUNT_CONCURRENT_UPDATE",
      AVATAR_INVALID_TYPE: "AVATAR_INVALID_TYPE",
      AVATAR_FILE_TOO_LARGE: "AVATAR_FILE_TOO_LARGE",
      STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `pnpm --filter @petcare/shared-types test -- admin-account.spec.ts`

Expected: FAIL because `./admin-account` does not exist.

- [ ] **Step 3: Add the exact shared interface**

```ts
/** Stable errors returned by administrator self-service account operations. */
export const ADMIN_ACCOUNT_ERROR_CODE = {
  PASSWORD_REUSED: "ACCOUNT_PASSWORD_REUSED",
  CURRENT_PASSWORD_INVALID: "ACCOUNT_CURRENT_PASSWORD_INVALID",
  PASSWORD_NOT_CONFIGURED: "ACCOUNT_PASSWORD_NOT_CONFIGURED",
  CONCURRENT_UPDATE: "ACCOUNT_CONCURRENT_UPDATE",
  AVATAR_INVALID_TYPE: "AVATAR_INVALID_TYPE",
  AVATAR_FILE_TOO_LARGE: "AVATAR_FILE_TOO_LARGE",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
} as const;

/** Current administrator's self-service profile. */
export interface AdminAccountProfile {
  /** User UUID. */
  id: string;
  /** Login name, or null when none is configured. */
  username: string | null;
  /** Server-masked login phone number. */
  maskedPhone: string;
  /** Administrator-facing display name. */
  nickname: string;
  /** Public avatar URL, or null for the default avatar. */
  avatar: string | null;
  /** Current account status. */
  status: string;
  /** Names of active backend roles. */
  roles: string[];
  /** ISO timestamp when the account was created. */
  createdAt: string;
}

/** Editable administrator profile fields. */
export interface UpdateAdminAccountProfileRequest {
  /** New display nickname after server normalization. */
  nickname: string;
}

/** Password rotation request; confirmation remains a UI-only field. */
export interface UpdateAdminAccountPasswordRequest {
  /** Password currently configured on the account. */
  currentPassword: string;
  /** Replacement password with at least twelve characters. */
  newPassword: string;
}

/** Result of a successful public-avatar replacement. */
export interface AdminAvatarResponse {
  /** Newly active public avatar URL. */
  avatar: string;
}
```

Export it from `api/index.ts`, and add this field to `AdminSessionUser`:

```ts
/** Current public avatar URL, or null for the default avatar. */
avatar: string | null;
```

- [ ] **Step 4: Extend the Prisma model and format it**

```prisma
avatar          String?
avatarObjectKey String?  @map("avatar_object_key")
sessionVersion  Int      @default(0) @map("session_version")
```

Run: `pnpm --filter @petcare/server exec prisma format`

Expected: schema formatted successfully; no migration directory is created.

- [ ] **Step 5: Run focused verification**

Run:

```powershell
pnpm --filter @petcare/shared-types test -- admin-account.spec.ts
pnpm --filter @petcare/shared-types build
$env:DATABASE_URL='postgresql://user:password@localhost:5432/petcare?schema=public'
pnpm --filter @petcare/server exec prisma validate
pnpm --filter @petcare/server exec prisma generate
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/api/admin-account.ts packages/shared-types/src/api/admin-account.spec.ts packages/shared-types/src/api/auth.ts packages/shared-types/src/api/index.ts apps/server/prisma/schema.prisma
git commit -m "feat(admin): 定义个人账户契约"
```

---

### Task 2: Versioned Tokens and Common Session Validation

**Files:**

- Create: `apps/server/src/auth/session-validation.service.ts`
- Create: `apps/server/src/auth/session-validation.service.spec.ts`
- Create: `apps/server/src/auth/jwt.strategy.spec.ts`
- Modify: `apps/server/src/auth/auth.types.ts`
- Modify: `apps/server/src/auth/token.service.ts`
- Modify: `apps/server/src/auth/token.service.spec.ts`
- Modify: `apps/server/src/auth/jwt.strategy.ts`
- Modify: `apps/server/src/auth/auth.service.ts`
- Modify: `apps/server/src/auth/auth.service.spec.ts`
- Modify: `apps/server/src/auth/wechat-auth.service.ts`
- Modify: `apps/server/src/auth/wechat-auth.service.spec.ts`
- Modify: `apps/server/src/auth/dto/auth-response.dto.ts`
- Modify: `apps/server/src/auth/auth.module.ts`

**Interfaces:**

- Consumes: Prisma `User.sessionVersion` and `AdminSessionUser.avatar` from Task 1.
- Produces: `SessionPrincipal.sessionVersion`.
- Produces: `AccessTokenPayload` with `sid`, `sessionVersion`, and `type: "access"`.
- Produces: `RefreshTokenPayload` with `sid`, `sessionVersion`, and `type: "refresh"`.
- Produces: `SessionValidationService.assertActiveVersion(userId, sessionVersion): Promise<void>`.
- Produces: `TokenService.revokeSession(sessionId): Promise<void>` for Task 4.

- [ ] **Step 1: Write failing session-validation tests**

```ts
it("accepts an active user with the current version", async () => {
  prisma.user.findUnique.mockResolvedValue({ status: "active", sessionVersion: 3 });
  await expect(service.assertActiveVersion("user-1", 3)).resolves.toBeUndefined();
});

it.each([
  [null, 3],
  [{ status: "inactive", sessionVersion: 3 }, 3],
  [{ status: "active", sessionVersion: 4 }, 3],
])("rejects missing, disabled, or stale sessions", async (user, version) => {
  prisma.user.findUnique.mockResolvedValue(user);
  await expect(service.assertActiveVersion("user-1", version)).rejects.toMatchObject({
    code: "AUTH_SESSION_EXPIRED",
  });
});
```

- [ ] **Step 2: Run the new spec and confirm it fails**

Run: `pnpm --filter @petcare/server test -- session-validation.service.spec.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the minimal common validator**

```ts
@Injectable()
export class SessionValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async assertActiveVersion(userId: string, sessionVersion: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, sessionVersion: true },
    });

    if (!user || user.status !== "active" || user.sessionVersion !== sessionVersion) {
      throw new ApiException("AUTH_SESSION_EXPIRED", "登录状态已失效", HttpStatus.UNAUTHORIZED);
    }
  }
}
```

This service deliberately does not inspect roles.

- [ ] **Step 4: Extend token tests before implementation**

Assert both tokens contain the same `sid` and `sessionVersion`, `consumeRefresh()` rejects a version mismatch, and `revokeSession(sid)` removes only `auth:session:{sid}`.

```ts
expect(accessPayload).toMatchObject({ sid: refreshPayload.sid, sessionVersion: 2 });
await service.revokeSession(refreshPayload.sid);
expect(redis.values.has(`auth:session:${refreshPayload.sid}`)).toBe(false);
```

Run: `pnpm --filter @petcare/server test -- token.service.spec.ts`

Expected: FAIL because the payload and method are missing.

- [ ] **Step 5: Implement versioned token issue/consume/revoke**

Update the type shapes:

```ts
export interface SessionPrincipal {
  userId: string;
  username: string | null;
  phone: string;
  roles: string[];
  sessionVersion: number;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  sessionVersion: number;
  username: string | null;
  phone: string;
  roles: string[];
  type: "access";
}
```

Generate `sid` once in `issue()`, put it in both payloads, call `assertActiveVersion(payload.sub, payload.sessionVersion)` from `consumeRefresh()`, and add:

```ts
async revokeSession(sessionId: string): Promise<void> {
  await this.redisService.del(this.sessionKey(sessionId));
}
```

- [ ] **Step 6: Make JWT validation asynchronous and test it**

```ts
async validate(payload: AccessTokenPayload): Promise<AccessTokenPayload> {
  if (payload.type !== "access" || !payload.sub || !payload.sid || !Number.isInteger(payload.sessionVersion)) {
    throw new UnauthorizedException("登录状态已失效");
  }

  await this.sessionValidation.assertActiveVersion(payload.sub, payload.sessionVersion);
  return payload;
}
```

Test valid, missing `sid`, and stale version cases. Do not add a role check.

- [ ] **Step 7: Thread the version through Admin and Miniapp session issuance**

Add `avatar` and `sessionVersion` to the Admin select and safe response. Add `sessionVersion` to the Miniapp select. Both calls to `TokenService.issue()` must pass the selected version.

Update existing fixtures to include:

```ts
avatar: null,
sessionVersion: 0,
```

- [ ] **Step 8: Register and export the authentication interfaces**

Provide `SessionValidationService`; export `PasswordService`, `TokenService`, and `SessionValidationService` from `AuthModule`. Ensure module tests assert those providers without requiring live Redis.

- [ ] **Step 9: Run focused authentication tests**

Run:

```powershell
pnpm --filter @petcare/server test -- session-validation.service.spec.ts token.service.spec.ts jwt.strategy.spec.ts auth.service.spec.ts wechat-auth.service.spec.ts
pnpm --filter @petcare/server typecheck
```

Expected: all pass; ordinary Miniapp fixtures remain valid without roles.

- [ ] **Step 10: Commit**

```bash
git add apps/server/src/auth/session-validation.service.ts apps/server/src/auth/session-validation.service.spec.ts apps/server/src/auth/jwt.strategy.spec.ts apps/server/src/auth/auth.types.ts apps/server/src/auth/token.service.ts apps/server/src/auth/token.service.spec.ts apps/server/src/auth/jwt.strategy.ts apps/server/src/auth/auth.service.ts apps/server/src/auth/auth.service.spec.ts apps/server/src/auth/wechat-auth.service.ts apps/server/src/auth/wechat-auth.service.spec.ts apps/server/src/auth/dto/auth-response.dto.ts apps/server/src/auth/auth.module.ts
git commit -m "feat(auth): 支持账户级会话失效"
```

---

### Task 3: Tencent COS Configuration and Public-Avatar Adapter

**Files:**

- Modify locally, never stage: `.env`
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `apps/server/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/server/src/config/config.service.ts`
- Modify: `apps/server/src/config/config.service.spec.ts`
- Create: `apps/server/src/public-avatar-storage/public-avatar-storage.types.ts`
- Create: `apps/server/src/public-avatar-storage/tencent-cos-public-avatar.storage.ts`
- Create: `apps/server/src/public-avatar-storage/tencent-cos-public-avatar.storage.spec.ts`
- Create: `apps/server/src/public-avatar-storage/disabled-public-avatar.storage.ts`
- Create: `apps/server/src/public-avatar-storage/public-avatar-storage.module.ts`
- Create: `apps/server/src/public-avatar-storage/public-avatar-storage.module.spec.ts`

**Interfaces:**

- Produces: `PUBLIC_AVATAR_STORAGE` injection token.
- Produces: `PublicAvatarStorage.upload(input): Promise<{ objectKey: string; publicUrl: string }>`.
- Produces: `PublicAvatarStorage.delete(objectKey): Promise<void>`.
- Produces: typed `ConfigService.tencentCos*` getters and `ConfigService.tencentCosEnabled`.

- [ ] **Step 1: Install the official Node.js SDK and Multer typings**

Run:

```powershell
pnpm --filter @petcare/server add cos-nodejs-sdk-v5
pnpm --filter @petcare/server add -D @types/multer
```

Expected: `apps/server/package.json` and `pnpm-lock.yaml` change; no browser COS SDK is added.

- [ ] **Step 2: Write failing configuration tests**

Replace Aliyun fixtures with the five `TENCENT_COS_*` variables and assert:

```ts
it("keeps COS disabled when all fields are empty", () => {
  process.env = { ...validStartupEnv, TENCENT_COS_SECRET_ID: "", TENCENT_COS_PUBLIC_BASE_URL: "" };
  const config = new ConfigService();
  expect(() => config.validateForStartup()).not.toThrow();
  expect(config.tencentCosEnabled).toBe(false);
});

it("rejects partial COS configuration", () => {
  process.env = { ...validStartupEnv, TENCENT_COS_BUCKET: "petcare-avatar-1250000000" };
  expect(() => new ConfigService().validateForStartup()).toThrow(/TENCENT_COS_SECRET_ID/);
});
```

Also cover a valid `BucketName-APPID`, a valid `ap-guangzhou` Region, and an absolute HTTP(S) public base URL.

- [ ] **Step 3: Run the ConfigService spec and confirm failure**

Run: `pnpm --filter @petcare/server test -- config.service.spec.ts`

Expected: FAIL because COS getters/validation are absent.

- [ ] **Step 4: Replace the unused Aliyun configuration**

Add getters:

```ts
get tencentCosSecretId(): string;
get tencentCosSecretKey(): string;
get tencentCosBucket(): string;
get tencentCosRegion(): string;
get tencentCosPublicBaseUrl(): string;
get tencentCosEnabled(): boolean;
```

Validation requires the four core values together. A non-empty public base URL also requires the four core values. Validate Bucket with the APPID suffix, Region with `^[a-z0-9]+(?:-[a-z0-9]+)+$`, and base URL with `new URL()` restricted to HTTP(S).

- [ ] **Step 5: Write failing adapter tests**

Use a fake COS client and assert exact calls:

```ts
expect(cos.putObject).toHaveBeenCalledWith(
  expect.objectContaining({
    Bucket: "petcare-avatar-1250000000",
    Region: "ap-guangzhou",
    Key: expect.stringMatching(/^public\/admin-avatars\/user-1\/[0-9a-f-]+\.png$/),
    Body: pngBuffer,
    ContentType: "image/png",
  }),
  expect.any(Function),
);
```

Cover default URL, custom base URL without duplicate slashes, `deleteObject`, and provider failures mapped to `503 STORAGE_UNAVAILABLE` while retaining the COS request ID only in structured logs.

- [ ] **Step 6: Implement the narrow adapter interface**

```ts
export const PUBLIC_AVATAR_STORAGE = Symbol("PUBLIC_AVATAR_STORAGE");

export interface PublicAvatarUpload {
  userId: string;
  body: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
}

export interface PublicAvatarStorage {
  upload(input: PublicAvatarUpload): Promise<{ objectKey: string; publicUrl: string }>;
  delete(objectKey: string): Promise<void>;
}
```

Wrap callback-style `putObject` and `deleteObject` in Promises. Generate the object key internally with `randomUUID()`; callers cannot choose ACL, path, Bucket, or Region.

- [ ] **Step 7: Implement enabled/disabled provider selection**

The module factory returns `DisabledPublicAvatarStorage` when `tencentCosEnabled` is false; its `upload()` throws `ApiException(STORAGE_UNAVAILABLE, ..., 503)` and its `delete()` is a no-op. When enabled, construct one COS client with the validated Secret ID and Secret Key.

- [ ] **Step 8: Append local placeholders safely and update deployable configuration**

First check only for key presence without printing values. Append missing keys to `.env`:

```env
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_BUCKET=
TENCENT_COS_REGION=
TENCENT_COS_PUBLIC_BASE_URL=
```

Make the same replacement in `.env.example` and pass the five variables through `docker-compose.yml`. Never stage `.env`.

- [ ] **Step 9: Run focused storage/configuration verification**

Run:

```powershell
pnpm --filter @petcare/server test -- config.service.spec.ts public-avatar-storage
pnpm --filter @petcare/server typecheck
git diff --check
```

Expected: all pass; `git status --short .env` prints nothing because it is ignored.

- [ ] **Step 10: Commit**

```bash
git add .env.example docker-compose.yml apps/server/package.json pnpm-lock.yaml apps/server/src/config/config.service.ts apps/server/src/config/config.service.spec.ts apps/server/src/public-avatar-storage/public-avatar-storage.types.ts apps/server/src/public-avatar-storage/tencent-cos-public-avatar.storage.ts apps/server/src/public-avatar-storage/tencent-cos-public-avatar.storage.spec.ts apps/server/src/public-avatar-storage/disabled-public-avatar.storage.ts apps/server/src/public-avatar-storage/public-avatar-storage.module.ts apps/server/src/public-avatar-storage/public-avatar-storage.module.spec.ts
git commit -m "feat(storage): 接入腾讯 COS 公开头像"
```

---

### Task 4: Admin Profile and Password Endpoints

**Files:**

- Create: `apps/server/src/auth/refresh-cookie.ts`
- Modify: `apps/server/src/auth/auth.controller.ts`
- Modify: `apps/server/src/auth/auth.controller.spec.ts`
- Create: `apps/server/src/modules/admin-account/active-administrator.guard.ts`
- Create: `apps/server/src/modules/admin-account/active-administrator.guard.spec.ts`
- Create: `apps/server/src/modules/admin-account/dto/admin-account.dto.ts`
- Create: `apps/server/src/modules/admin-account/dto/admin-account.dto.spec.ts`
- Create: `apps/server/src/modules/admin-account/admin-account.service.ts`
- Create: `apps/server/src/modules/admin-account/admin-account.service.spec.ts`
- Create: `apps/server/src/modules/admin-account/admin-account.controller.ts`
- Create: `apps/server/src/modules/admin-account/admin-account.controller.spec.ts`
- Create: `apps/server/src/modules/admin-account/admin-account.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**

- Consumes: shared account contracts, `PasswordService`, `TokenService.revokeSession(sid)`, and versioned `AccessTokenPayload.sid`.
- Produces: `AdminAccountService.getProfile(userId)` and `updateProfile(userId, nickname)`.
- Produces: `AdminAccountMutationContext { userId: string; sessionId: string; requestId: string }`.
- Produces: `AdminAccountService.changePassword(context, request): Promise<void>`.
- Produces: GET/PATCH profile and PUT password routes; avatar routes follow in Task 5.

- [ ] **Step 1: Extract the refresh-cookie interface with characterization tests**

Move `REFRESH_COOKIE` and the options builder into `refresh-cookie.ts`:

```ts
export const REFRESH_COOKIE = "petcare_refresh_token";

export function refreshCookieOptions(config: ConfigService) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.nodeEnv === "production",
    path: "/api/auth",
  };
}
```

Update existing AuthController tests first so cookie behavior is unchanged.

- [ ] **Step 2: Write failing guard and profile-service tests**

Guard cases: missing `sub` returns 401; an active user with no active Admin roles returns 403; any active role, not only `super_admin`, succeeds. Reuse `AuthService.getCurrentUserAuthorization(userId)` so the Guard never trusts role names copied into the Access Token.

Service profile test:

```ts
expect(await service.getProfile("user-1")).toEqual({
  id: "user-1",
  username: "admin",
  maskedPhone: "138****8000",
  nickname: "系统管理员",
  avatar: null,
  status: "active",
  roles: ["operator"],
  createdAt: "2026-07-22T00:00:00.000Z",
});
```

Only active roles are returned. Add masking cases for ordinary 11-digit and abnormal short stored values.

- [ ] **Step 3: Run the tests and confirm missing-module failures**

Run: `pnpm --filter @petcare/server test -- active-administrator.guard.spec.ts admin-account.service.spec.ts`

Expected: FAIL because the Admin Account slice does not exist.

- [ ] **Step 4: Implement profile query, masking, and nickname update**

The nickname DTO uses `@IsString()`, `@MinLength(1)`, and `@MaxLength(30)`. The service trims before persistence and explicitly rejects `\p{Cc}` control characters with `VALIDATION_FAILED`.

Do not return `phone`, `passwordHash`, `avatarObjectKey`, or `sessionVersion`.

- [ ] **Step 5: Write failing password tests**

Cover:

- no `passwordHash` -> `ACCOUNT_PASSWORD_NOT_CONFIGURED`;
- wrong current password -> `ACCOUNT_CURRENT_PASSWORD_INVALID`;
- new password verifies against current hash -> `ACCOUNT_PASSWORD_REUSED`;
- successful `updateMany` uses `{ id, passwordHash: oldHash, sessionVersion: oldVersion }`, sets `passwordHash`, and increments version;
- count `0` -> `ACCOUNT_CONCURRENT_UPDATE`;
- success calls `tokenService.revokeSession(sid)` and logs only IDs/event metadata.

- [ ] **Step 6: Implement password rotation without a long transaction**

```ts
const current = await this.prisma.user.findUnique({
  where: { id: userId },
  select: { passwordHash: true, sessionVersion: true },
});

// Verify current password, reject reuse, and hash new password before the write.
const result = await this.prisma.user.updateMany({
  where: {
    id: userId,
    passwordHash: current.passwordHash,
    sessionVersion: current.sessionVersion,
  },
  data: {
    passwordHash: newHash,
    sessionVersion: { increment: 1 },
  },
});
```

If `result.count !== 1`, return `ACCOUNT_CONCURRENT_UPDATE`. Revoke the current `sid` after the database write. Other Redis sessions remain until TTL but cannot pass version validation.

- [ ] **Step 7: Write failing controller-contract tests**

Assert class guards are `AccessTokenGuard` plus `ActiveAdministratorGuard`, profile methods pass `request.user!.sub`, and mutation methods build this explicit context:

```ts
const context: AdminAccountMutationContext = {
  userId: request.user!.sub,
  sessionId: request.user!.sid,
  requestId: request.requestId,
};
```

Password success returns `204` and clears `petcare_refresh_token` with the same `/api/auth` options. Type controller requests as `RequestWithId & { user: AccessTokenPayload }` so security logs always receive the existing request-trace ID.

The password endpoint does not read the cookie because that cookie is intentionally path-limited and will not be sent to `/api/admin/account/password`.

- [ ] **Step 8: Implement DTOs, controller, module, and AppModule registration**

Routes:

```ts
@Controller("admin/account")
@UseGuards(AccessTokenGuard, ActiveAdministratorGuard)
class AdminAccountController {
  @Get("profile")
  @Patch("profile")
  @Put("password")
}
```

Use `@HttpCode(204)` and `@ApiNoContentResponse()` for password success. Add exact Swagger error statuses.

- [ ] **Step 9: Run focused tests and typecheck**

Run:

```powershell
pnpm --filter @petcare/server test -- auth.controller.spec.ts active-administrator.guard.spec.ts admin-account
pnpm --filter @petcare/server typecheck
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/server/src/auth/refresh-cookie.ts apps/server/src/auth/auth.controller.ts apps/server/src/auth/auth.controller.spec.ts apps/server/src/modules/admin-account/active-administrator.guard.ts apps/server/src/modules/admin-account/active-administrator.guard.spec.ts apps/server/src/modules/admin-account/dto/admin-account.dto.ts apps/server/src/modules/admin-account/dto/admin-account.dto.spec.ts apps/server/src/modules/admin-account/admin-account.service.ts apps/server/src/modules/admin-account/admin-account.service.spec.ts apps/server/src/modules/admin-account/admin-account.controller.ts apps/server/src/modules/admin-account/admin-account.controller.spec.ts apps/server/src/modules/admin-account/admin-account.module.ts apps/server/src/app.module.ts
git commit -m "feat(admin): 新增个人资料与密码接口"
```

---

### Task 5: Avatar Validation and Lifecycle Endpoints

**Files:**

- Create: `apps/server/src/public-avatar-storage/avatar-file.ts`
- Create: `apps/server/src/public-avatar-storage/avatar-file.spec.ts`
- Modify: `apps/server/src/common/http/api-exception.filter.ts`
- Modify: `apps/server/src/common/http/api-exception.filter.spec.ts`
- Modify: `apps/server/src/modules/admin-account/admin-account.service.ts`
- Modify: `apps/server/src/modules/admin-account/admin-account.service.spec.ts`
- Modify: `apps/server/src/modules/admin-account/admin-account.controller.ts`
- Modify: `apps/server/src/modules/admin-account/admin-account.controller.spec.ts`
- Modify: `apps/server/src/modules/admin-account/dto/admin-account.dto.ts`
- Modify: `apps/server/src/modules/admin-account/admin-account.module.ts`

**Interfaces:**

- Consumes: `PublicAvatarStorage` from Task 3 and Admin Account slice from Task 4.
- Produces: `detectAvatarFile(buffer, declaredMime): DetectedAvatarFile`.
- Produces: `AdminAccountService.replaceAvatar(userId, file)` and `deleteAvatar(userId)`.
- Produces: PUT/DELETE `/admin/account/avatar`.

- [ ] **Step 1: Write failing byte-signature tests**

Use minimal buffers for:

```ts
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const webp = Buffer.from("RIFF0000WEBP", "ascii");
```

Assert exact detected MIME/extension, reject MIME-signature mismatch, reject unknown bytes, and reject empty files with `AVATAR_INVALID_TYPE`.

- [ ] **Step 2: Run the validator spec and confirm failure**

Run: `pnpm --filter @petcare/server test -- avatar-file.spec.ts`

Expected: FAIL because `detectAvatarFile` is missing.

- [ ] **Step 3: Implement deterministic magic-number validation**

```ts
export interface DetectedAvatarFile {
  body: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
}
```

Compare the declared MIME with the detected format. Do not inspect or retain the original filename.

- [ ] **Step 4: Add a regression test for Multer size errors**

Construct `new MulterError("LIMIT_FILE_SIZE")` and assert the global exception filter returns status `413`, code `AVATAR_FILE_TOO_LARGE`, and no stack/provider detail in the response.

Run: `pnpm --filter @petcare/server test -- api-exception.filter.spec.ts`

Expected: FAIL with current 500 mapping.

- [ ] **Step 5: Map only `LIMIT_FILE_SIZE` to the avatar size error**

Add an exception-status resolver before the generic `HttpException` branch. Other Multer errors remain safe `400 VALIDATION_FAILED`; unknown exceptions remain `500`.

- [ ] **Step 6: Write failing avatar lifecycle tests**

Cover these exact state transitions:

1. upload succeeds + serialized DB update succeeds -> return new URL, then delete old managed key;
2. DB update fails -> delete newly uploaded key, rethrow;
3. old-key deletion fails -> log error, still return new URL;
4. serializable conflict `P2034` -> retry at most three times;
5. retries exhausted -> delete new key, throw `ACCOUNT_CONCURRENT_UPDATE`;
6. delete avatar -> clear DB first, best-effort delete returned old key;
7. external old URL with null key -> never call storage delete.

- [ ] **Step 7: Implement bounded serializable retry and compensation**

Keep the retry helper private to `AdminAccountService`:

```ts
private async withAvatarTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!this.isSerializationConflict(error) || attempt === 3) throw error;
    }
  }
  throw new Error("unreachable");
}
```

Map exhausted serialization conflicts to the stable account error before returning from the public method.

- [ ] **Step 8: Add the multipart controller endpoints**

```ts
@Put("avatar")
@UseInterceptors(FileInterceptor("file", {
  storage: memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
}))
@ApiConsumes("multipart/form-data")

@Delete("avatar")
@HttpCode(204)
```

The upload handler calls `detectAvatarFile(file.buffer, file.mimetype)` before the service. Add Swagger binary upload DTO and exact success/error responses.

- [ ] **Step 9: Run focused tests**

Run:

```powershell
pnpm --filter @petcare/server test -- avatar-file.spec.ts api-exception.filter.spec.ts admin-account
pnpm --filter @petcare/server typecheck
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/server/src/public-avatar-storage/avatar-file.ts apps/server/src/public-avatar-storage/avatar-file.spec.ts apps/server/src/common/http/api-exception.filter.ts apps/server/src/common/http/api-exception.filter.spec.ts apps/server/src/modules/admin-account/admin-account.service.ts apps/server/src/modules/admin-account/admin-account.service.spec.ts apps/server/src/modules/admin-account/admin-account.controller.ts apps/server/src/modules/admin-account/admin-account.controller.spec.ts apps/server/src/modules/admin-account/dto/admin-account.dto.ts apps/server/src/modules/admin-account/admin-account.module.ts
git commit -m "feat(admin): 支持公开头像管理"
```

---

### Task 6: Admin API Client and Authentication State Updates

**Files:**

- Create: `apps/admin/src/api/admin-account.ts`
- Create: `apps/admin/src/api/admin-account.test.ts`
- Modify: `apps/admin/src/api/auth.ts`
- Modify: `apps/admin/src/api/auth.test.ts`
- Modify: `apps/admin/src/auth/auth.context.ts`
- Modify: `apps/admin/src/auth/AuthProvider.tsx`
- Modify: `apps/admin/src/auth/AuthProvider.test.tsx`

**Interfaces:**

- Consumes: shared account contracts and Admin Server routes.
- Produces: `getAdminAccountProfile`, `updateAdminAccountProfile`, `uploadAdminAvatar`, `deleteAdminAvatar`, `changeAdminPassword`.
- Produces: `AuthContextValue.updateUserSummary(patch)` and `invalidateLocalSession()`.

- [ ] **Step 1: Write failing account-client tests**

Mock `apiClient` and assert:

```ts
await updateAdminAccountProfile({ nickname: "新昵称" });
expect(apiClient.patch).toHaveBeenCalledWith("/admin/account/profile", { nickname: "新昵称" });

await uploadAdminAvatar(file);
expect(apiClient.put).toHaveBeenCalledWith(
  "/admin/account/avatar",
  expect.any(FormData),
  expect.objectContaining({ headers: { "Content-Type": "multipart/form-data" } }),
);
```

Also assert GET, DELETE, and password PUT paths and 204 handling.

- [ ] **Step 2: Run the client spec and confirm failure**

Run: `pnpm --filter @petcare/admin test -- admin-account.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the account API client**

Return the already-unwrapped `response.data`; do not restate shared interfaces locally. Let the browser set the multipart boundary by passing `FormData`; if Axios tests show the explicit header is unnecessary, omit it and assert only the body is FormData.

- [ ] **Step 4: Add a failing interceptor regression test for business 401**

Capture the interceptor rejection callback and assert:

- `401` + `AUTH_SESSION_EXPIRED` performs one refresh and retries;
- `401` + `ACCOUNT_CURRENT_PASSWORD_INVALID` rejects immediately and does not call `/auth/refresh`;
- `/auth/login/password`, `/auth/login/sms`, and `/auth/refresh` never enter automatic refresh.

- [ ] **Step 5: Restrict automatic refresh by stable error code**

Change the interceptor gate to require status `401`, `error.response.data.code === "AUTH_SESSION_EXPIRED"`, and a request URL outside `/auth/login/*` and `/auth/refresh`.

- [ ] **Step 6: Write failing AuthContext tests**

Add a probe that calls:

```ts
auth.updateUserSummary({ nickname: "新昵称", avatar: "https://cdn/avatar.png" });
auth.invalidateLocalSession();
```

Assert the first preserves ID/roles/permissions while changing the summary, and the second clears token/user and sets status to `anonymous` without calling the logout endpoint.

- [ ] **Step 7: Implement narrow context actions**

```ts
updateUserSummary(patch: Pick<AdminUser, "nickname" | "avatar">): void;
invalidateLocalSession(): void;
```

Use functional `setUser(current => current ? { ...current, ...patch } : current)`. `invalidateLocalSession()` calls `clearAccessToken()` but not Server logout because password rotation has already invalidated and revoked the session.

- [ ] **Step 8: Run focused Admin tests**

Run:

```powershell
pnpm --filter @petcare/admin test -- auth.test.ts admin-account.test.ts AuthProvider.test.tsx
pnpm --filter @petcare/admin typecheck
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add apps/admin/src/api/admin-account.ts apps/admin/src/api/admin-account.test.ts apps/admin/src/api/auth.ts apps/admin/src/api/auth.test.ts apps/admin/src/auth/auth.context.ts apps/admin/src/auth/AuthProvider.tsx apps/admin/src/auth/AuthProvider.test.tsx
git commit -m "feat(admin): 接入个人账户客户端状态"
```

---

### Task 7: `/account` Page, Route, and Responsive Header Menu

**Files:**

- Create: `apps/admin/src/pages/Account/index.tsx`
- Create: `apps/admin/src/pages/Account/ProfileCard.tsx`
- Create: `apps/admin/src/pages/Account/PasswordCard.tsx`
- Create: `apps/admin/src/pages/Account/index.test.tsx`
- Modify: `apps/admin/src/components/Header.tsx`
- Modify: `apps/admin/src/components/Header.test.tsx`
- Modify: `apps/admin/src/routes/registry.ts`
- Modify: `apps/admin/src/routes/registry.test.ts`
- Modify: `apps/admin/src/App.test.tsx`

**Interfaces:**

- Consumes: API and AuthContext actions from Task 6.
- Produces: accessible `/account` page and account-menu navigation.

- [ ] **Step 1: Write failing route-registry tests**

Assert `/account` has:

```ts
expect(ADMIN_ROUTE_REGISTRY.find((route) => route.path === "/account")).toMatchObject({
  id: "account",
  menuPermission: null,
  requiredPermissions: [],
  parentPath: null,
  menuLabel: null,
});
```

Also assert it is absent from all visible sidebar menu helper results and renders through `App` without a business permission.

- [ ] **Step 2: Run route tests and confirm failure**

Run: `pnpm --filter @petcare/admin test -- registry.test.ts App.test.tsx`

Expected: FAIL because `/account` is not registered.

- [ ] **Step 3: Register a lazy, menu-less account route**

Use the existing `LazyRouteBoundary` pattern. `requiredPermissions=[]` allows `PermissionRoute` to yield the route while `ProtectedRoute` still requires authentication.

- [ ] **Step 4: Write failing page behavior tests**

Cover:

- skeleton while GET is pending;
- page-level error and retry;
- read-only username, masked phone, status, roles, created date;
- trimmed nickname save enabled only after a valid change;
- nickname success calls `updateUserSummary`;
- file input accept string, upload pending disablement, failure preserves old avatar;
- delete restores default avatar and updates Header summary;
- password confirmation mismatch is local;
- password success calls `invalidateLocalSession()` and navigates to `/login` with success state;
- field-level messages use `role="alert"`; success uses `role="status"`;
- `#password` calls `scrollIntoView()` and focuses current-password input.

- [ ] **Step 5: Run page tests and confirm missing-component failures**

Run: `pnpm --filter @petcare/admin test -- pages/Account/index.test.tsx`

Expected: FAIL because the page components do not exist.

- [ ] **Step 6: Implement page orchestration and profile card**

Use local state and focused async handlers; React Query is optional but must not couple independent nickname/avatar submissions. Keep the original profile snapshot for dirty checking. Render the default `UserRound` icon when `avatar === null`.

The file input uses:

```tsx
accept = "image/jpeg,image/png,image/webp";
```

Client-side type/size checks provide immediate feedback, but still submit only files that the Server will revalidate.

- [ ] **Step 7: Implement password card and session exit**

Inputs: current password, new password, confirmation. New password requires at least 12 characters; confirmation never enters the API request. On 204:

```ts
auth.invalidateLocalSession();
navigate("/login", {
  replace: true,
  state: { message: "密码已修改，请重新登录" },
});
```

Teach the Login page to render this safe navigation-state message as `role="status"` if it does not already support it, and add the corresponding Login test.

- [ ] **Step 8: Write failing Header menu tests**

At desktop and narrow viewport widths, assert a semantic account-menu button exists, displays the avatar when set, and exposes “个人中心 / 修改密码 / 退出登录”. Assert navigation to `/account`, `/account#password`, and existing logout behavior.

- [ ] **Step 9: Replace the read-only popover with the responsive menu**

Use the already-installed `@radix-ui/react-dropdown-menu`; do not hand-roll outside-click, Escape, focus restoration, or menu keyboard navigation. Keep the standalone logout icon. Remove the `hidden sm:block` behavior so the mobile icon remains available while hiding long name/role text at small widths.

- [ ] **Step 10: Run focused UI tests and quality gates**

Run:

```powershell
pnpm --filter @petcare/admin test -- pages/Account Header.test.tsx registry.test.ts App.test.tsx Login
pnpm --filter @petcare/admin lint:styles
pnpm --filter @petcare/admin typecheck
```

Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add apps/admin/src/pages/Account/index.tsx apps/admin/src/pages/Account/ProfileCard.tsx apps/admin/src/pages/Account/PasswordCard.tsx apps/admin/src/pages/Account/index.test.tsx apps/admin/src/components/Header.tsx apps/admin/src/components/Header.test.tsx apps/admin/src/routes/registry.ts apps/admin/src/routes/registry.test.ts apps/admin/src/App.test.tsx apps/admin/src/pages/Login/index.tsx apps/admin/src/pages/Login/index.test.tsx
git commit -m "feat(admin): 新增个人中心页面"
```

---

### Task 8: Documentation, End-to-End Contract Checks, and Full Verification

**Files:**

- Modify: `docs/environment-variables.md`
- Modify: `docs/08-deployment/deployment.md`
- Modify: `docs/03-technical-architecture/01-tech-stack.md`
- Modify: `docs/06-api-specification/01-api-specification.md`
- Modify: `docs/01-requirements/01-prd.md`
- Modify: `docs/02-technical-design/02-menu-structure.md`
- Modify if referenced: `README.md`
- Modify if asserted: relevant documentation/tooling tests under `scripts/`

**Interfaces:**

- Consumes: all implementation tasks.
- Produces: documented environment and HTTP contract plus release-quality verification evidence.

- [ ] **Step 1: Update the environment and deployment documentation**

Replace Aliyun OSS text with Tencent COS and document all five variables. State:

- all empty disables avatar upload only;
- partial configuration fails startup;
- Bucket is `BucketName-APPID`;
- Region is a COS code such as `ap-guangzhou`;
- public base URL is optional;
- production uses a dedicated public-read/private-write avatar Bucket and least-privilege sub-account credentials.

- [ ] **Step 2: Update API specification**

Add the four `/admin/account/*` routes, exact bodies/responses, 2 MiB format rule, error table, masked-phone semantics, and password all-device invalidation. Remove or clearly distinguish any unimplemented generic `/uploads/images` wording so it cannot be mistaken for this public-avatar endpoint.

- [ ] **Step 3: Update PRD and menu delivery state**

Add the Admin personal center to the delivered-page list and keep the Header menu definition aligned with “个人中心 / 修改密码 / 退出登录”. Do not change the Miniapp `/profile` requirements.

- [ ] **Step 4: Run database synchronization in the local development workflow**

Run:

```powershell
pnpm --filter @petcare/server prisma:push
```

Expected: the local database gains `avatar_object_key` and `session_version` without creating migration files. If the local database is unavailable, report this verification separately; do not claim schema application succeeded.

- [ ] **Step 5: Run the complete shared/server verification**

Run:

```powershell
pnpm --filter @petcare/shared-types lint
pnpm --filter @petcare/shared-types test
pnpm --filter @petcare/shared-types build
$env:DATABASE_URL='postgresql://user:password@localhost:5432/petcare?schema=public'
pnpm --filter @petcare/server exec prisma validate
pnpm --filter @petcare/server exec prisma generate
pnpm --filter @petcare/server lint
pnpm --filter @petcare/server test
pnpm --filter @petcare/server typecheck
pnpm --filter @petcare/server build
```

Expected: every command exits `0`; report exact test counts from output.

- [ ] **Step 6: Run the complete Admin verification**

Run:

```powershell
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin test
pnpm --filter @petcare/admin typecheck
pnpm --filter @petcare/admin build
```

Expected: style policy, ESLint, Vitest, TypeScript, Vite build, and output style policy all pass.

- [ ] **Step 7: Verify repository state and secrets hygiene**

Run:

```powershell
git diff --check
git status --short
git diff --cached --name-only
rg -n "TENCENT_COS_SECRET_(ID|KEY)=.+" --glob '!*.md' --glob '!.env'
```

Expected: no whitespace errors, no staged `.env`, and no populated COS secret in tracked files. Preserve unrelated user changes.

- [ ] **Step 8: Commit documentation and any verification-test alignment**

```bash
git add docs/environment-variables.md docs/08-deployment/deployment.md docs/03-technical-architecture/01-tech-stack.md docs/06-api-specification/01-api-specification.md docs/01-requirements/01-prd.md docs/02-technical-design/02-menu-structure.md
git diff --cached --name-only
git commit -m "docs(admin): 完善个人中心与 COS 文档"
```

If a directly related documentation-policy test fails, add only that exact test file after inspecting its diff. Do not stage README, all of `docs/`, or all of `scripts/` as directories. Before committing, remove unrelated paths from the index; the commit must contain only account/COS documentation and directly related policy tests.

- [ ] **Step 9: Final acceptance review**

Verify each statement with test or command evidence:

- any active backend role can access `/account` without a business permission;
- complete phone, password data, COS key, and session version never appear in profile responses;
- nickname and avatar update independently and update the Header immediately;
- COS-disabled mode leaves profile/password usable and returns 503 for upload;
- upload failure and concurrent replacement preserve a consistent active avatar;
- password success makes old Admin and Miniapp Access/Refresh tokens fail through the shared account version;
- a role-less Miniapp user is not rejected by the common JWT validator;
- the current Redis session is revoked by Access Token `sid` even though the refresh cookie remains scoped to `/api/auth`.

Do not mark the feature complete until all acceptance statements have fresh evidence.

---

## Execution Notes

- At execution start, use `superpowers:using-git-worktrees` if the current workspace still contains unrelated changes. Do not move or reset those changes.
- A task implementer must read this plan's Global Constraints and their task's Interfaces block before editing.
- After each task, review the actual diff and run that task's focused verification before accepting the commit.
- If the pnpm/Corepack hook mismatch recurs, diagnose and fix the repository toolchain task first or run the exact hook commands manually with evidence; never silently skip validation.
