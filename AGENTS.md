# PetCare 项目 AI 助手指南

本文档为所有 AI 助手提供项目背景、开发规范和必读文档指引。

## 📋 项目概览

**PetCare宠伴** - 个人、非商业、可本地验收的宠物内容与档案原型

服务者认证、悬赏交易、支付结算等商业能力仅保留为未来设计资料，不属于当前产品或默认运行范围。

### 技术栈

- **Monorepo**: Turborepo + pnpm workspaces
- **Admin前端**: React 19 + Vite + shadcn/ui + TailwindCSS
- **项目官网**: Astro SSR + TailwindCSS
- **后端服务**: Nest.js + Prisma + PostgreSQL + Redis
- ~~**小程序**: Taro 4.x + React 18 + MobX（已弃用）~~
- **跨端客户端**: Miniapp 项目（UniApp + Vue 3 + Wot UI + UnoCSS）
- **测试**: Vitest（单元测试）+ Playwright（E2E测试）

### 项目结构

```

> **Taro 弃用说明（2026-08-11）**：项目不再同时维护 Taro 与 UniApp 两套跨端客户端。双项目会重复承担依赖升级、构建配置、样式门禁和文档维护成本，因此删除原 Taro 客户端，后续功能只在 `apps/miniapp` 实现。此决定是工程收敛，并不表示 Taro 框架本身不可用；原 Taro 功能未迁移，不能视为当前 Miniapp 已具备同等业务能力。
petcare/
├── apps/                    # 应用层
│   ├── admin/              # 后台管理系统（React + Vite）
│   ├── website/            # 项目官网（Astro SSR）
│   ├── server/             # 后端服务（Nest.js）
│   └── miniapp/            # UniApp 跨端客户端
├── packages/               # 共享包
│   ├── eslint-config-base/ # 共享ESLint配置
│   ├── shared-types/       # 共享类型定义
│   ├── shared-utils/       # 共享工具函数
│   └── api-client/         # API客户端封装
├── docs/                   # 项目文档
└── docker/                 # Docker配置
```

## ⚙️ 环境配置

### Node.js 版本

- **锁定版本**: 24.19.0（见 `.nvmrc`）
- **要求**: >= 24.12.0 且 < 25

### 环境变量配置

项目使用**独立配置变量**而非连接字符串：

**数据库配置**（Prisma需要拼接为完整URL）：

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_NAME=petcare
DB_SCHEMA=public
```

**Redis配置**：

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # 可选
```

**其他配置**：JWT、API_BASE_URL、第三方服务等

详见：[环境变量配置指南](./docs/environment-variables.md)

### 配置文件位置

- `.env.example` - 环境变量示例（根目录）
- `.env` - 本地与 Docker 共用的实际配置（不提交 Git）

## 🛠️ 开发规范

### 代码风格

- **引号**: 双引号（`"`）
- **分号**: 必须使用
- **缩进**: 2空格
- **行尾**: LF（Unix风格）
- **导入顺序**: 外部库 → 内部模块 → 相对路径

### ESLint 配置

- **共享配置**: `@petcare/eslint-config-base`（packages/eslint-config-base）
- **所有子项目**: 继承共享配置
- **根目录**: 独立配置（仅 lint 根级文件）

### 样式规范

- ~~Admin 与 Miniapp 均使用 Tailwind CSS v4 CSS-first；Miniapp 使用 Taro 专属 WXSS 门禁。~~
- Admin 使用 Tailwind CSS v4 CSS-first，默认字号为 `14px`
- Website 使用 Tailwind CSS v4 CSS-first，样式入口位于 `apps/website/src/styles/global.css`
- Miniapp 使用 UniApp、UnoCSS 与 Wot UI，样式配置位于 `apps/miniapp/uno.config.ts`
- Admin 优先直接使用 Tailwind 工具类，只有 Tailwind 无法合理表达时才使用独立 SCSS
- Tailwind 入口使用普通 CSS；SCSS 禁止 `@theme`、`@tailwind` 和 `@apply`
- Admin 样式变更必须通过 `pnpm lint:styles` 和生产构建

详见：[Admin 样式开发规范](./docs/09-development-guidelines/04-styling-standards.md)

### 前端目录与 API 契约

- 请求参数和响应类型统一定义在 `@petcare/shared-types`，前后端禁止重复声明。
- Admin API 调用统一放在 `apps/admin/src/api/`，并按业务域拆分。
- 页面使用模块目录，默认页为 `index.tsx`，编辑页为 `Edit.tsx`，详情页为 `Detail.tsx`。
- 共享类型的每个字段、业务值以及公共函数必须包含说明用途的 JSDoc。

详见：[前端目录与 API 契约规范](./docs/09-development-guidelines/05-frontend-structure-and-api-contracts.md)

### 个人开发版范围与代码清理

