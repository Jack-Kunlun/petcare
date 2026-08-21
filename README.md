# PetCare宠伴 🐾

双模式O2O宠物服务平台 - C2C悬赏 + B2C平台定价

## 技术栈

- **Monorepo**: Turborepo + pnpm
- **Admin前端**: React 19 + Vite + shadcn/ui + TailwindCSS
- **项目官网**: Astro SSR + TailwindCSS，通过 Admin 管理预设区块并显式发布
- **后端服务**: Nest.js + Prisma + PostgreSQL + Redis
- ~~**小程序**: Taro 4.x + React 18 + React Context（已弃用）~~
- **跨端客户端**: Miniapp 项目（UniApp + Vue 3 + Wot UI + UnoCSS）

### Taro 弃用说明

项目自 2026-08-11 起只维护 `apps/miniapp`，其技术框架为 UniApp。同时保留 Taro 与 UniApp 会重复维护依赖、构建链、样式规则、质量门禁和使用文档，因此已删除原 Taro 客户端。原 Taro 页面和认证能力没有迁移，后续必须在 Miniapp 项目中重新实现。

## 项目结构

```

~~旧客户端目录：`apps/miniapp`（Taro）~~
petcare-monorepo/
├── apps/                    # 应用层
│   ├── admin/              # 后台管理系统
│   ├── miniapp/            # UniApp 跨端客户端：H5、微信小程序和移动 App
│   ├── server/             # 后端服务
│   └── website/            # Astro SSR 项目官网
├── packages/               # 共享包
│   ├── shared-types/       # 共享类型定义
│   ├── shared-utils/       # 共享工具函数
│   └── api-client/         # API客户端封装
└── docs/                   # 项目文档
```

## 快速开始

### 前置要求

- Node.js 24.19.x（使用 `.nvmrc` 锁定，最低支持 24.12.0）
- pnpm 11.x（项目锁定 `pnpm@11.15.1`）
- PostgreSQL >= 15.0
- Redis >= 7.0

### 首次启动

1. 启用 Corepack，并安装项目 `packageManager` 字段声明的 pnpm 版本：

```bash
corepack enable
corepack install
```

`pnpm-workspace.yaml` 会在本机 pnpm 版本不同时自动下载项目声明的版本，
因此无需手动把全局 pnpm 降级。项目只允许 pnpm 安装依赖；
`npm install`、`yarn install` 和 `bun install` 会被拒绝。

2. 按锁文件安装依赖：

```bash
pnpm install --frozen-lockfile
```

Node 和 pnpm 的严格校验策略位于 `pnpm-workspace.yaml`。项目级 `.npmrc` 仅用于本地
registry 认证且不提交；请将 token 保存在 pnpm 用户级认证配置或 CI 密钥中。

3. 创建本地配置：

```bash
cp .env.example .env
```

PowerShell：

```powershell
Copy-Item .env.example .env
```

至少替换 `.env` 中的 `DB_PASSWORD`、`REDIS_PASSWORD`、`JWT_SECRET`、
`DEFAULT_ADMIN_PHONE` 和 `DEFAULT_ADMIN_PASSWORD`。本地 Server 连接容器时保持
`DB_HOST=localhost`、`REDIS_HOST=localhost`、`EXPOSE_DB_PORT=5432` 和
`EXPOSE_REDIS_PORT=6379`。

4. 启动 PostgreSQL 和 Redis，然后初始化数据库：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis
# 空数据库初始化，以及之后每次生产 Schema 发布
pnpm --filter @petcare/server prisma:migrate:deploy
# 仅在需要首次基础数据时显式执行
pnpm --filter @petcare/server prisma:seed
```

`prisma:migrate:deploy` 是空数据库初始化和生产 Schema 发布的唯一命令；`prisma:seed` 只用于显式
初始化首次基础数据。`prisma:push` 仅可用于可丢弃的本地 Schema 实验，绝不属于部署流程。

5. 启动 Admin、Server、Miniapp H5 和 Website 开发服务：

```bash
pnpm dev
```

启动后可访问 Admin <http://localhost:8986>、官网 Astro SSR <http://localhost:4321>、
Server <http://localhost:3000>、Swagger <http://localhost:3000/api-docs> 和健康检查
<http://localhost:3000/health>、流量就绪检查 <http://localhost:3000/ready>。全容器官网入口为
<http://localhost:8080>。

Miniapp 的微信小程序端需单独运行：

```bash
pnpm dev:miniapp:mp-weixin
```

然后在微信开发者工具中导入 `apps/miniapp/dist/dev/mp-weixin`。

### 日常启动

完成首次初始化后，日常开发只需：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis
pnpm dev
```

