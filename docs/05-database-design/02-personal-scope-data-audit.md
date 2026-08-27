# 个人版历史数据库与遗留数据只读审计

> - 审计日期：2026-08-27
> - 仓库基线：`efd9332`
> - 运行环境：长期本地 Compose 的 PostgreSQL `public` Schema 与本地媒体持久卷
> - 决策状态：只读审计已完成；**未批准 Schema、migration、数据库记录或对象文件删除**

## 1. 结论

当前 Prisma Schema 共有 52 个模型，可分为三类：

- 23 个模型由个人版当前账户、宠物档案、课堂、受控社区、官网内容或 RBAC 继续使用，必须保留；
- `Order` 仍被账户注销和宠物删除作为历史引用保护读取，属于兼容锚点，不能直接删除；
- 其余 28 个模型没有发现当前生产代码中的 Prisma 读写调用，可作为后续 Schema 收缩候选，但本审计不授权删除。

长期本地数据库当前只有 `public` Schema，共 53 张基础表，其中包含 52 个 Prisma 模型表和
`_prisma_migrations`。29 张暂停商业能力或未启用社交能力相关表全部为 0 行；本地媒体持久卷也为
0 个文件。这个结果只证明当前本地环境干净，不能代替其他数据库或对象存储的审计。

当前最优顺序不是立即生成删除 migration，而是：

1. 先关闭仍在当前运行时注册的旧公共注册端点；
2. 确认是否存在其他数据库、备份或对象存储，并在每个目标重复本报告的只读核对；
3. 明确保留或归档决策，完成可恢复备份与临时库恢复演练；
4. 解除 `Order` 的当前代码依赖后，再生成新的 forward-only Prisma migration。

## 2. 审计边界与方法

### 2.1 仓库引用

审计以 `apps/server/src/app.module.ts` 的默认模块装配为运行入口，并核对：

- `apps/server/prisma/schema.prisma` 中的模型、关系和映射表名；
- `apps/server/prisma/migrations/` 中 11 条已提交 migration；
- Server 生产源码中的 Prisma model delegate 调用；
- Admin、Miniapp、Website、共享类型和 API Client 中的相关契约与页面消费者；
- 当前官网内容键、RBAC 权限目录和默认 seed。

生成代码、单元测试、历史计划和未来设计文档不视为当前运行消费者。关系嵌套查询和当前安全保护也单独核对，
避免把没有直接 `prisma.<model>` 调用的 `UserProfile` 或仍由 `Order` 保护的数据误判为无消费者。

### 2.2 运行数据

所有数据库检查均在 `BEGIN READ ONLY` 事务中执行，只读取：

- Schema 与基础表数量；
- 各表精确行数；
- migration 账本的成功和回滚状态；
- 官网内容键、版本状态和暂停商业词/旧路由命中；
- RBAC 权限代码与用户类型聚合；
- 当前共享表中的字段级兼容值。

本地媒体检查只列举 `/app/data/media` 下的普通文件，不读取文件内容。审计没有输出 `.env`、密码、手机号、
OpenID、令牌、对象凭据或用户正文。

### 2.3 限制

- 本报告只覆盖 2026-08-27 的当前 checkout 和长期本地 Compose；远端 CI、目标环境、历史备份与真实 COS 未审计。
- “本地为 0 行”不是跨环境删除授权。任何其他数据库都必须重新执行同等只读检查。
- 静态引用搜索不能代替迁移后运行验证；后续仍须在空库和备份恢复出的临时库上执行 migration 与个人版纵向 E2E。

## 3. 模型分类

### 3.1 当前保留：23 个模型

| 领域       | 模型                                                                                                                                                     | 当前依据                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 账户       | `User`、`UserProfile`                                                                                                                                    | 登录、资料、公开用户、Admin 用户和账户注销 |
| 宠物档案   | `Pet`、`PetMediaAsset`                                                                                                                                   | 本人宠物 CRUD、受管理图片和对象清理        |
| 官网内容   | `WebsiteContent`、`WebsiteContentVersion`、`WebsiteContentSection`、`WebsiteMediaAsset`、`WebsitePreviewToken`、`WebsiteContentAuditLog`                 | 草稿、发布、预览、历史、素材和审计         |
| 课堂与社区 | `Post`、`CommunityMediaAsset`、`CommunityPostModerationEvent`、`CommunityPostReport`、`CommunityPostLike`、`ClassroomArticle`、`Comment`、`Notification` | 发布、审核、举报、互动、通知和课堂         |
| RBAC       | `Role`、`Permission`、`RolePermission`、`UserRole`、`PermissionAuditLog`                                                                                 | 当前 Admin 权限目录、角色分配和变更审计    |

这些模型中的关系字段仍可能指向遗留模型；后续收缩 Schema 时需要同步删除反向关系，但不能删除上述当前模型本身。

### 3.2 兼容锚点：`Order`

订单创建、接单和履约模块已经不在 `AppModule` 中注册，但 `Order` 仍有两处当前只读依赖：