- 当前任务只能来自 `docs/01-requirements/05-development-roadmap.md` 的个人开发版队列；未来 PRD、历史原型、已有页面或 Server 模块不能自行授权扩展商业能力。
- 服务者认证、悬赏/接单、SOP、支付退款、结算提现、钱包和 B2C 派单属于暂停范围，不得重新加入当前导航、公开路由、默认种子内容或演示数据。
- 商业残留先移除入口和默认运行时注册，再删除无消费者代码；Prisma Schema、已提交 migration 与运行数据必须单独审计和迁移，禁止在普通清理中顺带删除。

详见：[个人开发版范围与代码清理规范](./docs/09-development-guidelines/06-personal-scope-and-code-cleanup.md)

### Git Hooks

- **Husky**: 自动执行 pre-commit hooks
- **lint-staged**: 仅检查暂存文件
- **Prettier**: 提交前自动格式化
- **ESLint**: 提交前自动修复

### Commit 规范

遵循 Conventional Commits：

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试相关
chore: 构建/工具链
```

提交说明正文建议优先使用中文，除非需要保留通用的英文关键字、技术名称或工具名称。

### 主线线性历史

- `master` 必须永久保持线性历史，禁止任何 merge commit。
- 本地集成只能使用 rebase 后的 `git merge --ff-only`；拉取使用 rebase，禁止普通 `git merge` 和产生合并提交的 `git pull`。
- GitHub PR 只能使用 **Rebase and merge** 或 **Squash and merge**，禁止 **Create a merge commit**。
- 推送主线前必须确认 `git rev-list --min-parents=2 master` 无输出。

## 🏗️ 后端架构规范

### ConfigService 使用规范

**所有配置必须通过 ConfigService 访问**，禁止直接使用 `process.env`。

**核心文件**：

- `apps/server/src/config/config.service.ts` - 配置服务实现
- `apps/server/src/config/config.module.ts` - 全局配置模块（@Global）

**使用方式**：

```typescript
// 1. Module中导入ConfigModule
import { ConfigModule } from "../../config/config.module";

@Module({
  imports: [ConfigModule],
  // ...
})

// 2. Service中注入ConfigService
constructor(private configService: ConfigService) {}

// 3. 通过getter方法访问
const dbUrl = this.configService.databaseUrl;
const jwtSecret = this.configService.jwtSecret;
```

**优势**：

- ✅ 类型安全
- ✅ 默认值集中管理
- ✅ 易于测试（可mock）
- ✅ 统一配置入口

### Prisma 配置

Prisma 需要完整的 `DATABASE_URL` 连接字符串，由 ConfigService 自动拼接：

```typescript
// ConfigService.databaseUrl 会自动拼接：
// postgresql://${username}:${password}@${host}:${port}/${name}?schema=${schema}
```

### Redis 服务

参考 `apps/server/src/config/redis.service.ts` 实现 Redis 客户端初始化。

## 🧪 测试规范

### 单元测试

- **框架**: Vitest
- **位置**: 各模块的 `*.spec.ts` 文件
- **运行**: `pnpm test`

### E2E 测试

- **框架**: Playwright（仅 Chromium）
- **位置**: `apps/admin/e2e/`
- **配置**: `apps/admin/playwright.config.ts`
- **运行**: `pnpm test:e2e`

**注意**：首次运行需安装浏览器：

```bash
cd apps/admin
pnpm exec playwright install chromium
```

## 📦 常用命令

```bash
# 安装依赖
pnpm install

# 启动开发环境
pnpm dev                    # 所有应用
pnpm dev --filter=server    # 仅后端

# 构建
pnpm build
pnpm build --filter=admin

# 代码质量
pnpm format                 # 格式化
pnpm lint                   # 检查
pnpm lint --fix             # 自动修复

