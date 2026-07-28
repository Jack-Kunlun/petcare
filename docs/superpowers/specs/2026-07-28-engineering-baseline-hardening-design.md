# PetCare 工程基线加固设计

**日期**：2026-07-28  
**状态**：已确认，待实施

## 1. 背景

PetCare 已具备 Monorepo、三端应用、共享包、Docker Compose、代码检查和测试等基础设施，但各工作区的命令契约、环境变量入口、持续集成及端到端测试尚未形成统一闭环。当前主要问题包括：

- 根目录命令没有完整覆盖 Admin、Server、Miniapp 和共享包；
- 工作区缺少统一的 `dev`、`build`、`typecheck`、`test:coverage`、`clean` 生命周期；
- 清理脚本依赖 Unix 命令，Windows 下不可移植；
- Turbo 的任务输出和环境变量声明不准确；
- 本地配置文件约定在 `.env`、`.env.local` 之间不一致；
- Server 缺少集中式启动配置校验，生产 Docker 配置仍允许弱默认值；
- 仓库没有 GitHub Actions、Dependabot 和可运行的 Server E2E 基线；
- Admin Playwright 端口与实际开发端口不一致，现有用例没有覆盖真实登录链路；
- Commitlint、Husky、换行符和模块配置仍存在一致性问题。

本设计建立一套可在 Windows 本地开发、GitHub Actions 和 Docker 构建环境中复用的工程基线。

## 2. 目标与非目标

### 2.1 目标

- 统一根目录与各工作区的命令接口；
- 让 `pnpm check` 成为本地和 CI 共用的完整质量入口；
- 明确本地、测试和生产环境变量的加载与校验边界；
- 建立覆盖代码质量、单元测试、构建、真实 E2E 和容器构建的分层 CI；
- 固化中文 Conventional Commits、Git Hooks 和依赖维护规则；
- 修复已发现的端口、换行符、ESLint 模块告警和 Turbo 缓存配置问题。

### 2.2 非目标

- 不重构现有业务模块和领域模型；
- 不引入新的配置框架，继续使用现有 `ConfigService`；
- 不扩充浏览器矩阵，E2E 仅使用 Chromium；
- 不在 CI 中部署应用或长期运行容器；
- 不将真实微信、短信、对象存储或生产密钥写入仓库。

## 3. 命令与构建契约

### 3.1 工作区标准命令

所有可执行应用和共享包统一暴露以下生命周期；不适用的任务应提供真实、轻量且可验证的实现，不使用无意义的常驻进程：

| 命令            | 语义                                   |
| --------------- | -------------------------------------- |
| `dev`           | 启动应用开发模式或包的必要开发任务     |
| `build`         | 生成可发布产物或完成包级编译校验       |
| `typecheck`     | 仅执行 TypeScript 类型检查，不生成产物 |
| `lint`          | 执行 ESLint 检查                       |
| `test`          | 执行单元测试，不伪造覆盖率产物         |
| `test:coverage` | 执行单元测试并生成覆盖率               |
| `clean`         | 删除该工作区可再生的构建与缓存产物     |

Miniapp 的内部脚本统一使用 `pnpm`，避免在 pnpm 工作区中继续嵌套调用 `npm run`。

### 3.2 根目录命令

根目录提供以下稳定入口：

| 命令             | 行为                                             |
| ---------------- | ------------------------------------------------ |
| `pnpm dev`       | 并行启动 Admin、Server 和 Miniapp 微信开发监听   |
| `pnpm build`     | 构建 Admin、Server、Miniapp 微信端及全部共享包   |
| `pnpm typecheck` | 对所有工作区执行类型检查                         |
| `pnpm lint`      | 对所有工作区和根级配置执行 ESLint                |
| `pnpm test`      | 执行所有工作区单元测试                           |
| `pnpm test:e2e`  | 执行 Server E2E 与 Admin Playwright E2E          |
| `pnpm check`     | 依次执行格式检查、Lint、类型检查、单元测试和构建 |
| `pnpm clean`     | 跨平台清理所有可再生产物和 Turbo 缓存            |