也可单独启动：

```bash
pnpm dev:admin
pnpm dev:server
pnpm dev:website
pnpm dev:miniapp:h5
pnpm dev:miniapp:mp-weixin
```

### 升级 pnpm

pnpm 版本不跟随开发者的全局安装自动漂移。升级由维护者显式执行：

```bash
corepack use pnpm@<目标版本>
pnpm install
pnpm check
```

`corepack use` 会更新根 `package.json` 的 `packageManager` 并安装依赖。审查并提交
`package.json`、`pnpm-lock.yaml` 的变化后，本地、CI 和 Docker 就会统一使用新版本。

如需重置本地依赖，可一键删除根目录以及所有 `apps/*`、`packages/*`
工作区中的 `node_modules`：

```bash
pnpm clean:modules
```

该命令不会删除 pnpm 全局 store，执行后需重新运行 `pnpm install`。

### 环境变量配置

项目使用独立的环境变量配置。本地开发统一读取根目录 `.env`：

**主要配置项：**

- **数据库配置**：`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_SCHEMA`
- **Redis配置**：`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- **JWT配置**：`JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- **管理员认证**：`DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PHONE`, `DEFAULT_ADMIN_PASSWORD`, `SMS_DEV_CODE`, `CAPTCHA_TTL_SECONDS`, `CAPTCHA_MAX_ATTEMPTS`
- **第三方服务**：微信、腾讯云 COS；管理员公开头像与官网公开素材共享同一套 COS 配置
- **官网 SSR**：`WEBSITE_PUBLIC_URL`、仅服务端使用的 `WEBSITE_CONTENT_API_BASE_URL`、预览/缓存 TTL 与网关端口
- ~~**小程序 API**：`TARO_APP_API_BASE_URL`（已随 Taro 项目移除）~~

详见：[环境变量配置指南](./docs/environment-variables.md)

默认管理员支持“手机号或账号 + 密码”以及“手机号 + 验证码”两种登录方式。发送短信验证码前需要先填写图形验证码；点击验证码图片可以换一张。

### API 响应协议

Server 的 JSON 接口统一返回 `{ code, message, data, meta }`：成功业务码为 `SUCCESS`，错误使用稳定的字符串业务码并保留正确的 HTTP 状态；`meta.requestId` 与响应头 `X-Request-Id` 始终一致。Admin 和共享 API Client 会在 HTTP 边界统一解包，业务代码直接消费 `data`。

- Swagger UI：<http://localhost:3000/api-docs>
- 进程存活检查：<http://localhost:3000/health>
- 流量就绪检查：<http://localhost:3000/ready>
- 完整规范：[API 接口规范](./docs/06-api-specification/01-api-specification.md)

### 构建

```bash
# 构建所有应用
pnpm build

# 单独构建某个应用
pnpm build:admin
pnpm build:server
pnpm build:website
pnpm build:miniapp:mp-weixin
```

本地验证官网 standalone 产物时，先执行 `pnpm build:website`，再运行 `pnpm start:website`。

~~旧命令：`pnpm build:miniapp`~~

### 测试

```bash
# 运行单元测试
pnpm test

# 运行类型检查
pnpm typecheck

# 运行E2E测试
pnpm test:e2e

# 执行格式、Lint、类型、单测和构建完整门禁
pnpm check
```

## 开发规范

项目使用统一的代码规范和工具链：

