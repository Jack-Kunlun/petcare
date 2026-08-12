# 管理后台个人中心与账户安全设计

## 背景与目标

PetCare 管理后台已经具备管理员登录、会话恢复、RBAC 路由控制和退出登录，但顶部账户区域目前只是只读浮层。后台没有独立个人中心，也没有管理员自助修改昵称、头像或密码的接口。

本次提供一个独立的管理员自助账户闭环：

- 查看当前管理员的账户资料和角色。
- 修改展示昵称。
- 通过服务端上传、替换或删除公开头像。
- 修改密码，并让该管理员在所有设备上的既有会话立即失效。
- 接入腾讯云对象存储 COS，同时允许未配置 COS 的开发环境继续使用其他账户能力。
- 保持管理员账户与客户端用户资料、后台业务权限及敏感文件上传相互独立。

## 范围

### 本次包含

- Admin `/account` 页面和 Header 账户菜单。
- 当前管理员资料查询和昵称更新接口。
- JPEG、PNG、WebP 公开头像的服务端中转上传与删除。
- 腾讯云 COS 配置、存储 adapter 和对象生命周期管理。
- 当前密码校验、新密码设置和全设备会话即时失效。
- Prisma、共享契约、认证令牌和前端认证状态的必要调整。
- 自动化测试以及环境变量、接口、需求和菜单文档同步。

### 本次不包含

- 管理员自行修改登录账号或手机号。
- 忘记密码、自助找回密码、首次设置密码或管理员代重置密码。
- 设备和会话列表管理。
- 头像裁剪、压缩、转码或内容审核。
- 投诉证据、身份证、认证材料等私有文件上传。
- 通用上传接口或浏览器直传 COS。
- 独立 `AdminAccount`、`Credential` 或管理员资料表。
- 持久化账户操作审计表；本期只写不含敏感内容的结构化安全日志。

## 方案选择

采用独立管理员账户模块，接口统一放在 `/admin/account/*`：

- `AdminAccountModule` 负责资料、头像关联和密码修改。
- `PublicAvatarStorageModule` 负责腾讯 COS。
- `AuthModule` 继续负责登录、令牌和会话校验。

这形成三个清晰 seam：账户 interface 不暴露 COS；公开头像存储 interface 不演化为任意文件入口；认证 interface 不承载资料编辑逻辑。

不继续扩展 `AuthService`，避免登录、令牌、资料和对象存储堆叠在同一模块。不复用普通用户的 `UserProfile`，因为该模型表示实名、性别、年龄和地址等客户端业务资料，与管理员自助账户不是同一领域。

## 数据模型

继续使用现有 `User`，增加：

```prisma
avatarObjectKey String? @map("avatar_object_key")
sessionVersion  Int     @default(0) @map("session_version")
```

- `avatar` 保存公开头像 URL。
- `avatarObjectKey` 只保存 PetCare 托管的 COS 对象键，不能根据 URL 反推。
- `sessionVersion` 是当前有效会话版本，修改密码时原子递增。
- 外部历史头像没有 `avatarObjectKey`，系统不得尝试删除。

不修改 `UserProfile`，不新增管理员资料表。

## 共享契约

请求、响应和错误码统一定义在 `@petcare/shared-types`，字段、业务值和公共函数包含 JSDoc。Admin 和 Server 不重复声明类型。

```ts
interface AdminAccountProfile {
  id: string;
  username: string | null;
  maskedPhone: string;
  nickname: string;
  avatar: string | null;
  status: string;
  roles: string[];
  createdAt: string;
}
```

数据库 `Role` 只有唯一 `roleName`，没有独立编码和显示名，因此 `roles` 返回真实角色名称数组，例如 `['super_admin']`。前端可映射内置角色文案，自定义角色保留原名。

手机号由服务端脱敏：常规手机号保留前三位和后四位，中间使用 `*`；异常短值只保留末两位。接口不返回完整手机号。

## HTTP 接口

所有接口要求有效 Access Token、活动账户和至少一个活动后台角色，不要求额外 RBAC 业务权限。响应继续使用项目统一信封。

### `GET /admin/account/profile`

返回 `AdminAccountProfile`。账号、脱敏手机号、状态、角色和创建时间只读；不返回密码哈希、完整手机号、COS 对象键或会话版本。

### `PATCH /admin/account/profile`

```json
{ "nickname": "平台管理员" }
```