# 测试
pnpm test                   # 单元测试
pnpm test:e2e              # E2E测试
```

## 📚 必读文档

### 核心文档（按优先级）

1. **[README.md](./README.md)** - 项目概览和快速开始
2. **[docs/01-requirements/05-development-roadmap.md](./docs/01-requirements/05-development-roadmap.md)** - 当前状态、任务顺序与周期
3. **[docs/INDEX.md](./docs/INDEX.md)** - 完整文档索引 📚
4. **[docs/environment-variables.md](./docs/environment-variables.md)** - 环境变量配置详解
5. **[docs/06-api-specification/01-api-specification.md](./docs/06-api-specification/01-api-specification.md)** - API接口规范 📡
6. **[docs/08-deployment/deployment.md](./docs/08-deployment/deployment.md)** - 完整部署指南 ⭐
7. **[docs/01-requirements/01-prd.md](./docs/01-requirements/01-prd.md)** - 产品需求文档
8. **[docs/01-requirements/04-prototype-specification.md](./docs/01-requirements/04-prototype-specification.md)** - 原型规格文档(v47)
9. **[docs/03-technical-architecture/01-tech-stack.md](./docs/03-technical-architecture/01-tech-stack.md)** - 技术架构说明
10. **[docs/09-development-guidelines/02-development-standards.md](./docs/09-development-guidelines/02-development-standards.md)** - 开发规范详细版
11. **[docs/09-development-guidelines/06-personal-scope-and-code-cleanup.md](./docs/09-development-guidelines/06-personal-scope-and-code-cleanup.md)** - 个人版范围、代码清理和验收边界

### 安全相关

- **[SECURITY-AUDIT.md](./SECURITY-AUDIT.md)** - 安全审计报告
- **[SECURITY-CHECKLIST.md](./SECURITY-CHECKLIST.md)** - 生产环境安全检查清单

### 其他文档

- **[docs/01-requirements/02-user-stories.md](./docs/01-requirements/02-user-stories.md)** - 用户故事
- **[apps/admin/e2e/README.md](./apps/admin/e2e/README.md)** - E2E测试指南
- **[docs/08-deployment/deployment-architecture.html](./docs/08-deployment/deployment-architecture.html)** - 交互式部署架构图 🎨
- **[docker/README.md](./docker/README.md)** - Docker Compose使用指南

## 🚫 禁止事项

1. **不要直接读取 `process.env`** - 必须通过 ConfigService
2. **不要提交根目录 `.env`** - 该文件包含本地配置和敏感信息
3. **不要跳过 lint 检查** - 提交前必须通过 lint
4. **不要硬编码配置值** - 所有配置应从环境变量读取
5. **不要手动修改 prisma/migrations/** - 使用 Prisma CLI 生成
6. **不要从未来 PRD 或历史页面恢复商业需求** - 任务必须先进入当前路线图
7. **不要在普通代码清理中删除 Schema、migration 或运行数据** - 必须单独审计和迁移

## 🔧 Docker 部署

项目提供完整的容器化部署方案：

**配置文件位置：**

- `Dockerfile.server` - 后端服务（根目录）
- `Dockerfile.admin` - 后台管理（根目录）
- `Dockerfile.website` - Astro SSR 官网（根目录）
- `docker-compose.yml` - 多容器编排（根目录）
- `docker/nginx.conf` - Nginx配置（docker目录）
- `docker/website-nginx.conf` - 官网独立网关配置（docker目录）

**为什么Dockerfile在根目录？**

- Docker标准做法：`docker build`默认在构建上下文根目录查找Dockerfile
- 便于CI/CD集成和一键构建
- docker-compose.yml也在根目录，统一管理

**核心特性：**

- ✅ Redis密码认证（--requirepass）
- ✅ 端口暴露环境变量控制（EXPOSE_DB_PORT / EXPOSE_REDIS_PORT）
- ✅ CORS动态配置（ALLOWED_ORIGINS）
- ✅ 生产环境禁用Swagger UI
- ✅ JWT密钥强度验证（≥32字符）
- ✅ 健康检查机制（所有服务）
- ✅ 资源限制（CPU/Memory）
- ✅ 数据持久化（Volumes + Logs挂载）

**快速启动：**

```bash
# 开发环境
cp .env.example .env
docker compose --env-file .env up -d --build

# 生产环境（不暴露数据库端口）
# 在 .env 中设置: EXPOSE_DB_PORT= EXPOSE_REDIS_PORT=
docker compose --env-file .env up -d
```

**访问地址：**

- Admin前端: http://localhost:8986
- Website官网: http://localhost:8080（Docker Compose）/ http://localhost:4321（本地开发）
- API服务: http://localhost:3000
- API文档: http://localhost:3000/api-docs（仅宿主机非生产环境）

详见：

- [完整部署指南](./docs/08-deployment/deployment.md) ⭐
- [交互式架构图](./docs/08-deployment/deployment-architecture.html) 🎨
- [安全审计报告](./SECURITY-AUDIT.md)
- [安全检查清单](./SECURITY-CHECKLIST.md)

## 🤝 协作提示

- **代码审查**: 关注配置访问方式是否正确
- **新增功能**: 优先查看现有模块的实现模式
- **配置变更**: 同步更新 `.env.example` 和 `docs/environment-variables.md`
- **文档更新**: 重要变更后更新相关文档

## Agent 技能配置

### Issue 跟踪系统

项目工作项统一使用 GitHub Issues 管理。详细约定参见 `docs/agents/issue-tracker.md`。

### Triage 标签

项目使用五个默认分流标签。详细映射参见 `docs/agents/triage-labels.md`。

### 领域文档

项目采用多上下文布局，由根目录 `CONTEXT-MAP.md` 索引各应用和共享包的领域文档。详细约定参见 `docs/agents/domain.md`。

---

**最后更新**: 2026-08-27
**维护者**: PetCare 开发团队