- **EditorConfig**: `.editorconfig` - 跨平台编辑器配置（Mac/Windows/Linux）
- **Prettier**: `.prettierrc.json` - 代码格式化（双引号、2空格缩进）
- **ESLint**: `packages/eslint-config-base` - 共享基础配置，所有子项目继承
- **Commitlint**: `commitlint.config.js` - Git commit消息规范
- **Husky**: `.husky/` - Git hooks自动化检查（提交前格式化、lint、类型检查和E2E）
- ~~**Tailwind CSS v4**: Admin 与 Taro Miniapp 共用 CSS-first 规则（已弃用）~~
- **样式工具链**: Admin 与 Website 使用 Tailwind CSS v4；Miniapp 使用 UnoCSS 与 Wot UI

### 常用命令

```bash
# 格式化代码
pnpm format

# 检查代码规范
pnpm lint

# 检查双端 Tailwind 主题、类名和样式边界
pnpm lint:styles

# 检查类型
pnpm typecheck

# 运行所有测试
pnpm test

# 运行提交前门禁（不执行完整构建）
pnpm commit:check

# 完整质量门禁
pnpm check
```

详见：[开发规范文档](./docs/09-development-guidelines/02-development-standards.md)、
[双端样式开发规范](./docs/09-development-guidelines/04-styling-standards.md)。

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
- ✅ 启动失败快 - 监听端口前集中校验必填值、端口、JWT 和允许来源
- ✅ 可选集成成组校验 - 微信与腾讯云 COS 未启用时允许为空，启用后必须提供完整合法配置；COS 五项均留空时禁用公开头像和官网素材上传

详见：[环境变量配置指南](./docs/environment-variables.md)

## 文档

- **[文档索引](./docs/INDEX.md)** 📚 - 完整文档导航
- [产品需求文档](./docs/01-requirements/01-prd.md)
- [用户故事](./docs/01-requirements/02-user-stories.md)
- [竞品分析](./docs/01-requirements/03-competitive-analysis.md)
- **[原型规格文档(v41)](./docs/01-requirements/04-prototype-specification.md)**
- [技术架构](./docs/03-technical-architecture/01-tech-stack.md)
- **[API接口规范](./docs/06-api-specification/01-api-specification.md)** 📡
- [开发规范](./docs/09-development-guidelines/02-development-standards.md)
- **[部署指南](./docs/08-deployment/deployment.md)** ⭐
- **[部署架构图](./docs/08-deployment/deployment-architecture.html)** 🎨
- [安全审计](./SECURITY-AUDIT.md)
- [安全检查清单](./SECURITY-CHECKLIST.md)

## 🚀 Docker 本地诊断

生产环境只有一个受支持的发布入口：先在 Linux 服务器执行 `scripts/server-init.sh`，之后由 GitHub Actions 手动
触发 `deploy.yml`。完整步骤见[手动部署指南](./docs/08-deployment/github-actions-deploy.md)。不要在服务器上
执行本地构建、`docker compose build` 或旧的 tarball 部署脚本。

以下命令只用于可丢弃的本地 Docker 诊断；本地 HTTP 地址不能作为生产访问方式。

**配置文件：**

- `Dockerfile.server` - 后端服务多阶段构建
- `Dockerfile.admin` - 后台管理多阶段构建（含Nginx）
- `Dockerfile.website` - 官网 Astro standalone SSR 多阶段构建（非 root 运行）
- `docker-compose.yml` - 多容器编排（PostgreSQL + Redis + Server + Admin + Website）
- `docker/nginx.conf` - Admin 静态站点 Nginx 配置
- `docker/website-nginx.conf` - 官网独立 Nginx 网关，只暴露页面与已发布公共内容读取

**快速启动：**

```bash
# Docker Compose 读取项目根目录的 .env 文件
cp .env.example .env

# 只启动本地开发需要的基础设施
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis
pnpm dev
```

本地诊断地址仅限开发：Admin <http://localhost:8986>、官网 <http://localhost:4321>、Server
<http://localhost:3000>。生产 HTTPS 地址、备份、回滚与外部前置条件见[部署指南](./docs/08-deployment/deployment.md)。

## License

MIT
