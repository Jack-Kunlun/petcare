# PetCare 数据库设计（Phase 3完整版）

本目录存放PetCare项目的数据库设计相关文档，覆盖Phase 1-3全部功能需求。

## ER图（实体关系图）

```mermaid
erDiagram
    User ||--o| UserProfile : has
    User ||--o| Provider : "is provider"
    User ||--o{ Pet : owns
    User ||--o{ Order : "creates as owner"
    User ||--o{ Order : "serves as provider"
    User ||--o{ Post : authors
    User ||--o{ Favorite : favorites
    User ||--o{ Notification : receives
    User ||--o{ Review : writes
    User ||--o{ Comment : comments
    User ||--o{ Follow : follows
    User ||--o{ Follow : followed by
    User ||--o| CreditScore : has
    User ||--o{ CreditRecord : records
    User ||--o{ Complaint : files

    Pet ||--o{ Order : "has orders"
    Pet ||--o{ Post : featured in

    Order ||--o| OrderReward : "reward order"
    Order ||--o| OrderPlatform : "platform order"
    Order ||--o{ OrderIntent : intents
    Order ||--o{ OrderSop : sop steps
    Order ||--o| Review : reviewed
    Order ||--o| Complaint : disputed

    Post ||--o{ Favorite : favorited by
    Post ||--o{ Comment : commented on

    Role ||--o{ RolePermission : permissions
    Permission ||--o{ RolePermission : assigned to
    User ||--o{ UserRole : roles

    %% Note: Comments and DisputeResolution omitted for clarity
```

## 数据字典

### 一、用户相关表

#### 1. User（用户基础表）

存储平台所有用户的基础信息。

| 字段      | 类型          | 约束                 | 说明                             |
| --------- | ------------- | -------------------- | -------------------------------- |
| id        | String (UUID) | PK, default(uuid())  | 用户唯一标识                     |
| openid    | String        | UNIQUE, nullable     | 微信OpenID                       |
| phone     | String        | UNIQUE               | 手机号（登录凭证）               |
| nickname  | String        | NOT NULL             | 昵称                             |
| avatar    | String        | nullable             | 头像URL                          |
| userType  | String        | default("pet_owner") | 用户类型：pet_owner / provider   |
| status    | String        | default("active")    | 状态：active / inactive / banned |
| createdAt | DateTime      | default(now())       | 创建时间                         |
| updatedAt | DateTime      | @updatedAt           | 更新时间                         |

**索引：**

- `phone` - 加速手机号查询
- `userType` - 加速按用户类型筛选

#### 2. UserProfile（用户详细资料表）

存储用户的个人详细信息。

| 字段      | 类型          | 约束                 | 说明                |
| --------- | ------------- | -------------------- | ------------------- |
| id        | String (UUID) | PK, default(uuid())  | 记录ID              |
| userId    | String        | UNIQUE, FK → User.id | 用户ID              |
| realName  | String        | nullable             | 真实姓名            |
| gender    | String        | nullable             | 性别：male / female |
| age       | Int           | nullable             | 年龄                |
| address   | String        | nullable             | 地址                |
| createdAt | DateTime      | default(now())       | 创建时间            |
| updatedAt | DateTime      | @updatedAt           | 更新时间            |

**关系：**

- 与User：一对一

#### 3. Provider（服务提供者扩展表）

存储服务提供者的认证和资质信息。

| 字段            | 类型          | 约束                 | 说明           |
| --------------- | ------------- | -------------------- | -------------- |
| id              | String (UUID) | PK, default(uuid())  | 记录ID         |
| userId          | String        | UNIQUE, FK → User.id | 用户ID         |
| idCardVerified  | Boolean       | default(false)       | 身份证是否验证 |
| wechatScore     | Int           | nullable             | 微信支付分     |
| trainingPassed  | Boolean       | default(false)       | 培训是否通过   |
| certifiedSitter | Boolean       | default(false)       | 是否认证宠托师 |
| rejectRate      | Float         | default(0.0)         | 拒绝率         |
| createdAt       | DateTime      | default(now())       | 创建时间       |
| updatedAt       | DateTime      | @updatedAt           | 更新时间       |

**关系：**

