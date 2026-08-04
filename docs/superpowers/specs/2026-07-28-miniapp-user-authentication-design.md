# 小程序用户认证闭环设计

## 1. 背景

PetCare Miniapp 当前只有基础首页，没有登录、会话恢复、手机号绑定或退出能力。Server
已有管理员认证，但现有 `AuthService` 会强制校验 `super_admin` 角色，不适合直接复用为普通用户认证。

产品需求要求：

- 支持微信登录；
- 首次登录绑定手机号；
- 登录成功后进入业务页面；
- 普通用户与服务提供者共用同一个用户身份；
- 保留现有账号、订单、角色和资料。

本设计建立一个最小但完整的微信小程序认证纵切片，不重构已经稳定的管理员认证。

## 2. 目标与非目标

### 2.1 目标

- 游客可以浏览首页，只有主动登录或访问受保护功能时才触发认证；
- 使用 `Taro.login()` 获取的临时 code 完成微信身份识别；
- 首次用户通过微信手机号快捷授权完成账号创建或合并；
- 已绑定用户能够直接登录；
- 支持会话恢复、Access Token 刷新、并发刷新去重和退出登录；
- 手机号命中现有账号时保留原账号数据并绑定微信身份；
- 所有接口使用统一响应结构并补全 Swagger 类型；
- 在不调用真实微信服务的情况下完成自动化验证。

### 2.2 非目标

本轮不实现：

- 昵称和头像编辑；
- 完整“我的”页面和业务 TabBar；
- 短信验证码绑定手机号；
- UnionID、多小程序或公众号身份合并；
- 实名认证、宠托师认证和微信支付；
- 独立认证 SDK、MobX Store 或新的 HTTP 依赖；
- Prisma Migrate 迁移文件。

首次创建的用户使用默认昵称，资料完善由后续个人资料功能负责。

## 3. 已确认的产品规则

1. 游客可以进入首页；
2. 登录由用户主动触发；
3. 首次登录使用微信手机号快捷授权；
4. 手机号已存在时优先合并现有账号，不创建重复用户；
5. 账号冲突时拒绝自动合并并提示联系客服；
6. 本轮只完成身份、会话、手机号绑定和退出，不做资料完善。

## 4. 方案选择

采用“独立的小程序认证纵切片”：

- 在现有 `AuthModule` 内新增小程序认证 Controller 和 Service；
- 保持管理员 `/auth/login/*`、Cookie 和 `AdminGuard` 行为不变；
- 复用 Prisma、Redis、JWT、`TokenService`、`AccessTokenGuard` 和统一响应层；
- Miniapp 使用 Taro 原生请求、Storage 和 React Context。

没有采用通用认证重构，因为现有认证流程大量绑定管理员角色，扩大重构范围不会改善当前小程序闭环。
没有建立通用认证 SDK，因为目前只有一个小程序调用方。

## 5. Server 架构

### 5.1 组件职责

#### `WechatApiClient`

使用 Node.js 22 原生 `fetch` 调用微信服务：

- 使用小程序登录 code 换取 `openid`；
- 获取并缓存小程序接口调用凭证；
- 使用手机号授权 code 获取可信手机号；
- 对微信错误码、非 JSON 响应、超时和网络错误进行统一转换。

微信接口调用凭证缓存在 Redis 中，缓存时间使用微信返回有效期减去 60 秒。请求使用 5 秒超时。
`WECHAT_APP_SECRET` 只存在于 Server 配置，不返回 Miniapp。

该类直接作为 Nest Provider 注入，测试时覆盖 Provider，不额外创建只有一个实现的接口。

#### `WechatAuthService`

负责：

- 微信登录 code 交换；
- 查找已绑定用户；
- 创建和消费一次性手机号绑定令牌；
- 获取微信手机号；
- 创建用户或合并现有账号；
- 签发、刷新和撤销小程序会话；
- 返回安全的普通用户信息。

该服务不调用管理员 `AuthService`，只复用底层 `TokenService`。

#### `WechatAuthController`

暴露 `/auth/wechat/*` 接口，定义 DTO、Swagger 返回类型和稳定错误码。小程序刷新令牌通过请求正文传递，
不使用管理员认证的 HttpOnly Cookie。

### 5.2 数据模型

现有 `users` 表已经具备本轮需要的字段：

- `openid`：可空、唯一；
- `phone`：必填、唯一；
- `nickname`、`avatar`、`userType` 和 `status`；
- 角色、订单和资料关系。

首次微信登录尚未取得手机号时不创建用户，避免为了等待绑定而把 `phone` 改成可空。服务端生成一次性
`bindToken`。Redis 使用 `auth:wechat-bind:<sha256(bindToken)>` 作为键保存对应 `openid`，有效期固定为
5 分钟，不保存原始绑定令牌。

绑定成功后：

- 新用户使用 `宠友` 加手机号后四位作为默认昵称；
- 新用户使用默认 `pet_owner` 类型和 `active` 状态；
- 现有用户保留昵称、头像、用户类型、角色和所有业务关系；
- 不改变管理员或宠托师角色。

