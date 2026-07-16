## 二、Monorepo目录结构

```
petcare-monorepo/
├── apps/                          # 应用层
│   ├── admin/                     # 后台管理系统
│   │   ├── src/
│   │   │   ├── components/        # 通用组件
│   │   │   ├── pages/             # 页面组件
│   │   │   ├── hooks/             # 自定义Hooks
│   │   │   ├── stores/            # Zustand状态管理
│   │   │   ├── services/          # API服务层
│   │   │   ├── utils/             # 工具函数
│   │   │   └── App.tsx
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── tailwind.config.js
│   │
│   ├── miniapp/                   # 小程序端
│   │   ├── src/
│   │   │   ├── pages/             # 页面
│   │   │   ├── components/        # 组件
│   │   │   ├── stores/            # MobX状态管理
│   │   │   ├── services/          # API服务
│   │   │   ├── utils/             # 工具函数
│   │   │   └── app.ts
│   │   ├── config/                # Taro配置
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api/                       # 后端API服务
│       ├── src/
│       │   ├── modules/           # 功能模块
│       │   │   ├── auth/          # 认证模块
│       │   │   ├── user/          # 用户模块
│       │   │   ├── order/         # 订单模块
│       │   │   ├── community/     # 社区模块
│       │   │   ├── payment/       # 支付模块
│       │   │   └── admin/         # 后台管理模块
│       │   ├── common/            # 公共模块
│       │   │   ├── decorators/    # 装饰器
│       │   │   ├── filters/       # 异常过滤器
│       │   │   ├── guards/        # 守卫（RBAC）
│       │   │   ├── interceptors/  # 拦截器
│       │   │   └── pipes/         # 管道
│       │   ├── config/            # 配置文件
│       │   ├── prisma/            # Prisma Schema和迁移
│       │   └── main.ts
│       ├── prisma/
│       │   ├── schema.prisma      # 数据库Schema
│       │   └── migrations/        # 数据库迁移
│       ├── package.json
│       ├── tsconfig.json
│       └── nest-cli.json
│
├── packages/                      # 共享包
│   ├── shared-types/              # ⭐ 共享类型定义
│   │   ├── src/
│   │   │   ├── api/               # API接口类型
│   │   │   │   ├── request.ts     # 请求类型
│   │   │   │   ├── response.ts    # 响应类型
│   │   │   │   ├── user.ts        # 用户相关
│   │   │   │   ├── order.ts       # 订单相关
│   │   │   │   ├── pet.ts         # 宠物相关
│   │   │   │   ├── community.ts   # 社区相关
│   │   │   │   └── index.ts       # 统一导出
│   │   │   ├── models/            # 数据模型类型
│   │   │   ├── enums/             # 枚举定义
│   │   │   └── index.ts           # 统一导出
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared-utils/              # 共享工具函数
│   │   ├── src/
│   │   │   ├── date.ts            # 日期处理
│   │   │   ├── string.ts          # 字符串处理
│   │   │   ├── validate.ts        # 验证工具
│   │   │   ├── format.ts          # 格式化工具
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api-client/                # ⭐ API客户端封装
│   │   ├── src/
│   │   │   ├── http.ts            # Axios实例配置
│   │   │   ├── interceptors.ts    # 请求/响应拦截器
│   │   │   ├── endpoints/         # API端点定义
│   │   │   │   ├── user.ts
│   │   │   │   ├── order.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts           # 统一导出
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── eslint-config/             # 统一ESLint配置
│       ├── index.js
│       └── package.json
│
├── pnpm-workspace.yaml            # pnpm工作区配置
├── turbo.json                     # Turborepo配置
├── package.json                   # 根package.json
├── .gitignore
└── README.md
```

---

## 三、共享类型定义方案（重点）

### 3.1 可行性分析

**✅ 完全可行！** 这是Monorepo的核心优势之一。

**实现方式**：