共享包不参加根级 `dev` 常驻监听，除非其代码生成确有开发期依赖。根级清理通过仓库内 Node 脚本实现，不使用 `rm -rf`、Shell 通配删除或新增 `rimraf` 依赖。

### 3.3 Turbo 任务模型

Turbo 配置遵循以下原则：

- `build` 明确声明真实产物目录和上游依赖；
- `test` 不声明 `coverage/**` 输出；
- `test:coverage` 单独声明覆盖率输出；
- `lint`、`typecheck` 和普通 `test` 作为无产物任务缓存；
- 开发任务不缓存且保持常驻；
- 显式声明会影响任务结果的环境变量和环境文件；
- Miniapp 构建参与根级任务图，不再被排除。

## 4. 环境变量与启动校验

### 4.1 本地配置约定

根目录 `.env` 是本地 Docker 和 Server 开发的标准配置入口，`.env.example` 是可提交的完整模板。文档、脚本和 Compose 示例统一使用这一约定，不再混用根目录 `.env.local`。

客户端仅接收其构建所需且允许公开的变量。服务端密钥、数据库凭据和 Redis 密码不得注入前端构建。

### 4.2 Server 启动校验

继续使用现有 `ConfigService`，增加集中式启动校验，由 `main.ts` 在监听端口前执行。校验范围包括：

- 数据库主机、端口、用户名、密码、数据库名和 Schema；
- Redis 主机、端口及认证配置；
- JWT 密钥、有效期和生产环境强度要求；
- 默认管理员账号、手机号、密码和角色初始化参数；
- Server 端口及允许来源等基础运行参数。

微信和对象存储配置保持可选：未启用相应能力时允许为空；一旦提供或显式启用，则校验格式和必需字段组合。配置错误必须在启动阶段以清晰错误信息失败，不能延迟到首次请求。

### 4.3 生产 Docker 安全边界

生产模式 Compose 不为数据库密码、Redis 密码、JWT 密钥和管理员默认密码提供弱回退值。缺少必填值时，Compose 插值或 Server 启动校验应立即失败。

开发专用短信验证码不得被生产 Compose 默认启用。CI 只使用隔离的测试凭据，任何真实 AppSecret、生产密钥或个人凭据都不写入工作流和版本库。

## 5. 持续集成设计

GitHub Actions 使用 pnpm 冻结锁文件安装，并拆分为可独立定位失败原因的任务。

### 5.1 `quality`

- 校验 Prettier；
- 执行 ESLint；
- 执行所有工作区 TypeScript 类型检查；
- 校验提交信息格式和中文主题。

### 5.2 `unit-test`

- 执行 Admin Vitest；
- 执行 Server Jest；
- 执行 Miniapp Jest；
- 执行共享包测试；
- 不以伪造或空覆盖率目录满足 Turbo 输出。

### 5.3 `build`

- 构建 Admin；
- 构建 Server；
- 构建 Miniapp 微信端；
- 构建全部共享包。

### 5.4 `e2e`

E2E Job 使用 PostgreSQL 和 Redis 服务容器，流程如下：

1. 等待服务健康；
2. 使用测试环境变量执行 Prisma `db push` 和 seed；
3. 执行 Server E2E，至少验证 `/health` 及统一响应包装；
4. 启动 Server `3000` 端口和 Admin `8986` 端口；
5. 使用 Chromium 执行 Playwright；
6. 通过默认管理员真实登录，验证登录成功、控制台加载和核心导航；
7. 失败时上传 Playwright 报告、截图、视频或 trace 等诊断产物。

Admin Playwright 的 `baseURL`、Web Server 命令和端口必须与 Vite 的 `8986` 配置一致；API 继续使用 Server `3000` 端口。

### 5.5 `docker`

- 校验 Docker Compose 配置；
- 构建 Server 和 Admin 镜像；
- 不在 CI 中长期运行生产容器。