- 去除首尾空白后为 1 至 30 个 Unicode 字符。
- 不允许控制字符，不要求唯一。
- DTO 只接受 `nickname`，多余字段由全局白名单策略拒绝。
- 成功返回完整最新资料。

### `PUT /admin/account/avatar`

使用 `multipart/form-data`，字段名固定为 `file`。

- 仅 JPEG、PNG、WebP。
- 最大 2 MiB。
- 同时校验声明 MIME、文件头魔数和实际格式，不信任扩展名。
- 使用内存上传和 Multer 大小限制，超限请求不进入 COS。
- 对象扩展名来自检测后的真实格式，不沿用用户文件名。
- 成功返回 `{ "avatar": "https://..." }`。

### `DELETE /admin/account/avatar`

清空 `avatar` 与 `avatarObjectKey`，恢复默认头像并返回 `204`。没有头像时也返回 `204`，保持幂等。

### `PUT /admin/account/password`

```json
{
  "currentPassword": "当前密码",
  "newPassword": "新的高强度密码"
}
```

- 当前密码必须通过现有 Argon2id 校验。
- 新密码至少 12 个字符，且不得与当前密码相同。
- 确认新密码只在前端校验，不发送给 Server。
- 没有 `passwordHash` 的短信登录管理员不能通过此接口首次设置密码，返回 `409 ACCOUNT_PASSWORD_NOT_CONFIGURED`。
- 成功返回 `204`，清除当前 Refresh Cookie，并使所有设备旧令牌失效。

## 错误语义

| HTTP | 错误码                             | 场景                             |
| ---- | ---------------------------------- | -------------------------------- |
| 400  | `ACCOUNT_PASSWORD_REUSED`          | 新密码与当前密码相同             |
| 400  | `AVATAR_INVALID_TYPE`              | 声明类型、文件头或实际格式不允许 |
| 401  | `ACCOUNT_CURRENT_PASSWORD_INVALID` | 当前密码错误                     |
| 401  | `AUTH_SESSION_EXPIRED`             | Token 版本或登录状态失效         |
| 409  | `ACCOUNT_PASSWORD_NOT_CONFIGURED`  | 当前账户没有可校验的密码凭据     |
| 409  | `ACCOUNT_CONCURRENT_UPDATE`        | 账户资料或密码发生并发更新       |
| 413  | `AVATAR_FILE_TOO_LARGE`            | 头像超过 2 MiB                   |
| 400  | `VALIDATION_FAILED`                | 昵称、密码长度或请求字段验证失败 |
| 503  | `STORAGE_UNAVAILABLE`              | COS 未配置或暂时不可用           |

当前密码错误可返回明确错误，因为调用者已经通过身份认证，不存在登录接口的账户枚举风险。

Admin API 客户端只能在错误码为 `AUTH_SESSION_EXPIRED` 的 401 上尝试一次刷新。`ACCOUNT_CURRENT_PASSWORD_INVALID` 等业务 401 不得触发 Refresh Token 轮换或请求重放；登录和刷新接口也不参与自动刷新。

## 全设备会话即时失效

仅删除 Redis Refresh Session 无法让已签发的 Access Token 立即失效，因此 Access/Refresh Token payload 都增加 `sessionVersion`，签发时使用数据库当前值。

通用 JWT 策略同时服务 Admin 和 Miniapp，不能在这一层要求后台角色。它在每次受保护请求中检查：

- 用户存在且 `status=active`。
- Token `sessionVersion` 与数据库一致。

失败统一返回 `401 AUTH_SESSION_EXPIRED`。这让账号禁用和密码修改对 Admin 与 Miniapp 都即时生效。

后台角色仍在 Admin seam 校验：个人中心使用专用活动后台账户 Guard；其他后台接口继续使用现有 `AdminGuard`、`PermissionGuard` 或领域 Guard。最后一个后台角色被移除后，通用 Token 仍可能通过 JWT 校验，但所有后台接口都会拒绝；普通 Miniapp 用户不会因没有后台角色被误拒绝。

### 修改密码并发策略

1. 加载原密码哈希和 `sessionVersion`。
2. 在事务外完成当前密码校验、密码复用校验和新 Argon2id 哈希计算，避免长事务。
3. 以用户 ID、原密码哈希和原版本为条件执行一条 `updateMany`，同一写操作更新哈希并执行 `sessionVersion + 1`。
4. 更新数为零表示期间发生并发密码修改，返回 `409 ACCOUNT_CONCURRENT_UPDATE`，不得覆盖先完成的修改。

