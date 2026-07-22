# PetCare宠伴 - 技术架构设计文档

> 架构基线：MVP 使用“模块化单体 + PostgreSQL + Redis/BullMQ Worker”。领域模块保持独立边界，并在满足明确的容量、合规或团队自治条件后逐步拆分。详见 [架构演进决策](./03-architecture-evolution.md)。

## 文档信息

| 项目       | 内容        |
| ---------- | ----------- |
| 项目名称   | PetCare宠伴 |
| 文档版本   | v1.0        |
| 创建日期   | 2026-07-15  |
| 技术负责人 | TBD         |
| 架构师     | TBD         |

---

## 一、技术栈选型

### 1.1 Monorepo架构

**核心工具**：

- **Turborepo**：高性能Monorepo构建系统，智能缓存
- **pnpm**：包管理器（快速、节省磁盘空间）
- **TypeScript**：全栈类型安全

**优势**：

- 代码复用率高（共享类型、工具函数、API客户端）
- 统一的依赖管理和版本控制
- 原子化提交，便于团队协作
- 增量构建，提升CI/CD效率

---

### 1.2 后台管理系统（Admin）

| 技术领域       | 技术选型                 | 版本   | 说明                                   |
| -------------- | ------------------------ | ------ | -------------------------------------- |
| **框架**       | React                    | 19.x   | 最新稳定版，并发渲染优化               |
| **构建工具**   | Vite                     | 5.x    | 极速开发体验，HMR快                    |
| **UI组件库**   | **shadcn/ui**            | 最新版 | 基于Radix UI + TailwindCSS，高度可定制 |
| **样式方案**   | TailwindCSS              | 3.x    | 原子化CSS，与shadcn完美集成            |
| **图标库**     | Lucide React             | 最新版 | 简洁现代的图标系统                     |
| **状态管理**   | TanStack Query + Zustand | 最新版 | 服务端状态用Query，客户端状态用Zustand |
| **路由**       | React Router             | 6.x    | 声明式路由                             |
| **HTTP客户端** | Axios + TanStack Query   | 最新版 | 数据获取、缓存、重试                   |
| **表单处理**   | React Hook Form + Zod    | 最新版 | 类型安全表单验证                       |
| **图表**       | ECharts                  | 5.x    | 数据可视化                             |
| **代码规范**   | ESLint + Prettier        | 最新版 | 统一代码风格                           |

---

### 1.3 后端API服务

| 技术领域      | 技术选型                            | 版本   | 说明                    |
| ------------- | ----------------------------------- | ------ | ----------------------- |
| **框架**      | Nest.js                             | 10.x   | 企业级Node.js框架       |
| **语言**      | TypeScript                          | 5.x    | 类型安全                |
| **ORM**       | **Prisma**                          | 7.8.x  | 类型安全的数据库工具链  |
| **数据库**    | PostgreSQL                          | 15.x   | 关系型数据库，JSONB支持 |
| **缓存**      | Redis                               | 7.x    | 会话、缓存、消息队列    |
| **API文档**   | Swagger (OpenAPI)                   | 最新版 | 自动生成API文档         |
| **认证授权**  | Passport.js + JWT                   | 最新版 | RBAC权限控制            |
| **验证**      | class-validator + class-transformer | 最新版 | DTO验证                 |
| **日志**      | Winston + Pino                      | 最新版 | 结构化日志，高性能      |
| **任务队列**  | BullMQ                              | 最新版 | 基于Redis的异步任务处理 |
| **文件存储**  | MinIO / 阿里云OSS                   | -      | 对象存储                |
| **WebSocket** | @nestjs/websockets                  | -      | 实时通知、SOP进度推送   |
| **错误追踪**  | Sentry                              | 最新版 | 生产环境错误监控        |

---

### 1.4 小程序端（Miniapp）

| 技术领域     | 技术选型                    | 版本     | 说明                         |
| ------------ | --------------------------- | -------- | ---------------------------- |
| **框架**     | Taro                        | 4.x      | 多端统一开发框架             |
| **UI库**     | React                       | **18.x** | 稳定版，确保Taro兼容性       |
| **语言**     | TypeScript                  | 5.x      | 类型安全                     |
| **状态管理** | MobX                        | 6.x      | Taro官方推荐，响应式状态管理 |
| **HTTP请求** | Taro.request + 自定义拦截器 | -        | 统一请求封装                 |
| **地图SDK**  | 腾讯地图SDK                 | 最新版   | LBS定位、路线规划            |
| **图片上传** | Taro.chooseImage + OSS直传  | -        | 高效图片上传                 |
| **微信登录** | Taro.login + code2Session   | -        | 微信授权登录                 |
| **推送通知** | 微信订阅消息                | -        | 订单状态通知                 |

---

### 1.5 基础设施

| 领域         | 技术选型                                   | 说明                                                                    |
| ------------ | ------------------------------------------ | ----------------------------------------------------------------------- |
| **容器化**   | Docker + Docker Compose                    | 本地开发环境                                                            |
| **CI/CD**    | GitHub Actions                             | 自动化测试、构建、部署                                                  |
| **部署**     | Docker Compose（当前）/ Kubernetes（后续） | 当前以单区域容器化部署为主；服务拆分和多副本运行成熟后再引入 Kubernetes |
| **静态托管** | Vercel / Nginx                             | Admin前端部署                                                           |
| **监控**     | Prometheus + Grafana                       | 后端指标监控                                                            |
| **日志聚合** | ELK Stack                                  | 日志收集分析                                                            |
| **域名解析** | 阿里云DNS / Cloudflare                     | DNS管理                                                                 |
| **SSL证书**  | Let's Encrypt                              | HTTPS加密                                                               |

---

## 数据库命名约定

Prisma 模型和字段在 TypeScript 中使用 PascalCase / camelCase，例如 `User.userType`；PostgreSQL 的物理表和列统一使用复数 `snake_case`，例如 `users.user_type`。通过 Prisma 的 `@@map` 和 `@map` 保持两者映射，业务代码不直接依赖物理数据库命名。

新建或调整数据库结构时，使用 Prisma CLI 执行 schema 同步或生成迁移；已有生产数据时必须先评估并执行迁移，不可直接重置数据库。