- 与User：一对一

**索引：**

- `certifiedSitter` - 加速筛选认证宠托师

---

### 二、宠物相关表

#### 4. Pet（宠物档案表）

存储用户宠物信息。

| 字段       | 类型          | 约束                | 说明                |
| ---------- | ------------- | ------------------- | ------------------- |
| id         | String (UUID) | PK, default(uuid()) | 宠物唯一标识        |
| ownerId    | String        | FK → User.id        | 主人ID              |
| name       | String        | NOT NULL            | 宠物名称            |
| breed      | String        | NOT NULL            | 品种                |
| age        | Float         | NOT NULL            | 年龄（岁）          |
| weight     | Float         | nullable            | 体重（kg）          |
| gender     | String        | NOT NULL            | 性别：male / female |
| sterilized | Boolean       | default(false)      | 是否绝育            |
| habits     | String        | nullable            | 特殊习性            |
| allergies  | String        | nullable            | 过敏史              |
| photos     | String[]      | Array               | 照片URL数组         |
| createdAt  | DateTime      | default(now())      | 创建时间            |
| updatedAt  | DateTime      | @updatedAt          | 更新时间            |

**关系：**

- 与User：多对一（一个用户可以有多个宠物）
- 与Order：一对多（一个宠物可以有多个订单）
- 与Post：一对多（帖子可关联宠物）

**索引：**

- `ownerId` - 加速按主人查询宠物

---

### 三、订单相关表

#### 5. Order（订单主表）

存储服务订单的核心信息。

| 字段        | 类型          | 约束                       | 说明                                                                    |
| ----------- | ------------- | -------------------------- | ----------------------------------------------------------------------- |
| id          | String (UUID) | PK, default(uuid())        | 订单唯一标识                                                            |
| orderType   | String        | NOT NULL                   | 订单类型：reward / platform                                             |
| serviceType | String        | NOT NULL                   | 服务类型：feeding / walking / playing                                   |
| ownerId     | String        | FK → User.id               | 下单用户ID                                                              |
| providerId  | String        | FK → User.id, nullable     | 服务提供者ID                                                            |
| petId       | String        | FK → Pet.id                | 关联宠物ID                                                              |
| serviceTime | DateTime      | NOT NULL                   | 服务时间                                                                |
| address     | String        | NOT NULL                   | 服务地址                                                                |
| amount      | Float         | NOT NULL                   | 订单金额                                                                |
| status      | String        | default("pending_confirm") | 状态：pending_confirm / confirmed / in_progress / completed / cancelled |
| remark      | String        | nullable                   | 备注                                                                    |
| completedAt | DateTime      | nullable                   | 完成时间                                                                |
| createdAt   | DateTime      | default(now())             | 创建时间                                                                |
| updatedAt   | DateTime      | @updatedAt                 | 更新时间                                                                |

**关系：**

- 与User（owner）：多对一
- 与User（provider）：多对一（可选）
- 与Pet：多对一
- 与OrderReward：一对一（悬赏订单）
- 与OrderPlatform：一对一（平台订单）
- 与OrderIntent：一对多
- 与OrderSop：一对多
- 与Review：一对一
- 与Complaint：一对一

**索引：**

- `ownerId` - 加速按用户查询订单
- `providerId` - 加速按服务者查询订单
- `status` - 加速按状态筛选
- `orderType` - 加速按订单类型筛选

#### 6. OrderReward（悬赏订单扩展表）

存储悬赏订单的定价信息。

| 字段          | 类型          | 约束                  | 说明         |
| ------------- | ------------- | --------------------- | ------------ |
| id            | String (UUID) | PK, default(uuid())   | 记录ID       |
| orderId       | String        | UNIQUE, FK → Order.id | 订单ID       |
| rewardAmount  | Float         | NOT NULL              | 悬赏金额     |
| priceRangeMin | Float         | NOT NULL              | 推荐价格下限 |
| priceRangeMax | Float         | NOT NULL              | 推荐价格上限 |
| expireTime    | DateTime      | NOT NULL              | 过期时间     |
| createdAt     | DateTime      | default(now())        | 创建时间     |

**关系：**

- 与Order：一对一

#### 7. OrderPlatform（平台订单扩展表）