原子更新成功后清除当前 Refresh Cookie，并尽力删除当前 Redis Refresh Session。其他旧 Session 可保留至 TTL 到期；版本不匹配使其无法刷新。并发刷新即使在密码更新前签发旧版本令牌，下一次请求仍会被拒绝。

前端成功后立即清空内存 Access Token 和认证上下文，跳转 `/login`，展示“密码已修改，请重新登录”。

## 腾讯云 COS

腾讯云对象存储名称为 COS。删除尚未落地的阿里云 OSS 占位，改用：

```env
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_BUCKET=
TENCENT_COS_REGION=
TENCENT_COS_PUBLIC_BASE_URL=
```

- `BUCKET` 使用完整 `BucketName-APPID`。
- `REGION` 使用 `ap-guangzhou` 等地域代码。
- `PUBLIC_BASE_URL` 可选；为空时按 Bucket 和 Region 生成默认域名，配置后可使用自定义域名或 CDN。
- Secret 只由 Server 通过 `ConfigService` 读取，不返回前端或写入日志。
- 根目录 `.env` 已被 Git 忽略。实施时只追加空占位，不输出或覆盖其他变量。
- `.env.example`、Docker Compose、环境变量和部署文档同步替换 `ALIYUN_OSS_*`。

配置行为：

- 五项全空：使用 disabled adapter；服务正常启动，头像上传返回 `503 STORAGE_UNAVAILABLE`，其他功能正常。
- 核心四项部分填写，或只填写 `PUBLIC_BASE_URL`：启动失败并列出缺失项。
- 核心四项完整，`PUBLIC_BASE_URL` 可空：启用 COS adapter。

生产建议使用独立头像 Bucket，设置公有读、私有写，并向后端专用腾讯云子账号授予最小对象权限，不使用主账号永久密钥。敏感文件未来必须使用私有对象和临时签名 URL，不能复用头像接口。

