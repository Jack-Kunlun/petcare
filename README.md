# PetCare宠伴 🐾

双模式O2O宠物服务平台 - C2C悬赏 + B2C平台定价

## 技术栈

- **Monorepo**: Turborepo + pnpm
- **Admin前端**: React 19 + Vite + shadcn/ui + TailwindCSS
- **后端服务**: Nest.js + Prisma + PostgreSQL + Redis
- **小程序**: Taro 4.x + React 18 + MobX

## 项目结构

```
petcare-monorepo/
├── apps/                    # 应用层
│   ├── admin/              # 后台管理系统
│   ├── server/             # 后端服务
│   └── miniapp/            # 小程序端
├── packages/               # 共享包
│   ├── shared-types/       # 共享类型定义
│   ├── shared-utils/       # 共享工具函数
│   └── api-client/         # API客户端封装
└── docs/                   # 项目文档
```

## 快速开始

### 前置要求

- Node.js >= 20.0.0（推荐使用 `.nvmrc` 锁定的版本）
- pnpm >= 8.0.0
- PostgreSQL >= 15.0
- Redis >= 7.0

### 安装依赖

```bash
pnpm install
```

### 环境变量配置

项目使用独立的环境变量配置，复制示例文件并填写实际值：

```bash
cp .env.example apps/server/.env.local
```

**主要配置项：**

- **数据库配置**：`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_SCHEMA`
- **Redis配置**：`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- **JWT配置**：`JWT_SECRET`, `JWT_EXPIRES_IN`
- **第三方服务**：微信、阿里云OSS等

详见：[环境变量配置指南](./docs/environment-variables.md)

### 开发环境启动

```bash
# 启动所有应用
pnpm dev

# 单独启动某个应用
pnpm dev --filter=admin
pnpm dev --filter=server
pnpm dev --filter=miniapp
```

### 构建

```bash
# 构建所有应用
pnpm build

# 单独构建某个应用
pnpm build --filter=admin
```

### 测试

```bash
# 运行单元测试
pnpm test

# 运行E2E测试
pnpm test:e2e
```

## 开发规范

项目使用统一的代码规范和工具链：

- **EditorConfig**: `.editorconfig` - 跨平台编辑器配置（Mac/Windows/Linux）
- **Prettier**: `.prettierrc.json` - 代码格式化（双引号、2空格缩进）
- **ESLint**: `eslint.base.config.js` - 基础ESLint配置，所有子项目继承
- **Commitlint**: `commitlint.config.js` - Git commit消息规范
- **Husky**: `.husky/` - Git hooks自动化检查（提交前自动格式化和lint）

### 常用命令

```bash
# 格式化代码
pnpm format

# 检查代码规范
pnpm lint

# 运行所有测试
pnpm test
```

详见：[开发规范文档](./docs/09-development-guidelines/02-development-standards.md)

## 后端配置说明

### ConfigService 架构

后端服务使用统一的 `ConfigService` 管理所有环境变量，提供类型安全的配置访问方式。

**核心文件：**

- `apps/server/src/config/config.service.ts` - 配置服务实现
- `apps/server/src/config/config.module.ts` - 全局配置模块
- `apps/server/src/config/redis.service.ts` - Redis服务示例

**使用方式：**

```typescript
// 在Module中导入ConfigModule
import { ConfigModule } from "../../config/config.module";

@Module({
  imports: [ConfigModule],
  // ...
})

// 在Service中注入并使用
constructor(private configService: ConfigService) {}

const dbUrl = this.configService.databaseUrl;
const jwtSecret = this.configService.jwtSecret;
```

**优势：**

- ✅ 类型安全 - 所有配置有明确的返回类型
- ✅ 默认值管理 - 集中管理配置默认值
- ✅ 易于测试 - 可以mock ConfigService
- ✅ 统一入口 - 所有配置访问都通过ConfigService

详见：[环境变量配置指南](./docs/environment-variables.md)

## 文档

- **[文档索引](./docs/INDEX.md)** 📚 - 完整文档导航
- [产品需求文档](./docs/01-requirements/01-prd.md)
- [用户故事](./docs/01-requirements/02-user-stories.md)
- [竞品分析](./docs/01-requirements/03-competitive-analysis.md)
- **[原型规格文档(v41)](./docs/01-requirements/04-prototype-specification.md)**
- [技术架构](./docs/03-technical-architecture/01-tech-stack.md)
- **[API接口规范](./docs/06-api-specification/api-specification.md)** 📡
- [开发规范](./docs/09-development-guidelines/02-development-standards.md)
- **[部署指南](./docs/08-deployment/deployment.md)** ⭐
- **[部署架构图](./docs/08-deployment/deployment-architecture.html)** 🎨
- [安全审计](./SECURITY-AUDIT.md)
- [安全检查清单](./SECURITY-CHECKLIST.md)

## 🚀 Docker 部署

项目提供完整的容器化部署方案：

**配置文件：**

- `Dockerfile.server` - 后端服务多阶段构建
- `Dockerfile.admin` - 后台管理多阶段构建（含Nginx）
- `docker-compose.yml` - 多容器编排（PostgreSQL + Redis + Server + Admin）
- `docker/nginx.conf` - Nginx反向代理配置

**快速启动：**

```bash
# 使用 Docker Compose 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f server

# 停止所有服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v
```

**访问地址：**

- 后台管理系统: http://localhost:80
- API服务: http://localhost:3001
- API文档: http://localhost:3001/api-docs

## License

MIT