存储平台定价订单的信息。

| 字段               | 类型          | 约束                  | 说明           |
| ------------------ | ------------- | --------------------- | -------------- |
| id                 | String (UUID) | PK, default(uuid())   | 记录ID         |
| orderId            | String        | UNIQUE, FK → Order.id | 订单ID         |
| platformPrice      | Float         | NOT NULL              | 平台定价       |
| assignedProviderId | String        | nullable              | 指派的提供者ID |
| createdAt          | DateTime      | default(now())        | 创建时间       |

**关系：**

- 与Order：一对一

#### 8. OrderIntent（意向接单记录表）

存储服务提供者的接单意向。

| 字段         | 类型          | 约束                | 说明                                 |
| ------------ | ------------- | ------------------- | ------------------------------------ |
| id           | String (UUID) | PK, default(uuid()) | 记录ID                               |
| orderId      | String        | FK → Order.id       | 订单ID                               |
| providerId   | String        | FK → User.id        | 提供者ID                             |
| intentStatus | String        | default("pending")  | 状态：pending / confirmed / rejected |
| createdAt    | DateTime      | default(now())      | 创建时间                             |
| updatedAt    | DateTime      | @updatedAt          | 更新时间                             |

**关系：**

- 与Order：多对一
- 与User：多对一

**约束：**

- `@@unique([orderId, providerId])` - 防止重复提交意向

**索引：**

- `orderId` - 加速按订单查询意向
- `providerId` - 加速按提供者查询意向

#### 9. OrderSop（SOP执行记录表）

存储标准化服务流程的执行记录。

| 字段        | 类型          | 约束                | 说明                                                           |
| ----------- | ------------- | ------------------- | -------------------------------------------------------------- |
| id          | String (UUID) | PK, default(uuid()) | 记录ID                                                         |
| orderId     | String        | FK → Order.id       | 订单ID                                                         |
| stepNumber  | Int           | NOT NULL            | 步骤序号（1-5）                                                |
| stepName    | String        | NOT NULL            | 步骤名称：进门消毒 / 拍照打卡 / 执行服务 / 清理现场 / 离开拍照 |
| photos      | String[]      | Array               | 照片URL数组                                                    |
| videos      | String[]      | Array               | 视频URL数组                                                    |
| completedAt | DateTime      | nullable            | 完成时间                                                       |
| createdAt   | DateTime      | default(now())      | 创建时间                                                       |

**关系：**

- 与Order：多对一

**索引：**

- `orderId` - 加速按订单查询SOP记录

---

### 四、评价与纠纷表

#### 10. Review（评价表）

存储服务完成后的评价信息。

| 字段               | 类型          | 约束                  | 说明                  |
| ------------------ | ------------- | --------------------- | --------------------- |
| id                 | String (UUID) | PK, default(uuid())   | 评价ID                |
| orderId            | String        | UNIQUE, FK → Order.id | 订单ID                |
| reviewerId         | String        | FK → User.id          | 评价人ID              |
| attitudeRating     | Int           | NOT NULL              | 服务态度评分（1-5）   |
| professionalRating | Int           | NOT NULL              | 专业程度评分（1-5）   |
| punctualityRating  | Int           | NOT NULL              | 准时性评分（1-5）     |
| sopExecutionRating | Int           | NOT NULL              | SOP执行评分（1-5）    |
| overallRating      | Int           | NOT NULL              | 整体满意度评分（1-5） |
| content            | String        | nullable              | 评价内容              |
| photos             | String[]      | Array                 | 佐证照片              |
| createdAt          | DateTime      | default(now())        | 创建时间              |

**关系：**

- 与Order：一对一
- 与User：多对一

**索引：**

- `reviewerId` - 加速按评价人查询

#### 11. Complaint（投诉表）

存储用户投诉信息。