1. 在 `packages/shared-types` 中定义所有API接口的TypeScript类型
2. 后端使用这些类型生成DTO和Response
3. 前端（Admin + Miniapp）直接导入使用
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

#### 示例1：用户相关类型

```typescript
// packages/shared-types/src/api/user.ts

/**
 * 用户角色枚举
 */
export enum UserRole {
  PET_OWNER = "pet_owner",
  SERVICE_PROVIDER = "service_provider",
  ADMIN = "admin",
}

/**
 * 用户基本信息
 */
export interface User {
  id: string;
  nickname: string;
  avatar?: string;
  phone: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

/**
 * 注册请求
 */
export interface RegisterRequest {
  phone: string;
  code: string; // 短信验证码
  nickname: string;
  avatar?: string;
}

/**
 * 注册响应
 */
export interface RegisterResponse {
  user: User;
  token: string;
  refreshToken: string;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  phone: string;
  code: string;
}

/**
 * 登录响应（同注册响应）
 */
export type LoginResponse = RegisterResponse;

/**
 * 获取用户详情响应
 */
export interface GetUserResponse {
  user: User;
}

/**
 * 更新用户资料请求
 */
export interface UpdateUserRequest {
  nickname?: string;
  avatar?: string;
}
```

#### 示例2：订单相关类型

```typescript
// packages/shared-types/src/api/order.ts

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
  status?: OrderStatus;
  orderType?: OrderType;
  startDate?: string;
  endDate?: string;
}

/**
 * 订单列表响应
 */
export interface OrderListResponse {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
}
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
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

---

### 3.3 后端使用共享类型

```typescript
// apps/api/src/modules/user/dto/register.dto.ts

import { RegisterRequest } from "@petcare/shared-types";
import { IsString, IsMobilePhone, Length } from "class-validator";

// 继承共享类型，添加验证装饰器
export class RegisterDto implements RegisterRequest {
  @IsMobilePhone("zh-CN")
  phone: string;

  @IsString()
  @Length(6, 6)
  code: string;

  @IsString()
  @Length(2, 20)
  nickname: string;

  @IsString()
  @Length(0, 200)
  avatar?: string;
}
```

```typescript
// apps/api/src/modules/user/user.controller.ts

import { Controller, Post, Body } from "@nestjs/common";
import { RegisterRequest, RegisterResponse, ApiResponse } from "@petcare/shared-types";
import { successResponse } from "@petcare/shared-types";

@Controller("users")
export class UserController {
  @Post("register")
  async register(@Body() dto: RegisterRequest): Promise<ApiResponse<RegisterResponse>> {
    const result = await this.userService.register(dto);
    return successResponse(result);
  }
}
```

---

### 3.4 前端使用共享类型

```typescript
// apps/admin/src/services/user.service.ts

import axios from "axios";
import { RegisterRequest, RegisterResponse, ApiResponse } from "@petcare/shared-types";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const response = await apiClient.post<ApiResponse<RegisterResponse>>("/users/register", data);

  if (response.data.code !== 200) {
    throw new Error(response.data.message);
  }

  return response.data.data!;
}
```

```typescript
// apps/admin/src/pages/RegisterPage.tsx

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { register } from '@/services/user.service';
import type { RegisterRequest } from '@petcare/shared-types';

const schema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/),
  code: z.string().length(6),
  nickname: z.string().min(2).max(20),
});

export default function RegisterPage() {
  const { register: formRegister, handleSubmit } = useForm<RegisterRequest>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: RegisterRequest) => {
    try {
      const result = await register(data);
      console.log('注册成功', result);
    } catch (error) {
      console.error('注册失败', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* 表单内容 */}
    </form>
  );
}
```

---

### 3.5 类型同步流程

**最佳实践**：

1. 后端修改API接口时，同步更新 `packages/shared-types`
2. 提交前运行 `pnpm build` 检查类型是否一致
3. CI流程中加入类型检查步骤
4. 重大类型变更使用语义化版本号（breaking change升主版本）
