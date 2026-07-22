# 管理后台双模式认证与默认管理员设计

## 背景与目标

PetCare 当前已有 `User`、`Role`、`Permission`、`UserRole` 和 `RolePermission` 数据模型，但没有可用的后台认证闭环：用户表没有账号密码字段，注册接口仍返回模拟 Token，Admin 前端也没有登录页和路由保护。

本次工作需要提供一套可在本地直接运行、可安全扩展到生产环境的管理员认证能力：

- 初始化一个默认管理员账号和一个默认超级管理员角色。
- 支持手机号加短信验证码登录。
- 支持手机号或账号名加密码登录。
- 提供 Access Token、Refresh Token、会话恢复和退出登录。
- Admin 前端提供登录页、路由守卫及登录状态管理。
- 为认证核心行为和初始化逻辑编写完善的自动化测试。

## 范围

### 本次包含

- Prisma 认证字段与 snake_case 物理字段映射。
- 幂等的最小化 seed。
- 默认管理员本地凭据配置。
- 密码哈希与校验。
- Redis 验证码生命周期、发送频率和尝试次数限制。
- 本地短信模拟器及生产短信发送器接口。
- JWT 签发、刷新、注销和当前用户接口。
- 管理员角色校验。
- Admin 登录界面、会话恢复、受保护路由和退出登录。
- 后端单元测试、认证集成测试及前端组件/路由测试。
- 环境变量和运行文档更新。

### 本次不包含

- 接入真实短信供应商。
- 管理员自助注册。
- 找回或重置密码页面。
- 多设备会话管理后台。
- 微信小程序登录改造。

## 方案选择

采用在现有 `User` 模型上增加认证字段的方案：

- `username String? @unique`
- `passwordHash String? @map("password_hash")`

不新增独立 `AdminAccount`，因为角色关系当前已经以 `User` 为主体；拆出独立管理员表会重复用户身份和 RBAC 关系。暂不新增独立 `Credential` 表，因为当前只有密码凭据，单独建表会增加无必要的关联复杂度。未来出现多种外部身份提供商时，可再将凭据抽离。

## 初始数据

seed 只创建生产可接受的基础数据，不创建演示用户：

- 创建并更新权限点集合。
- 创建唯一系统角色 `super_admin`。
- 将全部权限关联到 `super_admin`。
- 创建或更新默认管理员：
  - `username=admin`
  - `phone=17679141878`
  - `nickname=系统管理员`
  - `status=active`
  - 密码来自 `DEFAULT_ADMIN_PASSWORD`
- 将默认管理员关联到 `super_admin`。

默认管理员手机号和账号名也通过 `DEFAULT_ADMIN_PHONE`、`DEFAULT_ADMIN_USERNAME` 配置，本地 `.env` 分别写入 `17679141878` 和 `admin`。seed 缺少手机号或密码时立即失败；不会回退到公开默认密码。密码只以 Argon2id 哈希形式写入数据库。

seed 使用唯一字段和复合唯一键执行 upsert，可重复运行且不产生重复数据。重新运行 seed 时使用当前环境变量重新计算默认管理员密码哈希，从而允许本地或部署流程显式轮换初始密码。

seed 不删除数据库中后来由管理员创建的其他角色或用户；“一个默认角色和一个默认账号”仅指引导数据集合。在空数据库首次初始化时，系统角色和管理员账号各为一个。

## 后端架构

新增独立 `AuthModule`，避免把认证职责继续堆叠到 `UserService`：

- `AuthController`：暴露认证 HTTP 接口并设置或清除 Refresh Token Cookie。
- `AuthService`：编排账号查询、凭据校验、管理员角色检查和令牌签发。
- `PasswordService`：封装 Argon2id 哈希与校验。
- `VerificationCodeService`：管理 Redis 验证码、发送频率、过期时间和尝试次数。
- `SmsSender`：短信发送接口。
- `DevelopmentSmsSender`：仅非生产环境启用的本地实现，使用配置的固定验证码；API 响应不返回验证码。
- JWT Strategy/Guard：验证 Access Token。
- Admin Guard：确认当前用户状态为 `active` 且拥有 `super_admin` 角色。

所有配置通过现有 `ConfigService` 暴露类型安全 getter，不在业务代码中直接读取 `process.env`。

## API 设计

### `POST /auth/sms/send`

请求：`{ phone }`。

行为：对手机号和来源执行限流；仅对具备后台角色的活动用户发送验证码，但始终返回统一成功消息，避免泄露账号是否存在。

### `POST /auth/login/sms`

请求：`{ phone, code }`。

行为：原子校验并消费验证码，验证用户状态和管理员角色，随后签发会话。