| 字段             | 类型          | 约束                  | 说明                                                 |
| ---------------- | ------------- | --------------------- | ---------------------------------------------------- |
| id               | String (UUID) | PK, default(uuid())   | 投诉ID                                               |
| orderId          | String        | UNIQUE, FK → Order.id | 订单ID                                               |
| complainantId    | String        | FK → User.id          | 投诉人ID                                             |
| complaintType    | String        | NOT NULL              | 投诉类型：service_quality / safety / payment / other |
| evidence         | String[]      | Array                 | 证据URL数组                                          |
| expectedSolution | String        | nullable              | 期望解决方案                                         |
| status           | String        | default("pending")    | 状态：pending / processing / resolved / closed       |
| createdAt        | DateTime      | default(now())        | 创建时间                                             |
| updatedAt        | DateTime      | @updatedAt            | 更新时间                                             |

**关系：**

- 与Order：一对一
- 与User：多对一
- 与DisputeResolution：一对一

**索引：**

- `complainantId` - 加速按投诉人查询
- `status` - 加速按状态筛选

#### 12. DisputeResolution（纠纷裁决表）

存储平台对纠纷的裁决结果。

| 字段             | 类型          | 约束                      | 说明                                                                                             |
| ---------------- | ------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| id               | String (UUID) | PK, default(uuid())       | 裁决ID                                                                                           |
| complaintId      | String        | UNIQUE, FK → Complaint.id | 投诉ID                                                                                           |
| resolverId       | String        | nullable                  | 客服ID                                                                                           |
| resolutionType   | String        | NOT NULL                  | 裁决类型：support_complainant / support_provider / shared_responsibility / insufficient_evidence |
| refundAmount     | Float         | nullable                  | 退款金额                                                                                         |
| scoreAdjustment  | Float         | nullable                  | 评分调整                                                                                         |
| creditAdjustment | Int           | nullable                  | 信用分调整                                                                                       |
| reason           | String        | nullable                  | 裁决理由                                                                                         |
| createdAt        | DateTime      | default(now())            | 创建时间                                                                                         |
| updatedAt        | DateTime      | @updatedAt                | 更新时间                                                                                         |

**关系：**

- 与Complaint：一对一

**索引：**

- `resolverId` - 加速按客服查询裁决

---

### 五、社区相关表

#### 13. Post（社区动态表）

存储社区发布的动态内容。

| 字段          | 类型          | 约束                  | 说明                              |
| ------------- | ------------- | --------------------- | --------------------------------- |
| id            | String (UUID) | PK, default(uuid())   | 帖子ID                            |
| authorId      | String        | FK → User.id          | 作者ID                            |
| content       | String        | NOT NULL              | 帖子内容                          |
| mediaUrls     | String[]      | Array                 | 媒体URL数组（图片/视频）          |
| tags          | String[]      | Array                 | 标签数组                          |
| petId         | String        | FK → Pet.id, nullable | 关联宠物ID                        |
| likesCount    | Int           | default(0)            | 点赞数                            |
| commentsCount | Int           | default(0)            | 评论数                            |
| sharesCount   | Int           | default(0)            | 转发数                            |
| status        | String        | default("published")  | 状态：published / draft / deleted |
| createdAt     | DateTime      | default(now())        | 创建时间                          |
| updatedAt     | DateTime      | @updatedAt            | 更新时间                          |

**关系：**

- 与User：多对一
- 与Pet：多对一（可选）
- 与Favorite：一对多
- 与Comment：一对多

**索引：**

- `authorId` - 加速按作者查询帖子
- `createdAt` - 加速按时间排序

#### 14. Comment（评论表）

存储帖子的评论和回复。

| 字段            | 类型          | 约束                      | 说明             |
| --------------- | ------------- | ------------------------- | ---------------- |
| id              | String (UUID) | PK, default(uuid())       | 评论ID           |
| postId          | String        | FK → Post.id              | 帖子ID           |
| commenterId     | String        | FK → User.id              | 评论人ID         |
| content         | String        | NOT NULL                  | 评论内容         |
| parentCommentId | String        | FK → Comment.id, nullable | 父评论ID（回复） |
| createdAt       | DateTime      | default(now())            | 创建时间         |
| updatedAt       | DateTime      | @updatedAt                | 更新时间         |

**关系：**

- 与Post：多对一
- 与User：多对一
- 自引用：一对多（回复评论）

**索引：**

- `postId` - 加速按帖子查询评论
- `commenterId` - 加速按评论人查询

#### 15. Follow（关注关系表）

