# 小程序用户认证闭环实施计划

> **当前基准说明（v45，2026-08-04）：** 本计划记录认证闭环的历史实施过程；当前小程序页面与路由以 `docs/01-requirements/04-prototype-specification.md` 为准。认证成功后统一切换到 `pages/index/index`，不再使用 `navigateBack` 返回游客页面；主 Tab 注册为首页、悬赏大厅、社区、消息和我的。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立游客可浏览、微信登录、首次手机号快捷绑定、会话恢复与刷新、退出登录完整闭环。

**Architecture:** 在现有 `AuthModule` 内增加独立的小程序认证纵切片，保持管理员认证不变。Server
通过原生 `fetch` 调用微信、通过 Redis 保存短时绑定状态并复用现有 JWT 会话；Miniapp 使用 Taro
原生请求、Storage 和 React Context，不新增运行时依赖。

**Tech Stack:** NestJS 11、Prisma 7、PostgreSQL、Redis 6、Node.js 22 `fetch`、Taro 4、React 18、Jest、Swagger。

## Global Constraints

- 管理员 `/auth/login/*`、Cookie、短信验证码和 `AdminGuard` 行为必须保持不变。
- 游客打开首页时不得因为没有 Refresh Token 调用刷新接口。
- 微信 `openid`、手机号和授权 code 只能由 Server 向微信换取，不能信任客户端提交的身份字段。
- 首次绑定优先合并现有手机号账号，保留角色、订单和资料；冲突时不得自动覆盖。
- Access Token 和 Refresh Token 复用现有有效期，Refresh Token 必须一次性轮换并只以摘要保存到 Redis。
- 小程序不新增 MobX、Axios 或其他运行时依赖，使用 Taro API 和 React Context。
- 数据库现有 `users.openid` 与 `users.phone` 足够，本轮不修改 Prisma Schema、不生成迁移。
- 新增接口必须使用统一响应格式并为 Swagger 提供具体成功和错误类型。
- 新用户默认昵称固定为 `宠友` 加手机号后四位。
- `bindToken` 使用 32 字节随机值，有效期固定 300 秒，Redis 键使用其 SHA-256 摘要。
- 微信网络请求超时固定 5 秒；微信接口调用凭证缓存时长为 `expires_in - 60` 秒，最低 1 秒。
- AppSecret、登录 code、手机号 code、原始令牌和未脱敏身份信息不得写入日志。

---

## 文件结构

### Server

- `apps/server/src/auth/wechat-api.client.ts`：微信登录、接口调用凭证和手机号 API 边界。
- `apps/server/src/auth/wechat-api.client.spec.ts`：微信响应、缓存、超时和错误映射测试。
- `apps/server/src/auth/wechat-auth.service.ts`：登录、绑定、账号合并、刷新和退出。
- `apps/server/src/auth/wechat-auth.service.spec.ts`：普通用户认证领域规则测试。
- `apps/server/src/auth/wechat-auth.controller.ts`：`/auth/wechat/*` HTTP 接口。
- `apps/server/src/auth/wechat-auth.controller.spec.ts`：Controller 委托和返回结构测试。
- `apps/server/src/auth/dto/wechat-auth.dto.ts`：请求 DTO。
- `apps/server/src/auth/dto/wechat-auth-response.dto.ts`：Swagger 成功 DTO。
- `apps/server/src/config/redis.service.ts`：增加原子 `GETDEL` 能力。
- `apps/server/src/config/redis.service.spec.ts`：一次性读取删除回归测试。
- `apps/server/src/auth/auth.module.ts`：注册小程序认证 Provider 和 Controller。
- `apps/server/src/common/swagger/api-response.decorators.ts`：补充 409、503 描述。
- `apps/server/src/common/swagger/swagger-responses.spec.ts`：新增接口 Swagger 契约。
- `apps/server/test/wechat-auth.e2e-spec.ts`：统一响应和 DTO 的 HTTP E2E。

### Shared

- `packages/shared-types/src/api/auth.ts`：Miniapp 与 Server 共用认证数据契约。
- `packages/shared-types/src/api/index.ts`：导出认证契约。

### Miniapp

- `apps/miniapp/src/api/request.ts`：Taro 请求、统一响应解包和客户端错误。
- `apps/miniapp/src/api/request.test.ts`：响应解包和错误转换测试。
- `apps/miniapp/src/auth/auth.api.ts`：微信认证端点封装。
- `apps/miniapp/src/auth/auth.session.ts`：Storage、自动刷新、并发去重和单次重试。
- `apps/miniapp/src/auth/auth.session.test.ts`：会话传输测试。
- `apps/miniapp/src/auth/auth.context.tsx`：认证 Context、恢复、登录、绑定和退出。
- `apps/miniapp/src/auth/auth.context.test.tsx`：状态机测试。
- `apps/miniapp/src/pages/auth/index.tsx`：微信登录与手机号授权页面。
- `apps/miniapp/src/pages/auth/index.config.ts`：认证页导航配置。
- `apps/miniapp/src/pages/auth/index.css`：认证页样式。
- `apps/miniapp/src/pages/auth/index.test.tsx`：认证页交互测试。
- `apps/miniapp/src/pages/index/index.tsx`：游客和登录态入口。
- `apps/miniapp/src/pages/index/index.test.tsx`：首页认证状态测试。
- `apps/miniapp/src/app.ts`：挂载 `AuthProvider`。
- `apps/miniapp/src/app.config.ts`：注册认证页。
- `apps/miniapp/types/global.d.ts`：声明 `TARO_APP_API_BASE_URL`。
- `apps/miniapp/project.config.json`：微信开发者工具项目配置。