## 6. API 契约

以下结构均位于项目统一响应的 `data` 字段中，204 响应除外。

### 6.1 微信登录

`POST /auth/wechat/login`

请求：

```json
{
  "loginCode": "Taro.login 返回的一次性 code"
}
```

已绑定用户：

```json
{
  "status": "authenticated",
  "accessToken": "access-token",
  "refreshToken": "refresh-token",
  "user": {
    "id": "user-id",
    "phone": "17679141878",
    "nickname": "宠友1878",
    "avatar": null,
    "userType": "pet_owner"
  }
}
```

首次登录：

```json
{
  "status": "phone_required",
  "bindToken": "opaque-one-time-token"
}
```

### 6.2 绑定微信手机号

`POST /auth/wechat/bind-phone`

请求：

```json
{
  "bindToken": "opaque-one-time-token",
  "phoneCode": "getPhoneNumber 返回的一次性 code"
}
```

成功返回 `status=authenticated` 的完整会话结构。

### 6.3 刷新会话

`POST /auth/wechat/refresh`

请求：

```json
{
  "refreshToken": "current-refresh-token"
}
```

成功返回新的 `accessToken`、`refreshToken` 和用户信息。旧刷新令牌在签发新会话前被一次性消费。

### 6.4 退出登录

`POST /auth/wechat/logout`

请求：

```json
{
  "refreshToken": "current-refresh-token"
}
```

无论会话是否已经失效，接口都保持幂等并返回 204。

### 6.5 当前用户

`GET /auth/wechat/me`

使用 Bearer Access Token，返回安全用户信息。只允许 `status=active` 的用户继续使用会话。

## 7. 登录与绑定数据流

### 7.1 恢复本地会话

1. `AuthProvider` 读取本地会话；
2. 没有 Refresh Token 时直接进入游客态；
3. 存在 Refresh Token 时调用刷新接口；
4. 刷新成功后原子替换本地令牌和用户；
5. 刷新失败后清理本地会话并进入游客态。

登录页不会在没有本地 Refresh Token 时调用刷新接口。

### 7.2 已绑定用户登录

1. 用户点击“微信登录”；
2. Miniapp 调用 `Taro.login()`；
3. Server 使用 `loginCode` 调用微信登录接口；
4. Server 根据服务端取得的 `openid` 查找有效用户；
5. Server 签发 Access Token 和一次性 Refresh Token；
6. Miniapp 保存会话并返回来源页面。

客户端不能提交或覆盖 `openid`。

### 7.3 首次登录与手机号绑定

1. 微信登录未找到 `openid` 对应用户；
2. Server 生成 32 字节随机 `bindToken`；
3. Redis 使用绑定令牌的 SHA-256 摘要作为键保存对应 `openid`，TTL 为 300 秒；
4. Miniapp 展示微信手机号授权按钮；
5. 用户授权后，Miniapp 提交 `phoneCode + bindToken`；
6. Server 先确认绑定令牌存在，再从微信获取可信手机号；
7. Server 使用 Redis 原子消费绑定令牌；
8. Server 在 Prisma 事务中创建或合并用户；
9. Server 签发会话，Miniapp 保存并返回来源页面。

如果数据库唯一约束在并发绑定时冲突，Server 将其转换为账号冲突错误，不重试自动合并。

### 7.4 账号合并规则

| 手机号查询结果                 | `openid` 状态        | 处理                 |
| ------------------------------ | -------------------- | -------------------- |
| 无用户                         | 无                   | 创建普通用户并绑定   |
| 有有效用户                     | 为空                 | 在现有用户上绑定     |
| 有有效用户                     | 与当前 `openid` 相同 | 直接签发会话         |
| 有用户                         | 属于其他微信身份     | 拒绝，提示联系客服   |
| 当前 `openid` 已属于另一手机号 | 任意                 | 拒绝，提示联系客服   |
| 用户状态不是 `active`          | 任意                 | 拒绝登录，不修改账号 |

## 8. Miniapp 架构

### 8.1 认证状态

React Context 暴露三种状态：

- `loading`：正在恢复本地会话；
- `guest`：无有效会话；
- `authenticated`：包含当前用户和 Access Token。

Context 只负责认证状态和操作，不承载业务页面数据。

### 8.2 请求层

小程序请求层使用 `Taro.request`：

- 从 `TARO_APP_API_BASE_URL` 读取 API Base URL；
- 自动解包 `{ code, message, data, meta }`；
- 认证请求添加 Bearer Access Token；
- 401 时触发一次 Refresh Token 轮换；
- 多个并发 401 共享同一个刷新 Promise；
- 刷新成功后每个原请求最多重试一次；
- 微信登录、绑定、刷新和退出接口不进入自动刷新，避免递归。

本地会话使用一个带版本号的 Storage Key，整体读写，防止 Access Token、Refresh Token 和用户信息部分更新。

### 8.3 页面交互

首页：

- 游客可以正常浏览；
- 游客看到“微信登录”入口；
- 已登录用户看到昵称和退出入口。

认证页：

