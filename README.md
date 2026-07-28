# PetCare宠伴 🐾

双模式O2O宠物服务平台 - C2C悬赏 + B2C平台定价

## 技术栈

- **Monorepo**: Turborepo + pnpm
- **Admin前端**: React 19 + Vite + shadcn/ui + TailwindCSS
- **后端服务**: Nest.js + Prisma + PostgreSQL + Redis
- **小程序**: Taro 4.x + React 18 + React Context

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

- Node.js 22.x（使用 `.nvmrc` 锁定）
- pnpm 11.x（项目锁定 `pnpm@11.15.1`）
- PostgreSQL >= 15.0
- Redis >= 7.0

### 安装依赖

```bash
pnpm install
```

### 环境变量配置

项目使用独立的环境变量配置。本地开发统一读取根目录 `.env`：

```bash
cp .env.example .env
```

**主要配置项：**

- **数据库配置**：`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_SCHEMA`
- **Redis配置**：`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- **JWT配置**：`JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- **管理员认证**：`DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PHONE`, `DEFAULT_ADMIN_PASSWORD`, `SMS_DEV_CODE`, `CAPTCHA_TTL_SECONDS`, `CAPTCHA_MAX_ATTEMPTS`
- **第三方服务**：微信、阿里云OSS等
- **小程序 API**：`TARO_APP_API_BASE_URL`（本地默认 `http://localhost:3000`）

详见：[环境变量配置指南](./docs/environment-variables.md)

### 开发环境启动

先启动本地依赖容器，再同步数据库并初始化默认管理员：

```bash
docker compose up -d postgres redis
pnpm --filter @petcare/server prisma:push
pnpm --filter @petcare/server prisma:seed
```

当 Server 在宿主机运行时，根 `.env` 中应使用 `DB_HOST=localhost`、`REDIS_HOST=localhost`。然后可直接从根目录启动：

```bash
# 启动所有应用
pnpm dev

# 单独启动某个应用
pnpm dev:admin
pnpm dev:server
pnpm dev:miniapp
```

本地地址：Admin `http://localhost:8986`，Server `http://localhost:3000`。默认管理员支持“手机号或账号 + 密码”以及“手机号 + 验证码”两种登录方式。发送短信验证码前需要先填写图形验证码；点击验证码图片可以换一张。

小程序微信登录联调时，先执行 `pnpm dev:server` 和 `pnpm dev:miniapp`，再在微信开发者工具中导入
`apps/miniapp`。AppID 已写入公开的项目配置；AppSecret 只能放在根目录 `.env` 的
`WECHAT_APP_SECRET` 中。开发工具可关闭域名校验，本地请求直连 Server `3000` 端口；生产环境必须使用
已在微信公众平台登记的 HTTPS request 域名。

### API 响应协议

Server 的 JSON 接口统一返回 `{ code, message, data, meta }`：成功业务码为 `SUCCESS`，错误使用稳定的字符串业务码并保留正确的 HTTP 状态；`meta.requestId` 与响应头 `X-Request-Id` 始终一致。Admin 和共享 API Client 会在 HTTP 边界统一解包，业务代码直接消费 `data`。

- Swagger UI：<http://localhost:3000/api-docs>
- 健康检查：<http://localhost:3000/health>
- 完整规范：[API 接口规范](./docs/06-api-specification/01-api-specification.md)

### 构建

```bash
# 构建所有应用
pnpm build

# 单独构建某个应用
pnpm build:admin
pnpm build:server
pnpm build:miniapp
```

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
- **Husky**: `.husky/` - Git hooks自动化检查（提交前自动格式化和lint）

### 常用命令

```bash
# 格式化代码
pnpm format

# 检查代码规范
pnpm lint

# 检查类型
pnpm typecheck

# 运行所有测试
pnpm test

# 完整质量门禁
pnpm check
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
- ✅ 启动失败快 - 监听端口前集中校验必填值、端口、JWT 和允许来源
- ✅ 可选集成成组校验 - 微信与 OSS 未启用时允许为空，启用后必须提供完整合法配置

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

## 🚀 Docker 部署

项目提供完整的容器化部署方案：

**配置文件：**

- `Dockerfile.server` - 后端服务多阶段构建
- `Dockerfile.admin` - 后台管理多阶段构建（含Nginx）
- `docker-compose.yml` - 多容器编排（PostgreSQL + Redis + Server + Admin）
- `docker/nginx.conf` - Nginx反向代理配置

**快速启动：**

```bash
# Docker Compose 读取项目根目录的 .env 文件
cp .env.example .env

# 将示例敏感值替换为当前环境的独立强密钥后先校验配置
docker compose config --quiet

# 使用 Docker Compose 启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f server

# 停止所有服务
docker compose down

# 停止并删除数据卷
docker compose down -v
```

**访问地址：**

- 后台管理系统: http://localhost:8986
- API服务: http://localhost:3000
- API文档: 仅宿主机开发模式提供 http://localhost:3000/api-docs
- 健康检查: http://localhost:3000/health

## License

MIT
