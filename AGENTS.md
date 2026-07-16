# PetCare 项目 AI 助手指南

本文档为所有 AI 助手提供项目背景、开发规范和必读文档指引。

## 📋 项目概览

**PetCare宠伴** - 双模式O2O宠物服务平台（C2C悬赏 + B2C平台定价）

### 技术栈

- **Monorepo**: Turborepo + pnpm workspaces
- **Admin前端**: React 19 + Vite + shadcn/ui + TailwindCSS
- **后端服务**: Nest.js + Prisma + PostgreSQL + Redis
- **小程序**: Taro 4.x + React 18 + MobX
- **测试**: Vitest（单元测试）+ Playwright（E2E测试）

### 项目结构

```
petcare/
├── apps/                    # 应用层
│   ├── admin/              # 后台管理系统（React + Vite）
│   ├── server/             # 后端服务（Nest.js）
│   └── miniapp/            # 小程序端（Taro）
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

- **锁定版本**: 22（见 `.nvmrc`）
- **要求**: >= 20.0.0

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
- `apps/server/.env.local` - 后端实际配置（不提交Git）

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
2. **[docs/INDEX.md](./docs/INDEX.md)** - 完整文档索引 📚
3. **[docs/environment-variables.md](./docs/environment-variables.md)** - 环境变量配置详解
4. **[docs/06-api-specification/api-specification.md](./docs/06-api-specification/api-specification.md)** - API接口规范 📡
5. **[docs/08-deployment/deployment.md](./docs/08-deployment/deployment.md)** - 完整部署指南 ⭐
6. **[docs/01-requirements/01-prd.md](./docs/01-requirements/01-prd.md)** - 产品需求文档
7. **[docs/03-technical-architecture/01-tech-stack.md](./docs/03-technical-architecture/01-tech-stack.md)** - 技术架构说明
8. **[docs/09-development-guidelines/02-development-standards.md](./docs/09-development-guidelines/02-development-standards.md)** - 开发规范详细版

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
2. **不要修改 `.env.local`** - 这是本地配置，不应提交
3. **不要跳过 lint 检查** - 提交前必须通过 lint
4. **不要硬编码配置值** - 所有配置应从环境变量读取
5. **不要手动修改 prisma/migrations/** - 使用 Prisma CLI 生成

## 🔧 Docker 部署

项目提供完整的容器化部署方案：

**配置文件位置：**

- `Dockerfile.server` - 后端服务（根目录）
- `Dockerfile.admin` - 后台管理（根目录）
- `docker-compose.yml` - 多容器编排（根目录）
- `docker/nginx.conf` - Nginx配置（docker目录）

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
cp .env.example .env.local
docker-compose up -d --build

# 生产环境（不暴露数据库端口）
# 在.env.local中设置: EXPOSE_DB_PORT= EXPOSE_REDIS_PORT=
docker-compose up -d
```

**访问地址：**

- Admin前端: http://localhost:80
- API服务: http://localhost:3001
- API文档: http://localhost:3001/api-docs (仅开发环境)

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

---

**最后更新**: 2026-07-16  
**维护者**: PetCare 开发团队