### 配置与文档

- `.env.example`：增加小程序 API 地址示例。
- `docs/environment-variables.md`：说明客户端与服务端微信配置。
- `docs/06-api-specification/01-api-specification.md`：记录小程序认证接口和错误码。
- `README.md`：补充本地微信认证运行入口。

---

### Task 1: 建立共享契约和微信 API 边界

**Files:**

- Create: `packages/shared-types/src/api/auth.ts`
- Modify: `packages/shared-types/src/api/index.ts`
- Create: `apps/server/src/auth/wechat-api.client.ts`
- Test: `apps/server/src/auth/wechat-api.client.spec.ts`

**Interfaces:**

- Consumes: `ConfigService.wechatAppId`、`ConfigService.wechatAppSecret`、`RedisService.get()`、`RedisService.set()`。
- Produces:
  - `MiniappUser`
  - `WechatSession`
  - `WechatLoginRequest`
  - `WechatLoginResult`
  - `WechatBindPhoneRequest`
  - `WechatRefreshRequest`
  - `WechatLogoutRequest`
  - `WechatApiClient.exchangeLoginCode(loginCode: string): Promise<{ openid: string }>`
  - `WechatApiClient.getPhoneNumber(phoneCode: string): Promise<string>`

- [ ] **Step 1: 写微信 API Client 失败测试**

在 `wechat-api.client.spec.ts` 创建 Config、Redis 和全局 `fetch` 测试替身，覆盖以下精确行为：

```typescript
const config = {
  wechatAppId: "wx3bdad4ab652f0d1d",
  wechatAppSecret: "0123456789abcdef0123456789abcdef",
} as ConfigService;

const redis = {
  get: jest.fn(),
  set: jest.fn(),
} as unknown as RedisService;

it("exchanges a login code without exposing the app secret in results", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ openid: "openid-1", session_key: "server-only" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  await expect(client.exchangeLoginCode("login-code")).resolves.toEqual({
    openid: "openid-1",
  });
});

it("reuses a cached access token when exchanging a phone code", async () => {
  jest.mocked(redis.get).mockResolvedValue("cached-access-token");
  jest.spyOn(global, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        errcode: 0,
        phone_info: { phoneNumber: "17679141878" },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );

  await expect(client.getPhoneNumber("phone-code")).resolves.toBe("17679141878");
  expect(redis.set).not.toHaveBeenCalled();
});
```

继续增加断言：

- 无缓存时请求 `/cgi-bin/token`，按 `expires_in - 60` 写入 Redis；
- 微信登录返回 `errcode` 时抛出 `AUTH_WECHAT_LOGIN_FAILED` 和 HTTP 401；
- 手机号 API 没有 `phone_info.phoneNumber` 时抛出 `AUTH_PHONE_AUTH_FAILED` 和 HTTP 400；
- 缺少 AppID/AppSecret、超时、网络错误、非 JSON 或非 2xx 响应时抛出
  `WECHAT_SERVICE_UNAVAILABLE` 和 HTTP 503；
- 每个请求的 `AbortSignal` 使用 5 秒超时；
- 错误对象不包含 AppSecret、登录 code 或手机号 code。

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @petcare/server test -- --runInBand src/auth/wechat-api.client.spec.ts
```

Expected: FAIL，提示找不到 `./wechat-api.client`。

- [ ] **Step 3: 定义共享认证契约**

在 `packages/shared-types/src/api/auth.ts` 定义：

```typescript
export interface MiniappUser {
  id: string;
  phone: string;
  nickname: string;
  avatar: string | null;
  userType: string;
}

export interface WechatSession {
  accessToken: string;
  refreshToken: string;
  user: MiniappUser;
}

export interface WechatLoginRequest {
  loginCode: string;
}

export type WechatLoginResult =
  ({ status: "authenticated" } & WechatSession) | { status: "phone_required"; bindToken: string };

export interface WechatBindPhoneRequest {
  bindToken: string;
  phoneCode: string;
}

export interface WechatRefreshRequest {
  refreshToken: string;
}

export type WechatLogoutRequest = WechatRefreshRequest;
```

从 `packages/shared-types/src/api/index.ts` 导出 `./auth`。

- [ ] **Step 4: 实现最小微信 API Client**

在 `wechat-api.client.ts`：

```typescript
const WECHAT_ACCESS_TOKEN_KEY = "auth:wechat:access-token";
const REQUEST_TIMEOUT_MS = 5000;

@Injectable()
export class WechatApiClient {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async exchangeLoginCode(loginCode: string): Promise<{ openid: string }> {
    this.assertConfigured();
    const url = new URL("https://api.weixin.qq.com/sns/jscode2session");

    url.search = new URLSearchParams({
      appid: this.configService.wechatAppId,
      secret: this.configService.wechatAppSecret,
      js_code: loginCode,
      grant_type: "authorization_code",
    }).toString();

    const payload = await this.fetchJson(url, undefined, "AUTH_WECHAT_LOGIN_FAILED");

