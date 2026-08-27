## 二、Monorepo目录结构

旧 Taro + React 跨端客户端已删除。现行 Miniapp 跨端客户端统一位于 `apps/miniapp/`；项目官网位于 `apps/website/`，使用 Astro SSR。

```
petcare/
├── apps/
│   ├── admin/                # React + Vite 后台管理
│   │   └── src/
│   │       ├── api/          # 按业务域组织的 HTTP 调用
│   │       ├── components/   # 通用组件
│   │       ├── pages/        # 页面模块
│   │       └── routes/       # 集中路由登记
│   ├── miniapp/              # UniApp 跨端客户端
│   │   ├── src/pages/        # 页面
│   │   └── uno.config.ts     # UnoCSS 配置
│   ├── server/               # NestJS API 与 Prisma
│   │   ├── prisma/           # Schema、迁移与 seed
│   │   └── src/modules/      # 领域模块
│   └── website/              # Astro SSR 项目官网
│       └── src/
│           ├── components/   # 页面与预设区块渲染器
│           ├── layouts/      # 公共页、文章页与预览布局
│           ├── lib/          # API、缓存和运行时配置
│           └── pages/        # 官网路由
├── packages/
│   ├── api-client/           # 共享 API 客户端
│   ├── eslint-config-base/   # 共享 ESLint 配置
│   ├── shared-types/         # 请求、响应与业务类型契约
│   └── shared-utils/         # 共享工具函数
├── docs/                     # 项目文档
├── package.json              # 根工作区脚本
├── pnpm-workspace.yaml       # pnpm 工作区配置
└── turbo.json                # Turborepo 任务配置
```

---

## 三、共享类型定义方案（重点）

### 3.1 可行性分析

**✅ 完全可行！** 这是Monorepo的核心优势之一。

**实现方式**：

1. 在 `packages/shared-types` 中定义所有API接口的TypeScript类型
2. 后端使用这些类型生成DTO和Response
3. Admin、Miniapp、Website 与 Server 直接导入使用
4. 通过pnpm workspace链接，实现热更新

**优势**：

- ✅ **类型安全**：前后端共享同一份类型定义，编译时即可发现不匹配
- ✅ **减少重复代码**：无需在前后端分别维护相同的接口类型
- ✅ **自动同步**：后端修改接口类型，前端立即感知（需重新构建）
- ✅ **开发体验好**：IDE自动补全、类型提示、跳转定义

**注意事项**：

- ⚠️ 后端Swagger文档仍需维护（用于API调试和第三方对接）
- ⚠️ 类型变更需考虑向后兼容，避免破坏性更新
- ⚠️ 敏感字段（如密码、token）不应暴露在shared-types中

---

### 3.2 类型定义示例

#### 示例1：公开用户资料类型

```typescript
// packages/shared-types/src/api/user.ts

/** 公开资料中可安全展示的用户字段。 */
export interface PublicUser {
  id: string;
  nickname: string;
  avatar: string | null;
  userType: string;
  status: "active";
  profile: {
    region: string | null;
    bio: string | null;
  } | null;
}
```

个人版不提供通用手机号注册契约。Admin 使用 `/auth/login/password` 或
`/auth/login/sms`，Miniapp 使用 `/auth/wechat/login` 建立会话；手机号绑定由受保护的
`/users/me/phone` 完成。

#### 示例2：订单相关类型

```typescript
// packages/shared-types/src/api/order.ts

import type { PaginatedResponse } from "./response";

/**
 * 订单类型枚举
 */
export enum OrderType {
  REWARD = "reward", // 悬赏订单
  PLATFORM = "platform", // 平台定价订单
}

/**
 * 订单状态枚举
 */
export enum OrderStatus {
  PENDING_CONFIRM = "pending_confirm", // 待确认
  CONFIRMED = "confirmed", // 已确认
  IN_PROGRESS = "in_progress", // 服务中
  COMPLETED = "completed", // 已完成
  CANCELLED = "cancelled", // 已取消
  DISPUTED = "disputed", // 纠纷中
}

/**
 * 服务类型枚举
 */
export enum ServiceType {
  FEEDING = "feeding", // 上门喂养
  WALKING = "walking", // 遛狗
  PLAYING = "playing", // 陪玩
}

/**
 * 订单基本信息
 */
export interface Order {
  id: string;
  orderType: OrderType;
  serviceType: ServiceType;
  ownerId: string;
  providerId?: string;
  petId: string;
  serviceTime: string;
  amount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建悬赏订单请求
 */
export interface CreateRewardOrderRequest {
  serviceType: ServiceType;
  petId: string;
  serviceTime: string;
  rewardAmount: number;
  address: string;
  remark?: string;
}

/**
 * 创建悬赏订单响应
 */
export interface CreateRewardOrderResponse {
  order: Order;
}

/**
 * 订单列表查询参数
 */
export interface OrderListQuery {
  page: number;
  pageSize: number;
}

/**
 * 匿名可浏览的悬赏订单列表响应
 */
export type PublicOrderListResponse = PaginatedResponse<PublicOrder>;

/** @deprecated Use PublicOrderListResponse. */
export type OrderListResponse = PublicOrderListResponse;
```

#### 示例3：统一响应格式

```typescript
// packages/shared-types/src/api/response.ts

/**
 * 统一API响应格式
 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}

/**
 * 成功响应快捷方法
 */
export function successResponse<T>(data: T, message = "success"): ApiResponse<T> {
  return {
    code: 200,
    message,
    data,
  };
}

/**
 * 错误响应快捷方法
 */
export function errorResponse(message: string, code = 400): ApiResponse {
  return {
    code,
    message,
  };
}

/**
 * 分页响应格式
 */
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

---

### 3.3 后端使用共享类型

```typescript
// apps/server/src/modules/user/user.controller.ts

import { Controller, Get, Param } from "@nestjs/common";
import type { PublicUser } from "@petcare/shared-types";

@Controller("users")
export class UserController {
  @Get(":id")
  findOne(@Param("id") id: string): Promise<PublicUser> {
    return this.userService.findOne(id);
  }
}
```

---

### 3.4 前端使用共享类型

```typescript
// packages/api-client/src/endpoints/user.ts

import type { PublicUser } from "@petcare/shared-types";

export async function getUserDetail(userId: string): Promise<PublicUser> {
  return apiClient.get(`/users/${userId}`);
}
```

---

### 3.5 类型同步流程

**最佳实践**：

1. 后端修改API接口时，同步更新 `packages/shared-types`
2. 提交前运行 `pnpm build` 检查类型是否一致
3. CI流程中加入类型检查步骤
4. 重大类型变更使用语义化版本号（breaking change升主版本）