### `POST /auth/login/password`

请求：`{ identifier, password }`，其中 `identifier` 可以是手机号或账号名。

行为：使用统一错误消息校验用户、密码、状态和管理员角色，随后签发会话。

### `POST /auth/refresh`

从 HttpOnly Cookie 读取 Refresh Token，验证后轮换 Refresh Token，并返回新的 Access Token。

### `POST /auth/logout`

清除 Refresh Token Cookie。Refresh Token 使用 Redis 会话标识进行校验，注销或轮换后旧 Token 失效。

### `GET /auth/me`

使用 Access Token 返回当前管理员的安全字段和角色；不返回密码哈希或其他凭据。

## Token 与 Cookie

- Access Token：15 分钟有效，Admin 前端仅保存在内存中。
- Refresh Token：7 天有效，写入 HttpOnly Cookie。
- Cookie：`SameSite=Lax`、路径限定为认证接口；生产环境启用 `Secure`。
- Refresh Token 携带唯一会话 ID，并在 Redis 保存会话状态；刷新时轮换，退出时删除。
- Admin 页面刷新后调用 `/auth/refresh` 恢复 Access Token，再调用 `/auth/me` 获取身份。

Admin 与 API 在 Docker/Nginx 和本地 Vite 代理下均使用同源 `/api` 路径，前端请求启用凭据 Cookie。

## 验证码安全策略

- 验证码长度：6 位数字。
- 有效期：5 分钟。
- 同一手机号发送间隔：60 秒。
- 同一手机号每小时最多发送 5 次。
- 单个验证码最多校验失败 5 次。
- 成功校验后立即删除，不能重复使用。
- Redis 只保存验证码摘要，不保存可直接读取的验证码明文。
- 本地固定验证码来自 `SMS_DEV_CODE`，仅允许在非生产环境使用。

## Admin 前端

新增 `/login` 页面，提供“验证码登录”和“密码登录”两个标签页：

- 验证码登录：手机号、发送验证码按钮、验证码输入框。
- 密码登录：手机号或账号、密码输入框。
- 提交期间禁用重复操作，显示统一且可理解的错误提示。
- 登录成功后进入仪表盘。

新增认证上下文和 API 客户端：

- 应用启动时尝试刷新会话。
- 未认证访问业务路由时跳转 `/login`。
- 已认证访问 `/login` 时跳转首页。
- Header 提供退出登录入口。
- API 收到 401 时只执行一次刷新；刷新失败则清理会话并返回登录页。

## 错误处理

- 登录失败统一返回 401 和“账号或凭据错误”，不区分不存在、密码错误、无管理员角色或被禁用。
- 验证码发送限流返回 429，并提供可安全公开的重试时间。
- 缺少生产短信实现、弱 JWT 密钥或缺少 seed 必填变量时启动或 seed 立即失败。
- Redis 不可用时验证码发送、验证码登录和 Token 刷新明确失败，不降级为不安全的本地内存状态。

## 测试策略

实施严格采用 Red-Green-Refactor：先编写失败测试并确认失败原因，再实现最小代码。

后端单元测试覆盖：

- 密码哈希不等于明文、正确密码通过、错误密码拒绝。
- 密码登录支持手机号和账号名。
- 不存在、禁用、无管理员角色及错误密码返回统一错误。
- 验证码生成、摘要存储、过期、成功消费、失败次数和发送限流。
- Access/Refresh Token 签发、轮换和注销。
- Admin Guard 的活动状态与角色判断。
- seed 输入校验和幂等 upsert 行为。

后端集成测试覆盖两种登录流程、`/auth/me`、刷新、注销及旧 Refresh Token 失效。

前端测试覆盖：

- 两种登录模式切换和表单校验。
- 发送验证码倒计时与错误状态。
- 登录成功跳转。
- 未登录路由跳转。
- 启动时会话恢复。
- 退出登录清理状态。

最终验证至少包含 Prisma validate/generate、后端测试、Admin 测试、后端与 Admin 构建、ESLint 和 `git diff --check`。

## 验收标准

- 空数据库初始化后存在一个默认 `super_admin` 角色和一个与其关联的默认管理员账号；重复初始化不会增加默认记录。
- seed 连续执行两次不会增加重复记录。
- 默认管理员可使用手机号加本地验证码登录。
- 默认管理员可使用手机号加密码或 `admin` 加密码登录。
- 未登录用户无法访问 Admin 业务页面。
- 非管理员用户即使凭据正确也无法登录 Admin。
- 页面刷新可以恢复有效会话；退出后旧 Refresh Token 无法继续刷新。
- 密码和验证码均不以明文存储在数据库或 Redis。
- 自动化测试和构建全部通过。