- 初始状态即展示配置了 `openType=getPhoneNumber` 的“微信登录”按钮；
- 用户点击同一个按钮时，小程序先取得手机号授权回调，再调用微信登录接口；若 Server 返回 `phone_required`，立即使用同一回调中的手机号 code 完成绑定，不再渲染第二个授权按钮；
- 用户拒绝授权时保持游客状态，可返回或再次授权；
- `bindToken` 失效时提示重新执行微信登录；
- 成功后统一使用 `switchTab` 进入首页，避免返回到未登录页面或重复登录页。

本轮不为了演示认证而创建虚假的受保护业务页面。

## 9. 会话与安全

- Access Token 和 Refresh Token 使用现有 JWT 密钥与有效期；
- Refresh Token 只以摘要形式保存在 Redis，并在刷新时轮换；
- Miniapp 使用 Storage 保存 Refresh Token，这是小程序运行环境下替代 HttpOnly Cookie 的客户端会话方案；
- 手机号绑定令牌随机、短时、一次性，不包含可读 `openid`；
- 微信登录 code、手机号授权 code、AppSecret、令牌和原始 `openid` 不写入应用日志；
- 生产日志继续使用现有手机号和 `openid` 脱敏规则；
- 微信 API 返回内容按不可信外部输入处理；
- DTO 限制字段长度并拒绝空字符串；
- 账号冲突响应不暴露冲突用户信息；
- 被禁用用户不能登录、刷新或通过 `/me` 继续会话；
- 管理员 Cookie 路径和小程序正文令牌互不影响。

## 10. 稳定错误码

| 错误码                       | HTTP | 场景                               |
| ---------------------------- | ---- | ---------------------------------- |
| `AUTH_WECHAT_LOGIN_FAILED`   | 401  | 微信登录 code 无效或已被使用       |
| `AUTH_PHONE_AUTH_FAILED`     | 400  | 手机号授权 code 无效               |
| `AUTH_BIND_TOKEN_EXPIRED`    | 401  | 绑定令牌过期、无效或已消费         |
| `AUTH_ACCOUNT_CONFLICT`      | 409  | 手机号与微信身份属于不同账号       |
| `AUTH_ACCOUNT_DISABLED`      | 403  | 用户被禁用                         |
| `AUTH_SESSION_EXPIRED`       | 401  | Access Token 或 Refresh Token 失效 |
| `WECHAT_SERVICE_UNAVAILABLE` | 503  | 微信服务超时或暂时不可用           |

Miniapp 对网络失败和 `WECHAT_SERVICE_UNAVAILABLE` 提供重试；账号冲突提示联系客服；用户拒绝手机号授权不是
Server 错误，不发送绑定请求。

## 11. 测试设计

### 11.1 Server

单元测试覆盖：

- 已绑定用户微信登录；
- 首次登录返回绑定令牌且不创建用户；
- 新手机号创建用户；
- 已有手机号绑定 `openid`；
- 同一手机号和 `openid` 重复绑定；
- 手机号或 `openid` 冲突；
- 禁用用户登录和刷新；
- 绑定令牌过期、重复消费；
- Refresh Token 轮换；
- 退出撤销和幂等；
- 微信接口成功、业务错误、非 JSON、超时和网络异常；
- Controller DTO、Swagger 成功与错误返回类型。

`WechatApiClient` 作为 Nest Provider 被测试桩覆盖，自动化测试不调用真实微信接口。

### 11.2 Miniapp

Jest 测试覆盖：

- 无本地令牌时直接进入游客态；
- 有本地令牌时恢复会话；
- 恢复失败后清理 Storage；
- 已绑定用户登录；
- 首次登录进入手机号授权步骤；
- 拒绝手机号授权保持游客态；
- 绑定成功保存会话；
- 单个 401 刷新并只重试一次；
- 多个并发 401 只发起一次刷新；
- 刷新失败清理会话；
- 退出撤销并清理本地状态；
- 首页游客态和登录态渲染。

### 11.3 验证命令

实现完成后执行：

```bash
pnpm check
pnpm test:coverage
pnpm --filter @petcare/server test:e2e
pnpm --filter @petcare/miniapp build:weapp
```

微信开发者工具中的手工验收使用真实 AppID，仅验证微信 code 和手机号授权链路，不把 AppSecret、真实手机号或
真实令牌写入测试代码和 CI。

## 12. 验收标准

1. 游客打开小程序时不会调用无令牌刷新接口，也不会被强制跳转登录；
2. 已绑定微信用户点击登录后无需再次授权手机号；
3. 首次用户完成微信手机号授权后创建或合并唯一用户并进入登录态；
4. 手机号合并保留现有用户全部业务关系和角色；
5. 账号冲突和禁用用户不能产生新绑定；
6. 小程序重启后可恢复会话，过期后安全回到游客态；
7. 并发 401 只轮换一次 Refresh Token；
8. 退出后 Redis 会话和本地令牌均失效；
9. 管理员账号密码、短信、刷新和退出流程保持原有行为；
10. 新增接口 Swagger 返回类型完整，格式、Lint、类型检查、测试和微信端构建通过。