腾讯云参考：[存储桶概述](https://cloud.tencent.com/document/product/436/13312)、[地域和访问域名](https://cloud.tencent.com/document/product/436/6224)。

## 头像对象生命周期

对象键：

```text
public/admin-avatars/{userId}/{uuid}.{detectedExtension}
```

替换流程：

1. 验证会话、大小、声明 MIME 和文件魔数。
2. 上传新对象。
3. 通过可串行化数据库事务读取旧键并更新 `avatar` 与 `avatarObjectKey`。
4. 数据库失败时立即尽力删除新对象并返回失败。
5. 数据库成功后尽力删除旧托管对象；删除失败写结构化错误日志，但不回滚已成功的换头像。

可串行化事务避免并发请求都把同一旧键当作前值。序列化冲突进行有上限短重试；耗尽后删除本请求新对象并返回 `409 ACCOUNT_CONCURRENT_UPDATE`。

删除头像先在事务中清空数据库字段，再尽力删除事务返回的旧对象。外部 URL 没有对象键，不会被误删。对象删除调用在请求内等待完成以获得明确结果，但其失败不改变资料更新或删除接口的成功响应。持久化清理队列留待有真实失败量后再引入。

## Server 模块结构

### `AdminAccountModule`

- Controller：HTTP 参数、认证用户 ID、Cookie 清理和状态码。
- Service：资料、昵称、头像关联、密码原子更新和安全日志。
- DTO：昵称、密码和 Swagger 响应模型。
- 依赖 `PasswordService`、会话版本能力和公开头像存储 interface。

### `PublicAvatarStorageModule`

外部 interface 只有：

- 上传已验证的公开头像，返回 `{ objectKey, publicUrl }`。
- 删除托管对象键。

COS SDK、Bucket/Region、域名拼接和供应商错误全部隐藏在启用 adapter 内；配置全空使用 disabled adapter。调用者不能传目录、ACL 或自定义对象键。

### `AuthModule`

- `SessionValidationService` 提供通用账户状态和版本校验，不判断后台角色。
- `TokenService` 在两类令牌携带 `sessionVersion`。
- `PasswordService` 继续独占 Argon2id。
- 账户模块不直接操作 JWT，也不扫描 Redis 会话键。

## Admin 前端

新增 `/account` 到受保护路由注册表，`requiredPermissions=[]`、`menuPermission=null`。它不出现在侧边栏，但要求有效后台账户。

Header：

- 桌面点击头像/名称，移动端点击头像图标，打开同一菜单。
- 菜单包含个人中心、修改密码、退出登录。
- 个人中心进入 `/account`；修改密码进入 `/account#password` 并聚焦密码区。
- 保留现有独立退出图标按钮。
- 有头像显示图片，无头像显示默认用户图标。

`/account` 是响应式单页双卡片：

1. 个人资料：头像预览、上传、删除；昵称；只读账号、脱敏手机号、状态、角色、创建时间。
2. 账户安全：当前密码、新密码、确认新密码和至少 12 位规则。

头像和昵称独立提交，互不阻塞。首次加载显示骨架；失败提供页级重试。上传期间禁用上传/删除，失败保留旧头像。昵称只有合法且改变时可保存。昵称或头像成功后通过认证上下文的窄 interface 更新用户摘要，Header 无需刷新。

密码支持显示/隐藏，确认密码只做前端校验。字段错误就近展示，未知错误使用表单级提示。卡片内用 `role="status"` 和 `role="alert"` 反馈，不引入全局 Toast 依赖。文件 `accept` 只辅助体验，安全校验仍在 Server。URL hash 仅用于滚动和聚焦。

`AdminSessionUser` 增加 `avatar: string | null`。

## 安全与日志

- 日志不得包含明文密码、密码哈希、COS Secret、完整手机号、原文件名或文件内容。
- 密码成功修改、头像更新和删除写结构化事件，包含事件名、管理员 ID、结果和请求追踪 ID。
- COS 错误对外映射稳定 PetCare 错误码，内部保留供应商请求 ID。
- 用户文件名不参与对象键或日志。
- 公开头像 URL 不能作为授权凭据。

## 测试策略

实施采用 Red-Green-Refactor，通过模块 interface 测试行为。

### Shared types 与 Server

- 契约导出和 JSDoc。
- 资料安全字段、手机号脱敏和活动角色。
- 昵称规范化、长度、控制字符和多余字段。
- 当前密码错误、密码复用、无密码凭据、乐观并发与成功修改。
- Token 版本、旧 Access/Refresh 失效、活动状态即时失效。
- 后台角色失效只阻止 Admin，不误伤普通 Miniapp 用户。
- COS 全空、部分配置、默认/自定义域名。
- 文件魔数、伪造 MIME、未知格式、2 MiB 上限。
- 上传/数据库/删除失败补偿及并发头像更新。
- Controller 认证、multipart、状态码、错误码和 Cookie 清除。

### Admin

- `/account` 仅需登录、不出现在侧边栏。
- Header 桌面/移动入口和菜单操作。
- 资料加载、重试、只读字段和昵称独立保存。
- 头像上传/删除、失败保留旧头像和 Header 同步。
- 密码字段、业务 401 不刷新、成功退出跳转。
- `#password` 滚动和键盘焦点。

### 最终验证

- Prisma format、validate、generate。
- Shared types build、lint、test。
- Server lint、test、typecheck、build。
- Admin lint、style lint、test、typecheck、生产 build。
- `git diff --check`。

## 文档与配置同步

- 本地 `.env` 追加空 `TENCENT_COS_*`，不读取输出或覆盖其他值。
- `.env.example`、`docker-compose.yml`、ConfigService 测试。
- 环境变量和部署文档。
- API 规范中的 Admin Account 接口。
- PRD 与菜单结构的交付状态。

## 验收标准

- 活动后台管理员无需额外业务权限即可进入 `/account`。
- 页面显示真实账号、脱敏手机号、活动角色、状态和创建时间，不泄漏内部字段。
- 昵称、头像独立修改，Header 同步更新。
- 配置 COS 后可上传不超过 2 MiB 的 JPEG、PNG、WebP，并可删除恢复默认头像。
- COS 未配置时服务仍启动；除头像上传外账户功能正常。
- 换头像失败不丢旧头像，数据库失败不永久遗留新对象，不删除外部历史头像。
- 修改密码要求当前密码且拒绝复用；成功后所有设备旧 Access/Refresh Token 立即失效。
- 无密码凭据时明确拒绝，不绕过当前密码验证。
- 新增契约、接口、页面、认证、配置分支和补偿路径均有测试。
- 所有相关 lint、测试、类型检查、构建、Prisma 与 diff 检查通过。