存储用户之间的关注关系。

| 字段        | 类型          | 约束                | 说明       |
| ----------- | ------------- | ------------------- | ---------- |
| id          | String (UUID) | PK, default(uuid()) | 记录ID     |
| followerId  | String        | FK → User.id        | 关注者ID   |
| followingId | String        | FK → User.id        | 被关注者ID |
| createdAt   | DateTime      | default(now())      | 创建时间   |

**关系：**

- 与User（follower）：多对一
- 与User（following）：多对一

**约束：**

- `@@unique([followerId, followingId])` - 防止重复关注

**索引：**

- `followerId` - 加速查询关注的人
- `followingId` - 加速查询粉丝

#### 16. Favorite（收藏表）

存储用户收藏的帖子。

| 字段      | 类型          | 约束                | 说明     |
| --------- | ------------- | ------------------- | -------- |
| id        | String (UUID) | PK, default(uuid()) | 收藏ID   |
| userId    | String        | FK → User.id        | 用户ID   |
| postId    | String        | FK → Post.id        | 帖子ID   |
| createdAt | DateTime      | default(now())      | 收藏时间 |

**关系：**

- 与User：多对一
- 与Post：多对一

**约束：**

- `@@unique([userId, postId])` - 防止重复收藏

**索引：**

- `userId` - 加速按用户查询收藏
- `postId` - 加速按帖子查询收藏者

---

### 六、消息通知表

#### 17. Notification（消息通知表）

存储用户的消息通知。

| 字段        | 类型          | 约束                | 说明                           |
| ----------- | ------------- | ------------------- | ------------------------------ |
| id          | String (UUID) | PK, default(uuid()) | 通知ID                         |
| userId      | String        | FK → User.id        | 接收用户ID                     |
| type        | String        | NOT NULL            | 类型：message / order / system |
| title       | String        | NOT NULL            | 通知标题                       |
| content     | String        | NOT NULL            | 通知内容                       |
| referenceId | String        | nullable            | 关联业务ID（订单/帖子等）      |
| isRead      | Boolean       | default(false)      | 是否已读                       |
| createdAt   | DateTime      | default(now())      | 创建时间                       |

**关系：**

- 与User：多对一

**索引：**

- `userId` - 加速按用户查询通知
- `isRead` - 加速筛选未读通知
- `createdAt` - 加速按时间排序

---

### 七、RBAC权限管理表

#### 18. Role（角色表）

存储系统角色定义。

| 字段        | 类型          | 约束                | 说明             |
| ----------- | ------------- | ------------------- | ---------------- |
| id          | String (UUID) | PK, default(uuid()) | 角色ID           |
| roleName    | String        | UNIQUE              | 角色名称         |
| description | String        | nullable            | 角色描述         |
| isSystem    | Boolean       | default(false)      | 是否系统内置角色 |
| isActive    | Boolean       | default(true)       | 是否启用         |
| createdAt   | DateTime      | default(now())      | 创建时间         |
| updatedAt   | DateTime      | @updatedAt          | 更新时间         |

**关系：**

- 与RolePermission：一对多
- 与UserRole：一对多

**索引：**

- `isActive` - 加速筛选启用角色

#### 19. Permission（权限点表）

存储细粒度权限点定义。

| 字段           | 类型          | 约束                | 说明                                                           |
| -------------- | ------------- | ------------------- | -------------------------------------------------------------- |
| id             | String (UUID) | PK, default(uuid()) | 权限ID                                                         |
| permissionCode | String        | UNIQUE              | 权限代码（如：user.read）                                      |
| permissionName | String        | NOT NULL            | 权限名称                                                       |
| module         | String        | NOT NULL            | 所属模块：user / order / content / finance / merchant / system |
| type           | String        | NOT NULL            | 类型：menu / button / api                                      |
| createdAt      | DateTime      | default(now())      | 创建时间                                                       |
| updatedAt      | DateTime      | @updatedAt          | 更新时间                                                       |

**关系：**

- 与RolePermission：一对多

**索引：**

- `module` - 加速按模块查询权限
- `type` - 加速按类型查询权限

#### 20. RolePermission（角色权限关联表）

存储角色与权限的多对多关系。

