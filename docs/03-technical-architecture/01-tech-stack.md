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

| 技术领域      | 技术选型                            | 版本   | 说明                                 |
| ------------- | ----------------------------------- | ------ | ------------------------------------ |
| **框架**      | Nest.js                             | 10.x   | 企业级Node.js框架                    |
| **语言**      | TypeScript                          | 5.x    | 类型安全                             |
| **ORM**       | **Prisma**                          | 7.8.x  | 类型安全的数据库工具链               |
| **数据库**    | PostgreSQL                          | 15.x   | 关系型数据库，JSONB支持              |
| **缓存**      | Redis                               | 7.x    | 会话、缓存、消息队列                 |
| **API文档**   | Swagger (OpenAPI)                   | 最新版 | 自动生成API文档                      |
| **认证授权**  | Passport.js + JWT                   | 最新版 | RBAC权限控制                         |
| **验证**      | class-validator + class-transformer | 最新版 | DTO验证                              |
| **日志**      | Winston + Pino                      | 最新版 | 结构化日志，高性能                   |
| **任务队列**  | BullMQ                              | 最新版 | 基于Redis的异步任务处理              |
| **文件存储**  | 腾讯云 COS（`cos-nodejs-sdk-v5`）   | -      | 管理员公开头像与官网公开素材对象存储 |
| **WebSocket** | @nestjs/websockets                  | -      | 实时通知、SOP进度推送                |
| **错误追踪**  | Sentry                              | 最新版 | 生产环境错误监控                     |

---

### 1.4 小程序端（Miniapp）

> **选型变更（2026-08-11）**：~~Taro 4.x + React 18 + MobX~~ 已弃用。项目只保留 Miniapp 客户端，其技术框架为 UniApp，以消除双客户端带来的重复依赖、构建链、样式门禁和文档维护；原 Taro 业务功能没有迁移。

| 技术领域     | 技术选型                           | 版本      | 说明                        |
| ------------ | ---------------------------------- | --------- | --------------------------- |
| **框架**     | UniApp                             | 3.x       | H5、小程序与 App 跨端框架   |
| **UI库**     | Vue + Wot UI                       | 3.x / 2.x | 统一跨端组件体系            |
| **语言**     | TypeScript                         | 5.x       | 类型安全                    |
| **样式**     | UnoCSS                             | 66.x      | 跨端原子化样式              |
| **HTTP请求** | UniApp 请求适配层                  | -         | 统一请求封装                |
| **地图SDK**  | 腾讯地图SDK                        | 最新版    | LBS定位、路线规划           |
| **图片上传** | `uni.chooseImage` + 服务端签发上传 | -         | 不向客户端暴露 COS 管理凭据 |
| **微信登录** | `uni.login` + code2Session         | -         | 微信授权登录                |
| **推送通知** | 微信订阅消息                       | -         | 订单状态通知                |

---

### 1.5 项目官网（Website）

| 技术领域     | 技术选型                | 版本 | 说明                                 |
| ------------ | ----------------------- | ---- | ------------------------------------ |
| **框架**     | Astro                   | 7.x  | 面向公开页面的服务端渲染             |
| **运行适配** | `@astrojs/node`         | 11.x | 构建独立 Node.js SSR 服务            |
| **样式方案** | Tailwind CSS            | 4.x  | 与 Admin 共用样式门禁规则            |
| **内容来源** | Website Content API     | -    | 仅读取已发布内容或带令牌的预览内容   |
| **类型契约** | `@petcare/shared-types` | -    | 复用官网区块、页面和文章契约         |
| **测试**     | Vitest + Astro Check    | 4.x  | 单元测试、渲染契约测试与模板类型检查 |

---

### 1.6 基础设施

| 领域         | 技术选型                                   | 说明                                                                    |
| ------------ | ------------------------------------------ | ----------------------------------------------------------------------- |
| **容器化**   | Docker + Docker Compose                    | 本地开发环境                                                            |
| **CI/CD**    | GitHub Actions                             | 自动化测试、构建、部署                                                  |
| **部署**     | Docker Compose（当前）/ Kubernetes（后续） | 当前以单区域容器化部署为主；服务拆分和多副本运行成熟后再引入 Kubernetes |
| **官网 SSR** | Astro SSR + `@astrojs/node`                | 独立 Website 容器；内部 `4321`，由独立 Nginx 网关公开                   |
| **静态托管** | Nginx                                      | Admin 静态前端独立部署，不与官网网关复用                                |
| **对象存储** | 腾讯云 COS                                 | 公开素材通过 `TENCENT_COS_PUBLIC_BASE_URL` 提供；密钥仅注入 Server      |
| **监控**     | Prometheus + Grafana                       | 后端指标监控                                                            |
| **日志聚合** | ELK Stack                                  | 日志收集分析                                                            |
| **域名解析** | 阿里云DNS / Cloudflare                     | DNS管理                                                                 |
| **SSL证书**  | Let's Encrypt                              | HTTPS加密                                                               |

---

## 数据库命名约定

Prisma 模型和字段在 TypeScript 中使用 PascalCase / camelCase，例如 `User.userType`；PostgreSQL 的物理表和列统一使用复数 `snake_case`，例如 `users.user_type`。通过 Prisma 的 `@@map` 和 `@map` 保持两者映射，业务代码不直接依赖物理数据库命名。

新建或调整数据库结构时，使用 Prisma CLI 执行 schema 同步或生成迁移；已有生产数据时必须先评估并执行迁移，不可直接重置数据库。

## 管理员公开头像存储

当前实现仅提供管理员个人中心的公开头像存储：Server 使用腾讯云 COS 将经过字节校验的 JPEG、PNG 或 WebP
文件（最大 2 MiB）写入 `public/admin-avatars/{userId}/`。COS 五项配置均留空时采取 fail-closed 策略：头像上传返回
`503 STORAGE_UNAVAILABLE`，但个人资料和密码接口继续可用；部分配置会使 Server 在启动前失败。

生产环境使用独立的公开读、私有写 Bucket 与最小权限子账号。Bucket 使用 `BucketName-APPID` 格式，Region 使用
`ap-guangzhou` 等 COS 代码；可选的公开基础 URL 可替代 COS 默认访问域名。此能力不是通用图片上传服务，未提供
`/uploads/images` 或客户端直传接口。