- `MiniappAccountService` 在发送注销验证码、执行注销和串行化事务复核时，阻止仍有
  `pending_confirm`、`confirmed`、`in_progress` 或 `disputed` 订单的账户注销；
- `PetService` 在删除宠物前检查是否仍有订单引用，并将数据库外键冲突转换为稳定业务错误。

本地 `orders` 为 0 行，但在确认所有环境均无历史订单或完成归档前，这两个保护不能直接删除。`Order` 及其
`User`、`Pet` 反向关系应在应用解耦后与商业表收缩一起处理。

### 3.3 后续删除候选：28 个模型

以下模型没有发现当前生产源码中的 Prisma model delegate 调用，本地对应表也全部为 0 行：

| 候选组         | 模型                                                                                                                                              | 数量 | 初步建议                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------- |
| 服务者与认证   | `Provider`、`ProviderCertificationApplication`、`ProviderRatingEligibility`、`AdminTodo`                                                          | 4    | 跨环境确认无身份材料与对象引用后删除                  |
| 订单附属与评价 | `OrderFeeSnapshot`、`OrderReward`、`OrderPlatform`、`OrderIntent`、`OrderSop`、`Review`                                                           | 6    | 与 `Order` 同批迁移，不能先拆断历史完整性             |
| 商业配置版本   | `SystemConfigVersion`、`SystemConfigPointer`、`SopConfigStep`、`SopViolationRule`、`RatingThresholdConfig`、`FeeConfig`、`SystemConfigAuditEvent` | 7    | 确认无订单版本引用后按依赖逆序删除                    |
| 投诉与纠纷     | `Complaint`、`ComplaintStatement`、`DisputeDecision`、`ComplaintAssignment`、`ComplaintEvent`、`DisputeExecutionTask`、`DisputeMoneyRecord`       | 7    | 先审计陈述、证据和金额记录；非空时禁止自动删除        |
| 未启用社交     | `Follow`、`Favorite`                                                                                                                              | 2    | 当前范围不含关注或收藏，确认所有环境为 0 后可独立删除 |
| 信用与商业声誉 | `CreditScore`、`CreditRecord`                                                                                                                     | 2    | 当前个人版无信用分能力，确认历史记录保留策略后删除    |

删除这些模型时还应删除不再使用的 `ProviderRatingEligibilityStatus` 和 `ProviderRetrainingStatus` 枚举，
以及当前模型上的对应反向关系。既有 migration 必须原样保留。

### 3.4 字段级兼容残留

以下字段仍位于当前保留模型中，不能随表级清理顺带删除：

| 字段或契约                                  | 当前状态                                                                             | 决策                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `User.userType` 与 `provider` 值            | 仍由公开用户、Miniapp 资料、Admin 列表和筛选契约读取；本地只有 `pet_owner`           | 先保留；跨环境核对取值后另做共享契约与列迁移             |
| `UserProfile.realName/gender/age`           | 当前资料只使用 `address` 和 `bio`；本地旧身份字段均为空                              | 先保留；涉及个人数据，必须独立决定导出或删除             |
| `Pet.legacyAge`                             | 新建宠物显式写入 `null`，用于出生日期迁移兼容；本地没有非空值                        | 先保留；跨环境确认全部转换为 `birthDate` 后单独删除      |
| `Post.sharesCount`                          | 当前没有转发写入能力，但 Admin 仍展示该值；本地没有非零值                            | 先移除 UI/API 消费，再决定是否删除列                     |
| `Notification.type=order`                   | 当前通知仍需通用表，但个人版只创建社区互动通知；本地没有订单通知                     | 保留通知模型；后续收紧类型契约时单独迁移                 |
| 官网 `services/trust/companions` 历史内容键 | 不属于 `CURRENT_WEBSITE_CONTENT_KEYS`，当前公共与 Admin 边界会拒绝；本地没有对应记录 | 在所有内容库核对后，才能删除历史类型和 seed 升级兼容逻辑 |

## 4. 长期本地数据快照

### 4.1 当前能力数据

| 数据组         | 精确结果                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| 账户与 RBAC    | `users=1`、`user_profiles=0`、`roles=1`、`permissions=36`、`role_permissions=36`、`user_roles=1`、权限审计日志 `0` |
| 官网内容       | 7 个内容键、14 个版本、40 个区块；官网媒体、预览令牌和官网审计日志均为 `0`                                         |
| 宠物与社区     | 宠物、宠物媒体、帖子、社区媒体、审核事件、举报、点赞、评论、通知和课堂文章均为 `0`                                 |
| 权限目录一致性 | 数据库 36 个权限代码与当前代码目录数量一致，没有发现遗留商业权限代码                                               |

官网内容键仅有：`site_shell`、`home`、`about`、`contact`、`help`、`privacy`、`terms`；每个内容键各有
1 个 published 和 1 个 draft 版本。扫描全部版本的 JSON、settings 与 SEO 后，没有命中悬赏、接单、宠托师、服务订单、
钱包、提现、退款、结算、微信支付、旧 `/services`、`/trust` 或 `/companions` 路由。