| 字段         | 类型          | 约束                | 说明     |
| ------------ | ------------- | ------------------- | -------- |
| id           | String (UUID) | PK, default(uuid()) | 记录ID   |
| roleId       | String        | FK → Role.id        | 角色ID   |
| permissionId | String        | FK → Permission.id  | 权限ID   |
| createdAt    | DateTime      | default(now())      | 创建时间 |

**关系：**

- 与Role：多对一
- 与Permission：多对一

**约束：**

- `@@unique([roleId, permissionId])` - 防止重复分配

**索引：**

- `roleId` - 加速按角色查询权限
- `permissionId` - 加速按权限查询角色

#### 21. UserRole（用户角色关联表）

存储用户与角色的多对多关系。

| 字段      | 类型          | 约束                | 说明     |
| --------- | ------------- | ------------------- | -------- |
| id        | String (UUID) | PK, default(uuid()) | 记录ID   |
| userId    | String        | FK → User.id        | 用户ID   |
| roleId    | String        | FK → Role.id        | 角色ID   |
| createdAt | DateTime      | default(now())      | 创建时间 |

**关系：**

- 与User：多对一
- 与Role：多对一

**约束：**

- `@@unique([userId, roleId])` - 防止重复分配

**索引：**

- `userId` - 加速按用户查询角色
- `roleId` - 加速按角色查询用户

#### 22. PermissionAuditLog（权限审计日志表）

记录所有权限变更操作。

| 字段          | 类型          | 约束                | 说明                                                                                                                            |
| ------------- | ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| id            | String (UUID) | PK, default(uuid()) | 日志ID                                                                                                                          |
| operatorId    | String        | NOT NULL            | 操作人ID                                                                                                                        |
| operationType | String        | NOT NULL            | 操作类型：create_role / update_role / delete_role / assign_permission / remove_permission / assign_user_role / remove_user_role |
| targetType    | String        | NOT NULL            | 目标类型：role / permission / user                                                                                              |
| targetId      | String        | NOT NULL            | 目标ID                                                                                                                          |
| changes       | String        | nullable            | 变更内容（JSON格式）                                                                                                            |
| ip            | String        | nullable            | 操作IP                                                                                                                          |
| createdAt     | DateTime      | default(now())      | 创建时间                                                                                                                        |

**索引：**

- `operatorId` - 加速按操作人查询
- `createdAt` - 加速按时间查询

---

### 八、信用管理表

#### 23. CreditScore（信用分表）

存储用户当前信用分数。

| 字段        | 类型          | 约束                 | 说明            |
| ----------- | ------------- | -------------------- | --------------- |
| id          | String (UUID) | PK, default(uuid())  | 记录ID          |
| userId      | String        | UNIQUE, FK → User.id | 用户ID          |
| creditScore | Int           | default(100)         | 信用分（0-100） |
| lastUpdated | DateTime      | default(now())       | 最后更新时间    |

**关系：**

- 与User：一对一

**索引：**

- `creditScore` - 加速按信用分筛选

#### 24. CreditRecord（信用记录表）

存储信用分的变更历史。

| 字段           | 类型          | 约束                | 说明                           |
| -------------- | ------------- | ------------------- | ------------------------------ |
| id             | String (UUID) | PK, default(uuid()) | 记录ID                         |
| userId         | String        | FK → User.id        | 用户ID                         |
| changeAmount   | Int           | NOT NULL            | 变更数量（正数增加，负数减少） |
| reason         | String        | NOT NULL            | 变更原因                       |
| relatedOrderId | String        | nullable            | 关联订单ID                     |
| createdAt      | DateTime      | default(now())      | 创建时间                       |

**关系：**

- 与User：多对一

**索引：**

- `userId` - 加速按用户查询记录
- `createdAt` - 加速按时间排序

---

## 索引策略

### 当前索引汇总