    if (typeof payload.openid !== "string" || payload.openid.length === 0) {
      throw new ApiException(
        "AUTH_WECHAT_LOGIN_FAILED",
        "微信登录失败，请重试",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return { openid: payload.openid };
  }
}
```

`getPhoneNumber()` 必须：

1. 先从 Redis 读取 `auth:wechat:access-token`；
2. 缺少缓存时调用 `/cgi-bin/token` 并缓存；
3. POST `/wxa/business/getuserphonenumber?access_token=...`，正文为 `{ code: phoneCode }`；
4. 只返回 `phone_info.phoneNumber`；
5. 将外部服务不可用与无效业务 code 映射为设计规定的稳定错误码。

- [ ] **Step 5: 运行单测和共享类型检查**

Run:

```bash
pnpm --filter @petcare/server test -- --runInBand src/auth/wechat-api.client.spec.ts
pnpm --filter @petcare/shared-types typecheck
pnpm --filter @petcare/server typecheck
```

Expected: 微信 Client 测试全部 PASS，两项类型检查退出码为 0。

- [ ] **Step 6: 提交**

```bash
git add packages/shared-types/src/api/auth.ts packages/shared-types/src/api/index.ts apps/server/src/auth/wechat-api.client.ts apps/server/src/auth/wechat-api.client.spec.ts
git commit -m "feat(server): 接入微信小程序身份接口"
```

---

### Task 2: 实现用户绑定、合并和小程序会话

**Files:**

- Modify: `apps/server/src/config/redis.service.ts`
- Modify: `apps/server/src/config/redis.service.spec.ts`
- Create: `apps/server/src/auth/wechat-auth.service.ts`
- Test: `apps/server/src/auth/wechat-auth.service.spec.ts`
- Modify: `apps/server/src/auth/auth.types.ts`

**Interfaces:**

- Consumes:
  - `WechatApiClient.exchangeLoginCode(loginCode)`
  - `WechatApiClient.getPhoneNumber(phoneCode)`
  - `TokenService.issue(principal)`
  - `TokenService.consumeRefresh(refreshToken)`
  - `TokenService.revoke(refreshToken)`
- Produces:
  - `RedisService.getAndDelete(key: string): Promise<string | null>`
  - `WechatAuthService.login(loginCode: string): Promise<WechatLoginResult>`
  - `WechatAuthService.bindPhone(bindToken: string, phoneCode: string): Promise<WechatSession & { status: "authenticated" }>`
  - `WechatAuthService.refresh(refreshToken: string): Promise<WechatSession>`
  - `WechatAuthService.logout(refreshToken: string): Promise<void>`
  - `WechatAuthService.getCurrentUser(userId: string): Promise<MiniappUser>`

- [ ] **Step 1: 写 Redis 原子消费失败测试**

在 `redis.service.spec.ts` 增加：

```typescript
it("reads and deletes a one-time value atomically", async () => {
  const getDel = jest.fn().mockResolvedValue("openid-1");
  const service = Object.create(RedisService.prototype) as RedisService;

  Object.assign(service, { client: { getDel } });

  await expect(service.getAndDelete("auth:wechat-bind:digest")).resolves.toBe("openid-1");
  expect(getDel).toHaveBeenCalledWith("auth:wechat-bind:digest");
});
```

- [ ] **Step 2: 运行 Redis 测试确认失败**

Run:

```bash
pnpm --filter @petcare/server test -- --runInBand src/config/redis.service.spec.ts
```

Expected: FAIL，提示 `getAndDelete` 不存在。

- [ ] **Step 3: 实现 Redis `GETDEL`**

在 `RedisService` 增加：

```typescript
async getAndDelete(key: string): Promise<string | null> {
  const value = await this.client.getDel(key);

  return typeof value === "string" ? value : null;
}
```

重新运行 Redis 测试，Expected: PASS。

- [ ] **Step 4: 写 WechatAuthService 失败测试**

测试替身必须包含：

```typescript
const activeUser = {
  id: "user-1",
  openid: "openid-1",
  phone: "17679141878",
  username: null,
  nickname: "宠友1878",
  avatar: null,
  userType: "pet_owner",
  status: "active",
  roles: [],
};

const wechatApiClient = {
  exchangeLoginCode: jest.fn().mockResolvedValue({ openid: "openid-1" }),
  getPhoneNumber: jest.fn().mockResolvedValue("17679141878"),
};

const tokenService = {
  issue: jest.fn().mockResolvedValue({
    accessToken: "access",
    refreshToken: "refresh",
  }),
  consumeRefresh: jest.fn().mockResolvedValue({
    userId: "user-1",
    sessionId: "session-1",
  }),
  revoke: jest.fn().mockResolvedValue(undefined),
};
```

编写以下测试：

```typescript
it("issues a session for an existing openid", async () => {
  prisma.user.findUnique.mockResolvedValue(activeUser);

  await expect(service.login("login-code")).resolves.toMatchObject({
    status: "authenticated",
    accessToken: "access",
    refreshToken: "refresh",
    user: {
      id: "user-1",
      phone: "17679141878",
      nickname: "宠友1878",
    },
  });
});

it("stores a short-lived binding challenge without creating a user", async () => {
  prisma.user.findUnique.mockResolvedValue(null);

  const result = await service.login("login-code");

  expect(result).toMatchObject({
    status: "phone_required",
    bindToken: expect.any(String),
  });
  expect(redis.set).toHaveBeenCalledWith(
    expect.stringMatching(/^auth:wechat-bind:[a-f0-9]{64}$/),
    "openid-1",
    300,
  );
  expect(prisma.user.create).not.toHaveBeenCalled();
});
```

继续覆盖：

- 新手机号创建 `pet_owner` 用户和 `宠友1878` 昵称；
- 已有手机号且 `openid=null` 时更新现有用户；
- 同一手机号与 `openid` 重复绑定时不创建、不覆盖；
- 手机号已有其他 `openid` 时返回 `AUTH_ACCOUNT_CONFLICT` 409；
- 当前 `openid` 属于另一手机号时返回同一冲突错误；
- `inactive` 或 `banned` 用户返回 `AUTH_ACCOUNT_DISABLED` 403；
- 绑定令牌不存在、已过期或 `GETDEL` 返回不同 `openid` 时返回
  `AUTH_BIND_TOKEN_EXPIRED` 401；
- `getPhoneNumber` 成功后才调用 `getAndDelete`；
- Prisma `P2002` 唯一约束冲突转换为 `AUTH_ACCOUNT_CONFLICT`；
- 刷新先消费旧 Refresh Token，再查询 active 用户并签发新会话；
- `getCurrentUser` 对禁用用户返回 `AUTH_ACCOUNT_DISABLED`，对缺失用户返回
  `AUTH_SESSION_EXPIRED`；
- `logout` 委托 `TokenService.revoke()` 并保持幂等。

- [ ] **Step 5: 运行 WechatAuthService 测试确认失败**

Run:

```bash
pnpm --filter @petcare/server test -- --runInBand src/auth/wechat-auth.service.spec.ts
```

Expected: FAIL，提示找不到 `./wechat-auth.service`。

- [ ] **Step 6: 最小实现绑定令牌与会话**

将 `AdminPrincipal` 重命名为通用 `SessionPrincipal`，字段保持：

```typescript
export interface SessionPrincipal {
  userId: string;
  username: string | null;
  phone: string;
  roles: string[];
}
```

同步更新 `TokenService.issue(principal: SessionPrincipal)`，不得改变 JWT Payload。

在 `WechatAuthService` 使用：

```typescript
const BIND_TOKEN_TTL_SECONDS = 300;

private createBindToken(): string {
  return randomBytes(32).toString("base64url");
}

private bindTokenKey(bindToken: string): string {
  const digest = createHash("sha256").update(bindToken).digest("hex");

  return `auth:wechat-bind:${digest}`;
}
```

`bindPhone()` 的数据库事务必须按以下顺序处理：

1. 分别查找 `openid` 用户和手机号用户；
2. 任一用户不是 `active` 时拒绝；
3. 两个查询命中不同用户时冲突；
4. `openid` 用户手机号不同或手机号用户已有其他 `openid` 时冲突；
5. 手机号用户 `openid` 为空时只更新 `openid`；
6. 两者均不存在时创建新用户；
7. 查询 active 角色并调用 `TokenService.issue()`；
8. 只返回 `MiniappUser` 安全字段。

- [ ] **Step 7: 运行相关 Server 测试与类型检查**

Run:

```bash
pnpm --filter @petcare/server test -- --runInBand src/config/redis.service.spec.ts src/auth/token.service.spec.ts src/auth/auth.service.spec.ts src/auth/wechat-auth.service.spec.ts
pnpm --filter @petcare/server typecheck
```

Expected: 新旧认证测试全部 PASS，管理员认证回归测试不变，类型检查退出码为 0。

- [ ] **Step 8: 提交**

```bash
git add apps/server/src/config/redis.service.ts apps/server/src/config/redis.service.spec.ts apps/server/src/auth/auth.types.ts apps/server/src/auth/token.service.ts apps/server/src/auth/wechat-auth.service.ts apps/server/src/auth/wechat-auth.service.spec.ts
git commit -m "feat(server): 实现小程序用户认证会话"
```

---

### Task 3: 暴露 HTTP、DTO、Swagger 和 Server E2E

**Files:**

- Create: `apps/server/src/auth/dto/wechat-auth.dto.ts`
- Create: `apps/server/src/auth/dto/wechat-auth-response.dto.ts`
- Create: `apps/server/src/auth/wechat-auth.controller.ts`
- Test: `apps/server/src/auth/wechat-auth.controller.spec.ts`
- Modify: `apps/server/src/auth/auth.module.ts`
- Modify: `apps/server/src/common/swagger/api-response.decorators.ts`
- Modify: `apps/server/src/common/swagger/swagger-responses.spec.ts`
- Create: `apps/server/test/wechat-auth.e2e-spec.ts`

**Interfaces:**

- Consumes: Task 2 的五个 `WechatAuthService` 公共方法。
- Produces:
  - `POST /auth/wechat/login`
  - `POST /auth/wechat/bind-phone`
  - `POST /auth/wechat/refresh`
  - `POST /auth/wechat/logout`
  - `GET /auth/wechat/me`

- [ ] **Step 1: 写 Controller 失败测试**

创建 Service Mock：

```typescript
const wechatAuthService = {
  login: jest.fn(),
  bindPhone: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  getCurrentUser: jest.fn(),
};
```

覆盖以下委托：

```typescript
it("delegates login codes without accepting an openid", async () => {
  wechatAuthService.login.mockResolvedValue({
    status: "phone_required",
    bindToken: "bind-token",
  });

  await expect(controller.login({ loginCode: "login-code" })).resolves.toEqual({
    status: "phone_required",
    bindToken: "bind-token",
  });
  expect(wechatAuthService.login).toHaveBeenCalledWith("login-code");
});

it("returns 204-compatible logout behavior", async () => {
  await expect(controller.logout({ refreshToken: "refresh-token" })).resolves.toBeUndefined();
  expect(wechatAuthService.logout).toHaveBeenCalledWith("refresh-token");
});
```

继续覆盖绑定、刷新和 `/me` 缺少 `request.user.sub` 时返回 `AUTH_SESSION_EXPIRED`。

- [ ] **Step 2: 运行 Controller 测试确认失败**

Run:

```bash
pnpm --filter @petcare/server test -- --runInBand src/auth/wechat-auth.controller.spec.ts
```

Expected: FAIL，提示找不到 Controller。

- [ ] **Step 3: 实现请求 DTO**

`wechat-auth.dto.ts` 使用 `class-validator`：

```typescript
export class WechatLoginDto {
  @ApiProperty({ example: "0a3X..." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  loginCode: string;
}

export class WechatBindPhoneDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  bindToken: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  phoneCode: string;
}

export class WechatRefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  refreshToken: string;
}

export class WechatLogoutDto extends WechatRefreshDto {}
```

- [ ] **Step 4: 实现响应 DTO 和 Controller**

`wechat-auth-response.dto.ts` 定义：

- `MiniappUserResponseDto`
- `WechatAuthenticatedResponseDto`
- `WechatPhoneRequiredResponseDto`
- `WechatLoginResponseDto`
- `WechatSessionResponseDto`

`WechatLoginResponseDto` 的 `status` 使用
`authenticated | phone_required`，其余字段使用 `required: false` 标记可选；接口运行时仍返回共享契约的判别联合。

Controller 必须：

```typescript
@ApiTags("auth")
@Controller("auth/wechat")
export class WechatAuthController {
  @Post("login")
  @HttpCode(200)
  login(@Body() dto: WechatLoginDto): Promise<WechatLoginResult> {
    return this.wechatAuthService.login(dto.loginCode);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Body() dto: WechatLogoutDto): Promise<void> {
    await this.wechatAuthService.logout(dto.refreshToken);
  }
}
```

`/me` 使用 `@UseGuards(AccessTokenGuard)` 和 `@ApiBearerAuth()`，但不得使用 `AdminGuard`。

- [ ] **Step 5: 注册模块并补充 Swagger 错误描述**

在 `AuthModule`：

- controllers 增加 `WechatAuthController`；
- providers 增加 `WechatApiClient`、`WechatAuthService`；
- 保持现有 exports，不导出没有模块外调用方的 `WechatAuthService`。

在 `errorDescriptions` 增加：

```typescript
409: "账号状态冲突",
503: "第三方服务暂时不可用",
```

- [ ] **Step 6: 写 Swagger 与 HTTP E2E 失败测试**

在 `swagger-responses.spec.ts` 注册 `WechatAuthController` 和其 Service Mock，断言：

```typescript
expect(responseSchema("/auth/wechat/login", "post", "200")).toMatchObject({
  allOf: expect.any(Array),
});
expect(document.paths["/auth/wechat/bind-phone"]?.post?.responses?.["409"]).toBeDefined();
expect(document.paths["/auth/wechat/login"]?.post?.responses?.["503"]).toBeDefined();
expect(document.paths["/auth/wechat/logout"]?.post?.responses?.["204"]).toBeDefined();
```

在 `wechat-auth.e2e-spec.ts` 覆盖 `WechatAuthService` Provider，启动 Nest 应用并启用与 `main.ts`
相同的 `ValidationPipe`、统一 Interceptor 和 Filter，验证：

- 合法登录返回 `{ code, message, data, meta }`；
- 多余 `openid` 字段返回 400；
- 空 `loginCode` 返回 400；
- logout 返回 204 且无响应正文。

- [ ] **Step 7: 运行 Controller、Swagger 和 E2E**

Run:

```bash
pnpm --filter @petcare/server test -- --runInBand src/auth/wechat-auth.controller.spec.ts src/common/swagger/swagger-responses.spec.ts
pnpm --filter @petcare/server test:e2e
pnpm --filter @petcare/server typecheck
```

Expected: 单测、E2E 和类型检查全部通过。

- [ ] **Step 8: 提交**

```bash
git add apps/server/src/auth/dto/wechat-auth.dto.ts apps/server/src/auth/dto/wechat-auth-response.dto.ts apps/server/src/auth/wechat-auth.controller.ts apps/server/src/auth/wechat-auth.controller.spec.ts apps/server/src/auth/auth.module.ts apps/server/src/common/swagger/api-response.decorators.ts apps/server/src/common/swagger/swagger-responses.spec.ts apps/server/test/wechat-auth.e2e-spec.ts
git commit -m "feat(server): 暴露小程序认证接口"
```

---

### Task 4: 实现 Miniapp 请求和会话传输

**Files:**

- Create: `apps/miniapp/src/api/request.ts`
- Test: `apps/miniapp/src/api/request.test.ts`
- Create: `apps/miniapp/src/auth/auth.api.ts`
- Create: `apps/miniapp/src/auth/auth.session.ts`
- Test: `apps/miniapp/src/auth/auth.session.test.ts`
- Modify: `apps/miniapp/types/global.d.ts`

**Interfaces:**

- Consumes: Task 1 的共享认证类型和 Server Task 3 的 HTTP 接口。
- Produces:
  - `apiRequest<T>(path, options): Promise<T>`
  - `loginWithWechat(loginCode): Promise<WechatLoginResult>`
  - `bindWechatPhone(bindToken, phoneCode): Promise<WechatSession & { status: "authenticated" }>`
  - `refreshWechatSession(refreshToken): Promise<WechatSession>`
  - `logoutWechatSession(refreshToken): Promise<void>`
  - `loadStoredSession(): Promise<WechatSession | null>`
  - `saveStoredSession(session): Promise<void>`
  - `clearStoredSession(): Promise<void>`
  - `restoreSession(): Promise<WechatSession | null>`
  - `requestWithSession<T>(path, options): Promise<T>`

- [ ] **Step 1: 写统一响应请求失败测试**

Mock `@tarojs/taro` 的 `request`，验证：

```typescript
it("unwraps a successful API envelope", async () => {
  jest.mocked(Taro.request).mockResolvedValue({
    statusCode: 200,
    data: {
      code: "SUCCESS",
      message: "操作成功",
      data: { value: 1 },
      meta: { requestId: "request-1", timestamp: "2026-07-28T00:00:00.000Z" },
    },
    header: {},
    cookies: [],
    errMsg: "request:ok",
  });

  await expect(apiRequest<{ value: number }>("/health")).resolves.toEqual({ value: 1 });
});
```

继续验证：

- 非 `SUCCESS` 响应转换为包含 `code/status/requestId` 的 `MiniappApiError`；
- 无效响应结构转换为 `INVALID_RESPONSE`；
- 204 返回 `undefined`；
- URL 使用 `process.env.TARO_APP_API_BASE_URL || "http://localhost:3000"`；
- 不记录请求正文和认证令牌。

- [ ] **Step 2: 运行请求测试确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp test -- --runInBand src/api/request.test.ts
```

Expected: FAIL，提示找不到 `./request`。

- [ ] **Step 3: 实现 Taro 请求边界与认证 API**

在 `types/global.d.ts` 增加：

```typescript
TARO_APP_API_BASE_URL?: string;
```

`request.ts` 定义：

```typescript
const API_BASE_URL = process.env.TARO_APP_API_BASE_URL || "http://localhost:3000";

export class MiniappApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId = "unknown",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "MiniappApiError";
  }
}
```

`auth.api.ts` 必须把共享类型原样映射到五个 Server 接口，不存储状态、不自动刷新：

```typescript
export function loginWithWechat(loginCode: string): Promise<WechatLoginResult> {
  return apiRequest("/auth/wechat/login", {
    method: "POST",
    data: { loginCode },
  });
}
```

- [ ] **Step 4: 写 Storage、刷新和并发去重失败测试**

在 `auth.session.test.ts` 覆盖：

```typescript
it("does not refresh when storage has no session", async () => {
  jest.mocked(Taro.getStorage).mockResolvedValue({
    data: undefined,
    errMsg: "getStorage:ok",
  });

  await expect(restoreSession()).resolves.toBeNull();
  expect(authApi.refreshWechatSession).not.toHaveBeenCalled();
});

it("shares one refresh across concurrent unauthorized requests", async () => {
  jest.mocked(authApi.refreshWechatSession).mockResolvedValue(newSession);
  jest
    .mocked(apiRequest)
    .mockRejectedValueOnce(new MiniappApiError("AUTH_SESSION_EXPIRED", "expired", "r1", 401))
    .mockRejectedValueOnce(new MiniappApiError("AUTH_SESSION_EXPIRED", "expired", "r2", 401))
    .mockResolvedValueOnce({ ok: 1 })
    .mockResolvedValueOnce({ ok: 2 });

  await expect(
    Promise.all([requestWithSession("/one"), requestWithSession("/two")]),
  ).resolves.toEqual([{ ok: 1 }, { ok: 2 }]);
  expect(authApi.refreshWechatSession).toHaveBeenCalledTimes(1);
});
```

继续覆盖：

- Storage Key 固定为 `petcare.auth.session.v1`；
- 保存时整体写入 Session；
- 恢复成功立即保存轮换后的完整 Session；
- 恢复失败清理 Storage；
- 单个请求最多重试一次；
- 刷新请求本身不触发递归刷新；
- 刷新失败时所有等待请求失败并清理 Storage；
- logout 请求无论成功失败都能由调用方清理本地 Session。

- [ ] **Step 5: 运行 Session 测试确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp test -- --runInBand src/auth/auth.session.test.ts
```

Expected: FAIL，提示找不到 `./auth.session`。

- [ ] **Step 6: 实现 Storage 与单一刷新 Promise**

`auth.session.ts` 使用模块级：

```typescript
const SESSION_KEY = "petcare.auth.session.v1";
let refreshPromise: Promise<WechatSession> | null = null;

async function refreshOnce(refreshToken: string): Promise<WechatSession> {
  if (!refreshPromise) {
    refreshPromise = authApi
      .refreshWechatSession(refreshToken)
      .then(async (session) => {
        await saveStoredSession(session);
        return session;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}
```

`requestWithSession()` 必须：

1. 读取当前完整 Session；
2. 没有 Session 时直接发无认证请求；
3. 添加 `Authorization: Bearer <accessToken>`；
4. 只在 HTTP 401 或 `AUTH_SESSION_EXPIRED` 时调用 `refreshOnce()`；
5. 使用新 Access Token 重试原请求一次；
6. 刷新失败后清理 Storage 并抛出原始认证错误。

- [ ] **Step 7: 运行 Miniapp 传输测试、Lint 和类型检查**

Run:

```bash
pnpm --filter @petcare/miniapp test -- --runInBand src/api/request.test.ts src/auth/auth.session.test.ts
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp typecheck
```

Expected: 测试全部 PASS，Lint 与类型检查退出码为 0。

- [ ] **Step 8: 提交**

```bash
git add apps/miniapp/src/api/request.ts apps/miniapp/src/api/request.test.ts apps/miniapp/src/auth/auth.api.ts apps/miniapp/src/auth/auth.session.ts apps/miniapp/src/auth/auth.session.test.ts apps/miniapp/types/global.d.ts
git commit -m "feat(miniapp): 增加认证请求与会话管理"
```

---

### Task 5: 完成 Miniapp 登录、绑定和退出交互

**Files:**

- Create: `apps/miniapp/src/auth/auth.context.tsx`
- Test: `apps/miniapp/src/auth/auth.context.test.tsx`
- Create: `apps/miniapp/src/pages/auth/index.tsx`
- Create: `apps/miniapp/src/pages/auth/index.config.ts`
- Create: `apps/miniapp/src/pages/auth/index.css`
- Test: `apps/miniapp/src/pages/auth/index.test.tsx`
- Modify: `apps/miniapp/src/pages/index/index.tsx`
- Modify: `apps/miniapp/src/pages/index/index.css`
- Modify: `apps/miniapp/src/pages/index/index.test.tsx`
- Modify: `apps/miniapp/src/app.ts`
- Modify: `apps/miniapp/src/app.config.ts`

**Interfaces:**

- Consumes: Task 4 的认证 API 和 Session 操作。
- Produces:
  - `AuthStatus = "loading" | "guest" | "authenticated"`
  - `AuthProvider`
  - `useAuth()`
  - `login(): Promise<WechatLoginResult>`
  - `bindPhone(bindToken, phoneCode): Promise<void>`
  - `logout(): Promise<void>`
  - 页面路由 `pages/auth/index`

- [ ] **Step 1: 写 AuthProvider 失败测试**

创建状态探针并覆盖：

```typescript
function AuthProbe() {
  const auth = useAuth();

  return (
    <>
      <Text>{auth.status}</Text>
      <Text>{auth.user?.nickname ?? "no-user"}</Text>
    </>
  );
}

it("becomes guest without calling refresh when no session exists", async () => {
  jest.mocked(authSession.restoreSession).mockResolvedValue(null);

  render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );

  expect(screen.getByText("loading")).toBeInTheDocument();
  expect(await screen.findByText("guest")).toBeInTheDocument();
});
```

继续覆盖：

- 恢复成功进入 `authenticated`；
- 微信登录返回 `authenticated` 时保存会话并更新用户；
- 微信登录返回 `phone_required` 时保持 guest 并把结果返回页面；
- 绑定成功保存会话并进入 `authenticated`；
- logout 在接口成功或失败时都清理 Storage 和 Context；
- Provider 卸载后异步恢复不得写状态。

- [ ] **Step 2: 运行 Context 测试确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp test -- --runInBand src/auth/auth.context.test.tsx
```

Expected: FAIL，提示找不到认证 Context。

- [ ] **Step 3: 实现 AuthProvider**

Context 值固定为：

```typescript
export interface AuthContextValue {
  status: AuthStatus;
  user: MiniappUser | null;
  login(): Promise<WechatLoginResult>;
  bindPhone(bindToken: string, phoneCode: string): Promise<void>;
  logout(): Promise<void>;
}
```

`login()` 内调用 `Taro.login()`，拒绝空 code；`authenticated` 结果立即整体保存，`phone_required`
结果只返回页面，不把 `bindToken` 写入持久化 Storage。

`logout()` 使用：

```typescript
try {
  if (session) {
    await authApi.logoutWechatSession(session.refreshToken);
  }
} finally {
  await clearStoredSession();
  setUser(null);
  setStatus("guest");
}
```

在 `app.ts` 用 `<AuthProvider>{this.props.children}</AuthProvider>` 包裹页面。

- [ ] **Step 4: 写认证页和首页失败测试**

认证页测试覆盖：

```typescript
it("shows phone authorization only after a first-time login", async () => {
  login.mockResolvedValue({
    status: "phone_required",
    bindToken: "bind-token",
  });

  render(<AuthPage />);
  fireEvent.click(screen.getByText("微信登录"));

  expect(await screen.findByText("授权手机号并登录")).toBeInTheDocument();
});
```

继续覆盖：

- 已绑定用户登录成功后调用 `Taro.switchTab({ url: "/pages/index/index" })`；
- `getPhoneNumber` 返回 code 时调用 `bindPhone("bind-token", code)`；
- 用户拒绝授权时不调用 Server，显示可重试提示；
- `AUTH_BIND_TOKEN_EXPIRED` 时清除页面 bindToken，重新显示微信登录；
- 网络或微信错误显示安全提示；
- 重复点击时按钮 loading/disabled，不能发送并发登录或绑定。

首页测试覆盖：

- loading 显示恢复状态；
- guest 显示“微信登录”，点击导航 `/pages/auth/index`；
- authenticated 显示昵称和“退出登录”；
- 点击退出调用 Context logout。

- [ ] **Step 5: 运行页面测试确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp test -- --runInBand src/pages/auth/index.test.tsx src/pages/index/index.test.tsx
```

Expected: 认证页缺失且首页断言失败。

- [ ] **Step 6: 实现认证页和首页状态**

认证页只维护瞬时：

```typescript
const [bindToken, setBindToken] = useState<string | null>(null);
const [pending, setPending] = useState(false);
const [error, setError] = useState("");
```

手机号按钮使用：

```tsx
<Button
  openType="getPhoneNumber"
  loading={pending}
  disabled={pending}
  onGetPhoneNumber={handleGetPhoneNumber}
>
  授权手机号并登录
</Button>
```

历史注册路由（仅保留认证页片段）：

```typescript
pages: ["pages/index/index", "pages/auth/index"];
```

当前认证成功后统一使用 `switchTab({ url: "/pages/index/index" })`；上方 `navigateBack()` / `redirectTo()` 仅代表历史实现，不作为 v45 页面基准。

- [ ] **Step 7: 运行 Miniapp 单测、Lint、类型和微信端构建**

Run:

```bash
pnpm --filter @petcare/miniapp test
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp build:weapp
```

Expected: Miniapp 测试全部 PASS，静态校验与微信端构建成功。

- [ ] **Step 8: 提交**

```bash
git add apps/miniapp/src/auth/auth.context.tsx apps/miniapp/src/auth/auth.context.test.tsx apps/miniapp/src/pages/auth apps/miniapp/src/pages/index apps/miniapp/src/app.ts apps/miniapp/src/app.config.ts
git commit -m "feat(miniapp): 完成微信登录交互闭环"
```

---

### Task 6: 完善本地配置、接口文档和全量验收

**Files:**

- Create: `apps/miniapp/project.config.json`
- Modify: `.env.example`
- Modify: `docs/environment-variables.md`
- Modify: `docs/06-api-specification/01-api-specification.md`
- Modify: `README.md`
- Modify: `scripts/workspace-contract.test.mjs`

**Interfaces:**

- Consumes: Tasks 1–5 的完整 Server 与 Miniapp 认证闭环。
- Produces: 可直接导入微信开发者工具的项目配置、环境变量说明、接口说明和最终验收证据。

- [ ] **Step 1: 写项目配置契约失败测试**

在 `workspace-contract.test.mjs` 增加：

```javascript
test("Miniapp 提供微信开发者工具和本地 API 配置", async () => {
  const project = await readJson("apps/miniapp/project.config.json");
  const envExample = await readFile(resolve(root, ".env.example"), "utf8");

  assert.equal(project.appid, "wx3bdad4ab652f0d1d");
  assert.equal(project.miniprogramRoot, "dist/");
  assert.match(envExample, /^TARO_APP_API_BASE_URL=http:\/\/localhost:3000$/m);
});
```

- [ ] **Step 2: 运行契约测试确认失败**

Run:

```bash
node --test scripts/workspace-contract.test.mjs
```

Expected: FAIL，提示找不到 `apps/miniapp/project.config.json`。

- [ ] **Step 3: 添加微信开发者工具配置**

创建：

```json
{
  "appid": "wx3bdad4ab652f0d1d",
  "compileType": "miniprogram",
  "description": "PetCare 宠伴微信小程序",
  "miniprogramRoot": "dist/",
  "projectname": "petcare-miniapp",
  "setting": {
    "es6": true,
    "minified": true,
    "postcss": true,
    "urlCheck": false
  }
}
```

AppID 是公开项目标识，可以提交；AppSecret 只能保留在根目录 `.env` 和部署 Secret 中。

- [ ] **Step 4: 更新环境变量与 API 文档**

`.env.example` 增加：

```dotenv
# 小程序请求 Server 的基础地址
TARO_APP_API_BASE_URL=http://localhost:3000
```

文档必须明确：

- Server 使用 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`；
- Miniapp 只使用 `TARO_APP_API_BASE_URL`，不读取 AppSecret；
- 本地微信开发者工具需要关闭域名校验，生产必须配置 HTTPS 合法 request 域名；
- `/auth/wechat/login` 的两种状态返回；
- 绑定、刷新、退出和 `/me` 请求/响应；
- 新增七个稳定错误码；
- 本地运行顺序为 Server 3000、Miniapp watch、微信开发者工具导入 `apps/miniapp`。

- [ ] **Step 5: 运行契约、格式和差异检查**

Run:

```bash
node --test scripts/workspace-contract.test.mjs
pnpm format
pnpm format:check
git diff --check
```

Expected: 契约测试 PASS，格式和差异检查无错误。

- [ ] **Step 6: 运行完整质量门禁**

Run:

```bash
pnpm check
pnpm test:coverage
```

Expected:

- 全部工作区格式、Lint、类型、单元测试和构建通过；
- 覆盖率命令退出码为 0；
- 现有管理员 91 项基线测试不减少；
- Miniapp 认证新增测试全部计入覆盖率。

- [ ] **Step 7: 运行 Server E2E 和三端回归**

Run:

```bash
pnpm --filter @petcare/server test:e2e
pnpm --filter @petcare/admin test:e2e
pnpm --filter @petcare/miniapp build:weapp
```

Expected:

- Server 健康与微信认证 E2E 通过；
- Admin 真实管理员登录和导航 4 项继续通过；
- Miniapp 微信端构建成功。

- [ ] **Step 8: 本地真实微信手工验收**

执行：

```bash
pnpm dev:server
pnpm dev:miniapp
```

在微信开发者工具导入 `apps/miniapp`，确认：

1. 游客首页不请求 refresh；
2. 微信登录 code 能被 Server 交换；
3. 首次用户显示手机号授权；
4. 授权后创建或合并用户并进入登录态；
5. 重启小程序恢复会话；
6. 退出后回到游客态；
7. Server 日志没有 AppSecret、原始 code 或令牌。

真实手机号授权需要当前微信小程序主体具备手机号能力。如果微信平台未开放该能力，自动化测试和构建仍应通过，
手工验收记录平台权限阻塞，不得改用客户端伪造手机号绕过。

- [ ] **Step 9: 提交文档和配置**

```bash
git add apps/miniapp/project.config.json .env.example docs/environment-variables.md docs/06-api-specification/01-api-specification.md README.md scripts/workspace-contract.test.mjs
git commit -m "docs: 完善小程序认证配置与验证"
```

- [ ] **Step 10: 最终状态检查**

Run:

```bash
git status --short
git log -7 --oneline
```

Expected: 工作树干净，最近六个实现提交均为中文 Conventional Commits。