Pull Request 执行 `quality`、`unit-test`、`build` 和 `e2e`；合入 `master` 后额外执行 `docker`。各 Job 独立执行，失败直接阻断合并或主分支构建。

## 6. 提交、Hooks 与仓库维护

### 6.1 提交信息

提交格式统一为：

```text
type(scope): 中文描述
```

`scope` 可省略，`type` 遵循 Conventional Commits。Commitlint 在保留 Conventional Commits 结构校验的同时，要求主题包含中文字符。发布脚本产生的自动提交也使用中文描述。

为自定义校验增加最小测试，至少覆盖：

- 合法中文主题可通过；
- 英文主题被拒绝；
- 非法 type 或空主题被拒绝。

### 6.2 Git Hooks

Husky 统一使用 `pnpm exec` 调用本地工具，不通过 `npx` 临时解析或下载依赖。提交前继续执行 lint-staged，提交信息阶段执行 Commitlint。

### 6.3 文件与模块配置

- `.gitattributes` 对 `.bat`、`.cmd` 使用 CRLF，其他文本默认 LF，与 `.editorconfig` 保持一致；
- Server ESLint 配置使用 `.mjs` 扩展名，消除 Node 对 ESM 配置文件的模块类型告警；
- 不通过全局关闭告警掩盖配置问题。

### 6.4 依赖维护

增加 Dependabot，每周检查：

- pnpm 依赖；
- Docker 基础镜像；
- GitHub Actions。

自动更新仍需通过完整 CI，不自动绕过测试或合并策略。

## 7. 预计影响范围

实施阶段预计会修改：

- 根目录及各工作区 `package.json`；
- `turbo.json`、TypeScript、ESLint、Prettier 和 Playwright 配置；
- `.env.example`、Docker Compose、Dockerfile 及相关文档；
- Server `ConfigService`、启动入口和 E2E 测试；
- Admin Playwright 用例；
- Husky、Commitlint、`.gitattributes`；
- `.github/workflows/` 与 `.github/dependabot.yml`；
- 跨平台清理脚本及其测试。

业务 API、数据库模型和页面功能不在本次架构加固范围内，除非是让既有登录链路可被 E2E 稳定验证所必需的测试适配。

## 8. 错误处理与可诊断性

- 配置缺失或格式错误在 Server 启动前失败，并指出变量名称和约束；
- CI 每个阶段使用独立 Job 名称，避免单一长命令掩盖失败来源；
- 服务容器必须配置健康检查；
- E2E 失败保留浏览器诊断产物，服务启动失败保留控制台日志；
- Docker 配置缺失生产必填值时立即失败；
- 本地命令与 CI 命令共享同一脚本入口，避免出现“本地通过、CI 使用另一套命令”的分叉。

## 9. 验收标准

实施完成后必须满足：

1. `pnpm check` 在 Node 22 和 pnpm 11 环境中通过；
2. `pnpm dev` 可从根目录同时启动 Admin、Server 和 Miniapp 微信监听，端口分别符合 Admin `8986`、Server `3000` 的约定；
3. `pnpm build` 实际包含 Admin、Server、Miniapp 微信端和共享包；
4. `pnpm test` 与 `pnpm test:coverage` 语义分离，Turbo 不再报告虚假覆盖率输出；
5. Server 配置错误会在监听端口前失败，可选集成未启用时不误报；
6. Server E2E 可在 PostgreSQL、Redis 和初始化数据就绪后验证健康接口与统一响应；
7. Admin Playwright 可通过默认管理员完成真实登录并进入控制台；
8. GitHub Actions 工作流和 Dependabot 配置语法有效；
9. Docker Compose 可在完整测试配置下通过解析，并在缺少生产必填密钥时快速失败；
10. Commitlint 接受符合格式的中文提交并拒绝纯英文主题；
11. Husky 不再使用 `npx`，Server ESLint 启动不再出现模块类型告警；
12. 换行符策略在 Git、EditorConfig 和格式化工具之间一致；
13. `git diff --check` 通过，测试及构建不遗留未跟踪的可再生产物。