| 表                 | 字段            | 类型   | 用途                  |
| ------------------ | --------------- | ------ | --------------------- |
| User               | phone           | B-tree | 唯一性约束 + 快速查找 |
| User               | userType        | B-tree | 用户类型筛选          |
| Provider           | certifiedSitter | B-tree | 筛选认证宠托师        |
| Pet                | ownerId         | B-tree | 按主人查询宠物        |
| Order              | ownerId         | B-tree | 按用户查询订单        |
| Order              | providerId      | B-tree | 按服务者查询订单      |
| Order              | status          | B-tree | 按状态筛选订单        |
| Order              | orderType       | B-tree | 按订单类型筛选        |
| OrderIntent        | orderId         | B-tree | 按订单查询意向        |
| OrderIntent        | providerId      | B-tree | 按提供者查询意向      |
| OrderSop           | orderId         | B-tree | 按订单查询SOP         |
| Review             | reviewerId      | B-tree | 按评价人查询          |
| Complaint          | complainantId   | B-tree | 按投诉人查询          |
| Complaint          | status          | B-tree | 按状态筛选投诉        |
| DisputeResolution  | resolverId      | B-tree | 按客服查询裁决        |
| Post               | authorId        | B-tree | 按作者查询帖子        |
| Post               | createdAt       | B-tree | 时间排序              |
| Comment            | postId          | B-tree | 按帖子查询评论        |
| Comment            | commenterId     | B-tree | 按评论人查询          |
| Follow             | followerId      | B-tree | 查询关注的人          |
| Follow             | followingId     | B-tree | 查询粉丝              |
| Favorite           | userId          | B-tree | 按用户查询收藏        |
| Favorite           | postId          | B-tree | 按帖子查询收藏者      |
| Notification       | userId          | B-tree | 按用户查询通知        |
| Notification       | isRead          | B-tree | 筛选未读通知          |
| Notification       | createdAt       | B-tree | 时间排序              |
| Role               | isActive        | B-tree | 筛选启用角色          |
| Permission         | module          | B-tree | 按模块查询权限        |
| Permission         | type            | B-tree | 按类型查询权限        |
| PermissionAuditLog | operatorId      | B-tree | 按操作人查询          |
| PermissionAuditLog | createdAt       | B-tree | 时间查询              |
| CreditScore        | creditScore     | B-tree | 按信用分筛选          |
| CreditRecord       | userId          | B-tree | 按用户查询记录        |
| CreditRecord       | createdAt       | B-tree | 时间排序              |

### 未来优化建议

1. **复合索引**：为高频组合查询添加复合索引
   - `Order(ownerId, status)` - 用户订单状态筛选
   - `Order(providerId, status)` - 服务者订单管理
   - `Post(authorId, createdAt DESC)` - 用户帖子时间倒序
   - `Notification(userId, isRead, createdAt)` - 未读通知查询

2. **全文搜索**：对大文本字段启用全文搜索
   - `Post.content` - 帖子内容搜索
   - `Pet.name` - 宠物名称模糊搜索
   - `User.nickname` - 用户昵称搜索

3. **分区策略**：对历史数据进行分区
   - `Order.createdAt` - 按月/年分区，提升查询性能
   - `CreditRecord.createdAt` - 按季度分区

---

## 迁移脚本说明

使用Prisma Migrate进行数据库迁移：

```bash
# 生成迁移文件
npx prisma migrate dev --name phase3_complete_schema

# 应用迁移
npx prisma migrate deploy

# 查看迁移历史
npx prisma migrate status
```

迁移文件位于：`apps/server/prisma/migrations/`

---

## 性能优化指南

### 查询优化

1. **避免N+1查询**：使用Prisma的`include`预加载关联数据
2. **分页查询**：使用`skip`和`take`进行分页
3. **选择性字段**：只查询需要的字段，使用`select`
4. **批量操作**：使用`createMany`、`updateMany`批量处理

### 缓存策略

1. **Redis缓存**：缓存热点数据（用户信息、宠物列表、热门帖子）
2. **CDN缓存**：静态资源（头像、宠物照片、社区媒体）
3. **API响应缓存**：不频繁变化的数据（权限配置、角色定义）

### 数据归档

1. **历史订单**：超过1年的订单归档到冷存储
2. **日志数据**：定期清理过期日志（权限审计日志保留90天）
3. **软删除**：使用`status`字段标记删除，定期物理清理

---

**最后更新**: 2026-07-16  
**维护者**: PetCare 后端团队  
**版本**: Phase 3 Complete