### 4.2 暂停能力与字段级值

- 29 张暂停商业能力或未启用社交表全部为 `0` 行，其中包含兼容锚点 `orders`；
- 非 `pet_owner` 用户、旧身份资料字段、`Pet.age`、非零分享数、订单通知和旧官网内容键均为 `0`；
- 本地媒体持久卷普通文件数为 `0`；
- 数据库没有 `admin_e2e_*` 或其他非系统 Schema，只存在 `public`。

### 4.3 Migration 账本

11 条已提交 migration 均已成功完成，没有 `rolled_back_at`：

- `20260820000000_initial_schema` 一次创建当前与商业设计表；
- 后续 10 条 migration 只涉及 Miniapp 资料、课堂分类、社区治理/媒体/互动和宠物档案/媒体。

后续收缩必须新增 migration。禁止删除、重命名或改写 `initial_schema`，否则空库重建和既有账本会分叉。

## 5. 数据与对象风险

本地为 0 不代表其他环境没有以下高敏或高完整性数据：

- 认证申请中的脱敏身份字段和证件图片 URL；
- 订单地址、金额、SOP 照片和视频；
- 投诉陈述、证据 URL、裁决和内部金额记录；
- 评价图片、用户类型、旧实名资料和信用记录。

如果任一目标存在记录，必须先冻结精确主键和对象引用，决定继续保留、导出归档或依法删除。对象文件应在数据库
归档验证后按精确 key 处理，禁止先清空 Bucket、named volume 或目录。数据库行与对象清理必须分别报告。

## 6. P0 独立修复：旧公共注册端点

本次只读审计当时确认 `UserModule` 注册了 `POST /users/register`，其实现会：

- 接受六位短信验证码字段但不调用验证码校验服务；
- 直接创建用户记录；
- 返回固定的 `mock-token` 和 `mock-refresh-token`；
- 仍由 `@petcare/api-client` 的注册方法暴露。

固定假令牌不是有效会话证据，但该端点仍会制造未经验证的账户数据，并向调用方返回误导性的成功响应。后续独立
鉴权修复已经下线该端点，并删除无消费者的注册、登录、资料更新和实名认证客户端契约；数据库 Schema 与 migration
未随本次修复变更。

## 7. 推荐的后续执行合同

### 7.1 先决条件

1. 已关闭旧公共注册端点及无消费者注册/实名客户端契约，并通过认证与账户定向测试；
2. 用户明确确认是否存在本地以外的数据库、备份和对象存储；
3. 对每个目标重复表行数、字段值、官网内容键、对象引用和 migration 账本检查；
4. 生成 PostgreSQL custom-format 备份，并用 `pg_restore --list` 和新建临时数据库完成恢复验证；
5. 对任何非空商业记录形成保留、归档或删除的逐组审批结果。

### 7.2 应用解耦

1. 在历史订单已确认不存在或完成归档后，移除账户注销和宠物删除对 `Order` delegate 的依赖；
2. 移除相应错误码、共享契约和定向测试中的订单阻断语义；
3. 处理 `userType/provider`、旧官网内容键、分享数等字段级兼容项，但不要与表删除默认合并；
4. 重新搜索当前 Server、Admin、Miniapp、Website 和共享包，确认候选模型没有运行消费者。

### 7.3 Forward-only Schema 收缩

1. 使用 Prisma CLI 基于更新后的 `schema.prisma` 生成新的 migration，不手改既有 migration；
2. 按外键依赖从叶子表向根表收缩商业模型，并同步删除当前模型上的反向关系和专属枚举；
3. 先在空数据库执行完整 migration 链，再在备份恢复出的临时数据库执行收缩 migration；
4. 连续执行 `prisma:migrate:deploy` 和 `prisma:migrate:status`，确认账本收敛且重复部署无新动作；
5. 验证当前 23 个模型的数据量、外键和关键读取未变化。

### 7.4 验收

- Server 相关 lint、typecheck 和受影响单元测试通过；
- `pnpm test:e2e:personal` 在一次性 Schema 中通过；
- 长期 Compose 重启后账户、官网内容、宠物、社区和媒体路径保持健康；
- 空库完整迁移、临时恢复库迁移和 migration status 均通过；
- 没有遗留表、悬空外键、对象误删、E2E Schema 或正式数据中的测试记录；
- 数据库、对象文件、代码、文档和 Git 状态分别报告。

## 8. 停止条件

出现以下任一情况时，不得执行删除 migration：

- 任一目标数据库的 29 张候选/兼容表存在未审批记录；
- 发现证件、订单、投诉、金额或对象引用无法确定保留责任；
- 备份无法列出内容或无法恢复到独立临时数据库；
- `Order`、旧内容键或其他候选仍有当前运行消费者；
- 不能确认所审计数据库覆盖全部部署环境；
- 空库或临时恢复库的 migration、当前能力测试或重启持久化验证失败。
